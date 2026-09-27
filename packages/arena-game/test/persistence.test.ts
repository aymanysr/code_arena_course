import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "../src/records.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { StoreBackedMatchPersistence, type MatchPersistence, type MatchPersistenceAdapters } from "../src/persistence.js";
import { PostgresStores } from "../src/postgres-store.js";
import {
  DuplicateError,
  InMemoryMatchStore,
  InMemoryRevealStore,
  InMemorySubmissionStore,
  MatchRevisionConflictError,
} from "../src/store.js";

function makeMatch(id: string): MatchRecord {
  return {
    id,
    mode: "1v1",
    roundPhase: "ROUND_INTRO",
    currentRound: 1,
    totalRounds: 1,
    durationMs: 60_000,
    startedAt: 1_000,
    participants: [
      { userId: "left-user", sideId: "left" },
      { userId: "right-user", sideId: "right" },
    ],
    rounds: [
      {
        roundId: `${id}-round-1`,
        problemVersionId: "problem-v1",
        hiddenSuiteId: "hidden-v1",
        counted: {},
        attempts: {},
        activities: { left: "coding", right: "coding" },
        runTests: {},
        reveal: null,
        closing: false,
        cutoffPassed: false,
        superseded: [],
      },
    ],
    failures: [],
    revision: 0,
    presence: {},
    offlineSinceMs: {},
    forfeit: null,
  };
}

function makeSubmission(match: MatchRecord): SubmissionRecord {
  return {
    submissionId: `${match.id}-submission-1`,
    evaluationId: `${match.id}-evaluation-1`,
    matchId: match.id,
    roundId: match.rounds[0]!.roundId,
    sideId: "left",
    problemVersionId: "problem-v1",
    language: "Python",
    source: "print('ok')",
    sourceHash: "hash-1",
    documentRevision: null,
    submittedAt: 1_100,
    elapsedMatchMs: 100,
    status: "pending",
    score: null,
    scoreBp: null,
    groups: null,
    testStatuses: null,
    failureCode: null,
  };
}

function makeReveal(match: MatchRecord): RevealSnapshot {
  return {
    round: 1,
    roundId: match.rounds[0]!.roundId,
    scores: { left: 100, right: 0 },
    groups: { left: [], right: [] },
    totals: { left: 100, right: 0 },
    publishedAt: 2_000,
  };
}

function inMemoryPersistence(): MatchPersistence {
  const adapters: MatchPersistenceAdapters = {
    matches: new InMemoryMatchStore(),
    submissions: new InMemorySubmissionStore(),
    reveals: new InMemoryRevealStore(),
    collab: new InMemoryCollabPersist(),
  };
  return new StoreBackedMatchPersistence(adapters);
}

async function assertPersistenceContract(persistence: MatchPersistence, id: string): Promise<void> {
  const match = makeMatch(id);
  const submission = makeSubmission(match);
  const reveal = makeReveal(match);

  await persistence.saveMatch(match);
  expect(await persistence.loadMatch(id)).toEqual(match);
  expect(await persistence.listMatchIds()).toContain(id);

  const first = await persistence.loadMatch(id);
  const second = await persistence.loadMatch(id);
  first!.presence.left = "online";
  first!.revision = 1;
  await persistence.saveMatch(first!, 0);
  second!.presence.right = "online";
  second!.revision = 1;
  await expect(persistence.saveMatch(second!, 0)).rejects.toBeInstanceOf(MatchRevisionConflictError);
  expect((await persistence.loadMatch(id))?.presence).toEqual({ left: "online" });

  expect(await persistence.recordSubmission(submission)).toEqual(submission);
  // Same immutable request is a safe replay and returns the stored row.
  expect(await persistence.recordSubmission({ ...submission })).toEqual(submission);
  await expect(
    persistence.recordSubmission({ ...submission, source: "print('different')", sourceHash: "hash-2" }),
  ).rejects.toBeInstanceOf(DuplicateError);
  expect(await persistence.listPendingSubmissions()).toHaveLength(1);

  submission.status = "completed";
  submission.score = 100;
  submission.scoreBp = 10_000;
  await persistence.updateSubmission(submission);
  expect((await persistence.findSubmissionByEvaluationId(submission.evaluationId))?.status).toBe("completed");
  expect(await persistence.listRoundSubmissions(id, match.rounds[0]!.roundId)).toHaveLength(1);

  await persistence.publishReveal(id, match.rounds[0]!.roundId, reveal);
  expect(await persistence.findReveal(id, match.rounds[0]!.roundId)).toEqual(reveal);

  await persistence.saveTeamDocument(id, match.rounds[0]!.roundId, "left", 2, "Python", "state-1");
  expect(await persistence.loadTeamDocument(id, match.rounds[0]!.roundId, "left")).toEqual({
    appRevision: 2,
    language: "Python",
    stateB64: "state-1",
  });
}

describe("MatchPersistence contract", () => {
  it("keeps Match, Submission, Reveal, and team-document rules in memory", async () => {
    await assertPersistenceContract(inMemoryPersistence(), `memory-${randomUUID()}`);
  });

  it("serializes pending evaluation claims and skips terminal rows", async () => {
    const persistence = inMemoryPersistence();
    const match = makeMatch(`claim-${randomUUID()}`);
    const submission = makeSubmission(match);
    await persistence.saveMatch(match);
    await persistence.recordSubmission(submission);

    const first = await persistence.claimPendingEvaluation(submission.evaluationId);
    expect(first).toBeDefined();

    let secondSettled = false;
    const second = persistence.claimPendingEvaluation(submission.evaluationId).then((claim) => {
      secondSettled = true;
      return claim;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(secondSettled).toBe(false);

    submission.status = "completed";
    await persistence.updateSubmission(submission);
    await first!.release();
    expect(await second).toBeUndefined();
  });
});

const PG_BASE = process.env.TEST_PG_URL ?? "postgres://postgres:postgres@localhost:5433/arena_test";
const PG_DATABASE = "arena_persistence_contract";
const PG_CONTRACT_URL = PG_BASE.replace(/\/[^/]*$/, `/${PG_DATABASE}`);

async function postgresAvailable(): Promise<boolean> {
  const target = new Pool({ connectionString: PG_CONTRACT_URL });
  try {
    await target.query("SELECT 1");
    return true;
  } catch {
    const adminUrl = new URL(PG_BASE);
    adminUrl.pathname = "/postgres";
    const admin = new Pool({ connectionString: adminUrl.toString() });
    try {
      const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [PG_DATABASE]);
      if (found.rowCount === 0) await admin.query(`CREATE DATABASE ${PG_DATABASE}`);
      return true;
    } catch {
      return false;
    } finally {
      await admin.end();
    }
  } finally {
    await target.end();
  }
}

const HAS_POSTGRES = await postgresAvailable();

describe.runIf(HAS_POSTGRES)("MatchPersistence Postgres adapter contract", () => {
  it("matches the in-memory idempotency and durable-state contract", async () => {
    const stores = new PostgresStores(PG_CONTRACT_URL);
    const id = `postgres-${randomUUID()}`;
    try {
      await stores.ensureSchema();
      await assertPersistenceContract(stores.persistence, id);
    } finally {
      await stores.raw.query("DELETE FROM submissions WHERE match_id = $1", [id]);
      await stores.raw.query("DELETE FROM reveals WHERE match_id = $1", [id]);
      await stores.raw.query("DELETE FROM match_failures WHERE match_id = $1", [id]);
      await stores.raw.query("DELETE FROM matches WHERE id = $1", [id]);
      await stores.close();
    }
  });
});
