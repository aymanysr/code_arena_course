import type { PlayerStatus, Readiness } from "arena-model";
import { assertSupportedLanguage, type SupportedLanguage } from "./judge.js";
import { IllegalStateError, NotMemberError } from "./match-authority.js";
import { collabRoomId, CollabDocs, type CollabRow } from "./collab.js";
import type {
  DocumentRevision,
  MatchRecord,
  MemberReadiness,
  Participant,
  RoundState,
  SideId,
  TeamDocState,
} from "./records.js";

export interface TeamCollaborationPersistence {
  saveMatch(match: MatchRecord): Promise<void>;
  loadTeamDocument(
    matchId: string,
    roundId: string,
    sideId: string,
  ): Promise<{ appRevision: number; language: string; stateB64: string } | undefined>;
  commitMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[]): Promise<void>;
}

export interface TeamProblemBank {
  loadProblem(problemVersionId: string): { starters: Partial<Record<SupportedLanguage, string>> };
}

export interface TeamReadinessResult {
  side: SideId;
  ready: boolean;
  documentRevision: DocumentRevision;
}

export interface TeamUpdateResult {
  side: SideId;
  revision: DocumentRevision;
  changed: boolean;
  source: string;
}

export interface TeamSyncResult {
  roomId: string;
  roundId: string;
  side: SideId;
  stateB64: string;
  source: string;
  revision: DocumentRevision;
  language: string;
}

export interface SubmissionDocument {
  source: string;
  documentRevision: DocumentRevision;
  language: string;
}

export interface TeamMemberSnapshot {
  userId: string;
  presence: "online" | "offline";
  /** Own team only; opponent readiness and document revisions stay masked. */
  ready: boolean;
  readyRevision: DocumentRevision | null;
}

export interface TeamSnapshot {
  side: SideId;
  activity: PlayerStatus;
  submissions: number;
  members: TeamMemberSnapshot[];
  documentRevision: DocumentRevision | null;
  language: string | null;
}

export interface TeamCollaborationOptions {
  persistence: TeamCollaborationPersistence;
  bank: TeamProblemBank;
  clock: () => number;
  collab?: CollabDocs;
}

/**
 * Game-owned 2v2 collaboration rules.
 *
 * The module hides Yjs loading, application revisions, readiness invalidation,
 * atomic persistence, rollback, language resets, and viewer masking behind a
 * small domain-shaped interface. ArenaEngine remains responsible for
 * membership gates, match locks, persistence of ordinary match state, and
 * event delivery.
 */
export class TeamCollaboration {
  private readonly persistence: TeamCollaborationPersistence;
  private readonly bank: TeamProblemBank;
  private readonly clock: () => number;
  private readonly collab: CollabDocs;

  constructor(options: TeamCollaborationOptions) {
    this.persistence = options.persistence;
    this.bank = options.bank;
    this.clock = options.clock;
    this.collab = options.collab ?? new CollabDocs();
  }

  readinessFor(match: MatchRecord, side: SideId): Readiness {
    const members = this.teamMembers(match, side);
    const readiness = this.currentRound(match).readiness ?? {};
    return {
      you: readiness[members[0]?.userId ?? ""]?.ready === true,
      mate: readiness[members[1]?.userId ?? ""]?.ready === true,
    };
  }

  documentRevisionMatches(match: MatchRecord, side: SideId, revision: DocumentRevision | undefined): boolean {
    if (revision === undefined) return false;
    const round = this.currentRound(match);
    const doc = round.teamDocs?.[side];
    if (!doc || revision !== doc.revision) return false;
    return this.teamMembers(match, side).every(
      (member) =>
        round.readiness?.[member.userId]?.ready === true &&
        round.readiness?.[member.userId]?.documentRevision === doc.revision,
    );
  }

  async setReady(
    match: MatchRecord,
    userId: string,
    input: { ready: boolean; documentRevision?: DocumentRevision },
  ): Promise<TeamReadinessResult> {
    this.requireTeamMode(match);
    if (match.roundPhase !== "CODING") throw new IllegalStateError(`ready rejected in ${match.roundPhase}`);
    const { sideId: side } = this.memberOf(match, userId);
    const doc = this.teamDocOf(match, side);
    if (input.ready === true && input.documentRevision !== doc.revision) {
      throw new IllegalStateError(
        `stale readiness revision: approved r${String(input.documentRevision)}, current r${doc.revision}`,
      );
    }
    const round = this.currentRound(match);
    round.readiness ??= {};
    const readiness: MemberReadiness = {
      userId,
      ready: input.ready,
      documentRevision: input.ready ? doc.revision : null,
      updatedAt: this.clock(),
    };
    round.readiness[userId] = readiness;
    return { side, ready: readiness.ready, documentRevision: doc.revision };
  }

