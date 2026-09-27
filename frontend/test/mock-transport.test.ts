import { describe, expect, it } from "vitest";
import { MockArenaTransport } from "../src/arena/mock.js";

const SOLVED = "def ledger_sum(nums):\n    return sum(nums)\n";
const STARTER = "def ledger_sum(nums):\n    return 0\n";

describe("mock transport seals scores until explicit reveal", () => {
  it("submit receipt carries no score; snapshot stays sealed while CODING", async () => {
    const t = new MockArenaTransport("1v1");
    t.startRound();
    const receipt = await t.submit({ code: SOLVED, language: "Python" });
    expect(receipt).toEqual({ ok: true, round: 1 });
    expect(JSON.stringify(receipt)).not.toContain("100");
    const snap = t.snapshot();
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.reveal).toBeNull();
    expect(JSON.stringify(snap)).not.toContain("Basic");
  });

  it("last completed submit wins (100 then starter counts 0), history of attempts kept", async () => {
    const t = new MockArenaTransport("1v1");
    t.startRound();
    await t.submit({ code: SOLVED, language: "Python" });
    await t.submit({ code: STARTER, language: "Python" });
    expect(t.snapshot().you.submissions).toBe(2);
    t.publishRevealForDev();
    expect(t.snapshot().reveal?.roundScore).toBe(0);
  });

  it("publish with nothing counted throws", () => {
    const t = new MockArenaTransport("1v1");
    t.startRound();
    expect(() => t.publishRevealForDev()).toThrow();
  });
});

describe("mock transport readiness gate (2v2)", () => {
  it("team submit rejected until both teammates ready", async () => {
    const t = new MockArenaTransport("2v2");
    t.startRound();
    await expect(t.submit({ code: SOLVED, language: "Python" })).rejects.toThrow();
    t.setReady(true);
    await expect(t.submit({ code: SOLVED, language: "Python" })).rejects.toThrow();
    t.setMateReadyForDev(true);
    const receipt = await t.submit({ code: SOLVED, language: "Python" });
    expect(receipt).toEqual({ ok: true, round: 1 });
    expect(t.snapshot().alpha.submissions).toBe(1);
  });

  it("doc revision bump invalidates both approvals; stale submit rejected", async () => {
    const t = new MockArenaTransport("2v2");
    t.startRound();
    t.setReady(true);
    t.setMateReadyForDev(true);
    expect(t.snapshot().readyRevision).toEqual({ you: 1, mate: 1 });
    t.bumpDocRevisionForDev();
    expect(t.snapshot().ready).toEqual({ you: false, mate: false });
    await expect(t.submit({ code: SOLVED, language: "Python" })).rejects.toThrow(/revision|ready/);
    await expect(t.submit({ code: SOLVED, language: "Python", documentRevision: 1 })).rejects.toThrow();
  });
});

describe("mock transport round stays active during executions", () => {
  it("run and submit return to CODING; reveal locks and advances", async () => {
    const t = new MockArenaTransport("1v1");
    t.startRound();
    await t.run({ code: SOLVED, language: "Python" });
    expect(t.snapshot().roundPhase).toBe("CODING");
    expect(t.snapshot().tests.every((x) => x.status === "passed")).toBe(true);
    await t.submit({ code: SOLVED, language: "Python" });
    expect(t.snapshot().roundPhase).toBe("CODING");
    t.publishRevealForDev();
    expect(t.snapshot().roundPhase).toBe("SCORE_REVEAL");
    expect(t.snapshot().reveal?.totals).toEqual({ you: 100, opponent: 65 });
    t.nextRoundForDev();
    expect(t.snapshot().roundPhase).toBe("ROUND_INTRO");
    expect(t.snapshot().tests.every((x) => x.status === "idle")).toBe(true);
  });
});
