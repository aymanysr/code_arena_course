/**
 * Scoring: round 0-100 from weighted hidden groups, match = sum of rounds,
 * tie-breaks = total final-score time, then fewer submissions, then draw.
 * Speed never decays correctness; times are server-sourced elapsed ms.
 */

export interface TestGroupScore {
  weight: number;
  earned: number;
}

/** Weighted groups to a 0-100 round score (reference: earned/weight over groups). */
export function roundScoreFromGroups(groups: TestGroupScore[]): number {
  const weight = groups.reduce((s, g) => s + g.weight, 0);
  if (!(weight > 0)) throw new RangeError("groups must carry positive total weight");
  const earned = groups.reduce((s, g) => s + g.earned, 0);
  return assertRoundScore(Math.round((earned / weight) * 100));
}

/** Normalization invariant: every round is 0-100 finite. */
export function assertRoundScore(n: number): number {
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new RangeError(`round score must be within 0-100, got ${n}`);
  }
  return n;
}

/**
 * Production partial-credit rule (basis points: 10000 = 100.00%).
 * For a group with weight W, P passed of T tests: earnedBp = floor(W*P*100/T).
 * Integer-only: no floating-point drift can change a persisted score; floor is
 * a function of the rational value, so equivalent ratios and test orderings
 * always produce the same basis points. Exactly ONE rounding point exists:
 * roundScoreFromBp rounds the summed basis points to whole percent once.
 */
export interface GroupCounts {
  weight: number;
  passed: number;
  total: number;
}

export function groupEarnedBp(weight: number, passed: number, total: number): number {
  if (!Number.isInteger(weight) || weight < 0) {
    throw new RangeError(`group weight must be a non-negative integer, got ${weight}`);
  }
  if (!Number.isInteger(total) || total <= 0) {
    throw new RangeError(`group must declare a positive test count, got ${total}`);
  }
  if (!Number.isInteger(passed) || passed < 0 || passed > total) {
    throw new RangeError(`passed count ${passed} out of range for ${total} tests`);
  }
  return Math.floor((weight * passed * 100) / total);
}

/** Sum of group basis points. Group weights must total exactly 100. */
export function roundScoreBp(groups: GroupCounts[]): number {
  const weight = groups.reduce((s, g) => s + g.weight, 0);
  if (weight !== 100) throw new RangeError(`group weights must sum to exactly 100, got ${weight}`);
  const bp = groups.reduce((s, g) => s + groupEarnedBp(g.weight, g.passed, g.total), 0);
  if (!Number.isInteger(bp) || bp < 0 || bp > 10000) {
    throw new RangeError(`basis-point total out of range: ${bp}`);
  }
  return bp;
}

/** The single rounding point: basis points to whole percent, halves up. */
export function roundScoreFromBp(bp: number): number {
  if (!Number.isInteger(bp) || bp < 0 || bp > 10000) {
    throw new RangeError(`basis points must be an integer 0-10000, got ${bp}`);
  }
  return assertRoundScore(Math.floor((bp + 50) / 100));
}

/** Production round score from per-group pass counts. */
export function roundScoreFromCounts(groups: GroupCounts[]): number {
  return roundScoreFromBp(roundScoreBp(groups));
}

/** Match result: sum of round scores (equal weight per round by invariant). */
export function matchSum(scores: number[]): number {
  return scores.map(assertRoundScore).reduce((s, n) => s + n, 0);
}

export interface RoundContribution {
  /** Counted (final) round score: the last completed hidden evaluation. */
  score: number;
  /**
   * Elapsed server time at which the side achieved this final score
   * (timestamp of the standing submission). Works at any score.
   */
  scoringTimeMs: number;
  /** Submit executions in this round. */
  submissions: number;
}

export type SideOutcome = "left" | "right" | "draw";

export function compareSides(left: RoundContribution[], right: RoundContribution[]): SideOutcome {
  const sumL = matchSum(left.map((r) => r.score));
  const sumR = matchSum(right.map((r) => r.score));
  if (sumL !== sumR) return sumL > sumR ? "left" : "right";
  const timeL = left.reduce((s, r) => s + r.scoringTimeMs, 0);
  const timeR = right.reduce((s, r) => s + r.scoringTimeMs, 0);
  if (timeL !== timeR) return timeL < timeR ? "left" : "right";
  const subL = left.reduce((s, r) => s + r.submissions, 0);
  const subR = right.reduce((s, r) => s + r.submissions, 0);
  if (subL !== subR) return subL < subR ? "left" : "right";
  return "draw";
}
