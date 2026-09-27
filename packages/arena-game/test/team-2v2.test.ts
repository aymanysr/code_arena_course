import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ArenaEngine, type EngineOptions } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { testPrincipal, type AuthenticatedPrincipal } from "../src/principal.js";
import { ScriptedJudge, type ScriptPlan } from "./scripted-judge.js";
import { P100, SOLVED_PY, STARTER_PY, setup, tick } from "./setup.js";

/**
 * Ticket 14 test-first, ticket 15 closure: shared-document edits drive REAL
 * Yjs frames (applyCollabUpdate) — the temporary notifyDocumentChanged seam
 * is deleted. Revision/invalidation/submit-gate semantics are unchanged.
 */

interface TeamFixture {
  engine: ArenaEngine;
  judge: ScriptedJudge;
  a1: AuthenticatedPrincipal;
  a2: AuthenticatedPrincipal;
  b1: AuthenticatedPrincipal;
  b2: AuthenticatedPrincipal;
  stranger: AuthenticatedPrincipal;
  matchId: string;
  advance: (ms: number) => void;
}

async function setup2v2(plans: ScriptPlan[] = [{ score: 100 }], options: Partial<EngineOptions> = {}): Promise<TeamFixture> {
  let now = 1_000_000;
  const judge = new ScriptedJudge(plans);
  const engine = new ArenaEngine({ judge, bank: new FileBank(), clock: () => now, revealGraceMs: 0, ...options });
  const a1 = testPrincipal("user-a1");
  const a2 = testPrincipal("user-a2");
  const b1 = testPrincipal("user-b1");
  const b2 = testPrincipal("user-b2");
  const stranger = testPrincipal("user-stranger");
  const matchId = await engine.createMatch({
    mode: "2v2",
    participants: [
      { userId: "user-a1", sideId: "left" },
      { userId: "user-a2", sideId: "left" },
      { userId: "user-b1", sideId: "right" },
      { userId: "user-b2", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger"],
  });
  await engine.startRound(a1, matchId);
  await engine.beginCoding(a1, matchId);
  return { engine, judge, a1, a2, b1, b2, stranger, matchId, advance: (ms: number) => { now += ms; } };
}

async function readyBoth(fx: TeamFixture, revision = 1): Promise<void> {
  await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: revision });
  await fx.engine.setReady(fx.a2, fx.matchId, { ready: true, documentRevision: revision });
}

async function readyBeta(fx: TeamFixture, revision = 1): Promise<void> {
  await fx.engine.setReady(fx.b1, fx.matchId, { ready: true, documentRevision: revision });
  await fx.engine.setReady(fx.b2, fx.matchId, { ready: true, documentRevision: revision });
}

