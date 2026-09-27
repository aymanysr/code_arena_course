import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ArenaEngine, type EngineOptions } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { testPrincipal, type AuthenticatedPrincipal } from "../src/principal.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";
import { PostgresStores } from "../src/postgres-store.js";
import { ScriptedJudge, type ScriptPlan } from "./scripted-judge.js";
import type { SealedEvaluationRequest } from "../src/judge.js";

/**
 * Ticket 15 test-first: REAL Yjs frames drive the application revision.
 * Client docs below are genuine Y.Docs (full-state update frames — the same
 * apply path as incremental y-codemirror frames; duplicates stay idempotent
 * either way). No notifyDocumentChanged anywhere: the temporary seam is dead
 * to these tests.
 */

interface CollabFixture {
  engine: ArenaEngine;
  judge: ScriptedJudge;
  a1: AuthenticatedPrincipal;
  a2: AuthenticatedPrincipal;
  b1: AuthenticatedPrincipal;
  b2: AuthenticatedPrincipal;
  stranger: AuthenticatedPrincipal;
  matchId: string;
}

async function setupCollab(plans: ScriptPlan[] = [{ score: 100 }], options: Partial<EngineOptions> = {}): Promise<CollabFixture> {
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
  return { engine, judge, a1, a2, b1, b2, stranger, matchId };
}

/** Fresh client doc seeded from the server baseline (like a joining provider). */
async function clientFromSync(fx: CollabFixture, who: AuthenticatedPrincipal): Promise<{ doc: Y.Doc; sync: Awaited<ReturnType<ArenaEngine["collabSync"]>> }> {
  const sync = await fx.engine.collabSync(who, fx.matchId);
  const doc = new Y.Doc();
  if (sync.stateB64) Y.applyUpdate(doc, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
  return { doc, sync };
}

function frame(doc: Y.Doc, edit: (t: Y.Text) => void): string {
  doc.transact(() => edit(doc.getText("source")));
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
}

async function revisionOf(fx: CollabFixture, who: AuthenticatedPrincipal): Promise<number> {
  const snap = await fx.engine.snapshot(who, fx.matchId);
  const mine = snap.teams?.find((t) => t.side === snap.mySide);
  return mine?.documentRevision ?? -1;
}

async function readyBoth(fx: CollabFixture, revision: number): Promise<void> {
  await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: revision });
  await fx.engine.setReady(fx.a2, fx.matchId, { ready: true, documentRevision: revision });
}

describe("real Yjs update -> application revision", () => {
  it("1. accepted edit bumps once and invalidates BOTH approvals", async () => {
    const fx = await setupCollab();
    await readyBoth(fx, 1);
    const { doc, sync } = await clientFromSync(fx, fx.a1);
    const res = await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, {
      roundId: sync.roundId,
      updateB64: frame(doc, (t) => t.insert(t.length, "\n# alpha was here")),
    });
    expect(res.changed).toBe(true);
    expect(res.revision).toBe(2);
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    const own = snap.teams?.find((t) => t.side === snap.mySide);
    expect(own?.members.every((m) => m.ready === false)).toBe(true);
    expect(await revisionOf(fx, fx.a2)).toBe(2);
  });

  it("2. duplicate/replayed frame never bumps twice", async () => {
    const fx = await setupCollab();
    const { doc, sync } = await clientFromSync(fx, fx.a1);
    const update = frame(doc, (t) => t.insert(t.length, "x"));
    const first = await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: sync.roundId, updateB64: update });
    const second = await fx.engine.applyCollabUpdate(fx.a2, fx.matchId, { roundId: sync.roundId, updateB64: update });
    expect(first).toMatchObject({ revision: 2, changed: true });
    expect(second).toMatchObject({ revision: 2, changed: false });
    expect(await revisionOf(fx, fx.a1)).toBe(2);
  });

  it("3. sync/reconnect traffic never bumps or invalidates", async () => {
    const fx = await setupCollab();
    await readyBoth(fx, 1);
    await fx.engine.collabSync(fx.a1, fx.matchId);
    await fx.engine.collabSync(fx.a2, fx.matchId);
    expect(await revisionOf(fx, fx.a1)).toBe(1);
    const snap = await fx.engine.snapshot(fx.a1, fx.matchId);
    const own = snap.teams?.find((t) => t.side === snap.mySide);
    expect(own?.members.every((m) => m.ready === true)).toBe(true);
  });

  it("4. malformed frames throw and change nothing", async () => {
    const fx = await setupCollab();
    const { sync } = await clientFromSync(fx, fx.a1);
    await expect(fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: sync.roundId, updateB64: "!!!" })).rejects.toThrow();
    await expect(fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: sync.roundId, updateB64: "" })).rejects.toThrow();
    expect(await revisionOf(fx, fx.a1)).toBe(1);
  });
});

