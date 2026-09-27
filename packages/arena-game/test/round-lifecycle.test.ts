import { describe, expect, it } from "vitest";
import { RoundLifecycle, type SealedVerdict } from "../src/round-lifecycle.js";
import type { MatchRecord } from "../src/records.js";

function round(roundId: string, activity: "coding" | "locked" = "coding") {
  return {
    roundId,
    problemVersionId: "even-ledger",
    hiddenSuiteId: "hidden-even-ledger",
    counted: {},
    attempts: {},
    activities: { left: activity, right: activity },
    runTests: {},
    reveal: null,
    closing: false,
    cutoffPassed: false,
    superseded: [],
  };
}

function match(): MatchRecord {
  return {
    id: "match-1",
    mode: "1v1",
    roundPhase: "SCORE_REVEAL",
    currentRound: 1,
    totalRounds: 2,
    durationMs: 1_800_000,
    startedAt: 1_000,
    participants: [
      { userId: "left-user", sideId: "left" },
      { userId: "right-user", sideId: "right" },
    ],
    rounds: [round("round-1", "locked"), round("round-2")],
    failures: [],
    revision: 0,
    presence: {},
    offlineSinceMs: {},
    forfeit: null,
  };
}

describe("RoundLifecycle", () => {
  it("scores competitive verdicts and rejects infrastructure verdicts", () => {
    const lifecycle = new RoundLifecycle();
    const verdict: SealedVerdict = {
      groups: [
        {
          name: "Basic",
          weight: 100,
          results: [
            { id: "a", passed: true, status: "accepted", runtimeMs: 1 },
            { id: "b", passed: false, status: "runtime_error", runtimeMs: 2 },
          ],
        },
      ],
    };

    expect(lifecycle.scoreVerdict(verdict)).toMatchObject({
      score: 50,
      scoreBp: 5000,
      testStatuses: ["accepted", "runtime_error"],
      groups: [{ name: "Basic", earned: 50, earnedBp: 5000 }],
    });
    expect(
      lifecycle.scoreVerdict({
        groups: [{ name: "Basic", weight: 100, results: [{ id: "a", passed: false, status: "internal_error", runtimeMs: 0 }] }],
      }),
    ).toBeUndefined();
  });

  it("advances the next round while keeping the facade-independent reset rules", () => {
    const lifecycle = new RoundLifecycle();
    const current = match();
    const plan = lifecycle.advance(current);

    expect(plan).toEqual({ completed: false, previousRoundId: "round-1", activityResets: [] });
    expect(current.roundPhase).toBe("ROUND_INTRO");
    expect(current.currentRound).toBe(2);
    expect(current.rounds[1]).toMatchObject({
      counted: {},
      attempts: {},
      reveal: null,
      closing: false,
      cutoffPassed: false,
      superseded: [],
    });
  });
});
