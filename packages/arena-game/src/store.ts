import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "./records.js";

/**
 * Persistence seam: append-only durable history. Completed/failed/superseded
 * records are terminal (pending transitions once, via update). Reads behind
 * idempotency keys make retries safe across process restarts. Production uses
 * Postgres; unit tests use the in-memory maps. Redis is never the source of
 * truth for scores or submissions.
 */
export interface MatchStore {
  /**
   * Save a Match, optionally requiring the durable row to still have the
   * supplied revision. The next revision is assigned when the supplied
   * snapshot still carries the expected revision.
   */
  save(match: MatchRecord, expectedRevision?: number): Promise<void>;
  load(matchId: string): Promise<MatchRecord | undefined>;
  /** All known match ids (boot recovery: presence reset, pending re-drive). */
  listIds(): Promise<string[]>;
}

export interface SubmissionStore {
  append(record: SubmissionRecord): Promise<void>;
  update(record: SubmissionRecord): Promise<void>;
  getBySubmissionId(submissionId: string): Promise<SubmissionRecord | undefined>;
  getByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined>;
  listRound(matchId: string, roundId: string): Promise<SubmissionRecord[]>;
  /** Non-terminal rows (boot recovery: idempotent judge retry under original ids). */
  listPending(): Promise<SubmissionRecord[]>;
}

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}

export class MatchRevisionConflictError extends Error {
  readonly code = 409;

  constructor(
    readonly matchId: string,
    readonly expectedRevision: number,
    readonly actualRevision?: number,
  ) {
    super(
      actualRevision === undefined
        ? `match ${matchId} revision conflict (expected ${expectedRevision})`
        : `match ${matchId} revision conflict (expected ${expectedRevision}, found ${actualRevision})`,
    );
    this.name = "MatchRevisionConflictError";
  }
}

export interface RevealStore {
  record(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void>;
  /** Published round reveal, if any (boot recovery: finish an interrupted flip). */
  get(matchId: string, roundId: string): Promise<RevealSnapshot | undefined>;
}

export class InMemoryMatchStore implements MatchStore {
  private readonly matches = new Map<string, MatchRecord>();
  async save(match: MatchRecord, expectedRevision?: number): Promise<void> {
    const current = this.matches.get(match.id);
    if (expectedRevision !== undefined && (!current || current.revision !== expectedRevision)) {
      throw new MatchRevisionConflictError(match.id, expectedRevision, current?.revision);
    }
    const stored = structuredClone(match);
    if (expectedRevision !== undefined && stored.revision <= expectedRevision) {
      stored.revision = expectedRevision + 1;
    }
    this.matches.set(match.id, stored);
  }
  async load(matchId: string): Promise<MatchRecord | undefined> {
    const match = this.matches.get(matchId);
    return match ? structuredClone(match) : undefined;
  }
  async listIds(): Promise<string[]> {
    return [...this.matches.keys()];
  }
}

export class InMemorySubmissionStore implements SubmissionStore {
  private readonly bySubmission = new Map<string, SubmissionRecord>();
  private readonly byEvaluation = new Map<string, SubmissionRecord>();
  async append(record: SubmissionRecord): Promise<void> {
    this.bySubmission.set(record.submissionId, record);
    this.byEvaluation.set(record.evaluationId, record);
  }
  async update(record: SubmissionRecord): Promise<void> {
    this.bySubmission.set(record.submissionId, record);
    this.byEvaluation.set(record.evaluationId, record);
  }
  async getBySubmissionId(submissionId: string): Promise<SubmissionRecord | undefined> {
    return this.bySubmission.get(submissionId);
  }
  async getByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined> {
    return this.byEvaluation.get(evaluationId);
  }
  async listRound(matchId: string, roundId: string): Promise<SubmissionRecord[]> {
    return [...this.bySubmission.values()].filter((r) => r.matchId === matchId && r.roundId === roundId);
  }
  async listPending(): Promise<SubmissionRecord[]> {
    return [...this.bySubmission.values()].filter((r) => r.status === "pending");
  }
}

export class InMemoryRevealStore implements RevealStore {
  private readonly reveals = new Map<string, RevealSnapshot>();
  async record(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void> {
    const key = `${matchId}:${roundId}`;
    if (this.reveals.has(key)) throw new DuplicateError(`reveal already published for round ${roundId}`);
    this.reveals.set(key, snapshot);
  }
  async get(matchId: string, roundId: string): Promise<RevealSnapshot | undefined> {
    return this.reveals.get(`${matchId}:${roundId}`);
  }
}
