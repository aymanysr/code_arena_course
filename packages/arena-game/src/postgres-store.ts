import { Pool, type PoolClient } from "pg";
import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "./records.js";
import type { CollabPersist, CollabRow } from "./collab.js";
import {
  EvaluationClaimLostError,
  StoreBackedMatchPersistence,
  type EvaluationClaim,
  type MatchPersistence,
} from "./persistence.js";
import { DuplicateError, MatchRevisionConflictError, type MatchStore, type RevealStore, type SubmissionStore } from "./store.js";

export const GAME_SCHEMA = `
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS rounds (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  round_id TEXT NOT NULL UNIQUE,
  problem_version_id TEXT NOT NULL,
  PRIMARY KEY (match_id, idx)
);
CREATE TABLE IF NOT EXISTS round_sides (
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL REFERENCES rounds(round_id) ON DELETE CASCADE,
  side_id TEXT NOT NULL,
  activity TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  counted_score INTEGER,
  scoring_time_ms BIGINT,
  PRIMARY KEY (match_id, round_id, side_id)
);
CREATE TABLE IF NOT EXISTS submissions (
  submission_id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL UNIQUE,
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS reveals (
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  published_at BIGINT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (match_id, round_id)
);
CREATE TABLE IF NOT EXISTS match_failures (
  match_id TEXT NOT NULL,
  idx SERIAL PRIMARY KEY,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collab_documents (
  match_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  side_id TEXT NOT NULL,
  app_revision INTEGER NOT NULL,
  language TEXT NOT NULL,
  ydoc_state TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (match_id, round_id, side_id)
);
`;

/**
 * Postgres-backed stores (ticket 09): unique match/round/submission/evaluation
 * identities, one counted row per side per round, one reveal row per round.
 * A match saves as one JSONB row (single-statement atomicity); submissions
 * move pending->terminal via update; reveals insert once (primary key rejects
 * duplicates). Idempotent retries read the stored row first, so a restart
 * changes nothing: same ids return the same outcome with no new attempt, and
 * a pending row left by a crash is re-driven under its original ids.
 */
import { LobbyStore } from "./lobby.js";

class PostgresEvaluationClaim implements EvaluationClaim {
  constructor(
    readonly evaluationId: string,
    readonly client: PoolClient,
    private readonly assertFn: () => void,
    private readonly releaseFn: () => Promise<void>,
  ) {}

  assertActive(): void {
    this.assertFn();
  }

  release(): Promise<void> {
    return this.releaseFn();
  }
}

