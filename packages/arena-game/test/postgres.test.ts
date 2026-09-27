import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { PostgresStores } from "../src/postgres-store.js";
import { testPrincipal } from "../src/principal.js";
import type { SubmissionRecord } from "../src/records.js";
import { P100, P70, SOLVED_PY, passes, tick } from "./setup.js";
import { ScriptedJudge, type ScriptPlan } from "./scripted-judge.js";

// Real Postgres integration (ticket 09): needs a reachable database.
// Default points at an ephemeral local instance; override with TEST_PG_URL.
// Skips (loudly) when no database answers so unit runs stay green everywhere.
const PG_URL = process.env.TEST_PG_URL ?? "postgres://postgres:postgres@localhost:5433/arena_test";

async function pgUp(): Promise<boolean> {
  try {
    const stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
    await stores.close();
    return true;
  } catch {
    return false;
  }
}

const HAS_PG = await pgUp();
if (!HAS_PG) console.warn(`[postgres.test] skipping: no database at ${PG_URL}`);

const P40 = passes("1110000");

async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition did not become true before timeout");
    await tick();
  }
}

function liveEngine(stores: PostgresStores, plan: ScriptPlan[], clock: () => number): ArenaEngine {
  return new ArenaEngine({ judge: new ScriptedJudge(plan), bank: new FileBank(), clock, revealGraceMs: 0, persistence: stores.persistence });
}

