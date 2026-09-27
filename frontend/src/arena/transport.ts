import type { ArenaSnapshot } from "./types.js";

export interface RunReceipt {
  ok: true;
}

export interface SubmitReceipt {
  ok: true;
  round: number;
}

/** Client transport connectivity, separate from game status (ticket 11 §14). */
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

/**
 * Development-only controls exposed by fixture transports. Production UI code
 * can discover these controls without importing or narrowing to a concrete
 * adapter, keeping the ArenaTransport seam intact.
 */
export interface FixtureTransportControls {
  publishReveal(): void;
  nextRound(): void;
  setMateReady(value: boolean): void;
}

/**
 * Shared delivery mechanics for transport adapters.
 *
 * The Match authority owns domain changes; this session owns connection state
 * and notifying UI subscribers when a baseline, event, or connectivity change
 * needs to be rendered.
 */
export class TransportSession {
  private readonly listeners = new Set<() => void>();

  constructor(private state: ConnectionState) {}

  connection(): ConnectionState {
    return this.state;
  }

  setConnection(next: ConnectionState): boolean {
    if (this.state === next) return false;
    this.state = next;
    return true;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/**
 * Transport seam: presentational components never know whether data comes from
 * mock state or a socket. The future SocketArenaTransport implements this same
 * interface against the real game service (authenticated principal attached by
 * the external auth layer; see docs/auth-game-contract.md).
 */
export interface ArenaTransport {
  snapshot(): ArenaSnapshot;
  subscribe(listener: () => void): () => void;
  /** Transport connectivity (subscribe fires on change). */
  connection(): ConnectionState;
  /** Stable key scoping the local editor draft (match identity). */
  scopeKey(): string;
  /**
   * Collaboration endpoint identity (2v2 live transport only). Absent for
   * mocks and 1v1: consumers fall back to the local controlled document.
   */
  collabConfig?(): { baseUrl: string; userId: string; matchId: string } | null;
  /**
   * Team chat endpoint identity (2v2 live transport only). Absent for mocks and 1v1.
   */
  chatConfig?(): { baseUrl: string; userId: string; matchId: string } | null;
  /** Development-only fixture actions. Live transports return no controls. */
  fixtureControls?(): FixtureTransportControls | null;
  startRound(): Promise<void>;
  beginCoding(): Promise<void>;
  /** 1v1: local-only. 2v2: authoritative team switch (bumps doc revision). */
  setLanguage(language: string): Promise<void>;
  run(input: { code: string; language: string }): Promise<RunReceipt>;
  /** 2v2 team submit: callers pass the approved docRevision; server re-checks. */
  submit(input: { code: string; language: string; documentRevision?: number }): Promise<SubmitReceipt>;
  setReady(value: boolean): Promise<void>;
  advance(): Promise<void>;
  /** Deliberate leave → immediate forfeit (§15). Never socket loss. */
  leave(): Promise<void>;
}