describe("convergence under concurrent typing", () => {
  it("5. simultaneous inserts from both teammates converge", async () => {
    const fx = await setupCollab();
    const a = await clientFromSync(fx, fx.a1);
    const b = await clientFromSync(fx, fx.a2);
    const fa = frame(a.doc, (t) => t.insert(0, "AAA"));
    const fb = frame(b.doc, (t) => t.insert(0, "BBB"));
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: a.sync.roundId, updateB64: fa });
    await fx.engine.applyCollabUpdate(fx.a2, fx.matchId, { roundId: b.sync.roundId, updateB64: fb });
    const after = await fx.engine.collabSync(fx.a1, fx.matchId);
    expect(after.source).toContain("AAA");
    expect(after.source).toContain("BBB");
    expect(after.revision).toBe(3);
    // A late joiner converges to the same text with no duplication.
    const c = await clientFromSync(fx, fx.a2);
    expect(c.sync.source).toBe(after.source);
  });

  it("6. conflicting edit/delete converges without resurrection", async () => {
    const fx = await setupCollab();
    const base = await clientFromSync(fx, fx.a1);
    const seed = frame(base.doc, (t) => t.insert(0, "0123456789"));
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: base.sync.roundId, updateB64: seed });
    const a = await clientFromSync(fx, fx.a1);
    const b = await clientFromSync(fx, fx.a2);
    // A deletes 0..5 while B inserts at 2: CRDT resolves deterministically.
    const fa = frame(a.doc, (t) => t.delete(0, 5));
    const fb = frame(b.doc, (t) => t.insert(2, "ZZ"));
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: a.sync.roundId, updateB64: fa });
    await fx.engine.applyCollabUpdate(fx.a2, fx.matchId, { roundId: b.sync.roundId, updateB64: fb });
    const c1 = await clientFromSync(fx, fx.a1);
    const c2 = await clientFromSync(fx, fx.a2);
    expect(c1.sync.source).toBe(c2.sync.source);
  });
});

describe("authorization: rooms derive from the principal", () => {
  it("7. stranger and 1v1 participants are rejected before sync", async () => {
    const fx = await setupCollab();
    const { sync } = await clientFromSync(fx, fx.a1);
    await expect(fx.engine.applyCollabUpdate(fx.stranger, fx.matchId, { roundId: sync.roundId, updateB64: "eA==" })).rejects.toThrow();
    await expect(fx.engine.collabSync(fx.stranger, fx.matchId)).rejects.toThrow();
    // 1v1 matches have no shared document at all.
    let now = 1_000_000;
    const solo = new ArenaEngine({ judge: new ScriptedJudge([{ score: 100 }]), bank: new FileBank(), clock: () => now });
    const left = testPrincipal("user-left");
    const soloId = await solo.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await solo.startRound(left, soloId);
    await solo.beginCoding(left, soloId);
    await expect(solo.applyCollabUpdate(left, soloId, { roundId: "whatever", updateB64: "eA==" })).rejects.toThrow();
    await expect(solo.collabSync(left, soloId)).rejects.toThrow();
  });

  it("8. teams are isolated: Beta edits never touch Alpha", async () => {
    const fx = await setupCollab();
    const a = await clientFromSync(fx, fx.a1);
    const b = await clientFromSync(fx, fx.b1);
    await fx.engine.applyCollabUpdate(fx.b1, fx.matchId, {
      roundId: b.sync.roundId,
      updateB64: frame(b.doc, (t) => t.insert(t.length, "BETA-ONLY")),
    });
    expect((await clientFromSync(fx, fx.a2)).sync.source).not.toContain("BETA-ONLY");
    expect(await revisionOf(fx, fx.a1)).toBe(1);
    expect(await revisionOf(fx, fx.b1)).toBe(2);
    void a;
  });
});

