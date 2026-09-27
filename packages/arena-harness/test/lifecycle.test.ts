import { describe, expect, it } from "vitest";
import { FakeJudge } from "../src/fake-judge.js";
import { MockGame } from "../src/mock-game.js";
import {
  SHUTOUT_OPPONENT,
  SOLVED_CODE,
  loadBankProblem,
  microProblems,
  mockSession,
} from "../src/fixtures.js";

const STARTER_CODE = "class Solution:\n    def ledger_sum(self, nums):\n        return 0\n";

async function fullMatch() {
  const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
  const game = new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000);
  const session = mockSession();
  for (let r = 1; r <= 3; r++) {
    game.startRound(session);
    await game.run(session, SOLVED_CODE, "Python");
    await game.submit(session, SOLVED_CODE, "Python");
    game.publishReveal();
    game.reveal();
    game.nextRound();
  }
  return game;
}

describe("mocked full 1v1 lifecycle (Week-2 proof path shape)", () => {
  it("problem loaded -> code -> run visible -> submit -> verdict -> reveal -> next round -> final", async () => {
    const game = await fullMatch();
    const final = game.finalResult();
    expect(final.you).toBe(300);
    expect(final.opponent).toBe(0);
    expect(final.outcome).toBe("left");
  });

  it("visible tests start idle, run passing, and reset idle each round", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    expect(game.tests.every((t) => t.status === "idle")).toBe(true);
    game.startRound(session);
    const verdicts = await game.run(session, SOLVED_CODE, "Python");
    expect(verdicts.every((v) => v.passed)).toBe(true);
    expect(game.tests.every((t) => t.status === "passed")).toBe(true);
    await game.submit(session, SOLVED_CODE, "Python");
    game.publishReveal();
    game.reveal();
    game.nextRound();
    game.startRound(session);
    expect(game.tests.every((t) => t.status === "idle")).toBe(true);
  });

  it("every step emits a cataloged event", async () => {
    const game = await fullMatch();
    for (const e of ["phase.changed", "player.statusChanged", "tests.updated", "reveal.published", "round.advanced", "match.ended"]) {
      expect(game.events).toContain(e);
    }
  });

  it("starter code scores 0: partial credit, not just pass/fail", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    const verdicts = await game.run(session, STARTER_CODE, "Python");
    expect(verdicts.some((v) => !v.passed)).toBe(true);
    await game.submit(session, STARTER_CODE, "Python");
    game.publishReveal();
    expect(game.reveal().roundScore).toBe(0);
  });
});

describe("sealing (scores hidden until reveal)", () => {
  it("submit receipt carries no scores or groups", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    const receipt = await game.submit(session, SOLVED_CODE, "Python");
    expect(JSON.stringify(receipt)).not.toContain("100");
    expect(JSON.stringify(receipt)).not.toContain("Basic");
    expect(() => game.reveal()).toThrow();
    expect(() => new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000).reveal()).toThrow();
  });
});

describe("failure capture (judge outage never strands the match)", () => {
  it("run failure returns to CODING idle with the failure recorded", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const judge = new FakeJudge();
    const game = new MockGame(rounds, judge, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    judge.failNext("judge unreachable");
    await expect(game.run(session, SOLVED_CODE, "Python")).rejects.toThrow("judge unreachable");
    expect(game.roundPhase).toBe("CODING");
    expect(game.tests.every((t) => t.status === "idle")).toBe(true);
    expect(game.failures).toEqual(["run: judge unreachable"]);
  });

  it("submit failure returns to CODING with the failure recorded", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const judge = new FakeJudge();
    const game = new MockGame(rounds, judge, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    judge.failNext("hidden suite timeout");
    await expect(game.submit(session, SOLVED_CODE, "Python")).rejects.toThrow();
    expect(game.roundPhase).toBe("CODING");
    expect(game.failures).toEqual(["submit: hidden suite timeout"]);
  });
});

function scriptedJudge(plan: Array<number | Error>) {
  let i = 0;
  return {
    async runVisible(_code: string, _language: string, tests: Array<{ id: string }>) {
      return tests.map((t) => ({ id: t.id, output: "ok", ms: 1, passed: true }));
    },
    async evaluateHidden() {
      const next = plan[i++];
      if (next instanceof Error) throw next;
      return { groups: [{ name: "Basic", weight: 100, earned: next as number }] };
    },
  };
}