  async applyUpdate(
    match: MatchRecord,
    userId: string,
    input: { roundId: string; updateB64: string },
  ): Promise<TeamUpdateResult> {
    this.requireTeamMode(match);
    if (match.roundPhase !== "CODING") throw new IllegalStateError(`document change rejected in ${match.roundPhase}`);
    const { sideId: side } = this.memberOf(match, userId);
    const round = this.currentRound(match);
    if (input.roundId !== round.roundId) throw new IllegalStateError("stale round document (write denied)");
    const doc = this.teamDocOf(match, side);
    const room = collabRoomId(match.id, round.roundId, side);
    await this.ensureLoaded(match, round, side, room);
    const { changed, source } = this.collab.applyUpdate(room, input.updateB64);
    if (!changed) return { side, revision: doc.revision, changed: false, source };

    const pre = this.preImage(match, round, side);
    doc.revision += 1;
    this.invalidate(match, round, side);
    try {
      await this.persist(match, round, side);
    } catch (error) {
      await this.rollback(match, round, side, room, pre);
      throw error;
    }
    return { side, revision: doc.revision, changed: true, source };
  }

  async sync(match: MatchRecord, userId: string): Promise<TeamSyncResult> {
    this.requireTeamMode(match);
    const { sideId: side } = this.memberOf(match, userId);
    const round = this.currentRound(match);
    const doc = this.teamDocOf(match, side);
    const room = collabRoomId(match.id, round.roundId, side);
    await this.ensureLoaded(match, round, side, room);
    return {
      roomId: room,
      roundId: round.roundId,
      side,
      stateB64: this.collab.encodeState(room),
      source: this.collab.getSource(room),
      revision: doc.revision,
      language: doc.language,
    };
  }

  async setLanguage(match: MatchRecord, userId: string, language: string): Promise<{ side: SideId; revision: DocumentRevision } | null> {
    if (match.mode !== "2v2") return null;
    if (match.roundPhase !== "CODING") throw new IllegalStateError(`document change rejected in ${match.roundPhase}`);
    assertSupportedLanguage(language);
    const { sideId: side } = this.memberOf(match, userId);
    const round = this.currentRound(match);
    const doc = this.teamDocOf(match, side);
    if (language === doc.language) return { side, revision: doc.revision };
    const room = collabRoomId(match.id, round.roundId, side);
    await this.ensureLoaded(match, round, side, room);
    const pre = this.preImage(match, round, side);
    doc.language = language;
    this.collab.setSource(room, this.starterFor(round, language));
    doc.revision += 1;
    this.invalidate(match, round, side);
    try {
      await this.persist(match, round, side);
    } catch (error) {
      await this.rollback(match, round, side, room, pre);
      throw error;
    }
    return { side, revision: doc.revision };
  }

  async submissionDocument(
    match: MatchRecord,
    side: SideId,
    language: string,
    documentRevision: DocumentRevision | undefined,
  ): Promise<SubmissionDocument> {
    this.requireTeamMode(match);
    const round = this.currentRound(match);
    const doc = this.teamDocOf(match, side);
    if (documentRevision === undefined || documentRevision !== doc.revision) {
      throw new IllegalStateError("submit rejected: stale document revision (re-ready the current revision)");
    }
    if (language !== doc.language) {
      throw new IllegalStateError(`submit language ${language} must match team language ${doc.language}`);
    }
    const room = collabRoomId(match.id, round.roundId, side);
    await this.ensureLoaded(match, round, side, room);
    return { source: this.collab.getSource(room), documentRevision: doc.revision, language: doc.language };
  }

  destroyRound(match: MatchRecord, round: RoundState): void {
    if (match.mode !== "2v2") return;
    for (const side of Object.keys(round.activities)) {
      this.collab.destroy(collabRoomId(match.id, round.roundId, side));
    }
  }

  hasOnlineMember(match: MatchRecord, side: SideId): boolean {
    return this.teamMembers(match, side).some((member) => match.memberPresence?.[member.userId] === "online");
  }

  snapshots(match: MatchRecord, round: RoundState, mySide: SideId): TeamSnapshot[] {
    return Object.keys(round.activities).map((side) => {
      const own = side === mySide;
      const doc = round.teamDocs?.[side];
      return {
        side,
        activity: this.activityOf(round, side),
        submissions: round.attempts[side] ?? 0,
        members: this.teamMembers(match, side).map((participant) => {
          const record = own ? round.readiness?.[participant.userId] : undefined;
          return {
            userId: participant.userId,
            presence: match.memberPresence?.[participant.userId] ?? "offline",
            ready: record?.ready === true,
            readyRevision: record?.ready === true ? (record.documentRevision ?? null) : null,
          };
        }),
        documentRevision: own ? (doc?.revision ?? null) : null,
        language: own ? (doc?.language ?? null) : null,
      };
    });
  }

