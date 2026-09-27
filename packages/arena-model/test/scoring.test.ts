import { describe, expect, it } from "vitest";
import {
  assertRoundScore,
  compareSides,
  groupEarnedBp,
  matchSum,
  roundScoreFromBp,
  roundScoreFromCounts,
  roundScoreBp,
  roundScoreFromGroups,
} from "../src/index.js";

describe("round normalization invariant (every round 0-100, equal weight)", () => {
  it("weights groups to 0-100", () => {
    expect(
      roundScoreFromGroups([
        { weight: 20, earned: 20 },
        { weight: 20, earned: 20 },
        { weight: 20, earned: 20 },
        { weight: 20, earned: 9 },
        { weight: 20, earned: 9 },
      ]),
    ).toBe(78);
  });
  it("rejects out-of-range scores", () => {
    expect(() => assertRoundScore(-1)).toThrow();
    expect(() => assertRoundScore(101)).toThrow();
    expect(() => assertRoundScore(Number.NaN)).toThrow();
  });
});

describe("partial-credit rule (integer basis points, one rounding point)", () => {
  it("all pass is exactly 100, none pass is exactly 0", () => {
    expect(roundScoreFromCounts([{ weight: 100, passed: 3, total: 3 }])).toBe(100);
    expect(roundScoreFromCounts([{ weight: 100, passed: 0, total: 3 }])).toBe(0);
    expect(
      roundScoreFromCounts([
        { weight: 40, passed: 0, total: 3 },
        { weight: 30, passed: 0, total: 2 },
        { weight: 30, passed: 0, total: 2 },
      ]),
    ).toBe(0);
  });
  it("bank shape: 40/30/30 groups score exactly (100, 70, 55, 40 cases)", () => {
    const shape = (p: number[]) =>
      [
        { weight: 40, passed: p[0]!, total: 3 },
        { weight: 30, passed: p[1]!, total: 2 },
        { weight: 30, passed: p[2]!, total: 2 },
      ] as const;
    expect(roundScoreBp([...shape([3, 2, 2])])).toBe(10000);
    expect(roundScoreFromCounts([...shape([3, 2, 1])])).toBe(85);
    expect(roundScoreFromCounts([...shape([3, 2, 0])])).toBe(70);
    expect(roundScoreFromCounts([...shape([3, 0, 1])])).toBe(55);
    expect(roundScoreFromCounts([...shape([3, 0, 0])])).toBe(40);
  });
  it("test order cannot affect the score", () => {
    const a = roundScoreBp([
      { weight: 40, passed: 1, total: 3 },
      { weight: 30, passed: 2, total: 2 },
      { weight: 30, passed: 0, total: 2 },
    ]);
    const b = roundScoreBp([
      { weight: 30, passed: 0, total: 2 },
      { weight: 40, passed: 1, total: 3 },
      { weight: 30, passed: 2, total: 2 },
    ]);
    expect(a).toBe(b);
  });
  it("equivalent pass ratios produce equivalent basis points (1/2 == 2/4, 1/3 == 2/6)", () => {
    expect(groupEarnedBp(50, 1, 2)).toBe(groupEarnedBp(50, 2, 4));
    expect(groupEarnedBp(30, 1, 3)).toBe(groupEarnedBp(30, 2, 6));
    expect(groupEarnedBp(30, 1, 3)).toBe(1000);
  });
  it("single rounding point rounds halves up (5050bp -> 51, 5049bp -> 50)", () => {
    expect(roundScoreFromBp(5050)).toBe(51);
    expect(roundScoreFromBp(5049)).toBe(50);
    expect(roundScoreFromBp(10000)).toBe(100);
    expect(roundScoreFromBp(0)).toBe(0);
  });
  it("rejects zero tests, out-of-range passed, non-100 weights, out-of-range bp", () => {
    expect(() => groupEarnedBp(50, 1, 0)).toThrow();
    expect(() => groupEarnedBp(50, 3, 2)).toThrow();
    expect(() => groupEarnedBp(50, -1, 2)).toThrow();
    expect(() => roundScoreBp([{ weight: 90, passed: 1, total: 1 }])).toThrow();
    expect(() => roundScoreFromBp(-1)).toThrow();
    expect(() => roundScoreFromBp(10001)).toThrow();
    expect(() => roundScoreFromBp(12.5)).toThrow();
  });
});
describe("match result = sum of round scores", () => {
  it("a 100-99 round and a 100-20 round count exactly their margins", () => {
    expect(matchSum([100, 100])).toBe(200);
    expect(matchSum([99, 20])).toBe(119);
    expect(matchSum([100, 100])).toBeGreaterThan(matchSum([99, 20]));
  });
});

describe("tie-breaks (final counted-score time, then fewer submissions)", () => {
  const side = (scores: number[], times: number[], subs: number[]) =>
    scores.map((score, i) => ({ score, scoringTimeMs: times[i], submissions: subs[i] }));

  it("higher sum wins regardless of speed", () => {
    expect(compareSides(side([100, 80], [10, 10], [1, 1]), side([90, 80], [1, 1], [1, 1]))).toBe("left");
  });
  it("tie-break 1 works at partial credit (78 vs 78 decided by final-score time)", () => {
    const slow = side([78, 60], [5000, 9000], [2, 2]);
    const fast = side([78, 60], [4000, 8000], [2, 2]);
    expect(compareSides(slow, fast)).toBe("right");
  });
  it("tie-break 1 keys off the final score time, not the first submit", () => {
    // Same sums and same submission counts; left's counting submit landed later.
    const left = side([42], [12000], [3]);
    const right = side([42], [3000], [3]);
    expect(compareSides(left, right)).toBe("right");
  });
  it("tie-break 2: fewer submissions wins when times tie", () => {
    const left = side([50, 50], [1000, 1000], [1, 1]);
    const right = side([50, 50], [1000, 1000], [2, 2]);
    expect(compareSides(left, right)).toBe("left");
  });
  it("exact tie after both tie-breaks is a draw", () => {
    const a = side([70, 70], [1000, 2000], [1, 2]);
    const b = side([70, 70], [1000, 2000], [1, 2]);
    expect(compareSides(a, b)).toBe("draw");
  });
});