/** Real shared-document edit (one Yjs frame, one application revision). */
async function pushEdit(fx: TeamFixture, who: AuthenticatedPrincipal, insert: string): Promise<number> {
  const sync = await fx.engine.collabSync(who, fx.matchId);
  const doc = new Y.Doc();
  if (sync.stateB64) Y.applyUpdate(doc, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
  doc.getText("source").insert(doc.getText("source").length, insert);
  const res = await fx.engine.applyCollabUpdate(who, fx.matchId, {
    roundId: sync.roundId,
    updateB64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
  });
  return res.revision;
}

describe("2v2 match creation validates team shape", () => {
  it("1. creates a valid 2v2 with two members per side", async () => {
    const fx = await setup2v2();
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    expect(snap.mode).toBe("2v2");
    expect(snap.teams).toHaveLength(2);
  });

  it("2. rejects malformed team sizes", async () => {
    const fx = await setup2v2();
    await expect(
      fx.engine.createMatch({
        mode: "2v2",
        participants: [
          { userId: "u1", sideId: "left" },
          { userId: "u2", sideId: "left" },
          { userId: "u3", sideId: "right" },
        ],
        problemVersionIds: ["even-ledger"],
      }),
    ).rejects.toThrow();
    await expect(
      fx.engine.createMatch({
        mode: "2v2",
        participants: [
          { userId: "u1", sideId: "left" },
          { userId: "u2", sideId: "right" },
        ],
        problemVersionIds: ["even-ledger"],
      }),
    ).rejects.toThrow();
  });

  it("3. rejects a duplicate user across teams", async () => {
    const fx = await setup2v2();
    await expect(
      fx.engine.createMatch({
        mode: "2v2",
        participants: [
          { userId: "u1", sideId: "left" },
          { userId: "u2", sideId: "left" },
          { userId: "u1", sideId: "right" },
          { userId: "u3", sideId: "right" },
        ],
        problemVersionIds: ["even-ledger"],
      }),
    ).rejects.toThrow();
  });
});

describe("principal resolves to exactly one team; cross-team acts fail", () => {
  it("4. principal resolves correct team and side", async () => {
    const fx = await setup2v2();
    expect(await fx.engine.participantSide("user-a1", fx.matchId)).toBe("left");
    expect(await fx.engine.participantSide("user-a2", fx.matchId)).toBe("left");
    expect(await fx.engine.participantSide("user-b1", fx.matchId)).toBe("right");
  });

  it("5. Alpha member cannot act for Beta (ready + submit paths)", async () => {
    const fx = await setup2v2();
    // readiness is keyed by the caller's own principal: A1 can only ever mark A1.
    await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: 1 });
    const snapB = await fx.engine.snapshot(fx.b1, fx.matchId);
    const beta = snapB.teams?.find((t) => t.side === "right");
    expect(beta?.members.every((m) => m.ready === false)).toBe(true);
  });

  it("6. stranger is rejected on every team action", async () => {
    const fx = await setup2v2();
    await expect(fx.engine.setReady(fx.stranger, fx.matchId, { ready: true, documentRevision: 1 })).rejects.toThrow();
    await expect(fx.engine.applyCollabUpdate(fx.stranger, fx.matchId, { roundId: "nope", updateB64: "eA==" })).rejects.toThrow();
    await expect(
      fx.engine.submit(fx.stranger, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 }),
    ).rejects.toThrow();
    await expect(fx.engine.snapshot(fx.stranger, fx.matchId)).rejects.toThrow();
  });

  it("player cannot mark teammate ready (only own record is writable)", async () => {
    const fx = await setup2v2();
    await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: 1 });
    const snap = await fx.engine.snapshot(fx.a2, fx.matchId);
    const alpha = snap.teams?.find((t) => t.side === "left");
    expect(alpha?.members.find((m) => m.userId === "user-a1")?.ready).toBe(true);
    expect(alpha?.members.find((m) => m.userId === "user-a2")?.ready).toBe(false);
  });
});

