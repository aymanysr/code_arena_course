import { describe, expect, it } from "vitest";
import type { ArenaEvent } from "arena-model";
import { P100, P30, P45, P55, P70, P85, SOLVED_PY, setup } from "./setup.js";

describe("09 engine-level 1v1 integration (bank + judge + clock + events)", () => {
  it("problem -> run -> submit -> sealed -> reveal x3 -> final, clock never resets", async () => {
    const fx = await setup([]);
    const { engine, judge, left, right, matchId } = fx;
    const seen: ArenaEvent[] = [];
    engine.on((event) => seen.push(event));
    expect(await ((await engine.snapshot(left, matchId))).problem.title).toBe("Even Ledger");
    expect(Object.keys((await engine.snapshot(left, matchId)).problem.starters)).toEqual(["C++", "Python", "C"]);

    const remaining: number[] = [];
    const scores = [[P100, P85], [P70, P45], [P55, P30]];
    for (let round = 0; round < 3; round++) {
      const [l, r] = scores[round] as [typeof P100, typeof P100];
      const runRes = await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
      expect(runRes.tests.every((t) => t.passed)).toBe(true);
      judge.queuePlan(l);
      await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
      expect((await engine.snapshot(left, matchId)).reveal).toBeNull();
      judge.queuePlan(r);
      await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
      const reveal = await engine.publishReveal(left, matchId);
      expect(reveal.scores).toEqual({ left: [100, 70, 55][round], right: [85, 45, 30][round] });
      remaining.push((await engine.snapshot(left, matchId)).remainingMs);
      fx.advance(60 * 1000);
      const snap = await engine.snapshot(left, matchId);
      if (snap.round < snap.totalRounds) {
        await engine.nextRound(left, matchId);
        await engine.beginCoding(left, matchId);
      }
    }
    expect(remaining[0]).toBeGreaterThan(remaining[1]);
    expect(remaining[1]).toBeGreaterThan(remaining[2]);
    expect(remaining[0]).toBeLessThanOrEqual(30 * 60 * 1000);

    await engine.nextRound(left, matchId);
    const final = await engine.finalResult(left, matchId);
    expect(final.scores).toEqual({ left: 225, right: 160 });
    expect(final.winner).toBe("left");
    for (const e of ["phase.changed", "player.statusChanged", "tests.updated", "reveal.published", "round.advanced", "match.ended"] as ArenaEvent[]) {
      expect(seen).toContain(e);
    }
  });

  it("match timeout rejects play and saves its Reveal and final result without player action", async () => {
    const fx = await setup([{ score: 100 }]);
    const { engine, left, right, matchId } = fx;
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    fx.advance(31 * 60 * 1000);
    const snap = await engine.snapshot(left, matchId);
    expect(snap.expired).toBe(true);
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.reveal?.scores.left).toBe(100);
    expect(snap.final?.scores.left).toBe(100);
    await expect(engine.run(right, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/expired/);
    await expect(engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/expired/);
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
    expect((await engine.finalResult(left, matchId)).scores.left).toBe(100);
  });
});
