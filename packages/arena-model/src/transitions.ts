import {
  type MatchMode,
  type PlayerStatus,
  type Readiness,
  type RoundPhase,
  bothReady,
} from "./model.js";

/**
 * Round lifecycle: the ONE global state machine. Tracks match/round progress
 * only — never per-side execution activity. Each side runs its own activity
 * (PlayerStatus) independently: one side evaluating/running never freezes the
 * other side's editor or actions. Gates below take the round phase; per-side
 * gates take the side activity.
 * SCORE_REVEAL fans out to ROUND_INTRO directly (the reference's primary
 * path) and to ROUND_COMPLETE/MATCH_COMPLETE for the banner-driven advance.
 * CODING -> SCORE_REVEAL is intentionally ABSENT from this generic table and
 * lives behind publishRoundReveal(..., "REVEAL_CONDITION_MET") so arbitrary
 * callers cannot disclose hidden results. No post-reveal resubmit exists:
 * after SCORE_REVEAL, hidden group results are visible and Submit stays
 * disabled (canSubmit requires round CODING).
 */
const ROUND_LEGAL: Record<RoundPhase, readonly RoundPhase[]> = {
  MATCH_FOUND: ["ROUND_INTRO"],
  ROUND_INTRO: ["CODING"],
  // ponytail: CODING has no generic exit — the round leaves it only through
  // the game-owned publishRoundReveal helper, so evaluation completions and
  // ordinary callers can never disclose hidden results or end a round.
  CODING: [],
  SCORE_REVEAL: ["ROUND_COMPLETE", "ROUND_INTRO", "MATCH_COMPLETE"],
  ROUND_COMPLETE: ["ROUND_INTRO", "MATCH_COMPLETE"],
  MATCH_COMPLETE: [],
};

export function canTransition(from: RoundPhase, to: RoundPhase): boolean {
  return ROUND_LEGAL[from].includes(to);
}

/** Only round CODING permits Run. ROUND_INTRO keeps Run disabled so Start gates play. */
export function canRun(phase: RoundPhase): boolean {
  return phase === "CODING";
}

/**
 * Only round CODING permits Submit. 1v1 needs nothing else; 2v2 additionally
 * requires both teammates Ready (enforced server-side regardless of UI).
 */
export function canSubmit(phase: RoundPhase, mode: MatchMode, readiness: Readiness): boolean {
  if (phase !== "CODING") return false;
  return mode === "1v1" || bothReady(readiness);
}

/** Only round CODING allows editing; every other round phase is read-only. */
export function isEditable(phase: RoundPhase): boolean {
  return phase === "CODING";
}

/** Cause gating CODING -> SCORE_REVEAL: the game determined the round's reveal condition was met. */
export type RevealCause = "REVEAL_CONDITION_MET";

/**
 * ponytail: explicit reveal action — the only way into SCORE_REVEAL.
 * Evaluation completion alone never reveals; only this game-owned call
 * publishes hidden group information. After reveal, no resubmit edge exists.
 */
export function publishRoundReveal(from: RoundPhase, cause: RevealCause): RoundPhase {
  if (from !== "CODING" || cause !== "REVEAL_CONDITION_MET") {
    throw new Error(`illegal reveal ${String(from)} with cause ${String(cause)}`);
  }
  return "SCORE_REVEAL";
}

/**
 * Per-side execution activity: the ONE authoritative state per player/team
 * side. Sides transition independently — A submitted/evaluating/running while
 * B keeps coding. Recovery (submitted -> coding with no verdict) and sealed
 * completion (evaluating -> coding with the counted result replaced) are
 * ordinary activity edges here; the protection lives one layer up: counted
 * results change only on a real judge verdict (submission-record layer) and
 * hidden results publish only via publishRoundReveal. Reveal can lock any
 * active side, and a round advance resets sides to coding. Connectivity is
 * presence, never an activity edge (ticket 11): no transition targets a
 * connectivity state.
 */
const SIDE_LEGAL: Record<PlayerStatus, readonly PlayerStatus[]> = {
  coding: ["running", "submitted", "locked"],
  running: ["coding", "locked"],
  submitted: ["evaluating", "coding", "locked"],
  evaluating: ["coding", "locked"],
  locked: ["coding"],
};

export function canSideTransition(from: PlayerStatus, to: PlayerStatus): boolean {
  return SIDE_LEGAL[from].includes(to);
}

/** A side may start a visible Run only while its own activity is coding. */
export function canSideRun(status: PlayerStatus): boolean {
  return status === "coding";
}

/** A side may start a Submit only while its own activity is coding. */
export function canSideSubmit(status: PlayerStatus): boolean {
  return status === "coding";
}
