# 14 — Coverage audit, verification and handoff

Plan Task: 14 (approved plan Task 14 — Close file and behavior coverage, verify, and hand off).

Status: needs-triage

Blocked by: None for implementing the audit; completion gates below remain open.

**What to build:** A strict, honest complete-course gate that proves every inventoried file has a disposition, every required behavior has a checked lesson, evidence is fresh and scoped, docs describe the built state, and the learner gets a factual handoff with blockers.

- [x] Create `scripts/build-coverage.mjs` with `{courseReady, targetComplete, issues[]}`; wire read-only `--check-build-complete` into `build-catalog.mjs`; normal `--check` still detects drift.
- [x] Add coverage tests for missing file dispositions, missing behavior checks, stale snapshots, blocked Judge versus unit mocks, rehearsal without target evidence, latest-result reopening, file/exclusion dispositions, and inventory integration. Keep the foundation walkthrough separate.
- [x] Review and disposition all 201 scoped files (74 build, 127 support) and 21 explicit exclusions; link all 18 required behavior rows to course checks; update README/MISSION/NOTES/RESOURCES/MAINTAINING, evidence, compliance record, and generated outputs.
- [x] Run generation and non-browser verification after the review fixes. The 10 non-browser course test files pass 132/132; root `npm run lint` and `npm run typecheck` pass; catalog `--check` passes with zero source/evidence drift; `git diff --check` passes. The browser suite cannot start bundled Chromium here: `bootstrap_check_in ... Permission denied (1100)`. The strict `--check-build-complete` gate exits 1 as intended while blockers remain.
- [x] Resolve the independent review findings: denied-storage navigation now uses session storage with a tab-name last fallback and accurate temporary/unavailable messaging; M11 teaches the test-first authenticated sync, provider, and editor binding before four-client work; M08/M09 Build hints are specific; M10–M12 transfers use changed cases; M05 scoring/deadline visuals no longer show seconds-left controls.
- [ ] Close the remaining gates: 15 author checks remain blocked and five new M11 author checks lack rehearsal evidence (79/99 pass); 0/99 checks have current results from the actual teammate repository; the learner walkthrough is still pending. Current state: `courseReady=false`, `targetComplete=false`.

## Comments

Approved plan Task 14. The checker is read-only. Latest blocked evidence reopens a gate; only actual team-workspace evidence counts toward `targetComplete`. Current audit after review changes: 68/68 lessons authored; 201/201 scoped paths and 21/21 exclusions disposed; 18/18 required behaviors linked; 79/99 author checks pass, with 15 blocked and five new M11 checks awaiting rehearsal; no current result exists from the teammate repository (0/99). `courseReady=false`, `targetComplete=false`. The learner walkthrough remains pending. No publishing, stage, or commit.