  private requireTeamMode(match: MatchRecord): void {
    if (match.mode !== "2v2") throw new IllegalStateError("no shared document in 1v1");
  }

  private memberOf(match: MatchRecord, userId: string): Participant {
    const participant = match.participants.find((entry) => entry.userId === userId);
    if (!participant) throw new NotMemberError(match.id);
    return participant;
  }

  private teamMembers(match: MatchRecord, side: SideId): Participant[] {
    return match.participants.filter((participant) => participant.sideId === side);
  }

  private teamDocOf(match: MatchRecord, side: SideId): TeamDocState {
    const doc = this.currentRound(match).teamDocs?.[side];
    if (!doc) throw new IllegalStateError(`no team document for side ${side}`);
    return doc;
  }

  private currentRound(match: MatchRecord): RoundState {
    const round = match.rounds[match.currentRound - 1];
    if (!round) throw new IllegalStateError(`match ${match.id} has no current round`);
    return round;
  }

  private activityOf(round: RoundState, side: SideId): PlayerStatus {
    return round.activities[side] ?? "coding";
  }

  private async ensureLoaded(match: MatchRecord, round: RoundState, side: SideId, room: string): Promise<void> {
    if (this.collab.has(room)) return;
    const doc = this.teamDocOf(match, side);
    const stored = await this.persistence.loadTeamDocument(match.id, round.roundId, side);
    if (stored?.stateB64) {
      this.collab.restoreState(room, stored.stateB64);
      if (stored.appRevision !== doc.revision || stored.language !== doc.language) {
        doc.revision = stored.appRevision;
        doc.language = stored.language;
        this.invalidate(match, round, side);
        await this.persistence.saveMatch(match);
      }
      return;
    }
    this.collab.seedOnce(room, this.starterFor(round, doc.language));
  }

  private starterFor(round: RoundState, language: string): string {
    try {
      return this.bank.loadProblem(round.problemVersionId).starters[language as SupportedLanguage] ?? "";
    } catch {
      return "";
    }
  }

  private invalidate(match: MatchRecord, round: RoundState, side: SideId): void {
    round.readiness ??= {};
    for (const member of this.teamMembers(match, side)) {
      round.readiness[member.userId] = {
        userId: member.userId,
        ready: false,
        documentRevision: null,
        updatedAt: this.clock(),
      };
    }
  }

  private preImage(
    match: MatchRecord,
    round: RoundState,
    side: SideId,
  ): { revision: DocumentRevision; language: string; readiness: Record<string, MemberReadiness | undefined> } {
    const doc = this.teamDocOf(match, side);
    const readiness: Record<string, MemberReadiness | undefined> = {};
    for (const member of this.teamMembers(match, side)) {
      const prior = round.readiness?.[member.userId];
      readiness[member.userId] = prior ? { ...prior } : undefined;
    }
    return { revision: doc.revision, language: doc.language, readiness };
  }

  private async persist(match: MatchRecord, round: RoundState, side: SideId): Promise<void> {
    const doc = this.teamDocOf(match, side);
    const row: CollabRow = {
      roundId: round.roundId,
      sideId: side,
      appRevision: doc.revision,
      language: doc.language,
      stateB64: this.collab.encodeState(collabRoomId(match.id, round.roundId, side)),
    };
    await this.persistence.commitMatchAndTeamDocuments(match, [row]);
  }

  private async rollback(
    match: MatchRecord,
    round: RoundState,
    side: SideId,
    room: string,
    pre: { revision: DocumentRevision; language: string; readiness: Record<string, MemberReadiness | undefined> },
  ): Promise<void> {
    const stored = await this.persistence.loadTeamDocument(match.id, round.roundId, side).catch(() => undefined);
    if (stored?.stateB64) this.collab.restoreState(room, stored.stateB64);
    else this.collab.destroy(room);
    const doc = this.teamDocOf(match, side);
    doc.revision = pre.revision;
    doc.language = pre.language;
    round.readiness ??= {};
    for (const member of this.teamMembers(match, side)) {
      const prior = pre.readiness[member.userId];
      if (prior) round.readiness[member.userId] = { ...prior };
      else delete round.readiness[member.userId];
    }
  }
}