describe("Phase 0.5 sealed resubmission (A: first submit stays sealed)", () => {
  it("first completed submit 100 returns CODING with counted 100 and no reveal", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds as never, scriptedJudge([100]) as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    const receipt = await game.submit(session, "code v1", "Python");
    expect(receipt).toEqual({ ok: true, round: 1 });
    expect(JSON.stringify(receipt)).not.toContain("100");
    expect(game.roundPhase).toBe("CODING");
    expect(game.countedScore).toBe(100);
    expect(game.countedCount).toBe(1);
    expect(game.submissionCount).toBe(1);
    expect(() => game.reveal()).toThrow();
  });
});

describe("Phase 0.5 sealed resubmission (B: overwrite stays sealed)", () => {
  it("100 then 40 returns CODING with counted 40, 1 contribution, both in history, reveal unavailable", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds as never, scriptedJudge([100, 40]) as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    await game.submit(session, "code v1", "Python");
    expect(game.countedScore).toBe(100);
    await game.submit(session, "code v2", "Python");
    expect(game.roundPhase).toBe("CODING");
    expect(game.countedScore).toBe(40);
    expect(game.countedCount).toBe(1);
    expect(game.submissionCount).toBe(2);
    expect(game.submissions.filter((s) => s.status === "completed")).toHaveLength(2);
    expect(() => game.reveal()).toThrow();
  });

  it("40 then 100 counts 100 while sealed", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds as never, scriptedJudge([40, 100]) as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    await game.submit(session, "code v1", "Python");
    await game.submit(session, "code v2", "Python");
    expect(game.roundPhase).toBe("CODING");
    expect(game.countedScore).toBe(100);
    expect(game.countedCount).toBe(1);
    expect(game.submissionCount).toBe(2);
    expect(() => game.reveal()).toThrow();
  });
});

describe("Phase 0.5 sealed resubmission (C: failed resubmit preserves)", () => {
  it("78 then failed evaluation returns CODING with counted 78, failure recorded, reveal unavailable", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(
      rounds as never,
      scriptedJudge([78, new Error("hidden suite timeout"), 90]) as never,
      SHUTOUT_OPPONENT,
      () => 1000,
    );
    const session = mockSession();
    game.startRound(session);
    await game.submit(session, "code v1", "Python");
    expect(game.countedScore).toBe(78);
    await expect(game.submit(session, "code v2", "Python")).rejects.toThrow("hidden suite timeout");
    expect(game.roundPhase).toBe("CODING");
    expect(game.countedScore).toBe(78);
    expect(game.countedCount).toBe(1);
    expect(game.submissionCount).toBe(1);
    expect(game.submissions).toHaveLength(2);
    expect(game.submissions[1].status).toBe("failed");
    expect(game.failures).toEqual(["submit: hidden suite timeout"]);
    expect(() => game.reveal()).toThrow();
    // ponytail: history preserved, counted untouched — recovery still plays.
    await game.submit(session, "code v3", "Python");
    expect(game.roundPhase).toBe("CODING");
    expect(game.countedScore).toBe(90);
    expect(game.submissionCount).toBe(2);
  });
});

describe("Phase 0.5 reveal (D: explicit reveal discloses, locks resubmit)", () => {
  it("publishReveal exposes the final counted result; Submit disabled after SCORE_REVEAL", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds as never, scriptedJudge([100, 40]) as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    await game.submit(session, "code v1", "Python");
    await game.submit(session, "code v2", "Python");
    game.publishReveal();
    expect(game.roundPhase).toBe("SCORE_REVEAL");
    const reveal = game.reveal();
    expect(reveal.roundScore).toBe(40);
    expect(reveal.totals.you).toBe(40);
    expect(reveal.groups).toEqual([{ name: "Basic", weight: 100, earned: 40 }]);
    await expect(game.submit(session, "code v3", "Python")).rejects.toThrow();
    expect(game.roundPhase).toBe("SCORE_REVEAL");
  });

  it("publishReveal with nothing counted throws", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    expect(() => game.publishReveal()).toThrow();
  });
});

describe("Phase 0.5 stable async identities", () => {
  it("Submit/Run carry UUIDs; resubmits get new ids; match/round stable per scope", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds as never, scriptedJudge([100, 40]) as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    const matchId = game.matchId;
    const roundId = game.roundId;
    expect(matchId).toMatch(/^[0-9a-f-]{8,}$/i);
    expect(roundId).toMatch(/^[0-9a-f-]{8,}$/i);
    game.startRound(session);
    await game.run(session, SOLVED_CODE, "Python");
    expect(game.runs).toHaveLength(1);
    expect(game.runs[0].runId).toMatch(/^[0-9a-f-]{8,}$/i);
    await game.submit(session, "code v1", "Python");
    expect(game.roundPhase).toBe("CODING");
    await game.submit(session, "code v2", "Python");
    const [first, second] = game.submissions;
    expect(first.submissionId).not.toBe(second.submissionId);
    expect(first.evaluationId).not.toBe(second.evaluationId);
    expect(game.matchId).toBe(matchId);
    expect(game.roundId).toBe(roundId);
    expect(first.round).toBe(1);
    expect(second.round).toBe(1);
  });
});

