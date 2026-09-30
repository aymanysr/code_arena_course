# 09 — M05 Submit through terminal Match

Plan Task: 9 (approved plan Task 9 — Author M05 Submit through terminal Match).

Status: needs-triage

Blocked by: 08 (reconciled as needs-triage; sufficient to start 09, review pending in parallel)

**What to build:** Nine ready lessons that take an accepted Submission through pending Evaluation, same-identity retry, integer scoring, Reveal, Round reset, summed final result with time/count tie-breaks, Match deadline with bounded inclusive grace, and a full three-Round local Match against a fake Judge. Every lesson cites validated reference spans.

- [x] Author all nine `m05-*` lessons in `.tours/learning/content/M05.json` per plan table; each recalls its prerequisite and removes prior simplifications explicitly
- [x] Rehearse same-identity success/error, conflicting reuse, scoring 43 case, equality at deadline, inclusive grace cutoff (counts at, superseded one past), tie-break matrices; record author-rehearsal evidence only
- [x] Add validated source spans to all nine lessons; add M05 browser timeline test (deadline frames with zero console errors)
- [x] Update learning-path, evidence, generated outputs; content test extended with 43 assertion and per-lesson span requirement
- [x] Run content/browser/generation checks and `npm run lint`; leave diff uncommitted
- [ ] Dispositions reviewed with no changes (spans reuse existing anchors); compliance matrix updated for lesson count only (no module-claim change)

## Comments

Approved plan Task 9. References L01/L02/L03/L06, `evaluation-orchestration.ts`, `round-lifecycle.ts`, `scoring.ts`, `deadline-closure.test.ts`. Local `SubmissionReceipt`/`EvaluationOutcome` mapped to source contracts; no giant ArenaEngine required first.

### Reconciliation 2026-09-28 (review gaps closed)

16 rehearsal checks pass in a disposable dir (submit 2, evaluation 2, scoring 3, lifecycle 4, deadline 3, local-match 2) plus typecheck clean; one strict-null fix applied to the rehearsal test only. Practice grace contract is an inclusive numeric cutoff (settle at deadline + grace counts, one unit past does not), labeled simulation because production waits out grace with a timer race; durability arrives in M08. Browser timeline test covers deadline accept/reject/terminal frames with zero console errors (8/8 experience tests pass). Lesson references cite validated spans. `--check` exit 0 with source drift 0. Walkthrough still pending.