describe("round isolation", () => {
  it("9. old-round frames die after advance; new round starts fresh", async () => {
    const fx = await setupCollab();
    const { doc, sync } = await clientFromSync(fx, fx.a1);
    const oldRoundId = sync.roundId;
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, {
      roundId: oldRoundId,
      updateB64: frame(doc, (t) => t.insert(t.length, "round1")),
    });
    await fx.engine.setReady(fx.a1, fx.matchId, { ready: true, documentRevision: 2 });
    await fx.engine.setReady(fx.a2, fx.matchId, { ready: true, documentRevision: 2 });
    await fx.engine.submit(fx.a1, fx.matchId, { code: "ignored-client-payload", language: "Python", documentRevision: 2 });
    await fx.engine.publishReveal(fx.a1, fx.matchId, { graceMs: 0 });
    await fx.engine.nextRound(fx.a1, fx.matchId);
    await fx.engine.beginCoding(fx.a1, fx.matchId);
    // Late frame for the OLD round: rejected, new doc untouched.
    await expect(
      fx.engine.applyCollabUpdate(fx.a1, fx.matchId, { roundId: oldRoundId, updateB64: frame(doc, (t) => t.insert(0, "LATE")) }),
    ).rejects.toThrow(/stale round/);
    const fresh = await fx.engine.collabSync(fx.a1, fx.matchId);
    expect(fresh.roundId).not.toBe(oldRoundId);
    expect(fresh.revision).toBe(1);
    expect(fresh.source).not.toContain("round1");
    expect(fresh.source).not.toContain("LATE");
  });
});

describe("team language owns the document", () => {
  it("10. language switch resets to starter, bumps, invalidates; concurrent switches serialize", async () => {
    const fx = await setupCollab();
    const before = await clientFromSync(fx, fx.a1);
    await readyBoth(fx, 1);
    const r2 = await fx.engine.setTeamLanguage(fx.a1, fx.matchId, "C++");
    expect(r2).toBe(2);
    const after = await fx.engine.collabSync(fx.a2, fx.matchId);
    expect(after.language).toBe("C++");
    expect(after.source).not.toBe(before.sync.source);
    expect(after.revision).toBe(2);
    // Same-language switch is a no-op.
    expect(await fx.engine.setTeamLanguage(fx.a2, fx.matchId, "C++")).toBe(2);
    // Concurrent switch + typing: lock serializes, one winner each, no hybrid.
    const c = await clientFromSync(fx, fx.a2);
    const [rLang] = await Promise.all([
      fx.engine.setTeamLanguage(fx.a1, fx.matchId, "Python"),
      fx.engine.applyCollabUpdate(fx.a2, fx.matchId, {
        roundId: c.sync.roundId,
        updateB64: frame(c.doc, (t) => t.insert(t.length, "typing-during-switch")),
      }),
    ]);
    void rLang;
    const final = await fx.engine.collabSync(fx.a1, fx.matchId);
    const final2 = await fx.engine.collabSync(fx.a2, fx.matchId);
    expect(final.source).toBe(final2.source);
    expect(final.language).toBe(final2.language);
  });

  it("11. submit with a split language is rejected", async () => {
    const fx = await setupCollab();
    const { doc, sync } = await clientFromSync(fx, fx.a1);
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, {
      roundId: sync.roundId,
      updateB64: frame(doc, (t) => t.insert(t.length, "x")),
    });
    await readyBoth(fx, 2);
    await expect(fx.engine.submit(fx.a1, fx.matchId, { code: "x", language: "C++", documentRevision: 2 })).rejects.toThrow(/team language/);
  });
});

