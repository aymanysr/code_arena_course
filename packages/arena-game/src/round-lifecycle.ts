import {
  canTransition,
  compareSides,
  groupEarnedBp,
  matchSum,
  publishRoundReveal,
  type RevealCause,
  roundScoreBp,
  roundScoreFromBp,
} from "arena-model";
import { isCompetitiveVerdict, type ExecutionStatus } from "./judge.js";
import { IllegalStateError } from "./match-authority.js";
import type { CountedResult, GroupResult, MatchRecord, RevealSnapshot, RoundState, SideId } from "./records.js";

/** Judge output that the Game turns into a scored Match result. */
export interface SealedVerdict {
  groups: Array<{
    name: string;
    weight: number;
    results: Array<{ id: string; passed: boolean; status: ExecutionStatus; runtimeMs: number }>;
  }>;
}

export interface ScoredVerdict {
  score: number;
  scoreBp: number;
  groups: GroupResult[];
  testStatuses: ExecutionStatus[];
}

export interface FinalResult {
  scores: Partial<Record<SideId, number>>;
  outcome: "left" | "right" | "draw";
  winner: SideId | null;
  forfeit: MatchRecord["forfeit"];
}

export interface RoundAdvance {
  completed: boolean;
  previousRoundId: string | null;
  activityResets: SideId[];
}

export interface RevealInput {
  scores: Partial<Record<SideId, number>>;
  groups: RevealSnapshot["groups"];
  totals: Partial<Record<SideId, number>>;
  publishedAt: number;
}

/**
 * Match/Round state machine rules that do not need persistence, sockets, or
 * judge execution. ArenaEngine keeps the transport-facing facade and owns
 * locking/events; this module owns the deeper Round transitions and scoring
 * invariants behind that facade.
 */
