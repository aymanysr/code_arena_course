import { describe, expect, it } from "vitest";
import { P100, P40, SOLVED_PY, STARTER_PY, setup } from "./setup.js";

// Hidden-only markers: absent from every visible/bank-public surface.
const HIDDEN_MARKERS = ['"b1"', '"n1"', '"e1"', "1000000000", "Negatives and zeros", "hiddenGroups"];
const LEFT_CODE = "def ledger_sum(nums):\n    return 999111\n";
const RIGHT_CODE = "def ledger_sum(nums):\n    return 222888\n";

describe("client-facing sealing (hidden + opponent isolation)", () => {
  it("snapshots, receipts and events never carry hidden material", async () => {
    const { engine, judge, left, matchId } = await setup([P100, P40]);
    const seen: unknown[] = [];
    engine.on((_event, payload) => seen.push(payload));
    const receipt = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.submit(left, matchId, { code: STARTER_PY, language: "Python" });
    const snap = await engine.snapshot(left, matchId);
    // The sealed channel DID carry hidden material internally.
    expect(JSON.stringify(judge.lastSealedGroups)).toContain("1000000000");
    const bodies = [JSON.stringify(receipt), JSON.stringify(snap), ...seen.map((s) => JSON.stringify(s))];
    for (const body of bodies) {
      for (const marker of HIDDEN_MARKERS) {
        expect(body).not.toContain(marker);
      }
    }
  });

  it("neither side ever sees the other's source", async () => {
    const { engine, left, right, matchId } = await setup([P100, P100]);
    await engine.submit(left, matchId, { code: LEFT_CODE, language: "Python" });
    await engine.submit(right, matchId, { code: RIGHT_CODE, language: "Python" });
    const leftSnap = JSON.stringify((await engine.snapshot(left, matchId)));
    const rightSnap = JSON.stringify((await engine.snapshot(right, matchId)));
    expect(leftSnap).not.toContain("222888");
    expect(rightSnap).not.toContain("999111");
  });

  it("failure audit carries no hidden data", async () => {
    const { engine, left, matchId } = await setup([{ infra: "queue down" }]);
    await expect(engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    const snap = await engine.snapshot(left, matchId);
    for (const marker of HIDDEN_MARKERS) {
      expect(JSON.stringify(snap.failures)).not.toContain(marker);
    }
  });

  it("reveal discloses groups but never raw hidden inputs or expected values", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId);
    const body = JSON.stringify((await engine.snapshot(left, matchId)).reveal);
    expect(body).toContain("Basic");
    for (const marker of ['"b1"', '"n1"', '"e1"', "1000000000", "nums = [10,-3]", '"expected"']) {
      expect(body).not.toContain(marker);
    }
    expect(reveal.groups.left?.every((g) => g.earned <= g.weight)).toBe(true);
  });
});