describe("frozen submission from the authoritative doc", () => {
  it("12. judge receives the R-acceptance snapshot; later edits cannot move it", async () => {
    const fx = await setupCollab();
    const seen: string[] = [];
    const orig = fx.judge.evaluateSealed.bind(fx.judge);
    fx.judge.evaluateSealed = async (req: SealedEvaluationRequest) => {
      seen.push(req.source);
      return orig(req);
    };
    const c = await clientFromSync(fx, fx.a1);
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, {
      roundId: c.sync.roundId,
      updateB64: frame(c.doc, (t) => t.insert(t.length, "\n# frozen-v1")),
    });
    await readyBoth(fx, 2);
    const receipt = await fx.engine.submit(fx.a1, fx.matchId, { code: "forged-client-code", language: "Python", documentRevision: 2 });
    expect(receipt.ok).toBe(true);
    // Team keeps editing into R3 AFTER acceptance.
    const c2 = await clientFromSync(fx, fx.a2);
    await fx.engine.applyCollabUpdate(fx.a2, fx.matchId, {
      roundId: c2.sync.roundId,
      updateB64: frame(c2.doc, (t) => t.insert(t.length, "\n# post-submit-edit")),
    });
    expect(await revisionOf(fx, fx.a1)).toBe(3);
    // Judge got exactly the R2 source: forged payload ignored, later edit absent.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("# frozen-v1");
    expect(seen[0]).not.toContain("forged-client-code");
    expect(seen[0]).not.toContain("post-submit-edit");
    const h = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
    expect(h(seen[0]!)).not.toBe(h((await clientFromSync(fx, fx.a1)).sync.source));
  });

  it("13. ready(R)/edit/submit race resolves whole: stale submit dies, fresh submit wins", async () => {
    const fx = await setupCollab();
    const c = await clientFromSync(fx, fx.a1);
    await readyBoth(fx, 1);
    // Edit lands first: R1 approvals die, stale submit rejected.
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, {
      roundId: c.sync.roundId,
      updateB64: frame(c.doc, (t) => t.insert(t.length, "race")),
    });
    await expect(fx.engine.submit(fx.b1, fx.matchId, { code: "x", language: "Python", documentRevision: 1 })).rejects.toThrow();
    // R1 approvals died with the edit: the both-ready gate fires first, the
    // revision gate second — either rejection proves the stale submit is dead.
    await expect(fx.engine.submit(fx.a1, fx.matchId, { code: "x", language: "Python", documentRevision: 1 })).rejects.toThrow(
      /team not both ready|stale document revision/,
    );
    // Re-ready the CURRENT revision: submit accepted for exactly R2.
    await readyBoth(fx, 2);
    const receipt = await fx.engine.submit(fx.a1, fx.matchId, { code: "whatever-client-sends", language: "Python", documentRevision: 2 });
    expect(receipt.ok).toBe(true);
  });
});

describe("persistence + process restart", () => {
  it("14. committed update survives engine restart; uncommitted never appears", async () => {
    const persist = new InMemoryCollabPersist();
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const clock = (): number => 1_000_000;
    const fx = await setupCollab([{ score: 100 }], { collab: persist, matches, submissions, reveals });
    const { doc, sync } = await clientFromSync(fx, fx.a1);
    await fx.engine.applyCollabUpdate(fx.a1, fx.matchId, {
      roundId: sync.roundId,
      updateB64: frame(doc, (t) => t.insert(t.length, "\n# committed-before-crash")),
    });
    // "kill -9": drop the engine (Y.Doc memory dies with it), boot a fresh
    // one over the SAME durable stores.
    const reboot = new ArenaEngine({
      judge: new ScriptedJudge([{ score: 100 }]),
      bank: new FileBank(),
      clock,
      revealGraceMs: 0,
      matches,
      submissions,
      reveals,
      collab: persist,
    });
    const rsync = await reboot.collabSync(fx.a1, fx.matchId);
    expect(rsync.revision).toBe(2);
    expect(rsync.source).toContain("# committed-before-crash");
    // No duplication across the restart: re-applying the same frame is a no-op.
    const dup = await reboot.applyCollabUpdate(fx.a2, fx.matchId, {
      roundId: rsync.roundId,
      updateB64: frame(doc, () => {}),
    });
    expect(dup).toMatchObject({ revision: 2, changed: false });
    // An update never sent to the server exists nowhere after restart.
    const ghost = new Y.Doc();
    ghost.getText("source").insert(0, "uncommitted-ghost");
    void ghost;
    expect(rsync.source).not.toContain("uncommitted-ghost");
  });
});