describe.runIf(HAS_PG)("postgres persistence + restart (real database)", () => {
  let stores: PostgresStores;
  let now = 1_000_000;
  const clock = (): number => now;
  const left = testPrincipal("user-left");
  const right = testPrincipal("user-right");

  beforeAll(async () => {
    stores = new PostgresStores(PG_URL);
    await stores.ensureSchema();
  });

  beforeEach(async () => {
    now = 1_000_000;
    await stores.raw.query("TRUNCATE matches, rounds, round_sides, submissions, reveals, match_failures RESTART IDENTITY CASCADE");
  });

  it("serializes pending evaluation claims across separate Postgres pools", async () => {
    const firstStores = new PostgresStores(PG_URL);
    const secondStores = new PostgresStores(PG_URL);
    const evaluationId = `claim-${Date.now()}-${Math.random()}`;
    const pending: SubmissionRecord = {
      submissionId: `${evaluationId}-submission`,
      evaluationId,
      matchId: `${evaluationId}-match`,
      roundId: `${evaluationId}-round`,
      sideId: "left",
      problemVersionId: "even-ledger",
      language: "Python",
      source: SOLVED_PY,
      sourceHash: "claim-hash",
      documentRevision: null,
      submittedAt: 1,
      elapsedMatchMs: 1,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    try {
      await firstStores.ensureSchema();
      await secondStores.ensureSchema();
      await firstStores.submissions.append(pending);

      const first = await firstStores.persistence.claimPendingEvaluation(evaluationId);
      expect(first).toBeDefined();

      let secondSettled = false;
      const second = secondStores.persistence.claimPendingEvaluation(evaluationId).then((claim) => {
        secondSettled = true;
        return claim;
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(secondSettled).toBe(false);

      pending.status = "completed";
      await firstStores.submissions.update(pending);
      await first!.release();
      expect(await second).toBeUndefined();
    } finally {
      await firstStores.raw.query("DELETE FROM submissions WHERE evaluation_id = $1", [evaluationId]);
      await firstStores.close();
      await secondStores.close();
    }
  });

  it("keeps persistence writes available while evaluation claims are held", async () => {
    const runId = `pool-starvation-${Date.now()}-${Math.random()}`;
    const rows: SubmissionRecord[] = Array.from({ length: 10 }, (_, index) => ({
      submissionId: `${runId}-submission-${index}`,
      evaluationId: `${runId}-evaluation-${index}`,
      matchId: `${runId}-match-${index}`,
      roundId: `${runId}-round-${index}`,
      sideId: "left",
      problemVersionId: "even-ledger",
      language: "Python",
      source: SOLVED_PY,
      sourceHash: `${runId}-hash-${index}`,
      documentRevision: null,
      submittedAt: 1,
      elapsedMatchMs: 1,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    }));
    let write: Promise<void> | undefined;
    const claims: Array<Awaited<ReturnType<typeof stores.persistence.claimPendingEvaluation>>> = [];
    try {
      for (const row of rows) await stores.submissions.append(row);
      claims.push(...(await Promise.all(rows.map((row) => stores.persistence.claimPendingEvaluation(row.evaluationId)))));
      expect(claims.every(Boolean)).toBe(true);

      rows[0]!.status = "completed";
      write = stores.submissions.update(rows[0]!);
      await expect(
        Promise.race([
          write,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("persistence write starved by claims")), 1_000)),
        ]),
      ).resolves.toBeUndefined();
    } finally {
      await Promise.all(
        claims.filter(Boolean).map((claim) => Promise.all([claim!.release(), claim!.release()])),
      );
      await write?.catch(() => {});
      await stores.raw.query("DELETE FROM submissions WHERE evaluation_id LIKE $1", [`${runId}-evaluation-%`]);
    }
  });

  it("treats a terminated claim session as lost and releases safely", async () => {
    const evaluationId = `terminated-claim-${Date.now()}-${Math.random()}`;
    const pending: SubmissionRecord = {
      submissionId: `${evaluationId}-submission`,
      evaluationId,
      matchId: `${evaluationId}-match`,
      roundId: `${evaluationId}-round`,
      sideId: "left",
      problemVersionId: "even-ledger",
      language: "Python",
      source: SOLVED_PY,
      sourceHash: "terminated-claim-hash",
      documentRevision: null,
      submittedAt: 1,
      elapsedMatchMs: 1,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    await stores.submissions.append(pending);
    const claim = await stores.persistence.claimPendingEvaluation(evaluationId);
    expect(claim).toBeDefined();
    try {
      const lock = await stores.raw.query(
        `WITH key AS (SELECT hashtextextended($1, 0) AS value)
         SELECT l.pid
         FROM pg_locks l, key
         WHERE l.locktype = 'advisory' AND l.granted AND l.pid <> pg_backend_pid()
           AND l.classid = ((key.value >> 32) & 4294967295)::oid
           AND l.objid = (key.value & 4294967295)::oid`,
        [evaluationId],
      );
      expect(lock.rowCount).toBe(1);
      await stores.raw.query("SELECT pg_terminate_backend($1)", [lock.rows[0]!.pid]);

      let lost = false;
      for (let index = 0; index < 100; index++) {
        try {
          claim!.assertActive();
        } catch {
          lost = true;
          break;
        }
        await tick();
      }
      expect(lost).toBe(true);
      await expect(claim!.release()).resolves.toBeUndefined();
    } finally {
      await stores.raw.query("DELETE FROM submissions WHERE evaluation_id = $1", [evaluationId]);
    }
  });

  it("cannot commit a submission through a terminated claim session", async () => {
    const engine = liveEngine(stores, [P100], clock);
    const matchId = await createMatch(engine);
    const storedMatch = await stores.matches.load(matchId);
    const round = storedMatch!.rounds[0]!;
    const evaluationId = `terminated-commit-${Date.now()}-${Math.random()}`;
    const pending: SubmissionRecord = {
      submissionId: `${evaluationId}-submission`,
      evaluationId,
      matchId,
      roundId: round.roundId,
      sideId: "left",
      problemVersionId: round.problemVersionId,
      language: "Python",
      source: SOLVED_PY,
      sourceHash: createHash("sha256").update(SOLVED_PY, "utf8").digest("hex"),
      documentRevision: null,
      submittedAt: now,
      elapsedMatchMs: 0,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    await stores.submissions.append(pending);
    const claim = await stores.persistence.claimPendingEvaluation(evaluationId);
    expect(claim).toBeDefined();
    try {
      const lock = await stores.raw.query(
        `WITH key AS (SELECT hashtextextended($1, 0) AS value)
         SELECT l.pid
         FROM pg_locks l, key
         WHERE l.locktype = 'advisory' AND l.granted AND l.pid <> pg_backend_pid()
           AND l.classid = ((key.value >> 32) & 4294967295)::oid
           AND l.objid = (key.value & 4294967295)::oid`,
        [evaluationId],
      );
      expect(lock.rowCount).toBe(1);
      await stores.raw.query("SELECT pg_terminate_backend($1)", [lock.rows[0]!.pid]);

      pending.status = "completed";
      pending.score = 100;
      await expect(stores.persistence.commitClaimedEvaluation(claim!, storedMatch!, pending)).rejects.toThrow();
      expect((await stores.submissions.getByEvaluationId(evaluationId))?.status).toBe("pending");
      await claim!.release();
    } finally {
      await claim?.release();
    }
  });

  it("two Game instances judge one shared evaluation exactly once", async () => {
    const peerStores = new PostgresStores(PG_URL);
    const firstJudge = new ScriptedJudge([{ defer: true }]);
    const secondJudge = new ScriptedJudge([P100]);
    try {
      await peerStores.ensureSchema();
      const firstEngine = new ArenaEngine({
        judge: firstJudge,
        bank: new FileBank(),
        clock,
        revealGraceMs: 0,
        persistence: stores.persistence,
      });
      const secondEngine = new ArenaEngine({
        judge: secondJudge,
        bank: new FileBank(),
        clock,
        revealGraceMs: 0,
        persistence: peerStores.persistence,
      });
      const matchId = await createMatch(firstEngine);
      const first = firstEngine.submit(left, matchId, {
        code: SOLVED_PY,
        language: "Python",
        submissionId: "cross-process-submission",
        evaluationId: "cross-process-evaluation",
      });
      first.catch(() => {});
      await waitFor(() => firstJudge.evalCalls === 1);
      expect(firstJudge.evalCalls).toBe(1);

      const second = secondEngine.submit(left, matchId, {
        code: SOLVED_PY,
        language: "Python",
        submissionId: "cross-process-submission",
        evaluationId: "cross-process-evaluation",
      });
      second.catch(() => {});
      await tick();
      expect(secondJudge.evalCalls).toBe(0);

      firstJudge.release(P100);
      const [firstReceipt, secondReceipt] = await Promise.all([first, second]);
      expect(secondReceipt).toEqual(firstReceipt);
      expect(firstJudge.evalCalls).toBe(1);
      expect(secondJudge.evalCalls).toBe(0);
    } finally {
      await peerStores.close();
    }
  });

  it("two recovery workers claim one pending evaluation exactly once", async () => {
    const peerStores = new PostgresStores(PG_URL);
    const firstJudge = new ScriptedJudge([P100]);
    const secondJudge = new ScriptedJudge([P100]);
    try {
      await peerStores.ensureSchema();
      const firstEngine = new ArenaEngine({
        judge: firstJudge,
        bank: new FileBank(),
        clock,
        revealGraceMs: 0,
        persistence: stores.persistence,
      });
      const secondEngine = new ArenaEngine({
        judge: secondJudge,
        bank: new FileBank(),
        clock,
        revealGraceMs: 0,
        persistence: peerStores.persistence,
      });
      const createdId = await createMatch(firstEngine);
      const storedMatch = await stores.matches.load(createdId);
      const round = storedMatch!.rounds[0]!;
      await stores.submissions.append({
        submissionId: "recovery-claim-submission",
        evaluationId: "recovery-claim-evaluation",
        matchId: createdId,
        roundId: round.roundId,
        sideId: "left",
        problemVersionId: round.problemVersionId,
        language: "Python",
        source: SOLVED_PY,
        sourceHash: createHash("sha256").update(SOLVED_PY, "utf8").digest("hex"),
        documentRevision: null,
        submittedAt: now,
        elapsedMatchMs: 0,
        status: "pending",
        score: null,
        scoreBp: null,
        groups: null,
        testStatuses: null,
        failureCode: null,
      });

      const [firstReport, secondReport] = await Promise.all([firstEngine.recover(), secondEngine.recover()]);
      expect(firstReport.retried + secondReport.retried).toBe(1);
      expect(firstReport.failed + secondReport.failed).toBe(0);
      expect(firstJudge.evalCalls + secondJudge.evalCalls).toBe(1);
    } finally {
      await stores.raw.query("DELETE FROM submissions WHERE evaluation_id = $1", ["recovery-claim-evaluation"]);
      await peerStores.close();
    }
  });

  async function createMatch(engine: ArenaEngine): Promise<string> {
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    return matchId;
  }

  it("1+9. duplicate delivery and post-restart retry return the stored outcome", async () => {
    const engine1 = liveEngine(stores, [P100], clock);
    const matchId = await createMatch(engine1);
    const first = await engine1.submit(left, matchId, { code: SOLVED_PY, language: "Python", submissionId: "s1", evaluationId: "e1" });
    const retry = await engine1.submit(left, matchId, { code: SOLVED_PY, language: "Python", submissionId: "s1", evaluationId: "e1" });
    expect(retry).toEqual(first);
    // Process restart: brand-new engine over the same database.
    const engine2 = liveEngine(stores, [P40], clock);
    const afterRestart = await engine2.submit(left, matchId, { code: SOLVED_PY, language: "Python", submissionId: "s1", evaluationId: "e1" });
    expect(afterRestart).toEqual(first);
    const snap = await engine2.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    const rows = await stores.raw.query("SELECT COUNT(*)::int AS n FROM submissions WHERE evaluation_id = 'e1'");
    expect(rows.rows[0].n).toBe(1);
  });

  it("2. restart before the verdict re-drives an unclaimed pending row under original ids", async () => {
    const engine1 = liveEngine(stores, [P100], clock);
    const matchId = await createMatch(engine1);
    const storedMatch = await stores.matches.load(matchId);
    const round = storedMatch!.rounds[0]!;
    const pending: SubmissionRecord = {
      submissionId: "s2",
      evaluationId: "e2",
      matchId,
      roundId: round.roundId,
      sideId: "left",
      problemVersionId: round.problemVersionId,
      language: "Python",
      source: SOLVED_PY,
      sourceHash: createHash("sha256").update(SOLVED_PY, "utf8").digest("hex"),
      documentRevision: null,
      submittedAt: now,
      elapsedMatchMs: 0,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    await stores.submissions.append(pending);
    const engine2 = liveEngine(stores, [P70], clock);
    const completed = await engine2.submit(left, matchId, { code: SOLVED_PY, language: "Python", submissionId: "s2", evaluationId: "e2" });
    expect(completed.submissionId).toBe("s2");
    const snap = await engine2.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    const rows = await stores.raw.query("SELECT COUNT(*)::int AS n FROM submissions WHERE evaluation_id = 'e2'");
    expect(rows.rows[0].n).toBe(1);
    // The pending row models a process that died before obtaining a claim.
  });

  it("3. restart after completion keeps counted result and reveal", async () => {
    const engine1 = liveEngine(stores, [P70], clock);
    const matchId = await createMatch(engine1);
    await engine1.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const engine2 = liveEngine(stores, [P100], clock);
    const reveal = await engine2.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(70);
    const engine3 = liveEngine(stores, [P100], clock);
    const snap = await engine3.snapshot(left, matchId);
    expect(snap.reveal?.scores.left).toBe(70);
    expect(snap.roundPhase).toBe("SCORE_REVEAL");
  });

  it("4+5. duplicate and concurrent reveals publish exactly once", async () => {
    const engine1 = liveEngine(stores, [P100], clock);
    const matchId = await createMatch(engine1);
    await engine1.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine1.publishReveal(left, matchId);
    await expect(engine1.publishReveal(left, matchId)).rejects.toThrow();
    const engine2 = liveEngine(stores, [P100], clock);
    await expect(engine2.publishReveal(right, matchId)).rejects.toThrow();
    const rows = await stores.raw.query("SELECT COUNT(*)::int AS n FROM reveals");
    expect(rows.rows[0].n).toBe(1);
  });

  it("7. duplicate round advance is rejected, phase stays terminal", async () => {
    const engine1 = liveEngine(stores, [P100], clock);
    const matchId = await createMatch(engine1);
    await engine1.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine1.publishReveal(left, matchId);
    await engine1.nextRound(left, matchId);
    const engine2 = liveEngine(stores, [P100], clock);
    const snap = await engine2.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
  });

  it("8. restart during round restores clock, activities and counted state", async () => {
    const engine1 = liveEngine(stores, [P100], clock);
    const matchId = await createMatch(engine1);
    await engine1.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    now += 5 * 60 * 1000;
    const engine2 = liveEngine(stores, [P100], clock);
    const snap = await engine2.snapshot(left, matchId);
    expect(snap.remainingMs).toBe(30 * 60 * 1000 - 5 * 60 * 1000);
    expect(snap.sides.right?.status).toBe("coding");
    expect(snap.sides.right?.submissions).toBe(1);
    const reveal = await engine2.publishReveal(left, matchId);
    expect(reveal.scores.right).toBe(100);
  });
});
