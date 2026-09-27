# 03. Canonical domain/state model (modes, phases, statuses, events)

Status: ready-for-agent
Category: domain/state model
Week 2: yes
Blocked by: none

## Scope

Transcribe the frozen reference into a single canonical model shared (by import or by mirrored contract with conformance tests) across frontend and game service: `MatchMode` (1v1/2v2), `MatchPhase` (`ROUND_INTRO → CODING ⇄ RUNNING_TESTS → SUBMITTED → EVALUATING → SCORE_REVEAL → next round / match end`), `PlayerStatus` (coding/running/submitted/evaluating/locked in/disconnected) as the gameplay source of truth with `STATUS_LABEL`-equivalent display text, `presence` (online/offline) kept separate, and 2v2 readiness (per-player flags, both-required gate, per-round reset). Include the transition table (only `CODING` permits Run/Submit), the realtime event catalog for phase/status/test/reveal updates, and request-identifier idempotency rules. Use `CONTEXT.md` vocabulary; do not reintroduce retired puzzle terms.

## Acceptance criteria

- [ ] One canonical definition of modes, phases, statuses, presence, readiness, and all legal transitions, with illegal transitions rejected by construction or by test.
- [ ] Impossible combinations from the reference acceptance set are unrepresentable (e.g. `CODING` with locked status, `ROUND_INTRO` with Submit enabled, scores visible before reveal).
- [ ] Event catalog documents every cross-client update (phase, status, presence, readiness, test results, reveal) with payload shapes both sides conform to.
- [ ] Sum-of-scores result plus tie-break inputs (per-round counted score, scoring-submission timestamps, submission counts) are part of the model.

## Notes

Feeds 04, 06, 07, 08, 10, 12. Pure model plus tests — no service wiring here.

## Comments

2026-09-23: Implemented as `packages/arena-model/` (model, transitions, scoring, events + index; vitest suites). 51 tests pass, `tsc --noEmit` clean. Covers gating matrix, readiness, transition table, labels, normalization/sum/tie-breaks, event catalog. Single-round scoring-time fields (`scoringTimeMs`) implement the resolved final-score-time tie-break. 01 will wire it into the workspace; services import or mirror with conformance tests.

2026-09-23 (Phase 0): added same-round resubmit edge `SCORE_REVEAL → CODING` (unlimited submits, last-wins; counted replaced only on completed verdict) and explicit `recoverSubmissionFailure(from, cause)` allowing `SUBMITTED → CODING` only with `EVALUATION_NOT_ACCEPTED`. `canTransition` table otherwise unchanged; existing coverage preserved. 53 tests green, typecheck clean, `dist` rebuilt (arena-model → consumers order kept).

2026-09-23 (Phase 0.5, semantic correction): no authoritative doc (spec, 08, ADR-0003, prototype) requires post-reveal resubmission, so the generic table is restored to the reference machine — `SUBMITTED → CODING`, `EVALUATING → CODING`, `CODING → SCORE_REVEAL`, `SCORE_REVEAL → CODING` are all rejected by `canTransition`. Three cause-gated helpers own the special edges: `recoverSubmissionFailure` (EVALUATION_NOT_ACCEPTED), `completeHiddenEvaluation` (HIDDEN_EVALUATION_COMPLETED_SEALED, sealed loop back to CODING), `publishRoundReveal` (REVEAL_CONDITION_MET, disclosure to SCORE_REVEAL). 56 tests green, typecheck clean, `dist` rebuilt.

2026-09-23 (Phase 0.75, concurrency split): audit proved the single global phase blocked the other side (MockGame.submit set global EVALUATING, disabling B's Run/Submit). Model now splits round lifecycle (`RoundPhase`: MATCH_FOUND/ROUND_INTRO/CODING/SCORE_REVEAL/ROUND_COMPLETE/MATCH_COMPLETE; `MatchPhase`/`ALL_PHASES` renamed, services updated) from per-side activity (`PlayerStatus` + `canSideTransition` table + `canSideRun`/`canSideSubmit`). Generic `CODING` has no exit — reveal only via `publishRoundReveal`; `recoverSubmissionFailure`/`completeHiddenEvaluation` removed as dead helpers (recovery/completion are ordinary side edges; protection lives in counted-replacement + reveal layers). 67 tests green, typecheck clean, `dist` rebuilt.
