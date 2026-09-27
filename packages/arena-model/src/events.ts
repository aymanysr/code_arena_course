/**
 * Realtime event catalog: every cross-client update in 09-arena.html
 * maps to exactly one event. Frontend and game service conform to these
 * names and payloads (ticket 09 wires the transport).
 */
export const ARENA_EVENTS = [
  "phase.changed",
  "player.statusChanged",
  "player.presenceChanged",
  "readiness.changed",
  "tests.updated",
  "reveal.published",
  "round.advanced",
  "match.clock",
  "match.ended",
] as const;

export type ArenaEvent = (typeof ARENA_EVENTS)[number];

export interface ArenaEventPayloads {
  "phase.changed": { phase: string; round: number; revision: number };
  "player.statusChanged": { side: string; player: string; status: string; revision: number };
  "player.presenceChanged": { side: string; player: string; presence: string; revision: number };
  /**
   * Absolute (viewer-independent) readiness: clients refresh their
   * authoritative snapshot on receipt and derive you/mate locally.
   * `invalidated` marks a document-revision bump that cleared approvals.
   */
  "readiness.changed": {
    side: string;
    userId?: string;
    ready?: boolean;
    invalidated?: boolean;
    documentRevision?: number;
    revision: number;
  };
  "tests.updated": { tests: Array<{ id: string; status: string }>; revision: number };
  "reveal.published": { round: number; revision: number };
  "round.advanced": { round: number; problemId: string; revision: number };
  "match.clock": { remainingSeconds: number };
  "match.ended": { result: string; winner?: string; loser?: string; reason?: string; revision: number };
}