export class RoundLifecycle {
  startRound(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "ROUND_INTRO")) {
      throw new IllegalStateError(`cannot start round in ${match.roundPhase}`);
    }
    match.roundPhase = "ROUND_INTRO";
  }

  beginCoding(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "CODING")) {
      throw new IllegalStateError(`cannot begin coding in ${match.roundPhase}`);
    }
    match.roundPhase = "CODING";
    const round = this.currentRound(match);
    for (const side of Object.keys(round.activities)) round.activities[side] = "coding";
  }

  beginReveal(match: MatchRecord): void {
    const round = this.currentRound(match);
    if (match.roundPhase !== "CODING") {
      throw new IllegalStateError(`reveal rejected in ${match.roundPhase}`);
    }
    // A deadline reveal with zero submissions is valid. The flag closes the
    // acceptance gate while in-flight evaluations finish during grace.
    round.closing = true;
  }

  prepareReveal(
    match: MatchRecord,
    settledEvaluationIds: ReadonlySet<string>,
    inFlightEvaluationIds: readonly string[],
  ): void {
    const round = this.currentRound(match);
    if (match.roundPhase !== "CODING") {
      throw new IllegalStateError(`reveal rejected in ${match.roundPhase}`);
    }
    round.cutoffPassed = true;
    for (const evaluationId of inFlightEvaluationIds) {
      if (!settledEvaluationIds.has(evaluationId)) round.superseded.push(evaluationId);
    }
  }

  prepareDeadlineReveal(
    match: MatchRecord,
    settledEvaluationIds: ReadonlySet<string>,
    inFlightEvaluationIds: readonly string[],
  ): void {
    if (match.roundPhase === "CODING") {
      this.prepareReveal(match, settledEvaluationIds, inFlightEvaluationIds);
      return;
    }
    if (match.roundPhase !== "MATCH_FOUND" && match.roundPhase !== "ROUND_INTRO") {
      throw new IllegalStateError(`deadline reveal rejected in ${match.roundPhase}`);
    }
    const round = this.currentRound(match);
    round.cutoffPassed = true;
    for (const evaluationId of inFlightEvaluationIds) {
      if (!settledEvaluationIds.has(evaluationId) && !round.superseded.includes(evaluationId)) {
        round.superseded.push(evaluationId);
      }
    }
  }

  createReveal(match: MatchRecord, input: RevealInput): RevealSnapshot {
    const round = this.currentRound(match);
    return Object.freeze({
      round: match.currentRound,
      roundId: round.roundId,
      scores: Object.freeze({ ...input.scores }),
      groups: Object.freeze({ ...input.groups }),
      totals: Object.freeze({ ...input.totals }),
      publishedAt: input.publishedAt,
    }) as RevealSnapshot;
  }

  commitReveal(match: MatchRecord, snapshot: RevealSnapshot, cause: RevealCause = "REVEAL_CONDITION_MET"): void {
    const round = this.currentRound(match);
    round.reveal = snapshot;
    round.closing = false;
    match.roundPhase = publishRoundReveal(match.roundPhase, cause);
  }

  finishAtDeadline(match: MatchRecord): boolean {
    if (match.roundPhase === "MATCH_COMPLETE") return false;
    if (match.roundPhase !== "SCORE_REVEAL" && match.roundPhase !== "ROUND_COMPLETE") {
      throw new IllegalStateError(`cannot finish expired Match in ${match.roundPhase}`);
    }
    if (!canTransition(match.roundPhase, "MATCH_COMPLETE")) {
      throw new IllegalStateError(`cannot finish expired Match in ${match.roundPhase}`);
    }
    match.roundPhase = "MATCH_COMPLETE";
    return true;
  }

  advance(match: MatchRecord): RoundAdvance {
    const target = match.currentRound >= match.totalRounds ? "MATCH_COMPLETE" : "ROUND_INTRO";
    if (!canTransition(match.roundPhase, target)) {
      throw new IllegalStateError(`cannot advance from ${match.roundPhase}`);
    }
    match.roundPhase = target;
    if (target === "MATCH_COMPLETE") {
      return { completed: true, previousRoundId: null, activityResets: [] };
    }

    const previousRound = this.currentRound(match);
    match.currentRound += 1;
    const round = this.currentRound(match);
    round.counted = {};
    round.attempts = {};
    round.runTests = {};
    round.reveal = null;
    round.closing = false;
    round.cutoffPassed = false;
    round.superseded = [];
    if (match.mode === "2v2") {
      round.readiness = {};
      round.teamDocs ??= {};
      for (const side of Object.keys(round.activities)) {
        round.teamDocs[side] = { revision: 1, language: round.teamDocs[side]?.language ?? "Python" };
      }
    }

    return {
      completed: false,
      previousRoundId: previousRound.roundId,
      activityResets: Object.keys(round.activities).filter((side) => this.activityOf(round, side) !== "coding"),
    };
  }

  scoreVerdict(verdict: SealedVerdict): ScoredVerdict | undefined {
    const testStatuses = verdict.groups.flatMap((group) => group.results.map((result) => result.status));
    if (!testStatuses.every(isCompetitiveVerdict)) return undefined;

    const counts = verdict.groups.map((group) => ({
      weight: group.weight,
      passed: group.results.filter((result) => result.passed).length,
      total: group.results.length,
    }));
    const scoreBp = roundScoreBp(counts);
    const groups = verdict.groups.map((group, index) => {
      const count = counts[index]!;
      const earnedBp = groupEarnedBp(group.weight, count.passed, count.total);
      return {
        name: group.name,
        weight: group.weight,
        earned: roundScoreFromBp(earnedBp),
        earnedBp,
      };
    });
    return { score: roundScoreFromBp(scoreBp), scoreBp, groups, testStatuses };
  }

  computeFinal(match: MatchRecord): FinalResult {
    if (match.forfeit) {
      const scores: Partial<Record<SideId, number>> = {};
      for (const side of Object.keys(match.rounds[0]?.activities ?? {})) {
        scores[side] = matchSum(match.rounds.map((round) => round.counted[side]?.score ?? 0));
      }
      const [left, right] = Object.keys(match.rounds[0]?.activities ?? {});
      const winner = match.forfeit.winner;
      return {
        scores,
        outcome: winner === left ? "left" : winner === right ? "right" : "draw",
        winner,
        forfeit: { ...match.forfeit },
      };
    }

    const sides = Object.keys(match.rounds[0]?.activities ?? {});
    const contributions = (side: SideId) =>
      match.rounds.map((round) => ({
        score: round.counted[side]?.score ?? 0,
        scoringTimeMs: round.counted[side]?.scoringTimeMs ?? 0,
        submissions: round.attempts[side] ?? 0,
      }));
    const [left, right] = sides;
    const outcome = compareSides(contributions(left), contributions(right));
    const scores: Partial<Record<SideId, number>> = {};
    for (const side of sides) scores[side] = matchSum(contributions(side).map((contribution) => contribution.score));
    return { scores, outcome, winner: outcome === "draw" ? null : outcome === "left" ? left : right, forfeit: null };
  }

  totalScore(match: MatchRecord, side: SideId): number {
    return matchSum(match.rounds.slice(0, match.currentRound).map((round) => round.counted[side]?.score ?? 0));
  }

  private currentRound(match: MatchRecord): RoundState {
    const round = match.rounds[match.currentRound - 1];
    if (!round) throw new IllegalStateError(`match ${match.id} has no current round`);
    return round;
  }

  private activityOf(round: RoundState, side: SideId): string {
    return round.activities[side] ?? "coding";
  }
}