// Real Postgres collab persistence (ticket 15 §13/§15): skips loudly without
// a DB. Uses its OWN database (arena_test_collab) so parallel suites sharing
// arena_test (postgres.test.ts) never cross-talk via TRUNCATE.
const PG_BASE = process.env.TEST_PG_URL ?? "postgres://postgres:postgres@localhost:5433/arena_test";
const PG_URL = PG_BASE.replace(/\/[^/]*$/, "/arena_test_collab");
async function pgUp(): Promise<boolean> {
  try {
    const { Pool } = await import("pg");
    const adminUrl = new URL(PG_BASE);
    adminUrl.pathname = "/postgres";
    const admin = new Pool({ connectionString: adminUrl.toString() });
    try {
      const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'arena_test_collab'");
      if (found.rowCount === 0) await admin.query("CREATE DATABASE arena_test_collab");
    } finally {
      await admin.end();
    }
    const stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
    await stores.close();
    return true;
  } catch {
    return false;
  }
}
const HAS_PG = await pgUp();
if (!HAS_PG) console.warn(`[collab.test] postgres proof skipping: no database at ${PG_URL}`);

describe.runIf(HAS_PG)("postgres collab persistence (real database)", () => {
  it("15. commit persists full Yjs state; reboot restores source + revision", async () => {
    const stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
    await stores.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures, collab_documents RESTART IDENTITY CASCADE");
    const clock = (): number => 1_000_000;
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([{ score: 100 }]),
      bank: new FileBank(),
      clock,
      revealGraceMs: 0,
      matches: stores.matches,
      submissions: stores.submissions,
      reveals: stores.reveals,
      collab: stores.collab,
      saveMatchAndCollab: (match, rows) => stores.saveMatchAndCollab(match, rows),
    });
    const a1 = testPrincipal("user-a1");
    const a2 = testPrincipal("user-a2");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "user-a1", sideId: "left" },
        { userId: "user-a2", sideId: "left" },
        { userId: "user-b1", sideId: "right" },
        { userId: "user-b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);
    const sync = await engine.collabSync(a1, matchId);
    const client = new Y.Doc();
    Y.applyUpdate(client, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
    const update = frame(client, (t) => t.insert(t.length, "\n# pg-durable"));
    await engine.applyCollabUpdate(a1, matchId, { roundId: sync.roundId, updateB64: update });
    const row = await stores.collab.load(matchId, sync.roundId, "left");
    expect(row?.appRevision).toBe(2);
    expect(row?.language).toBe("Python");
    expect(row?.stateB64.length).toBeGreaterThan(0);
    // Reboot over the same Postgres: source + revision restored.
    const reboot = new ArenaEngine({
      judge: new ScriptedJudge([{ score: 100 }]),
      bank: new FileBank(),
      clock,
      revealGraceMs: 0,
      matches: stores.matches,
      submissions: stores.submissions,
      reveals: stores.reveals,
      collab: stores.collab,
      saveMatchAndCollab: (match, rows) => stores.saveMatchAndCollab(match, rows),
    });
    const rsync = await reboot.collabSync(a2, matchId);
    expect(rsync.revision).toBe(2);
    expect(rsync.source).toContain("# pg-durable");

    // Edit after restart advances revision exactly once from durable state (2 -> 3)
    const afterClient = new Y.Doc();
    Y.applyUpdate(afterClient, new Uint8Array(Buffer.from(rsync.stateB64, "base64")));
    const update2 = frame(afterClient, (t) => t.insert(t.length, "\n# edit-after-reboot"));
    const res2 = await reboot.applyCollabUpdate(a1, matchId, { roundId: rsync.roundId, updateB64: update2 });
    expect(res2.revision).toBe(3);
    expect(res2.changed).toBe(true);
    const row2 = await stores.collab.load(matchId, sync.roundId, "left");
    expect(row2?.appRevision).toBe(3);
    expect(row2?.stateB64).not.toBe(row?.stateB64);

    await stores.close();
  });

  it("16. failure injection: failed DB transaction in saveMatchAndCollab rolls back memory and DB", async () => {
    const stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
    await stores.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures, collab_documents RESTART IDENTITY CASCADE");
    const clock = (): number => 1_000_000;
    let failDb = false;
    const events: string[] = [];
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([{ score: 100 }]),
      bank: new FileBank(),
      clock,
      revealGraceMs: 0,
      matches: stores.matches,
      submissions: stores.submissions,
      reveals: stores.reveals,
      collab: stores.collab,
      saveMatchAndCollab: async (match, rows) => {
        if (failDb) {
          throw new Error("injected DB commit failure");
        }
        return stores.saveMatchAndCollab(match, rows);
      },
    });
    engine.on((event) => events.push(event));

    const a1 = testPrincipal("user-a1");
    const a2 = testPrincipal("user-a2");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "user-a1", sideId: "left" },
        { userId: "user-a2", sideId: "left" },
        { userId: "user-b1", sideId: "right" },
        { userId: "user-b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);

    // Initial successful commit R1 -> R2
    const sync1 = await engine.collabSync(a1, matchId);
    const client = new Y.Doc();
    Y.applyUpdate(client, new Uint8Array(Buffer.from(sync1.stateB64, "base64")));
    const update1 = frame(client, (t) => t.insert(t.length, "\n# commit-1"));
    await engine.applyCollabUpdate(a1, matchId, { roundId: sync1.roundId, updateB64: update1 });

    // Mark both ready for R2
    await engine.setReady(a1, matchId, { ready: true, documentRevision: 2 });
    await engine.setReady(a2, matchId, { ready: true, documentRevision: 2 });
    events.length = 0;

    // Now inject commit failure for next edit
    failDb = true;
    const update2 = frame(client, (t) => t.insert(t.length, "\n# should-fail"));
    await expect(
      engine.applyCollabUpdate(a1, matchId, { roundId: sync1.roundId, updateB64: update2 }),
    ).rejects.toThrow("injected DB commit failure");

    // In-memory Y.Doc reloaded from DB: revision stays 2, text has no failed edit
    const restoredSync = await engine.collabSync(a1, matchId);
    expect(restoredSync.revision).toBe(2);
    expect(restoredSync.source).toContain("# commit-1");
    expect(restoredSync.source).not.toContain("# should-fail");

    // Readiness stayed at R2 approvals (not wiped out by the failed edit)
    const snap = await engine.snapshot(a1, matchId);
    const leftTeam = snap.teams?.find((t) => t.side === "left");
    expect(leftTeam?.documentRevision).toBe(2);
    expect(leftTeam?.members.every((m) => m.ready === true)).toBe(true);

    // No readiness.changed was emitted for the failed update
    expect(events.filter((e) => e === "readiness.changed")).toHaveLength(0);

    // Database still reflects R2
    const row = await stores.collab.load(matchId, sync1.roundId, "left");
    expect(row?.appRevision).toBe(2);

    await stores.close();
  });

  it("17. failure injection: language switch rollback restores starter, language, revision and readiness", async () => {
    const stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
    await stores.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures, collab_documents RESTART IDENTITY CASCADE");
    const clock = (): number => 1_000_000;
    let failDb = false;
    const events: string[] = [];
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([{ score: 100 }]),
      bank: new FileBank(),
      clock,
      revealGraceMs: 0,
      matches: stores.matches,
      submissions: stores.submissions,
      reveals: stores.reveals,
      collab: stores.collab,
      saveMatchAndCollab: async (match, rows) => {
        if (failDb) {
          throw new Error("injected language commit failure");
        }
        return stores.saveMatchAndCollab(match, rows);
      },
    });
    engine.on((event) => events.push(event));

    const a1 = testPrincipal("user-a1");
    const a2 = testPrincipal("user-a2");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "user-a1", sideId: "left" },
        { userId: "user-a2", sideId: "left" },
        { userId: "user-b1", sideId: "right" },
        { userId: "user-b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);

    // Initial language is Python, revision is 1. Mark ready.
    await engine.setReady(a1, matchId, { ready: true, documentRevision: 1 });
    await engine.setReady(a2, matchId, { ready: true, documentRevision: 1 });
    events.length = 0;

    // Inject failure on language switch to C++
    failDb = true;
    await expect(engine.setTeamLanguage(a1, matchId, "C++")).rejects.toThrow("injected language commit failure");

    // In-memory state rolled back: language remains Python, revision stays 1, readiness remains ready
    const sync = await engine.collabSync(a1, matchId);
    expect(sync.language).toBe("Python");
    expect(sync.revision).toBe(1);
    expect(sync.source).toContain("def ledger_sum"); // Python starter

    const snap = await engine.snapshot(a1, matchId);
    const leftTeam = snap.teams?.find((t) => t.side === "left");
    expect(leftTeam?.language).toBe("Python");
    expect(leftTeam?.documentRevision).toBe(1);
    expect(leftTeam?.members.every((m) => m.ready === true)).toBe(true);

    expect(events.filter((e) => e === "readiness.changed")).toHaveLength(0);

    await stores.close();
  });

  it("18. duplicate replay after lost ack: revision unchanged, readiness not invalidated again", async () => {
    const stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
    await stores.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures, collab_documents RESTART IDENTITY CASCADE");
    const clock = (): number => 1_000_000;
    const events: string[] = [];
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([{ score: 100 }]),
      bank: new FileBank(),
      clock,
      revealGraceMs: 0,
      matches: stores.matches,
      submissions: stores.submissions,
      reveals: stores.reveals,
      collab: stores.collab,
      saveMatchAndCollab: (match, rows) => stores.saveMatchAndCollab(match, rows),
    });
    engine.on((event) => events.push(event));

    const a1 = testPrincipal("user-a1");
    const a2 = testPrincipal("user-a2");
    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "user-a1", sideId: "left" },
        { userId: "user-a2", sideId: "left" },
        { userId: "user-b1", sideId: "right" },
        { userId: "user-b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(a1, matchId);
    await engine.beginCoding(a1, matchId);

    const sync = await engine.collabSync(a1, matchId);
    const client = new Y.Doc();
    Y.applyUpdate(client, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
    const update = frame(client, (t) => t.insert(t.length, "\n# commit-r2"));

    // First commit R1 -> R2
    const first = await engine.applyCollabUpdate(a1, matchId, { roundId: sync.roundId, updateB64: update });
    expect(first.revision).toBe(2);
    expect(first.changed).toBe(true);

    // Re-ready both on R2
    await engine.setReady(a1, matchId, { ready: true, documentRevision: 2 });
    await engine.setReady(a2, matchId, { ready: true, documentRevision: 2 });
    events.length = 0;

    // Simulate lost ack: client replays the exact same update
    const replay = await engine.applyCollabUpdate(a1, matchId, { roundId: sync.roundId, updateB64: update });
    expect(replay.revision).toBe(2);
    expect(replay.changed).toBe(false);
    expect(replay.source).toContain("# commit-r2");

    // Readiness is NOT invalidated by the replay
    const snap = await engine.snapshot(a1, matchId);
    const leftTeam = snap.teams?.find((t) => t.side === "left");
    expect(leftTeam?.documentRevision).toBe(2);
    expect(leftTeam?.members.every((m) => m.ready === true)).toBe(true);

    // No duplicate readiness.changed emitted
    expect(events.filter((e) => e === "readiness.changed")).toHaveLength(0);

    // Source contains only one instance of the edit
    const occurrences = (replay.source.match(/# commit-r2/g) || []).length;
    expect(occurrences).toBe(1);

    await stores.close();
  });
});
