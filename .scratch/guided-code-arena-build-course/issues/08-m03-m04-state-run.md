# 08 — M03 state and M04 Problem and visible Run

Plan Task: 8 (approved plan Task 8 — Author M03 state and M04 Problem/Run).

Status: needs-triage

Blocked by: None — authoring continues with the foundation walkthrough pending separately (see `.tours/learning/reviews/2026-09-28-foundation-walkthrough.md`, still pending real learner feedback).

**What to build:** Seven ready lessons that let the learner represent a Match with Rounds, sides and players, change Match phase through allowed transitions only, check membership through Match authority, compare injected Clock time against the Match deadline, validate Problem data and hide the hidden suite, call a fake Judge port with resolved verdicts (ok, compile_error, runtime_error) versus infrastructure rejection, and complete a Run that never changes score. Every lesson cites validated reference spans.

- [x] Author `m03-records`, `m03-transitions`, `m03-membership`, `m03-clock` in `.tours/learning/content/M03.json` with six phases, one change per Build step, four hints, exact practice paths, `Check.cwd: "."`, expected results and recovery
- [x] Author `m04-problem`, `m04-judge-port`, `m04-run` in `.tours/learning/content/M04.json` with public/hidden separation, fake Judge with verdict statuses, and no-score Run verified by serialization checks
- [x] Add validated source spans to all seven lessons (coverage-map containment checked by the loader; content test requires at least one span per lesson)
- [x] Rehearse each check from stated cwd in disposable dirs; verify failure branches (duplicate identity, illegal transition, outsider, deadline equality, hidden leak, compile_error/runtime_error verdicts versus Judge rejection, illegal phase Run)
- [x] Extend `scripts/build-content.test.mjs` for the seven IDs; update `learning-path.json`, `course-evidence.json`, generated outputs and `prototype/game-ui/42-subject-compliance.md`
- [x] Run content/generation checks and root `npm run lint`; leave diff uncommitted
- [ ] Browser walkthrough of the seven new lessons not separately done (Task 7 dusk/mobile inspection only); dispositions reviewed with no changes needed (spans reuse existing anchors, no new coverage-map entries)

## Comments

Created from approved plan Task 8. Reference anchors: legacy L03/L05/L07, `packages/arena-model/src/model.ts`, `transitions.ts`, `match-authority.ts`, `file-bank.ts`, `judge.ts` plus tests. Practice roles: `domain.match`, `domain.rules`, `port.clock`, `domain.problem`, `port.judge`, `workflow.run`.

### Progress 2026-09-28 (initial implementation)

Ticket 08 implemented uncommitted: M03.json (4 lessons) and M04.json (3 lessons) authored, learning-path statuses flipped to ready (18/68 ready), build-content test extended, 18 rehearsal checks passed in disposable dir, 7 evidence rows appended, guided pages regenerated (7 new build/*.html), compliance matrix updated. Checks: 50 course tests pass; lint clean; git diff --check clean; catalog --check reports 1 evidence drift from the reviewed compliance edit (hashes not refreshed). Walkthrough still pending per instruction.

### Reconciliation 2026-09-28 (review gaps closed)

Content test was added after authoring and passes — no pre-authoring red run was recorded. Lesson references now cite validated spans (no new anchors authored into `coverage-map.json`; reference paths remain read-only previews in prose). `m04-judge-port` and `m04-run` now execute compile_error and runtime_error as resolved verdicts with status kept, versus infrastructure rejection; rehearsal updated (judge 5 tests, run 4 tests, typecheck clean) and evidence rows amended. `m04-problem` leak check is serialization plus forbidden-string scan, not a full recursive walk. Evidence drift from the reviewed compliance edit was accepted through `--accept-reviewed-snapshot` after confirming source drift 0 (snapshot `f10f2ef7328398f8`, `--check` exit 0). Unrelated `docs/superpowers/.DS_Store` change reverted; untracked continuation plan and `node_modules` link left untouched.
