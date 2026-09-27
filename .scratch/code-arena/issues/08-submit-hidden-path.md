# 08. Submit path (sealed hidden suite, idempotent)

Status: ready-for-agent
Category: Submit/hidden-suite path
Week 2: yes
Blocked by: 03, 06

## Scope

Game-service orchestration of reference Submit behavior: allowed only in `CODING` (2v2 additionally requires both Ready — enforced server-side regardless of UI state); locks the solution (`SUBMITTED`); evaluates the hidden suite (`EVALUATING`) via the 06 contract; each completed evaluation overwrites the round's pending score with the last one counting. This overwrite risk materially changes player strategy, so the submit surface must carry this exact warning prominently — never a minor tooltip: “Submitting again replaces your current scored result for this round.” (Rendered by 12; enforced here.); request identifiers make retries idempotent (repeat returns the original outcome, never a second transition); scores stay sealed until reveal. Unlimited submits per round; invalid/duplicate transport requests never count as attempts.

## Acceptance criteria

- [ ] Submit rejected outside `CODING` and (2v2) without both-ready; status progression Submitted → Evaluating → Locked in observed.
- [ ] Evaluation failure (judge unreachable/timeout) unlocks to `CODING` with the failure recorded — no lock exists without a verdict (recovery-only `SUBMITTED → CODING` edge in 03).- [ ] Hidden responses carry group scores only, releasable solely through the reveal path (10); payload assertions prove sealing.
- [ ] Retried identifiers return original outcomes; concurrent duplicate submits finalize once.
- [ ] Unlimited resubmits overwrite pending score; counted score, scoring timestamp, and submission count recorded per round for 10.

## Notes

Feeds 10 (scoring inputs) and 09 (lifecycle). Server-side readiness enforcement is required here even though the UI also gates.

## Comments

2026-09-23 (Phase 0): harness implements last-completed-wins + failure preservation + stable ids. `MockGame` overwrites one counted contribution per round by index (`contributions[round-1]`, `countedCount`/`submissionCount` getters), keeps full `submissionHistory` (completed + failed, UUID `submissionId`/`evaluationId` per attempt, failed never counts toward tie-break submissions), records `runHistory` (`runId`), exposes stable `matchId`/`roundId` (stdlib `randomUUID`, no source-hash identity), and recovers via `recoverSubmissionFailure(SUBMITTED, EVALUATION_NOT_ACCEPTED)` only. `prepareResubmit()` reopens `SCORE_REVEAL → CODING` keeping counted score until the next completed verdict. Tests: 100→40 counts 40 (1 counted, 2 subs), 40→100 counts 100, 78 survives failed resubmit then 90 overwrites, ids unique/stable. 12 tests green in `arena-harness`, typecheck clean. Remaining for this ticket: production game-service orchestration (real DB, 2v2 readiness gate, idempotent retry returning original outcome, sealed payload assertions).

2026-09-23 (Phase 0.5, semantic correction): resubmits now loop sealed — `submit()` success runs `CODING → SUBMITTED → EVALUATING → CODING` via `completeHiddenEvaluation`, counted overwritten, receipt still `{ok, round}` with no scores, `reveal()` still throws until the explicit `publishReveal()` action discloses via `publishRoundReveal` to `SCORE_REVEAL`. `prepareResubmit()` removed (no longer needed); `SCORE_REVEAL → CODING` removed (Submit requires CODING, stays disabled after reveal). New `countedScore` getter is harness-only visibility for tests; production must never expose it pre-reveal. Tests A–D green (100 sealed, 100→40 sealed, 78 survives failure, reveal exposes 40 and locks Submit). 15 tests green in `arena-harness`. Production items above still remaining.

2026-09-23 (Phase 0.75, concurrency): `run`/`submit` take an optional side (`you` default, `opponent` supported) gated by round CODING + own side coding; round never leaves CODING during executions. Mock models only your competitive score (opponent scripted); opponent submissions exercise activity independence only — production keeps one counted result per side. Late verdicts after reveal/advance are recorded, never overwrite published results. Submission-count rule fixed: completed judge verdicts count (history + UI + tiebreak); invalid/duplicate-retry count nothing new; infra failure pre-verdict is recorded (history + failures log) but counts toward neither UI nor tiebreak. 19 tests green in `arena-harness`.

2026-09-23 (COMPLETE): production Submit in `packages/arena-game/`: full `SubmissionRecord` persisted append-only (ids, match/round/side, problemVersionId, language, source snapshot + sha256, submittedAt, elapsedMatchMs, status, score/groups, failure code); per-side counted result with last-completed-wins; idempotent `evaluationId` retry (stored outcome, no second attempt); competitive verdicts incl. compile_error/TLE/MLE/OLE count as attempts; infra failure pre-verdict → failed history, no replacement, no tiebreak penalty; sealed receipt `{ok, round, submissionId, evaluationId}`; hidden suite travels game→judge only. 12/12 acceptance tests green (`test/submit-path.test.ts` + `test/sealing.test.ts`).

2026-09-25 (lock/idempotency hardening): same-identity in-flight retries now wait outside the Match lock, so the original judge can re-enter to commit; waiting retries replay the original success or judge error. Evaluation IDs are bound to Match, Round, problem version, side, submission ID, language, source hash, and document revision; conflicting reuse is rejected. Regression coverage: 17 submit-path tests, plus full engine and Game-service suites green. Cross-process pending-row claiming remains open under issue 25.