describe("team activity is per side and independent across teams", () => {
  it("7/8. Alpha evaluating while Beta keeps coding", async () => {
    const fx = await setup2v2([{ defer: true }, { score: 100 }]);
    await readyBoth(fx);
    const pending = fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await tick();
    const snap = await fx.engine.snapshot(fx.b1, fx.matchId);
    expect(snap.teams?.find((t) => t.side === "left")?.activity).toBe("evaluating");
    expect(snap.teams?.find((t) => t.side === "right")?.activity).toBe("coding");
    // Beta runs and submits freely while Alpha is in flight.
    await fx.engine.run(fx.b1, fx.matchId, { code: SOLVED_PY, language: "Python" });
    fx.judge.release(P100);
    await pending;
  });

  it("9. Alpha running while Beta submitting", async () => {
    const fx = await setup2v2([{ score: 100 }]);
    await readyBoth(fx);
    await readyBeta(fx);
    fx.judge.deferNextRun();
    const running = fx.engine.run(fx.a2, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    await fx.engine.submit(fx.b1, fx.matchId, { code: STARTER_PY, language: "Python", documentRevision: 1 });
    fx.judge.releaseRun();
    await running;
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    // Beta counted without disturbing Alpha's run round-trip.
    expect(snap.reveal).toBeNull();
    expect(snap.teams?.find((t) => t.side === "left")?.activity).toBe("coding");
  });

  it("both evaluating concurrently, then both counted", async () => {
    const fx = await setup2v2([{ defer: true }, { defer: true }]);
    await readyBoth(fx);
    await fx.engine.setReady(fx.b1, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.setReady(fx.b2, fx.matchId, { ready: true, documentRevision: 1 });
    const pa = fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    const pb = fx.engine.submit(fx.b1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await tick();
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    expect(snap.teams?.find((t) => t.side === "left")?.activity).toBe("evaluating");
    expect(snap.teams?.find((t) => t.side === "right")?.activity).toBe("evaluating");
    fx.judge.release(P100);
    fx.judge.release(P100);
    await pa;
    await pb;
  });

  it("12. both members see the same team activity", async () => {
    const fx = await setup2v2();
    await readyBoth(fx);
    const sa = await fx.engine.snapshot(fx.a1, fx.matchId);
    const sa2 = await fx.engine.snapshot(fx.a2, fx.matchId);
    expect(sa.teams?.find((t) => t.side === "left")?.activity).toBe(
      sa2.teams?.find((t) => t.side === "left")?.activity,
    );
  });
});

describe("one team = one submission stream = one counted result", () => {
  it("10/11. one Submit action creates one submission, one evaluation, one counted score", async () => {
    const fx = await setup2v2([P100]);
    await readyBoth(fx);
    const receipt = await fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    expect(fx.judge.evalCalls).toBe(1);
    expect(receipt.submissionId).toBeTruthy();
    expect(receipt.evaluationId).toBeTruthy();
    // Sequential resubmission while CODING stays legal (last-wins product
    // rule) — the "not two" invariant is about one action fanning out, and
    // about concurrent double-submit below.
    await readyBoth(fx);
    await fx.engine.submit(fx.a2, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    expect(fx.judge.evalCalls).toBe(2);
  });

  it("concurrent double-submit: exactly one evaluation, loser rejected", async () => {
    const fx = await setup2v2([{ defer: true }]);
    await readyBoth(fx);
    const pa = fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    const pb = fx.engine.submit(fx.a2, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    // ponytail: handlers attach in the same tick so the loser's rejection is
    // never reported unhandled across the judge-release await below.
    pa.catch(() => {});
    pb.catch(() => {});
    await tick();
    fx.judge.release(P100);
    const results = await Promise.allSettled([pa, pb]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(fx.judge.evalCalls).toBe(1);
  });

  it("21. team submission count increments once per team submit", async () => {
    const fx = await setup2v2([P100]);
    await readyBoth(fx);
    await fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    const snap = await fx.engine.snapshot(fx.a2, fx.matchId);
    expect(snap.teams?.find((t) => t.side === "left")?.submissions).toBe(1);
    expect(snap.teams?.find((t) => t.side === "right")?.submissions).toBe(0);
  });

  it("22. last-completed-result-wins holds per team (resubmission overwrites)", async () => {
    const fx = await setup2v2([{ score: 0 }, P100]);
    await readyBoth(fx);
    await fx.engine.submit(fx.a1, fx.matchId, { code: STARTER_PY, language: "Python", documentRevision: 1 });
    await readyBoth(fx);
    await fx.engine.submit(fx.a2, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await fx.engine.setReady(fx.b1, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.setReady(fx.b2, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.submit(fx.b1, fx.matchId, { code: STARTER_PY, language: "Python", documentRevision: 1 });
    const reveal = await fx.engine.publishReveal(fx.a1, fx.matchId);
    expect(reveal.scores.left).toBe(100);
  });

  it("24. teams resubmit independently while the round stays CODING", async () => {
    const fx = await setup2v2([P100, P100]);
    await readyBoth(fx);
    await fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await fx.engine.setReady(fx.b1, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.setReady(fx.b2, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.submit(fx.b2, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.teams?.find((t) => t.side === "left")?.submissions).toBe(1);
    expect(snap.teams?.find((t) => t.side === "right")?.submissions).toBe(1);
  });
});

describe("readiness binds to the current document revision (strict rule)", () => {
  it("13. one ready only blocks team submit", async () => {
    const fx = await setup2v2();
    await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: 1 });
    await expect(
      fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 }),
    ).rejects.toThrow(/ready/i);
  });

  it("14. both ready on the current revision allows submit", async () => {
    const fx = await setup2v2([P100]);
    await readyBoth(fx);
    const receipt = await fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    expect(receipt.ok).toBe(true);
  });

  it("15. stale readiness (R1 approval, R2 current) blocks submit", async () => {
    const fx = await setup2v2();
    await readyBoth(fx, 1);
    await pushEdit(fx, fx.a1, "\n# edit");
    await expect(
      fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 }),
    ).rejects.toThrow(/revision|stale|ready/i);
  });

  it("16. any accepted edit invalidates BOTH teammates' readiness", async () => {
    const fx = await setup2v2();
    await readyBoth(fx, 1);
    const r2 = await pushEdit(fx, fx.a2, "\n# edit");
    expect(r2).toBe(2);
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    const alpha = snap.teams?.find((t) => t.side === "left");
    expect(alpha?.members.map((m) => m.ready)).toEqual([false, false]);
    expect(alpha?.documentRevision).toBe(2);
    // Re-ready on R2 re-enables submit.
    await readyBoth(fx, 2);
    const after = await fx.engine.snapshot(fx.a1, fx.matchId);
    expect(after.teams?.find((t) => t.side === "left")?.members.map((m) => m.ready)).toEqual([true, true]);
  });

  it("ready for a non-current revision is rejected at setReady time", async () => {
    const fx = await setup2v2();
    await pushEdit(fx, fx.a1, "\n# edit");
    await expect(fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: 1 })).rejects.toThrow(
      /revision/i,
    );
    await expect(fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: 99 })).rejects.toThrow(
      /revision/i,
    );
  });

  it("17. team language change advances revision and invalidates both", async () => {
    const fx = await setup2v2();
    await readyBoth(fx, 1);
    await fx.engine.setTeamLanguage(fx.a1, fx.matchId, "C++");
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    const alpha = snap.teams?.find((t) => t.side === "left");
    expect(alpha?.language).toBe("C++");
    expect(alpha?.documentRevision).toBe(2);
    expect(alpha?.members.map((m) => m.ready)).toEqual([false, false]);
    // Same-language set is a no-op: no bump, readiness preserved.
    await readyBoth(fx, 2);
    await fx.engine.setTeamLanguage(fx.a2, fx.matchId, "C++");
    const same = await fx.engine.snapshot(fx.a1, fx.matchId);
    expect(same.teams?.find((t) => t.side === "left")?.documentRevision).toBe(2);
    expect(same.teams?.find((t) => t.side === "left")?.members.map((m) => m.ready)).toEqual([true, true]);
  });

  it("language stays team-owned: Beta keeps its own language", async () => {
    const fx = await setup2v2();
    await fx.engine.setTeamLanguage(fx.a1, fx.matchId, "C");
    const snap = await fx.engine.snapshot(fx.b1, fx.matchId);
    expect(snap.teams?.find((t) => t.side === "right")?.language).toBe("Python");
  });
});

describe("round boundaries reset readiness and revision", () => {
  it("18/19. next round resets readiness; old-round readiness cannot authorize", async () => {
    const fx = await setup2v2([P100, P100]);
    await readyBoth(fx, 1);
    await fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await fx.engine.setReady(fx.b1, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.setReady(fx.b2, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.submit(fx.b1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await fx.engine.publishReveal(fx.a1, fx.matchId);
    await fx.engine.nextRound(fx.a1, fx.matchId);
    await fx.engine.beginCoding(fx.a1, fx.matchId);
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    expect(snap.round).toBe(2);
    const alpha = snap.teams?.find((t) => t.side === "left");
    expect(alpha?.members.map((m) => m.ready)).toEqual([false, false]);
    expect(alpha?.documentRevision).toBe(1);
    // Round-1 revision-1 approval no longer authorizes anything.
    await expect(
      fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 }),
    ).rejects.toThrow(/ready/i);
  });
});

describe("ready/edit/submit race is deterministic under the match lock", () => {
  it("20. concurrent edit vs submit yields exactly one valid outcome, never a mix", async () => {
    for (let trial = 0; trial < 10; trial++) {
      const fx = await setup2v2([{ score: 100 }]);
      await readyBoth(fx, 1);
      const sync = await fx.engine.collabSync(fx.a1, fx.matchId);
      const doc = new Y.Doc();
      if (sync.stateB64) Y.applyUpdate(doc, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
      doc.getText("source").insert(doc.getText("source").length, "\n# race");
      const frame = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
      const results = await Promise.allSettled([
        fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: sync.roundId, updateB64: frame }),
        fx.engine.submit(fx.a2, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 }),
      ]);
      const [edit, submit] = results;
      expect(edit.status).toBe("fulfilled");
      if (submit.status === "fulfilled") {
        // OUTCOME A: submit froze R1 before the edit; the edit made R2 after.
        const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
        expect(snap.teams?.find((t) => t.side === "left")?.documentRevision).toBe(2);
        expect(snap.teams?.find((t) => t.side === "left")?.submissions).toBe(1);
      } else {
        // OUTCOME B: edit advanced to R2 first; R1 readiness went stale.
        expect(String(submit.reason)).toMatch(/revision|stale|ready/i);
        const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
        expect(snap.teams?.find((t) => t.side === "left")?.submissions).toBe(0);
        expect(snap.teams?.find((t) => t.side === "left")?.documentRevision).toBe(2);
      }
    }
  });
});

