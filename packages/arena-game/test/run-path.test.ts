import { describe, expect, it } from "vitest";
import { P100, SOLVED_PY, setup } from "./setup.js";

describe("07 run path (visible tests only, independent sides)", () => {
  it("1. A Run succeeds while B remains coding", async () => {
    const { engine, left, right, matchId } = await setup();
    const res = await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(res.tests.every((t) => t.passed)).toBe(true);
    const snap = await engine.snapshot(right, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.sides.right?.status).toBe("coding");
    expect(snap.reveal).toBeNull();
  });

  it("2. A Run completes while B submits", async () => {
    const { engine, left, right, matchId } = await setup([P100]);
    const aRun = engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    const receipt = await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
    const res = await aRun;
    expect(res.tests.every((t) => t.passed)).toBe(true);
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("CODING");
  });

  it("3. judge receives visible tests only, never hidden material", async () => {
    const { engine, judge, left, matchId } = await setup();
    await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    const ids = judge.lastRunTests.map((t) => t.id);
    expect(ids).toEqual(["ex1", "ex2", "ex3"]);
    expect(ids).not.toContain("b1");
    const snap = await engine.snapshot(left, matchId);
    expect(JSON.stringify(snap)).not.toContain("1000000000");
    expect(JSON.stringify(snap)).not.toContain("hiddenGroups");
  });

  it("4. run judge failure returns A to coding and is recorded", async () => {
    const { engine, judge, left, right, matchId } = await setup();
    judge.failNextRun("judge unreachable");
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow("judge unreachable");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.failures).toEqual(["run: judge unreachable"]);
    expect(snap.sides.right?.status).toBe("coding");
  });

  it("5. run timeout verdict is represented without touching score", async () => {
    const { engine, judge, left, matchId } = await setup();
    judge.queueRunStatus("time_limit_exceeded");
    const res = await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(res.tests.every((t) => !t.passed)).toBe(true);
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.reveal).toBeNull();
  });

  it("6. invalid language and oversized source rejected before judge", async () => {
    const { engine, judge, left, matchId } = await setup();
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Brainfuck" })).rejects.toThrow();
    await expect(engine.run(left, matchId, { code: "", language: "Python" })).rejects.toThrow();
    await expect(engine.run(left, matchId, { code: "x".repeat(200 * 1024), language: "Python" })).rejects.toThrow();
    expect(judge.runCalls).toBe(0);
  });

  it("7. non-member principal rejected", async () => {
    const { engine, stranger, matchId } = await setup();
    await expect(engine.run(stranger, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    await expect(engine.submit(stranger, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    await expect(engine.snapshot(stranger, matchId)).rejects.toThrow();
  });

  it("8. duplicate concurrent Run for the same side is blocked", async () => {
    const { engine, judge, left, matchId } = await setup();
    judge.deferNextRun();
    const first = engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    judge.releaseRun();
    await first;
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("coding");
  });

  it("9. other side can still submit after A run failure", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ score: 100 }]);
    judge.failNextRun("boom");
    await expect(engine.run(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    const receipt = await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
  });
});
