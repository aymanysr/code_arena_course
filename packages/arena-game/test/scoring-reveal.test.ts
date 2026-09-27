import { describe, expect, it } from "vitest";
import { P100, P30, P40, P45, P55, P60, P70, P85, SOLVED_PY, setup, type Fixture } from "./setup.js";
import type { ScriptPlan } from "./scripted-judge.js";

async function playRound(
  fx: Fixture,
  leftPlan: ScriptPlan,
  rightPlan: ScriptPlan,
  extraLeft: ScriptPlan[] = [],
) {
  const { engine, judge, left, right, matchId } = fx;
  judge.queuePlan(leftPlan);
  await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
  for (const plan of extraLeft) {
    judge.queuePlan(plan);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
  }
  judge.queuePlan(rightPlan);
  await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
  await engine.publishReveal(left, matchId);
  const snap = await engine.snapshot(left, matchId);
  if (snap.round < snap.totalRounds) {
    await engine.nextRound(left, matchId);
    await engine.beginCoding(left, matchId);
  }
}

describe("10 scoring via arena-model, no duplicated formulas", () => {
  it("round normalized 0-100 and match sums three rounds", async () => {
    const fx = await setup([]);
    await playRound(fx, P100, P85);
    await playRound(fx, P70, P45);
    await playRound(fx, P55, P30);
    await fx.engine.nextRound(fx.left, fx.matchId);
    const final = await fx.engine.finalResult(fx.left, fx.matchId);
    expect(final.scores).toEqual({ left: 225, right: 160 });
    expect(final.winner).toBe("left");
  });

  it("tiebreak 1: equal sums decided by lower final-score time", async () => {
    const fx = await setup([]);
    const { engine, judge, left, right, matchId } = fx;
    for (const [l, r] of [[P100, P100], [P60, P60], [P60, P60]] as const) {
      judge.queuePlan(l);
      await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
      fx.advance(5000);
      judge.queuePlan(r);
      await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
      await engine.publishReveal(left, matchId);
      const snap = await engine.snapshot(left, matchId);
      if (snap.round < snap.totalRounds) {
        await engine.nextRound(left, matchId);
        await engine.beginCoding(left, matchId);
      }
    }
    await engine.nextRound(left, matchId);
    const final = await engine.finalResult(left, matchId);
    expect(final.scores).toEqual({ left: 220, right: 220 });
    expect(final.winner).toBe("left");
  });

  it("tiebreak 2: equal sums and times decided by fewer submissions", async () => {
    const fx = await setup([]);
    for (let i = 0; i < 3; i++) {
      await playRound(fx, P100, P100, [P100]);
    }
    await fx.engine.nextRound(fx.left, fx.matchId);
    const final = await fx.engine.finalResult(fx.left, fx.matchId);
    expect(final.scores).toEqual({ left: 300, right: 300 });
    expect(final.winner).toBe("right");
  });

  it("exact tie after both tiebreaks is a draw", async () => {
    const fx = await setup([]);
    await playRound(fx, P70, P70);
    await playRound(fx, P70, P70);
    await playRound(fx, P70, P70);
    await fx.engine.nextRound(fx.left, fx.matchId);
    const final = await fx.engine.finalResult(fx.left, fx.matchId);
    expect(final.outcome).toBe("draw");
    expect(final.winner).toBeNull();
  });
});

describe("10 explicit reveal + in-flight policy (wait in grace, supersede after)", () => {
  it("verdict inside the grace window becomes counted", async () => {
    const fx = await setup([{ defer: true }]);
    const { engine, judge, left, matchId } = fx;
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const published = engine.publishReveal(left, matchId, { graceMs: 100 });
    setTimeout(() => judge.release(P70), 10);
    await pending;
    const reveal = await published;
    expect(reveal.scores.left).toBe(70);
  });

  it("new submits are rejected while reveal is closing the round", async () => {
    const fx = await setup([{ defer: true }]);
    const { engine, judge, left, right, matchId } = fx;
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const published = engine.publishReveal(left, matchId, { graceMs: 60 });
    await expect(engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/closing/);
    judge.release(P70);
    await pending;
    const reveal = await published;
    expect(reveal.scores.left).toBe(70);
  });

  it("verdict after the cutoff is superseded: recorded, never counted", async () => {
    const fx = await setup([P70, { defer: true }]);
    const { engine, judge, left, matchId } = fx;
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId, { graceMs: 0 });
    expect(reveal.scores.left).toBe(70);
    judge.release(P40);
    await pending;
    expect((await engine.snapshot(left, matchId)).reveal?.scores.left).toBe(70);
    expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(1);
  });

  it("published reveal is a stable snapshot: consumer mutation and republish change nothing", async () => {
    const fx = await setup([{ score: 100 }]);
    const { engine, left, matchId } = fx;
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId);
    const before = JSON.stringify((await engine.snapshot(left, matchId)).reveal);
    reveal.scores.left = -1;
    await expect(engine.publishReveal(left, matchId)).rejects.toThrow();
    expect(JSON.stringify((await engine.snapshot(left, matchId)).reveal)).toBe(before);
    expect((await engine.snapshot(left, matchId)).reveal?.scores.left).toBe(100);
  });
});