export class PostgresStores {
  /** One production persistence module consumed by ArenaEngine. */
  readonly persistence: MatchPersistence;
  readonly matches: MatchStore;
  readonly submissions: SubmissionStore;
  readonly reveals: RevealStore;
  readonly collab: CollabPersist;
  readonly lobby: LobbyStore;
  private readonly pool: Pool;
  /** Claims hold sessions through judge/commit; keep them off the write pool. */
  private readonly claimPool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.claimPool = new Pool({ connectionString });
    this.matches = new PostgresMatchStore(this.pool);
    this.submissions = new PostgresSubmissionStore(this.pool);
    this.reveals = new PostgresRevealStore(this.pool);
    this.collab = new PostgresCollabStore(this.pool);
    this.lobby = new LobbyStore(this.pool);
    this.persistence = new StoreBackedMatchPersistence({
      matches: this.matches,
      submissions: this.submissions,
      reveals: this.reveals,
      collab: this.collab,
      commitMatchAndTeamDocuments: (match, rows) => this.saveMatchAndCollab(match, rows),
      claimPendingEvaluation: (evaluationId) => this.claimPendingEvaluation(evaluationId),
      commitClaimedEvaluation: (claim, match, submission) => this.commitClaimedEvaluation(claim, match, submission),
    });
  }

  async ensureSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(GAME_SCHEMA);
      await this.lobby.ensureSchema();
    } finally {
      client.release();
    }
  }

  async recordFailure(matchId: string, message: string): Promise<void> {
    await this.pool.query("INSERT INTO match_failures (match_id, message) VALUES ($1, $2)", [matchId, message]);
  }

  /**
   * Ticket 15 closure: ONE database transaction covering the match row
   * (MatchRecord JSON, round rows, team revision, readiness, game revision)
   * AND the team collab rows (ydoc_state, app_revision, language). Either
   * everything commits or nothing does — CASE 1 (match without collab) and
   * CASE 2 (collab without match) are both impossible as durable state.
   * Events/acks happen only after this resolves.
   */
  async saveMatchAndCollab(match: MatchRecord, rows: CollabRow[], expectedRevision?: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await saveMatchTx(client, match, expectedRevision);
      for (const row of rows) {
        await client.query(
          `INSERT INTO collab_documents (match_id, round_id, side_id, app_revision, language, ydoc_state, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (match_id, round_id, side_id) DO UPDATE SET
             app_revision = EXCLUDED.app_revision, language = EXCLUDED.language,
             ydoc_state = EXCLUDED.ydoc_state, updated_at = EXCLUDED.updated_at`,
          [match.id, row.roundId, row.sideId, row.appRevision, row.language, row.stateB64, Date.now()],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Hold a database-session advisory lock for one pending evaluation. The
   * checked-out client stays with the claim through judge execution and
   * commit; a lost process therefore releases ownership automatically when
   * PostgreSQL closes the session.
   */
  async claimPendingEvaluation(evaluationId: string): Promise<EvaluationClaim | undefined> {
    const client = await this.claimPool.connect();
    let lockHeld = false;
    let clientReleased = false;
    let releasePromise: Promise<void> | undefined;
    let connectionError: EvaluationClaimLostError | undefined;
    const lockExpression = "hashtextextended($1, 0)";
    const onClientError = (error: Error): void => {
      connectionError ??= new EvaluationClaimLostError(evaluationId, error);
    };
    client.on("error", onClientError);
    const release = (destroy = false): Promise<void> => {
      if (releasePromise) return releasePromise;
      releasePromise = (async () => {
        let destroyClient = destroy || Boolean(connectionError);
        try {
          if (lockHeld && !connectionError) {
            await client.query(`SELECT pg_advisory_unlock(${lockExpression})`, [evaluationId]);
            lockHeld = false;
          }
        } catch {
          destroyClient = true;
        } finally {
          client.removeListener("error", onClientError);
          clientReleased = true;
          client.release(destroyClient);
        }
      })();
      return releasePromise;
    };

    try {
      await client.query(`SELECT pg_advisory_lock(${lockExpression})`, [evaluationId]);
      lockHeld = true;
      const result = await client.query("SELECT data FROM submissions WHERE evaluation_id = $1", [evaluationId]);
      const stored = result.rows[0]?.data as SubmissionRecord | undefined;
      if (!stored || stored.status !== "pending") {
        await release();
        return undefined;
      }
      return new PostgresEvaluationClaim(
        evaluationId,
        client,
        () => {
          if (connectionError || clientReleased) {
            throw connectionError ?? new EvaluationClaimLostError(evaluationId);
          }
        },
        () => release(),
      );
    } catch (error) {
      await release(true);
      throw error;
    }
  }

  async commitClaimedEvaluation(
    claim: EvaluationClaim,
    match: MatchRecord,
    submission?: SubmissionRecord,
  ): Promise<void> {
    if (!(claim instanceof PostgresEvaluationClaim)) {
      throw new Error("Postgres persistence requires a Postgres evaluation claim");
    }
    claim.assertActive();
    let inTransaction = false;
    try {
      await claim.client.query("BEGIN");
      inTransaction = true;
      if (submission) {
        const updated = await claim.client.query(
          "UPDATE submissions SET data = $2 WHERE evaluation_id = $1 AND data->>'status' = 'pending'",
          [submission.evaluationId, JSON.stringify(submission)],
        );
        if (updated.rowCount !== 1) throw new EvaluationClaimLostError(claim.evaluationId);
      }
      await saveMatchTx(claim.client, match);
      claim.assertActive();
      await claim.client.query("COMMIT");
      inTransaction = false;
    } catch (error) {
      if (inTransaction) {
        try {
          await claim.client.query("ROLLBACK");
        } catch {
          // The claim session may already be gone; the database rolls back the session.
        }
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    await Promise.all([this.pool.end(), this.claimPool.end()]);
  }

  get raw(): Pool {
    return this.pool;
  }
}

/** Match-row writes against an already-open transaction client. */
export async function saveMatchTx(client: PoolClient, match: MatchRecord, expectedRevision?: number): Promise<void> {
  const storedMatch =
    expectedRevision !== undefined && match.revision <= expectedRevision
      ? { ...structuredClone(match), revision: expectedRevision + 1 }
      : match;
  if (expectedRevision === undefined) {
    await client.query(`INSERT INTO matches (id, data) VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [storedMatch.id, JSON.stringify(storedMatch)]);
  } else {
    const updated = await client.query(
      `UPDATE matches
       SET data = $2
       WHERE id = $1 AND COALESCE((data->>'revision')::integer, 0) = $3`,
      [storedMatch.id, JSON.stringify(storedMatch), expectedRevision],
    );
    if (updated.rowCount !== 1) {
      const current = await client.query("SELECT data FROM matches WHERE id = $1", [storedMatch.id]);
      const actualRevision = current.rowCount === 1 ? (current.rows[0].data as MatchRecord).revision : undefined;
      throw new MatchRevisionConflictError(storedMatch.id, expectedRevision, actualRevision);
    }
  }
  for (let idx = 0; idx < storedMatch.rounds.length; idx++) {
    const round = storedMatch.rounds[idx]!;
    await client.query(
      `INSERT INTO rounds (match_id, idx, round_id, problem_version_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, idx) DO UPDATE SET round_id = EXCLUDED.round_id, problem_version_id = EXCLUDED.problem_version_id`,
      [storedMatch.id, idx, round.roundId, round.problemVersionId],
    );
    for (const [sideId, activity] of Object.entries(round.activities)) {
      const counted = round.counted[sideId];
      await client.query(
        `INSERT INTO round_sides (match_id, round_id, side_id, activity, attempts, counted_score, scoring_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id, round_id, side_id) DO UPDATE SET
           activity = EXCLUDED.activity, attempts = EXCLUDED.attempts,
           counted_score = EXCLUDED.counted_score, scoring_time_ms = EXCLUDED.scoring_time_ms`,
        [storedMatch.id, round.roundId, sideId, activity ?? "coding", round.attempts[sideId] ?? 0, counted?.score ?? null, counted?.scoringTimeMs ?? null],
      );
    }
  }
}

class PostgresMatchStore implements MatchStore {
  constructor(private readonly pool: Pool) {}

  async save(match: MatchRecord, expectedRevision?: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await saveMatchTx(client, match, expectedRevision);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async load(matchId: string): Promise<MatchRecord | undefined> {
    const res = await this.pool.query("SELECT data FROM matches WHERE id = $1", [matchId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as MatchRecord;
  }

  async listIds(): Promise<string[]> {
    const res = await this.pool.query("SELECT id FROM matches");
    return res.rows.map((r) => r.id as string);
  }
}

class PostgresSubmissionStore implements SubmissionStore {
  constructor(private readonly pool: Pool) {}

  async append(record: SubmissionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO submissions (submission_id, evaluation_id, match_id, round_id, data)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (submission_id) DO NOTHING`,
      [record.submissionId, record.evaluationId, record.matchId, record.roundId, JSON.stringify(record)],
    );
  }

  async update(record: SubmissionRecord): Promise<void> {
    await this.pool.query("UPDATE submissions SET data = $2 WHERE submission_id = $1", [
      record.submissionId,
      JSON.stringify(record),
    ]);
  }

  async getBySubmissionId(submissionId: string): Promise<SubmissionRecord | undefined> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE submission_id = $1", [submissionId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as SubmissionRecord;
  }

  async getByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE evaluation_id = $1", [evaluationId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as SubmissionRecord;
  }

  async listRound(matchId: string, roundId: string): Promise<SubmissionRecord[]> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE match_id = $1 AND round_id = $2", [
      matchId,
      roundId,
    ]);
    return res.rows.map((r) => r.data as SubmissionRecord);
  }

  async listPending(): Promise<SubmissionRecord[]> {
    const res = await this.pool.query("SELECT data FROM submissions WHERE data->>'status' = 'pending'");
    return res.rows.map((r) => r.data as SubmissionRecord);
  }
}

