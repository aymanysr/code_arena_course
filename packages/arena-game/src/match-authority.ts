import type { AuthenticatedPrincipal } from "./principal.js";
import type { MatchPersistence } from "./persistence.js";
import type { CollabRow } from "./collab.js";
import type { MatchRecord, RoundState, SideId } from "./records.js";

export class NotMemberError extends Error {
  readonly code = 403;
  constructor(matchId: string) {
    super(`principal is not a participant of match ${matchId}`);
    this.name = "NotMemberError";
  }
}

export class IllegalStateError extends Error {
  readonly code = 409;
  constructor(message: string) {
    super(message);
    this.name = "IllegalStateError";
  }
}

export interface MatchLockOptions {
  /** The callback already durably committed through another ownership seam. */
  skipFinalSave?: boolean;
}

export interface MatchLockResult<T> {
  value: T;
  /** Revision read back after the command's durable writes. */
  revision?: number;
}

/**
 * Match authority owns the shared command mechanics around Match state:
 * membership resolution, per-Match serialization, and revision stamping.
 * It does not know about sockets, judge execution, or database adapters.
 */
export class MatchAuthority {
  private readonly matchLocks = new Map<string, Promise<void>>();
  private readonly lockRevision = new Map<string, number>();
  private readonly lockBaseRevision = new Map<string, number | undefined>();
  private readonly lockPersisted = new Set<string>();
  private readonly lockLastState = new Map<string, string | null>();

  constructor(private readonly persistence: MatchPersistence) {}

  /**
   * Serialize short Match mutations. Long judge calls stay outside this
   * lock; callers re-enter for the final accepted result. The persistence
   * module performs the durable write and this module supplies the revision
   * used by events emitted during the command.
   */
  async withLock<T>(matchId: string, fn: () => Promise<T>, options: MatchLockOptions = {}): Promise<MatchLockResult<T>> {
    const prev = this.matchLocks.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.matchLocks.set(matchId, prev.then(() => mine));
    await prev;
    const beforeRow = await this.persistence.loadMatch(matchId).catch(() => undefined);
    const beforeText = beforeRow ? JSON.stringify(beforeRow) : null;
    this.lockBaseRevision.set(matchId, beforeRow?.revision);
    this.lockRevision.set(matchId, (beforeRow?.revision ?? 0) + 1);
    this.lockPersisted.delete(matchId);
    this.lockLastState.set(matchId, beforeRow ? this.stateText(beforeRow) : null);
    try {
      const result = await fn();
      const fresh = await this.persistence.loadMatch(matchId);
      if (!options.skipFinalSave && fresh && JSON.stringify(fresh) !== beforeText && !this.lockPersisted.has(matchId)) {
        fresh.revision = this.lockRevision.get(matchId) ?? fresh.revision + 1;
        await this.saveMatch(fresh);
      }
      return { value: result, revision: fresh?.revision };
    } finally {
      release();
      this.lockRevision.delete(matchId);
      this.lockBaseRevision.delete(matchId);
      this.lockPersisted.delete(matchId);
      this.lockLastState.delete(matchId);
      if (this.matchLocks.get(matchId) === mine) this.matchLocks.delete(matchId);
    }
  }

  revisionFor(matchId: string): number | undefined {
    return this.lockRevision.get(matchId);
  }

  /** Persist an ordinary Match mutation through the active optimistic lock. */
  async saveMatch(match: MatchRecord): Promise<void> {
    const nextRevision = this.lockRevision.get(match.id);
    if (nextRevision === undefined) {
      await this.persistence.saveMatch(match);
      return;
    }
    const state = this.stateText(match);
    if (this.lockLastState.get(match.id) === state) return;
    const expectedRevision = this.lockPersisted.has(match.id)
      ? nextRevision
      : this.lockBaseRevision.get(match.id);
    const committedRevision = this.lockPersisted.has(match.id) ? nextRevision + 1 : nextRevision;
    match.revision = committedRevision;
    await this.persistence.saveMatch(match, expectedRevision);
    this.lockRevision.set(match.id, committedRevision);
    this.lockPersisted.add(match.id);
    this.lockLastState.set(match.id, state);
  }

  /** Persist Match + shared-document rows through the active optimistic lock. */
  async saveMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[]): Promise<void> {
    const nextRevision = this.lockRevision.get(match.id);
    if (nextRevision === undefined) {
      await this.persistence.commitMatchAndTeamDocuments(match, rows);
      return;
    }
    const state = this.stateText(match);
    if (this.lockLastState.get(match.id) === state) return;
    const expectedRevision = this.lockPersisted.has(match.id)
      ? nextRevision
      : this.lockBaseRevision.get(match.id);
    const committedRevision = this.lockPersisted.has(match.id) ? nextRevision + 1 : nextRevision;
    match.revision = committedRevision;
    await this.persistence.commitMatchAndTeamDocuments(match, rows, expectedRevision);
    this.lockRevision.set(match.id, committedRevision);
    this.lockPersisted.add(match.id);
    this.lockLastState.set(match.id, state);
  }

  private stateText(match: MatchRecord): string {
    const snapshot = structuredClone(match);
    snapshot.revision = 0;
    return JSON.stringify(snapshot);
  }

  async requireMember(principal: AuthenticatedPrincipal, matchId: string): Promise<MatchRecord> {
    const match = await this.loadOrThrow(matchId);
    if (!match.participants.some((participant) => participant.userId === principal.userId)) {
      throw new NotMemberError(matchId);
    }
    return match;
  }

  async loadOrThrow(matchId: string): Promise<MatchRecord> {
    const match = await this.persistence.loadMatch(matchId);
    if (!match) throw new NotMemberError(matchId);
    return match;
  }

  sideOf(match: MatchRecord, principal: AuthenticatedPrincipal): SideId {
    const participant = match.participants.find((candidate) => candidate.userId === principal.userId);
    if (!participant) throw new NotMemberError(match.id);
    return participant.sideId;
  }

  currentRound(match: MatchRecord): RoundState {
    const round = match.rounds[match.currentRound - 1];
    if (!round) throw new IllegalStateError(`match ${match.id} has no current round`);
    return round;
  }
}
