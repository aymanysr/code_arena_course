# 13 — M13 team transition and integration

Plan Task: 13 (approved plan Task 13 — Ship the team transition workflow and M13 integration guidance).

Status: needs-triage

Blocked by: None for course authoring; the teammate-repository handoff checks remain blocked because that repository is unavailable.

**What to build:** Seven ready M13 lessons plus a usable workspace transition page that maps one learner-authored rule and then each game responsibility into the teammate destination repo without inventing target paths or copying practice passes.

- [x] Author `m13-inspect-team`, `m13-map-rule`, `m13-integrate`, `m13-compose`, `m13-tls`, `m13-parity`, `m13-handover` with inspection-first mapping, reuse/create/extend choices, Compose/worker/DB launch, HTTPS/WSS path, behavior parity matrix, and handover README.
- [x] Build workspace page with root entry, reference/practice read-only columns, editable target path/action/reason/check/cwd/dependency, preview-before-save; a missing repo blocks only team checks, practice stays usable, and the page makes no disk-inspection claims.
- [x] Exercise mapping in a disposable fixture with an alternate target path and working folder. Browser checks cover preview-before-save, reuse mapping, escaped user text, mapped command/cwd, partial mapping, and keeping results unverified. The map does not write files or rewrite imports.
- [x] Add unavailable-team and partial-mapping browser tests; update learning-path, workspaces/runtime, evidence, generated outputs, and compliance record. Final course test suite: 150 passed; root lint and catalog drift check pass.
- [ ] Inspect the actual teammate repository, run its mapped checks, and record separate learner-reported/team results. Blocked until the teammate repository is available; practice results do not satisfy this item.

## Comments

Approved plan Task 13. Reuses `WorkspaceProfile`/`Mapping`/`validateWorkspaceProfile`/`resolveBuildStep`; no second schema and no repo writer. The disposable mapping test is not evidence from the real teammate repository. The foundation walkthrough remains pending. No stage or commit.