function controllableJudge(plan: Array<number | Error | "defer">) {
  let i = 0;
  const parked: Array<(v: number | Error) => void> = [];
  return {
    release(v: number | Error): void {
      const settle = parked.shift();
      if (!settle) throw new Error("nothing parked");
      settle(v);
    },
    async runVisible(_code: string, _language: string, tests: Array<{ id: string }>) {
      return tests.map((t) => ({ id: t.id, output: "ok", ms: 1, passed: true }));
    },
    async evaluateHidden() {
      const next = plan[i++];
      if (next === "defer") {
        const v = await new Promise<number | Error>((resolve) => parked.push(resolve));
        if (v instanceof Error) throw v;
        return { groups: [{ name: "Basic", weight: 100, earned: v }] };
      }
      if (next instanceof Error) throw next;
      return { groups: [{ name: "Basic", weight: 100, earned: next as number }] };
    },
  };
}

describe("Phase 0.75 concurrency (one side never freezes the other)", () => {
  it("A evaluating + B coding: round stays CODING and B can Run and Submit", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const judge = controllableJudge(["defer", 70]);
    const game = new MockGame(rounds as never, judge as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    const aPending = game.submit(session, "a-code", "Python", "you");
    expect(game.youStatus).toBe("evaluating");
    expect(game.opponentStatus).toBe("coding");
    expect(game.roundPhase).toBe("CODING");
    await game.run(session, SOLVED_CODE, "Python", "opponent");
    expect(game.opponentStatus).toBe("coding");
    await game.submit(session, "b-code", "Python", "opponent");
    expect(game.opponentStatus).toBe("coding");
    expect(game.youStatus).toBe("evaluating");
    expect(game.roundPhase).toBe("CODING");
    judge.release(40);
    await aPending;
    expect(game.youStatus).toBe("coding");
    expect(game.opponentStatus).toBe("coding");
    expect(game.roundPhase).toBe("CODING");
    expect(game.countedScore).toBe(40);
    expect(game.submissionCount).toBe(1);
  });

  it("A running + B coding: round stays CODING and B is unaffected", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const game = new MockGame(rounds, new FakeJudge(), SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    const aRunning = game.run(session, SOLVED_CODE, "Python", "you");
    expect(game.youStatus).toBe("running");
    expect(game.opponentStatus).toBe("coding");
    expect(game.roundPhase).toBe("CODING");
    await game.run(session, SOLVED_CODE, "Python", "opponent");
    expect(game.opponentStatus).toBe("coding");
    await aRunning;
    expect(game.youStatus).toBe("coding");
    expect(game.roundPhase).toBe("CODING");
  });

  it("A evaluating + B running can overlap; completing one side never alters the other", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const judge = controllableJudge(["defer"]);
    const game = new MockGame(rounds as never, judge as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    const aPending = game.submit(session, "a-code", "Python", "you");
    const bRunning = game.run(session, SOLVED_CODE, "Python", "opponent");
    expect(game.youStatus).toBe("evaluating");
    expect(game.opponentStatus).toBe("running");
    expect(game.roundPhase).toBe("CODING");
    await bRunning;
    expect(game.opponentStatus).toBe("coding");
    expect(game.youStatus).toBe("evaluating");
    judge.release(55);
    await aPending;
    expect(game.youStatus).toBe("coding");
    expect(game.countedScore).toBe(55);
    expect(game.roundPhase).toBe("CODING");
  });

  it("reveal while A is outstanding publishes counted-so-far; the late verdict is recorded but never overwrites", async () => {
    const rounds = [await loadBankProblem("even-ledger"), ...microProblems()];
    const judge = controllableJudge([70, "defer"]);
    const game = new MockGame(rounds as never, judge as never, SHUTOUT_OPPONENT, () => 1000);
    const session = mockSession();
    game.startRound(session);
    await game.submit(session, "b-code", "Python");
    expect(game.countedScore).toBe(70);
    const aPending = game.submit(session, "a-code", "Python");
    expect(game.youStatus).toBe("evaluating");
    game.publishReveal();
    expect(game.roundPhase).toBe("SCORE_REVEAL");
    expect(game.reveal().roundScore).toBe(70);
    judge.release(40);
    await aPending;
    expect(game.countedScore).toBe(70);
    expect(game.reveal().roundScore).toBe(70);
    expect(game.submissions).toHaveLength(2);
  });
});
