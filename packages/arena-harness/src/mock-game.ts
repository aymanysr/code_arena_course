import { randomUUID } from "node:crypto";
import {
  type ArenaEvent,
  type PlayerStatus,
  type RoundContribution,
  type RoundPhase,
  canRun,
  canSideRun,
  canSideSubmit,
  canSideTransition,
  canSubmit,
  canTransition,
  compareSides,
  matchSum,
  publishRoundReveal,
  roundScoreFromGroups,
} from "arena-model";
import { DEFAULT_LIMITS, type JudgePort, type VisibleVerdict } from "./judge-port.js";
import type { FixtureProblem, MockSession, OpponentRound } from "./fixtures.js";

/**
 * MockGame: in-memory 1v1 lifecycle proving the Week-2 path with fakes.
 * Round lifecycle (arena-model RoundPhase) is global; execution activity
 * (PlayerStatus) is independent per side: one side running/evaluating never
 * freezes the other side. Judging via JudgePort (06 implements it for real);
 * opponent scores are scripted. The driver tests below this file keep their
 * shape when fakes are replaced by HTTP adapters.
 */
export interface SubmitReceipt {
  ok: true;
  round: number;
}

export interface Reveal {
  round: number;
  roundScore: number;
  groups: Array<{ name: string; weight: number; earned: number }>;
  totals: { you: number; opponent: number };
}

/** ponytail: history is the audit trail; counted score is last-wins. Ceiling: in-memory only — production persists Match/Submission/Evaluation rows (spec). */
export interface SubmissionRecord {
  submissionId: string;
  evaluationId: string;
  round: number;
  side: string;
  status: "completed" | "failed";
  score: number | null;
  scoringTimeMs: number;
}

export interface RunRecord {
  runId: string;
  round: number;
  side: string;
}

export type MockSide = "you" | "opponent";

export class MockGame {
  roundPhase: RoundPhase = "ROUND_INTRO";
  round = 1;
  youStatus: PlayerStatus = "coding";
  opponentStatus: PlayerStatus = "coding";
  tests: Array<{ id: string; status: string }> = [];
  failures: string[] = [];
  events: ArenaEvent[] = [];

  readonly matchId: string = randomUUID();
  private readonly roundIds: string[];
  private readonly submissionHistory: SubmissionRecord[] = [];
  private readonly runHistory: RunRecord[] = [];
  private contributions: RoundContribution[] = [];
  private submissionsThisRound = 0;
  private lastGroups: Array<{ name: string; weight: number; earned: number }> | null = null;
  private lastReveal: Reveal | null = null;

  constructor(
    private readonly rounds: FixtureProblem[],
    private readonly judge: JudgePort,
    private readonly opponent: OpponentRound[],
    private readonly clock: () => number = () => Date.now(),
  ) {
    this.roundIds = this.rounds.map(() => randomUUID());
    this.resetTests();
  }

  get totalRounds(): number {
    return this.rounds.length;
  }

  get roundId(): string {
    return this.roundIds[this.round - 1];
  }

  /** Full submission history (completed + failed). Never pruned on overwrite. */
  get submissions(): SubmissionRecord[] {
    return this.submissionHistory.map((s) => ({ ...s }));
  }

  get runs(): RunRecord[] {
    return this.runHistory.map((r) => ({ ...r }));
  }

  /** Completed competitive verdicts this round (tie-break input). Failures and retries never count. */
  get submissionCount(): number {
    return this.submissionsThisRound;
  }

  /** Rounds with a counted score (one per round, last-wins). */
  get countedCount(): number {
    return this.contributions.filter((c) => c !== undefined).length;
  }

  /** Sealed counted score for the current round (null before the first completed evaluation). Harness-only visibility: production never exposes this before SCORE_REVEAL. */
  get countedScore(): number | null {
    return this.contributions[this.round - 1]?.score ?? null;
  }

  get problem(): FixtureProblem {
    return this.rounds[this.round - 1];
  }

  private emit(event: ArenaEvent): void {
    this.events.push(event);
  }

  private setRoundPhase(next: RoundPhase): void {
    if (!canTransition(this.roundPhase, next)) {
      throw new Error(`illegal transition ${this.roundPhase} -> ${next}`);
    }
    this.roundPhase = next;
    this.emit("phase.changed");
  }

  /**
   * ponytail: privileged applier for the game-owned reveal only. Every caller
   * must validate via publishRoundReveal first; generic code uses setRoundPhase.
   */
  private adoptRoundPhase(next: RoundPhase): void {
    this.roundPhase = next;
    this.emit("phase.changed");
  }

  private statusOf(side: MockSide): PlayerStatus {
    return side === "you" ? this.youStatus : this.opponentStatus;
  }

  private setSide(side: MockSide, next: PlayerStatus): void {
    const from = this.statusOf(side);
    if (!canSideTransition(from, next)) {
      throw new Error(`illegal side transition ${side} ${from} -> ${next}`);
    }
    if (side === "you") this.youStatus = next;
    else this.opponentStatus = next;
    this.emit("player.statusChanged");
  }

  private resetTests(): void {
    this.tests = this.problem.visible.map((t) => ({ id: t.id, status: "idle" }));
  }

  startRound(_session: MockSession): void {
    this.setRoundPhase("CODING");
    this.emit("match.clock");
  }