class PostgresCollabStore implements CollabPersist {
  constructor(private readonly pool: Pool) {}

  async save(matchId: string, roundId: string, sideId: string, appRevision: number, language: string, stateB64: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO collab_documents (match_id, round_id, side_id, app_revision, language, ydoc_state, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (match_id, round_id, side_id) DO UPDATE SET
         app_revision = EXCLUDED.app_revision, language = EXCLUDED.language,
         ydoc_state = EXCLUDED.ydoc_state, updated_at = EXCLUDED.updated_at`,
      [matchId, roundId, sideId, appRevision, language, stateB64, Date.now()],
    );
  }

  async load(matchId: string, roundId: string, sideId: string) {
    const res = await this.pool.query(
      "SELECT app_revision, language, ydoc_state FROM collab_documents WHERE match_id = $1 AND round_id = $2 AND side_id = $3",
      [matchId, roundId, sideId],
    );
    if (res.rowCount === 0) return undefined;
    const row = res.rows[0];
    return { appRevision: row.app_revision as number, language: row.language as string, stateB64: row.ydoc_state as string };
  }
}

class PostgresRevealStore implements RevealStore {
  constructor(private readonly pool: Pool) {}

  async record(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void> {
    try {
      await this.pool.query("INSERT INTO reveals (match_id, round_id, published_at, data) VALUES ($1, $2, $3, $4)", [
        matchId,
        roundId,
        snapshot.publishedAt,
        JSON.stringify(snapshot),
      ]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new DuplicateError(`reveal already published for round ${roundId}`);
      }
      throw error;
    }
  }

  async get(matchId: string, roundId: string): Promise<RevealSnapshot | undefined> {
    const res = await this.pool.query("SELECT data FROM reveals WHERE match_id = $1 AND round_id = $2", [
      matchId,
      roundId,
    ]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].data as RevealSnapshot;
  }
}