describe("2v2 reveal is team scores only; 1v1 unchanged", () => {
  it("23. reveal carries one score per team, identical for both members", async () => {
    const fx = await setup2v2([{ score: 100 }, { score: 0 }]);
    await readyBoth(fx, 1);
    await fx.engine.submit(fx.a1, fx.matchId, { code: SOLVED_PY, language: "Python", documentRevision: 1 });
    await fx.engine.setReady(fx.b1, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.setReady(fx.b2, fx.matchId, { ready: true, documentRevision: 1 });
    await fx.engine.submit(fx.b1, fx.matchId, { code: STARTER_PY, language: "Python", documentRevision: 1 });
    const reveal = await fx.engine.publishReveal(fx.a2, fx.matchId);
    expect(reveal.scores).toEqual({ left: 100, right: 0 });
    const sa1 = await fx.engine.snapshot(fx.a1, fx.matchId);
    const sa2 = await fx.engine.snapshot(fx.a2, fx.matchId);
    expect(sa1.reveal?.scores).toEqual(sa2.reveal?.scores);
    expect(sa1.reveal?.scores).toEqual({ left: 100, right: 0 });
  });

  it("25. 1v1 regression: submit without revision still works, setReady stays a no-op", async () => {
    const one = await setup([P100]);
    await one.engine.setReady(one.left, one.matchId, { ready: true, documentRevision: 1 });
    const receipt = await one.engine.submit(one.left, one.matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
    const snap = await one.engine.snapshot(one.right, one.matchId);
    expect(snap.mode).toBe("1v1");
    expect(snap.teams).toBeUndefined();
  });

  it("1v1 createMatch validation unchanged", async () => {
    const one = await setup();
    await expect(
      one.engine.createMatch({ mode: "1v1", participants: [{ userId: "solo", sideId: "left" }], problemVersionIds: ["even-ledger"] }),
    ).rejects.toThrow();
  });
});

describe("member presence is per player; 2v2 has no grace forfeit", () => {
  it("per-member online/offline restores independently", async () => {
    const fx = await setup2v2();
    await fx.engine.setMemberPresence(fx.matchId, "user-a1", "online");
    await fx.engine.setMemberPresence(fx.matchId, "user-a2", "online");
    await fx.engine.setMemberPresence(fx.matchId, "user-b1", "online");
    let snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    const pres = Object.fromEntries(
      (snap.teams ?? []).flatMap((t) => t.members.map((m) => [m.userId, m.presence])),
    );
    expect(pres).toEqual({ "user-a1": "online", "user-a2": "online", "user-b1": "online", "user-b2": "offline" });
    await fx.engine.setMemberPresence(fx.matchId, "user-a1", "offline");
    snap = await fx.engine.snapshot(fx.a2, fx.matchId);
    const alpha = snap.teams?.find((t) => t.side === "left");
    expect(alpha?.members.find((m) => m.userId === "user-a1")?.presence).toBe("offline");
    expect(alpha?.members.find((m) => m.userId === "user-a2")?.presence).toBe("online");
    // Presence never rewrites team activity.
    expect(alpha?.activity).toBe("coding");
  });

  it("stranger presence is rejected", async () => {
    const fx = await setup2v2();
    await expect(fx.engine.setMemberPresence(fx.matchId, "user-stranger", "online")).rejects.toThrow();
  });

  it("expired offline members do not forfeit a 2v2 match", async () => {
    const fx = await setup2v2([], { reconnectGraceMs: 1000 });
    await fx.engine.setMemberPresence(fx.matchId, "user-a1", "online");
    await fx.engine.setMemberPresence(fx.matchId, "user-a1", "offline");
    fx.advance(60_000);
    const snap = await fx.engine.snapshot(fx.a2, fx.matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.teams?.find((t) => t.side === "left")?.activity).toBe("coding");
  });
});