  async run(_session: MockSession, code: string, language: string, side: MockSide = "you"): Promise<VisibleVerdict[]> {
    if (!canRun(this.roundPhase)) throw new Error(`run rejected in ${this.roundPhase}`);
    if (!canSideRun(this.statusOf(side))) throw new Error(`run rejected for ${side} while ${this.statusOf(side)}`);
    const runId = randomUUID();
    this.runHistory.push({ runId, round: this.round, side });
    this.setSide(side, "running");
    this.tests = this.tests.map((t) => ({ ...t, status: "running" }));
    try {
      const verdicts = await this.judge.runVisible(
        code,
        language,
        this.problem.visible,
        DEFAULT_LIMITS,
      );
      const byId = new Map(verdicts.map((v) => [v.id, v]));
      this.tests = this.tests.map((t) => ({
        ...t,
        status: byId.get(t.id)?.passed ? "passed" : "failed",
      }));
      this.emit("tests.updated");
      if (this.statusOf(side) === "running") this.setSide(side, "coding");
      return verdicts;
    } catch (error) {
      this.failures.push(`run: ${error instanceof Error ? error.message : String(error)}`);
      this.resetTests();
      if (this.statusOf(side) === "running") this.setSide(side, "coding");
      throw error;
    }
  }

  /**
   * Sealed: returns a receipt only. A completed hidden evaluation replaces the
   * round's counted result and returns the side to coding with nothing
   * disclosed; the other side is untouched. Scores surface exclusively via
   * publishReveal() + reveal(). A verdict landing after the round revealed or
   * advanced is recorded in history but never overwrites published results.
   */
  async submit(_session: MockSession, code: string, language: string, side: MockSide = "you"): Promise<SubmitReceipt> {
    if (!canSubmit(this.roundPhase, "1v1", { you: false, mate: false })) {
      throw new Error(`submit rejected in ${this.roundPhase}`);
    }
    if (!canSideSubmit(this.statusOf(side))) {
      throw new Error(`submit rejected for ${side} while ${this.statusOf(side)}`);
    }
    // ponytail: stdlib UUIDs, not source hashes — one Submit click = one submissionId,
    // one evaluation attempt = one evaluationId; retrying the same evaluation reuses its id.
    const submissionId = randomUUID();
    const evaluationId = randomUUID();
    const at = this.clock();
    const round = this.round;
    this.setSide(side, "submitted");
    try {
      this.setSide(side, "evaluating");
      const { groups } = await this.judge.evaluateHidden(
        code,
        language,
        this.problem.hidden,
        DEFAULT_LIMITS,
      );
      const roundScore = roundScoreFromGroups(groups);
      this.submissionHistory.push({ submissionId, evaluationId, round, side, status: "completed", score: roundScore, scoringTimeMs: at });
      // ponytail: 1v1 mock models only your competitive score (opponent is a
      // scripted fixture); opponent submissions exercise activity independence
      // only. Production game service keeps one counted result per side.
      if (side === "you" && this.roundPhase === "CODING" && round === this.round) {
        this.submissionsThisRound += 1;
        this.contributions[round - 1] = { score: roundScore, scoringTimeMs: at, submissions: this.submissionsThisRound };
        this.lastGroups = groups.map((g) => ({ ...g }));
      }
      if (this.statusOf(side) === "evaluating") this.setSide(side, "coding");
      return { ok: true, round };
    } catch (error) {
      this.submissionHistory.push({ submissionId, evaluationId, round, side, status: "failed", score: null, scoringTimeMs: at });
      this.failures.push(`submit: ${error instanceof Error ? error.message : String(error)}`);
      if (this.statusOf(side) === "evaluating") this.setSide(side, "coding");
      throw error;
    }
  }

  /**
   * Explicit reveal condition/action: discloses the final counted result for
   * the round and locks both sides. After SCORE_REVEAL there is no resubmit
   * edge; Submit requires round CODING and stays disabled.
   */
  publishReveal(): void {
    const counted = this.contributions[this.round - 1];
    if (this.roundPhase !== "CODING" || !counted || !this.lastGroups) {
      throw new Error("nothing counted to reveal");
    }
    this.adoptRoundPhase(publishRoundReveal("CODING", "REVEAL_CONDITION_MET"));
    this.setSide("you", "locked");
    this.setSide("opponent", "locked");
    this.lastReveal = {
      round: this.round,
      roundScore: counted.score,
      groups: this.lastGroups.map((g) => ({ ...g })),
      totals: {
        you: matchSum(this.contributions.filter((c) => c !== undefined).map((c) => c.score)),
        opponent: matchSum(this.opponent.slice(0, this.round).map((o) => o.score)),
      },
    };
    this.emit("reveal.published");
  }

  reveal(): Reveal {
    if (this.roundPhase !== "SCORE_REVEAL" || !this.lastReveal) {
      throw new Error("no scores before reveal");
    }
    return this.lastReveal;
  }

  nextRound(): void {
    this.setRoundPhase(this.round >= this.totalRounds ? "MATCH_COMPLETE" : "ROUND_INTRO");
    if (this.roundPhase === "MATCH_COMPLETE") {
      this.emit("match.ended");
      return;
    }
    this.round += 1;
    this.submissionsThisRound = 0;
    this.lastGroups = null;
    this.lastReveal = null;
    this.setSide("you", "coding");
    this.setSide("opponent", "coding");
    this.resetTests();
    this.emit("round.advanced");
  }

  finalResult(): { you: number; opponent: number; outcome: "left" | "right" | "draw" } {
    if (this.roundPhase !== "MATCH_COMPLETE") throw new Error("match not complete");
    const you = this.contributions.map((c) => ({ ...c }));
    const opp = this.opponent.map((o) => ({ score: o.score, scoringTimeMs: o.scoringTimeMs, submissions: o.submissions }));
    const outcome = compareSides(you, opp);
    return {
      you: matchSum(you.map((c) => c.score)),
      opponent: matchSum(opp.map((o) => o.score)),
      outcome: outcome === "left" ? "left" : outcome === "right" ? "right" : "draw",
    };
  }
}
