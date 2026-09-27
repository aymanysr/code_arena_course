import type { CollabPersist, CollabRow } from "./collab.js";
import type { MatchRecord, RevealSnapshot, SubmissionRecord } from "./records.js";
import { DuplicateError, type MatchStore, type RevealStore, type SubmissionStore } from "./store.js";

export { MatchRevisionConflictError } from "./store.js";

/** Exclusive ownership of one pending evaluation until judge/commit finishes. */
export interface EvaluationClaim {
  evaluationId: string;
  /** Throws when the durable ownership session has been lost. */
  assertActive(): void;
  release(): Promise<void>;
}

export class EvaluationClaimLostError extends Error {
  constructor(readonly evaluationId: string, readonly cause?: unknown) {
    super(`evaluation claim lost for ${evaluationId}`);
    this.name = "EvaluationClaimLostError";
  }
}

/**
 * Durable Match state owned by one module.
 *
 * ArenaEngine decides whether a state transition is valid. This interface
 * decides how that transition, a Submission, a Reveal, or a shared document
 * becomes durable. The interface is intentionally domain-shaped: callers do
 * not know whether the implementation uses Postgres, maps, or another adapter.
 */
export interface MatchPersistence {
  loadMatch(matchId: string): Promise<MatchRecord | undefined>;
  saveMatch(match: MatchRecord, expectedRevision?: number): Promise<void>;
  listMatchIds(): Promise<string[]>;

  recordSubmission(record: SubmissionRecord): Promise<SubmissionRecord>;
  updateSubmission(record: SubmissionRecord): Promise<void>;
  findSubmissionById(submissionId: string): Promise<SubmissionRecord | undefined>;
  findSubmissionByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined>;
  listRoundSubmissions(matchId: string, roundId: string): Promise<SubmissionRecord[]>;
  listPendingSubmissions(): Promise<SubmissionRecord[]>;
  /** Claim a pending evaluation before invoking the judge; terminal rows return no claim. */
  claimPendingEvaluation(evaluationId: string): Promise<EvaluationClaim | undefined>;
  /** Persist the verdict-side Match and Submission changes on the claim owner. */
  commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void>;

  publishReveal(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void>;
  findReveal(matchId: string, roundId: string): Promise<RevealSnapshot | undefined>;

  loadTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
  ): Promise<{ appRevision: number; language: string; stateB64: string } | undefined>;
  saveTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
    appRevision: number,
    language: string,
    stateB64: string,
  ): Promise<void>;
  /** MatchRecord and shared-document rows commit together when supported. */
  commitMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[], expectedRevision?: number): Promise<void>;
}

export interface MatchPersistenceAdapters {
  matches: MatchStore;
  submissions: SubmissionStore;
  reveals: RevealStore;
  collab: CollabPersist;
  /** Postgres implementation supplies the real transaction. */
  commitMatchAndTeamDocuments?: (match: MatchRecord, rows: CollabRow[], expectedRevision?: number) => Promise<void>;
  /** Postgres implementation supplies cross-process evaluation ownership. */
  claimPendingEvaluation?: (evaluationId: string) => Promise<EvaluationClaim | undefined>;
  /** Postgres implementation commits the evaluation and Match on the claim session. */
  commitClaimedEvaluation?: (claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord) => Promise<void>;
}

