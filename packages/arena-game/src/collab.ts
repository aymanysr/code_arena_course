import * as Y from "yjs";

/** Canonical Y.Text key for the team source. Single source of truth per team doc. */
export const COLLAB_TEXT_KEY = "source";

/** Exact room/document identity: one collaborative document per match+round+side. */
export function collabRoomId(matchId: string, roundId: string, sideId: string): string {
  return `${matchId}:${roundId}:${sideId}`;
}

function b64encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function b64decode(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export interface CollabPersist {
  save(matchId: string, roundId: string, sideId: string, appRevision: number, language: string, stateB64: string): Promise<void>;
  load(
    matchId: string,
    roundId: string,
    sideId: string,
  ): Promise<{ appRevision: number; language: string; stateB64: string } | undefined>;
}

/** One team-document row inside the atomic match+collab commit. */
export interface CollabRow {
  roundId: string;
  sideId: string;
  appRevision: number;
  language: string;
  stateB64: string;
}

export class InMemoryCollabPersist implements CollabPersist {
  private readonly rows = new Map<string, { appRevision: number; language: string; stateB64: string }>();
  async save(matchId: string, roundId: string, sideId: string, appRevision: number, language: string, stateB64: string): Promise<void> {
    this.rows.set(`${matchId}:${roundId}:${sideId}`, { appRevision, language, stateB64 });
  }
  async load(matchId: string, roundId: string, sideId: string) {
    return this.rows.get(`${matchId}:${roundId}:${sideId}`);
  }
}
/**
 * Authoritative Y.Doc registry (ticket 15). One Y.Doc per collabRoomId, each
 * exposing exactly one Y.Text ("source"). Yjs stays the sync/merge layer;
 * the Arena application revision (TeamDocState.revision) is owned by the
 * engine and advances only when an applied update really changes the source.
 *
 * ponytail: full-state persist (encodeStateAsUpdate per commit) instead of an
 * update log — coding-problem docs are kilobytes, one row per team doc, no
 * compaction jobs. Ceiling: megabyte sources rewrite the row per keystroke
 * burst; upgrade path is an append-only collab_updates log + compaction.
 */
export class CollabDocs {
  private readonly docs = new Map<string, Y.Doc>();

  private docFor(roomId: string): Y.Doc {
    let doc = this.docs.get(roomId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(roomId, doc);
    }
    return doc;
  }

  has(roomId: string): boolean {
    return this.docs.has(roomId);
  }

  /** Current authoritative source text ("": unseeded doc). */
  getSource(roomId: string): string {
    const doc = this.docs.get(roomId);
    if (!doc) return "";
    return doc.getText(COLLAB_TEXT_KEY).toString();
  }

  /**
   * Apply a client update frame. Idempotent: duplicate/replayed frames change
   * nothing (Yjs dedupes) and report changed=false so the caller never bumps
   * the application revision for them. Malformed frames throw.
   */
  applyUpdate(roomId: string, updateB64: string): { changed: boolean; source: string } {
    let bytes: Uint8Array;
    try {
      bytes = b64decode(updateB64);
    } catch {
      throw new Error("malformed collab update");
    }
    if (bytes.length === 0) throw new Error("malformed collab update");
    const doc = this.docFor(roomId);
    const before = doc.getText(COLLAB_TEXT_KEY).toString();
    try {
      Y.applyUpdate(doc, bytes);
    } catch {
      throw new Error("malformed collab update");
    }
    const after = doc.getText(COLLAB_TEXT_KEY).toString();
    return { changed: after !== before, source: after };
  }

  /** Atomic source replace (language reset): one Yjs transaction, one revision. */
  setSource(roomId: string, text: string): { changed: boolean } {
    const doc = this.docFor(roomId);
    const before = doc.getText(COLLAB_TEXT_KEY).toString();
    if (before === text) return { changed: false };
    doc.transact(() => {
      const t = doc.getText(COLLAB_TEXT_KEY);
      t.delete(0, t.length);
      t.insert(0, text);
    });
    return { changed: true };
  }

  /** Seed a fresh doc exactly once (round init); never overwrites live content. */
  seedOnce(roomId: string, text: string): void {
    if (this.docs.has(roomId)) return;
    const doc = new Y.Doc();
    if (text) doc.getText(COLLAB_TEXT_KEY).insert(0, text);
    this.docs.set(roomId, doc);
  }

  /** Full durable state for persistence (option B). */
  encodeState(roomId: string): string {
    const doc = this.docs.get(roomId);
    if (!doc) return "";
    return b64encode(Y.encodeStateAsUpdate(doc));
  }

  /** Restore persisted state (restart / lazy load). Overwrites memory only. */
  restoreState(roomId: string, stateB64: string): void {
    const doc = new Y.Doc();
    if (stateB64) Y.applyUpdate(doc, b64decode(stateB64));
    this.docs.set(roomId, doc);
  }

  /** Round advance: detach the old identity so late updates cannot land there. */
  destroy(roomId: string): void {
    const doc = this.docs.get(roomId);
    if (doc) doc.destroy();
    this.docs.delete(roomId);
  }
}
