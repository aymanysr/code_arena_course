import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";

/** Canonical Y.Text key — must match the server's COLLAB_TEXT_KEY. */
export const COLLAB_TEXT_KEY = "source";

export interface CollabSyncPayload {
  roomId: string;
  roundId: string;
  side: string;
  stateB64: string;
  source: string;
  revision: number;
  language: string;
}

export interface PeerCursor {
  userId: string;
  clientId: number | null;
  anchor: number | null;
  head: number | null;
  displayName: string | null;
  color: string | null;
}

export type CollabConnection = "connecting" | "connected" | "reconnecting" | "offline";

/**
 * Deterministic cursor color per user (accessibility: color is never the
 * ONLY identity signal — the collaborator label carries the displayName).
 */
export function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 40%)`;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Single-client awareness update encoder (y-protocols wire format:
 * varUint(1), varUint(clientId), varUint(clock), varString(JSON state)).
 * Lets the socket relay feed y-codemirror.next's remote-cursor rendering
 * through the REAL Awareness store — no parallel cursor table, no fake DOM.
 */
function encodeRemoteCursor(clientId: number, clock: number, state: unknown): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(state));
  const out: number[] = [];
  const varUint = (n: number): void => {
    while (n > 127) {
      out.push(128 | (n & 127));
      n >>>= 7;
    }
    out.push(n);
  };
  varUint(1);
  varUint(clientId);
  varUint(clock);
  varUint(json.length);
  for (const b of json) out.push(b);
  return new Uint8Array(out);
}

/**
 * Collaboration provider (ticket 15): owns ONE Y.Doc bound to the team
 * Y.Text via y-codemirror.next (see EditorAdapter collab mode), syncing
 * incremental Yjs frames over the separate /collab namespace.
 *
 * game socket  = RoundPhase / readiness / submit / reveal authority
 * this socket  = Yjs updates + cursor awareness only (never game state)
 *
 * Offline policy (§20, safe default): while disconnected the shared editor
 * goes read-only (see CodeWorkspace) — no unbounded offline CRDT editing
 * that could surprise readiness or frozen-submit semantics. Reconnect
 * re-applies the authoritative baseline; CRDT merge makes it idempotent.
 */
export class CollabClient {
  readonly doc = new Y.Doc();
  /** Ephemeral cursor store backing y-codemirror.next remote rendering. */
  readonly awareness: Awareness;
  revision: number | null = null;
  language: string | null = null;
  roundId: string | null = null;
  private socket: Socket | null = null;
  private conn: CollabConnection = "connecting";
  private readonly listeners = new Set<() => void>();
  /** userId -> Y clientId for peer-left cleanup. */
  private readonly peerIds = new Map<string, number>();
  /** Synthetic per-peer awareness clocks (strictly increasing per clientId). */
  private readonly peerClocks = new Map<number, number>();
  /** True while applying server frames: suppresses echo back to the server. */
  private applyingRemote = false;

  constructor(
    private readonly options: {
      baseUrl: string;
      userId: string;
      matchId: string;
      displayName: string;
    },
  ) {
    this.awareness = new Awareness(this.doc);
    this.awareness.setLocalStateField("user", {
      name: options.displayName,
      color: colorForUser(options.userId),
    });
    // Local edits -> incremental frames to the server (skips remote applies).
    this.doc.on("update", (update: Uint8Array) => {
      if (this.applyingRemote) return;
      const sock = this.socket;
      if (!sock || this.conn !== "connected" || !this.roundId) return;
      sock.emit("update", { roundId: this.roundId, updateB64: bytesToB64(update) }, () => {});
    });
  }

  get ytext(): Y.Text {
    return this.doc.getText(COLLAB_TEXT_KEY);
  }

  getSource(): string {
    return this.ytext.toString();
  }

  connection(): CollabConnection {
    return this.conn;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setConn(next: CollabConnection): void {
    if (this.conn !== next) {
      this.conn = next;
      this.emit();
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  /** Applies one accepted server frame (idempotent: duplicates change nothing). */
  applyRemoteUpdate(updateB64: string): void {
    this.applyingRemote = true;
    try {
      Y.applyUpdate(this.doc, b64ToBytes(updateB64));
    } finally {
      this.applyingRemote = false;
    }
  }

  /**
   * Applies a teammate cursor into the awareness store (never the document).
   * y-codemirror.next renders remote selections from Y RELATIVE positions,
   * so numeric transport offsets are converted against the live Y.Text here.
   * Unconvertible offsets are dropped: cursors are ephemeral, the doc is not.
   */
  applyPeerCursor(cursor: PeerCursor): void {
    if (cursor.clientId === null || cursor.clientId === this.doc.clientID) return;
    if (cursor.userId) this.peerIds.set(cursor.userId, cursor.clientId);
    const metaClock = this.awareness.meta.get(cursor.clientId)?.clock ?? 0;
    const localClock = this.peerClocks.get(cursor.clientId) ?? 0;
    const clock = Math.max(metaClock, localClock) + 1;
    this.peerClocks.set(cursor.clientId, clock);
    let rel: { anchor: Y.RelativePosition | null; head: Y.RelativePosition | null } | null = null;
    if (typeof cursor.anchor === "number" && typeof cursor.head === "number") {
      try {
        rel = {
          anchor: Y.createRelativePositionFromTypeIndex(this.ytext, cursor.anchor),
          head: Y.createRelativePositionFromTypeIndex(this.ytext, cursor.head),
        };
      } catch {
        rel = null;
      }
    }
    applyAwarenessUpdate(
      this.awareness,
      encodeRemoteCursor(cursor.clientId, clock, {
        cursor: rel,
        user: { name: cursor.displayName ?? cursor.userId, color: cursor.color ?? colorForUser(cursor.userId) },
      }),
      "socket",
    );
  }

  /** Drops a departed teammate's cursor (awareness only). */
  removePeer(userId: string): void {
    const id = this.peerIds.get(userId);
    if (id === undefined) return;
    this.peerIds.delete(userId);
    this.peerClocks.delete(id);
    removeAwarenessStates(this.awareness, [id], "socket");
  }

  /**
   * Publishes the local cursor (called on editor selection change). The local
   * awareness field keeps y-codemirror.next's relative-position shape (the
   * binding rewrites it the same way); the socket carries plain offsets.
   */
  setLocalCursor(anchor: number | null, head: number | null): void {
    let rel: { anchor: Y.RelativePosition | null; head: Y.RelativePosition | null } | null = null;
    if (anchor !== null && head !== null) {
      try {
        rel = {
          anchor: Y.createRelativePositionFromTypeIndex(this.ytext, anchor),
          head: Y.createRelativePositionFromTypeIndex(this.ytext, head),
        };
      } catch {
        rel = null;
      }
    }
    this.awareness.setLocalStateField("cursor", rel);
    const sock = this.socket;
    if (!sock || this.conn !== "connected") return;
    sock.emit(
      "cursor",
      {
        clientId: this.doc.clientID,
        anchor,
        head,
        displayName: this.options.displayName,
        color: colorForUser(this.options.userId),
      },
      () => {},
    );
  }

  /**
   * Applies the authoritative baseline (join + reconnect). Plain CRDT merge:
   * idempotent for reconnects. Round isolation rides per-round remounts
   * (fresh Y.Doc per round — old content can never merge into a new round),
   * so no reset logic lives here.
   */
  applySync(sync: CollabSyncPayload): void {
    this.applyingRemote = true;
    try {
      if (sync.stateB64) Y.applyUpdate(this.doc, b64ToBytes(sync.stateB64));
    } finally {
      this.applyingRemote = false;
    }
    this.roundId = sync.roundId;
    this.revision = sync.revision;
    this.language = sync.language;
    this.emit();
  }

  connect(): Promise<CollabSyncPayload> {
    this.setConn("connecting");
    const sock = io(`${this.options.baseUrl}/collab`, {
      auth: { userId: this.options.userId, matchId: this.options.matchId },
      forceNew: true,
    });
    this.socket = sock;
    sock.on("sync", (sync: CollabSyncPayload) => {
      this.applySync(sync);
      this.setConn("connected");
    });
    sock.on("remote-update", (p: { updateB64: string; revision: number }) => {
      this.applyRemoteUpdate(p.updateB64);
      this.revision = p.revision;
      this.emit();
    });
    sock.on("peer-cursor", (p: PeerCursor) => this.applyPeerCursor(p));
    sock.on("peer-left", (p: { userId: string }) => {
      if (p && typeof p.userId === "string") this.removePeer(p.userId);
    });
    sock.on("disconnect", () => this.setConn("reconnecting"));
    sock.io.on("reconnect", () => {
      // Re-baseline arrives as a fresh "sync" (idempotent merge).
    });
    return new Promise<CollabSyncPayload>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("collab connect timeout")), 10000);
      sock.once("sync", (sync: CollabSyncPayload) => {
        clearTimeout(timer);
        resolve(sync);
      });
      sock.once("connect_error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
      sock.once("disconnect", () => {
        clearTimeout(timer);
        reject(new Error("collab room refused"));
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.setConn("offline");
  }
}
