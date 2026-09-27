/** Canonical Code Arena domain types. Transcribed from frozen prototype/game-ui/09-arena.html. */

export type MatchMode = "1v1" | "2v2";

/** Round/match lifecycle: the ONE global state. Never tracks per-side execution activity. */
export type RoundPhase =
  | "MATCH_FOUND"
  | "ROUND_INTRO"
  | "CODING"
  | "SCORE_REVEAL"
  | "ROUND_COMPLETE"
  | "MATCH_COMPLETE";

export const ALL_ROUND_PHASES: readonly RoundPhase[] = [
  "MATCH_FOUND",
  "ROUND_INTRO",
  "CODING",
  "SCORE_REVEAL",
  "ROUND_COMPLETE",
  "MATCH_COMPLETE",
] as const;

/** Per-side execution activity: the ONE authoritative state per player/team side (never presence). Independent across sides: one side evaluating never freezes the other. Competitive activity ONLY: socket loss changes presence (below) and never rewrites this — a disconnected side keeps whatever activity it had (coding/running/submitted/evaluating/locked). Ticket 11 removed the former `disconnected` activity value as redundant. */
export type PlayerStatus =
  | "coding"
  | "running"
  | "submitted"
  | "evaluating"
  | "locked";

export const STATUS_LABEL: Record<PlayerStatus, string> = {
  coding: "Coding",
  running: "Running",
  submitted: "Submitted",
  evaluating: "Evaluating",
  locked: "Locked in",
};

/** Connectivity only; never doubles as gameplay status. */
export type Presence = "online" | "offline";

/** 2v2 submission gate. Resets every round; both flags required to submit. */
export interface Readiness {
  you: boolean;
  mate: boolean;
}

export function resetReadiness(): Readiness {
  return { you: false, mate: false };
}

export function bothReady(r: Readiness): boolean {
  return r.you && r.mate;
}

export type VisibleTestStatus = "idle" | "running" | "passed" | "failed";

export interface VisibleTest {
  id: string;
  label: string;
  input: string;
  expected: string;
  output: string | null;
  status: VisibleTestStatus;
  ms: number | null;
}
