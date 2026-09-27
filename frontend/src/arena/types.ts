import type {
  MatchMode,
  PlayerStatus,
  Presence,
  Readiness,
  RoundPhase,
  VisibleTestStatus,
} from "arena-model";

export type { MatchMode, PlayerStatus, Presence, Readiness, RoundPhase, VisibleTestStatus };

export interface ProblemExample {
  id: string;
  input: string;
  expected: string;
}

export interface ArenaProblem {
  id: string;
  title: string;
  description: string;
  examples: ProblemExample[];
  starters: Partial<Record<"C++" | "Python" | "C", string>>;
}

export interface TestView {
  id: string;
  status: VisibleTestStatus;
  output: string | null;
  ms: number | null;
}

export interface SideView {
  name: string;
  status: PlayerStatus;
  presence: Presence;
  submissions: number;
}

export interface TeamView {
  id: string;
  members: [SideView, SideView];
  score: number | null;
  submissions: number;
}

export interface RevealView {
  roundScore: number;
  groups: Array<{ name: string; weight: number; earned: number }>;
  totals: { you: number; opponent: number };
}

/** Terminal match result, viewer-relative (score sums + forfeit override). */
export interface MatchFinalView {
  you: number;
  opponent: number;
  outcome: string;
}

/**
 * SERVER/AUTHORITATIVE snapshot: everything here renders trusted server state.
 * Local UI state (font size, tabs, collapsed panes, drafts) lives in components.
 */
export interface ArenaSnapshot {
  mode: MatchMode;
  roundPhase: RoundPhase;
  round: number;
  totalRounds: number;
  remainingSeconds: number;
  problem: ArenaProblem;
  language: string;
  tests: TestView[];
  you: SideView;
  opponent: SideView;
  alpha: TeamView;
  beta: TeamView;
  ready: Readiness;
  /**
   * 2v2 only: current team-document revision + the revision each approval
   * binds to. Null in 1v1. Submit gating requires both approvals to equal
   * docRevision (server re-checks; this is UX state only).
   */
  docRevision: number | null;
  readyRevision: { you: number | null; mate: number | null } | null;
  reveal: RevealView | null;
  notice: string | null;
  /** Server mutation counter (§3): orders snapshots against events. */
  revision: number;
  /** Terminal result once MATCH_COMPLETE; null before. */
  matchFinal: MatchFinalView | null;
}
