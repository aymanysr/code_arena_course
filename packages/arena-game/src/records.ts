import type { MatchMode, PlayerStatus, Presence, RoundPhase } from "arena-model";
import type { ExecutionStatus } from "./judge.js";

export type SideId = string;

export interface ForfeitRecord {
  winner: SideId;
  loser: SideId;
  /** Server time of the terminal decision. */
  at: number;
  reason: "grace-expired" | "leave";
}

export interface Participant {
  userId: string;
  sideId: SideId;
}

/**
 * Opaque shared-document revision (ticket 14 placeholder). Monotonic per team
 * document, 1-based; a fresh round starts at 1. Ticket 15 maps Yjs state
 * (state vector / update hash) onto this identity — never the reverse.
 */
export type DocumentRevision = number;

export interface MemberReadiness {
  userId: string;
  ready: boolean;
  /** Revision approved when ready=true; null when never ready or invalidated. */
  documentRevision: DocumentRevision | null;
  updatedAt: number;
}

export interface TeamDocState {
  revision: DocumentRevision;
  /** Team-owned language (authoritative in 2v2; 1v1 stays client-local). */
  language: string;
}

export interface CountedResult {
  score: number;
  scoringTimeMs: number;
}

export interface RoundState {
  roundId: string;
  problemVersionId: string;
  hiddenSuiteId: string;
  counted: Partial<Record<SideId, CountedResult>>;
  attempts: Partial<Record<SideId, number>>;
  activities: Partial<Record<SideId, PlayerStatus>>;
  /** Last visible-run results per side (visible only; restored on reconnect). */
  runTests: Partial<Record<SideId, Array<{ id: string; status: "idle" | "running" | "passed" | "failed"; output: string | null; ms: number | null }>>>;
  /**
   * 2v2 only: one shared-document identity per team side. Absent in 1v1
   * (no shared document exists there). Ticket 15 binds real Yjs state here.
   */
  teamDocs?: Partial<Record<SideId, TeamDocState>>;
  /**
   * 2v2 only: per-member readiness keyed by userId (relational, no fixed
   * player columns). Absent in 1v1. Round-scoped: nextRound replaces the map.
   */
  readiness?: Record<string, MemberReadiness>;
  reveal: RevealSnapshot | null;
  closing: boolean;
  cutoffPassed: boolean;
  superseded: string[];
}

export interface MatchRecord {
  id: string;
  mode: MatchMode;
  roundPhase: RoundPhase;
  currentRound: number;
  totalRounds: number;
  durationMs: number;
  startedAt: number;
  participants: Participant[];
  rounds: RoundState[];
  /** Audit trail (judge/run failures). Persisted with the match; never secrets. */
  failures: string[];
  /**
   * Monotonic mutation counter (ticket 11 §3): bumped once per committed
   * state change, carried on every snapshot and event payload so clients can
   * drop stale/out-of-order updates after reconnect.
   */
  revision: number;
  /**
   * Connectivity per side (ticket 11 §1): presence owns socket state only and
   * never rewrites side activity. Absent entry means offline (no socket ever
   * attached); fresh matches start with no entries.
   */
  presence: Partial<Record<SideId, Presence>>;
  /** Server time each side last went offline (grace accounting); cleared on rejoin. */
  offlineSinceMs: Partial<Record<SideId, number>>;
  /**
   * 2v2 only: per-member connectivity keyed by userId (two members share one
   * side, so side-keyed presence cannot represent them). 1v1 keeps using the
   * side-keyed `presence` path untouched. No 2v2 grace forfeit reads these.
   */
  memberPresence?: Partial<Record<string, Presence>>;
  memberOfflineSinceMs?: Partial<Record<string, number>>;
  /** Terminal forfeit decision (grace expiry or deliberate leave); null otherwise. */
  forfeit: ForfeitRecord | null;
}

export interface GroupResult {
  name: string;
  weight: number;
  /** Whole-percent display credit (single rounding point applied). */
  earned: number;
  /** Exact integer basis points (10000 = 100.00%); the persisted precision. */
  earnedBp: number;
}

export type SubmissionStatus = "pending" | "completed" | "failed" | "superseded";

export interface SubmissionRecord {
  submissionId: string;
  evaluationId: string;
  matchId: string;
  roundId: string;
  sideId: SideId;
  problemVersionId: string;
  language: string;
  source: string;
  sourceHash: string;
  /** 2v2 only: application DocumentRevision frozen at acceptance. Null in 1v1. */
  documentRevision?: DocumentRevision | null;
  submittedAt: number;
  elapsedMatchMs: number;
  status: SubmissionStatus;
  score: number | null;
  scoreBp: number | null;
  groups: GroupResult[] | null;
  testStatuses: ExecutionStatus[] | null;
  failureCode: string | null;
}

export interface RevealSnapshot {
  round: number;
  roundId: string;
  scores: Partial<Record<SideId, number>>;
  groups: Partial<Record<SideId, GroupResult[]>>;
  totals: Partial<Record<SideId, number>>;
  publishedAt: number;
}