function immutableSubmissionView(record: SubmissionRecord): string {
  return JSON.stringify({
    submissionId: record.submissionId,
    evaluationId: record.evaluationId,
    matchId: record.matchId,
    roundId: record.roundId,
    sideId: record.sideId,
    problemVersionId: record.problemVersionId,
    language: record.language,
    source: record.source,
    sourceHash: record.sourceHash,
    documentRevision: record.documentRevision ?? null,
    submittedAt: record.submittedAt,
    elapsedMatchMs: record.elapsedMatchMs,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/**
 * Adapter implementation used by both production and tests.
 *
 * Keeping this orchestration here gives ArenaEngine one small seam while
 * preserving the current MatchStore/SubmissionStore/RevealStore adapters
 * during the migration. It also centralizes idempotency rules that used to be
 * scattered across the engine and database implementations.
 */
export class StoreBackedMatchPersistence implements MatchPersistence {
  private readonly localClaims = new Map<string, Promise<void>>();

  constructor(private readonly adapters: MatchPersistenceAdapters) {}

  loadMatch(matchId: string): Promise<MatchRecord | undefined> {
    return this.adapters.matches.load(matchId);
  }

  saveMatch(match: MatchRecord, expectedRevision?: number): Promise<void> {
    return this.adapters.matches.save(match, expectedRevision);
  }

  listMatchIds(): Promise<string[]> {
    return this.adapters.matches.listIds();
  }

  async recordSubmission(record: SubmissionRecord): Promise<SubmissionRecord> {
    const existingBySubmission = await this.adapters.submissions.getBySubmissionId(record.submissionId);
    const existingByEvaluation = await this.adapters.submissions.getByEvaluationId(record.evaluationId);
    const existing = existingBySubmission ?? existingByEvaluation;
    if (existing) {
      if (immutableSubmissionView(existing) !== immutableSubmissionView(record)) {
        throw new DuplicateError("submission or evaluation id is already bound to different data");
      }
      return existing;
    }

    try {
      await this.adapters.submissions.append(record);
    } catch (error) {
      // A second process may win the unique insert between the reads above.
      // Re-read the durable row and apply the same idempotency rule.
      if (!isUniqueViolation(error)) throw error;
      const winner =
        (await this.adapters.submissions.getBySubmissionId(record.submissionId)) ??
        (await this.adapters.submissions.getByEvaluationId(record.evaluationId));
      if (!winner) throw error;
      if (immutableSubmissionView(winner) !== immutableSubmissionView(record)) {
        throw new DuplicateError("submission or evaluation id is already bound to different data");
      }
      return winner;
    }
    const stored =
      (await this.adapters.submissions.getBySubmissionId(record.submissionId)) ??
      (await this.adapters.submissions.getByEvaluationId(record.evaluationId));
    if (!stored) return record;
    if (immutableSubmissionView(stored) !== immutableSubmissionView(record)) {
      throw new DuplicateError("submission or evaluation id is already bound to different data");
    }
    return stored;
  }

  updateSubmission(record: SubmissionRecord): Promise<void> {
    return this.adapters.submissions.update(record);
  }

  findSubmissionById(submissionId: string): Promise<SubmissionRecord | undefined> {
    return this.adapters.submissions.getBySubmissionId(submissionId);
  }

  findSubmissionByEvaluationId(evaluationId: string): Promise<SubmissionRecord | undefined> {
    return this.adapters.submissions.getByEvaluationId(evaluationId);
  }

  listRoundSubmissions(matchId: string, roundId: string): Promise<SubmissionRecord[]> {
    return this.adapters.submissions.listRound(matchId, roundId);
  }

  listPendingSubmissions(): Promise<SubmissionRecord[]> {
    return this.adapters.submissions.listPending();
  }

  async claimPendingEvaluation(evaluationId: string): Promise<EvaluationClaim | undefined> {
    if (this.adapters.claimPendingEvaluation) {
      return this.adapters.claimPendingEvaluation(evaluationId);
    }

    const previous = this.localClaims.get(evaluationId) ?? Promise.resolve();
    let releaseQueued!: () => void;
    const queued = previous.then(
      () =>
        new Promise<void>((resolve) => {
          releaseQueued = resolve;
        }),
    );
    this.localClaims.set(evaluationId, queued);
    await previous;

    try {
      const stored = await this.adapters.submissions.getByEvaluationId(evaluationId);
      if (!stored || stored.status !== "pending") {
        releaseQueued();
        if (this.localClaims.get(evaluationId) === queued) this.localClaims.delete(evaluationId);
        return undefined;
      }
    } catch (error) {
      releaseQueued();
      if (this.localClaims.get(evaluationId) === queued) this.localClaims.delete(evaluationId);
      throw error;
    }

    let released = false;
    return {
      evaluationId,
      assertActive: () => {},
      release: async () => {
        if (released) return;
        released = true;
        releaseQueued();
        await queued;
        if (this.localClaims.get(evaluationId) === queued) this.localClaims.delete(evaluationId);
      },
    };
  }

  async commitClaimedEvaluation(claim: EvaluationClaim, match: MatchRecord, submission?: SubmissionRecord): Promise<void> {
    claim.assertActive();
    if (this.adapters.commitClaimedEvaluation) {
      await this.adapters.commitClaimedEvaluation(claim, match, submission);
      return;
    }
    if (submission) await this.updateSubmission(submission);
    await this.saveMatch(match);
  }

  publishReveal(matchId: string, roundId: string, snapshot: RevealSnapshot): Promise<void> {
    return this.adapters.reveals.record(matchId, roundId, snapshot);
  }

  findReveal(matchId: string, roundId: string): Promise<RevealSnapshot | undefined> {
    return this.adapters.reveals.get(matchId, roundId);
  }

  loadTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
  ): Promise<{ appRevision: number; language: string; stateB64: string } | undefined> {
    return this.adapters.collab.load(matchId, roundId, sideId);
  }

  saveTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
    appRevision: number,
    language: string,
    stateB64: string,
  ): Promise<void> {
    return this.adapters.collab.save(matchId, roundId, sideId, appRevision, language, stateB64);
  }

  async commitMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[], expectedRevision?: number): Promise<void> {
    if (this.adapters.commitMatchAndTeamDocuments) {
      await this.adapters.commitMatchAndTeamDocuments(match, rows, expectedRevision);
      return;
    }
    // In-memory implementations are already serialized by ArenaEngine's
    // match lock. Production supplies the one-transaction implementation.
    await this.saveMatch(match, expectedRevision);
    for (const row of rows) {
      await this.saveTeamDocument(match.id, row.roundId, row.sideId, row.appRevision, row.language, row.stateB64);
    }
  }
}
