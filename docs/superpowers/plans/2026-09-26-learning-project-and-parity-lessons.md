# Project Operation and Rewrite Parity Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach how to run and test the current repository, then give the learner a test-first path to rebuild the exact current game.

**Architecture:** Use final lessons to explain app composition, services and runtime configuration, the roles of tests and harnesses, and observable behavior parity. Treat technical setup files as supporting references when they do not need their own behavior lesson. Finish with a file-by-file disposition audit, not a mastery claim.

**Tech Stack:** HTML/CSS lessons, Node.js MJS catalog and tests, workspace npm scripts, Docker Compose, Vitest, Playwright, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-26-code-arena-learning-course-design.md`

## Global Constraints

- Teach one behavior or rule at a time. Use a short sequence: predict, trace a small path in the code, inspect the relevant test, then explain the behavior from memory.
- Start with real player actions and follow their actual UI, Arena transport, Game service, game rules, persistence, or Judge boundaries as needed.
- Use tests as evidence for the cases they exercise. A passing test does not prove untested behavior, security against every attack, or parity in a separate rewrite.
- Use `CONTEXT.md` terms consistently: Match, Round, Problem, Run, Submission, Hidden suite, Reveal, Readiness, Presence, Player status, and Match phase.
- Preserve the distinction between current implementation, test evidence, design documents, prototypes, and planned behavior.
- Never mark exposure, a correct click, or a local self-check as mastery.
- Do not change game behavior, database schema, module claims, or team sign-off as part of this learning-course work.
- The Judge isolation spike must always be labeled as an experiment, not runtime behavior.
- Keep the existing scope and exclusions unless a later reviewed course change explicitly revises them.
- Every lesson must state its goal and key terms, cite source/tests, explain what cited tests demonstrate and do not, and include a prediction, short trace, retrieval check with a useful hint, and rewrite-test prompt; target 7–12 minutes.
- Preserve all existing Git index and worktree changes; do not stage or commit unrelated paths.

## Review Focus

- A Docker Compose or environment example describes local setup, not production deployment; keep it separate from actual sandbox integration evidence in `container-judge.test.ts` (Task 2).
- `services/core` and `services/chat` skeletons are not complete account/chat products; inspect their startup/health surfaces and call out absent test evidence instead of inferring product behavior (Task 2).
- The arena harness uses fakes; its lifecycle results are not proof Docker or Postgres behavior passed; compare `packages/arena-harness/test/lifecycle.test.ts` with actual execution of `container-judge.test.ts` and `postgres.test.ts` (Task 3).
- Source-project tests do not run against the learner's separate rewrite unless ported and executed there; the rewrite gate stays pending until equivalent tests actually run in that project (Task 3).
- The 42-subject PDF requires mandatory behavior and a demonstration of each claimed module; course coverage does not satisfy sign-off; verify the lesson against the PDF and current compliance matrix (Task 3).

---

## Tasks

### Task 1: Teach frontend composition and observable Match screens

**Files:**
- Create: `.tours/learning/templates/0012-arena-screen.template.html`
- Generate: `.tours/learning/lessons/0012-arena-screen.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/components/ArenaPage.tsx`, `frontend/src/components/ArenaWorkspace.tsx`, `frontend/src/components/ArenaHeader.tsx`, `frontend/src/components/DuelPanel.tsx`, `frontend/src/components/MatchPanel.tsx`, `frontend/src/components/MatchResult.tsx`, `frontend/src/components/PhaseBanner.tsx`, `frontend/src/components/RoundScoreReveal.tsx`, `frontend/src/components/TeamPanel.tsx`, `frontend/src/components/TestPanel.tsx`, `frontend/src/components/status.ts`, `frontend/src/index.css`

- [x] **Step 1: Trace one authoritative snapshot into the visible arena state** without teaching every React component at once.
- [x] **Step 2: Read the components and tests not already taught** by the earlier Run, Lobby, reconnect, and collaboration lessons. Classify display-only components as support references where appropriate.
- [x] **Step 3: Write the lesson** around “Which screen shows the current Match phase, and which component owns that display?” Cite source and test evidence.
- [x] **Step 4: Add exact catalog references and generate the page.** Keep prototype screenshots and production UI code clearly separate.
- [x] **Step 5: Run course tests, `--check`, and frontend unit tests.** Run frontend lint for UI lesson changes only if the implementation also changes UI code; do not add runtime UI code in this task.

**Task 1 verification:** 35 course-generator tests passed; 41 frontend unit tests passed; generation and `--check` agree on snapshot `94e3592a698707cc`, 248 current lesson links, no stale/unclassified/invalid anchors, and 74 uncovered paths reserved for Lessons 13–14. The historic 1v1 browser record was cited as dated evidence only; neither live browser scenario was rerun for this lesson. No app runtime code or 42-subject claims changed.

### Task 2: Teach service roles and local runtime setup

**Files:**
- Create: `.tours/learning/templates/0013-running-the-project.template.html`
- Generate: `.tours/learning/lessons/0013-running-the-project.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `services/core/src/app.module.ts`, `services/core/src/main.ts`, `services/core/src/health.controller.ts`, `services/chat/src/app.module.ts`, `services/chat/src/main.ts`, `services/chat/src/health.controller.ts`, `services/game/src/app.module.ts`, `services/game/src/main.ts`, `services/game/src/game/game.module.ts`, service `Dockerfile`/`package.json` files, `docker-compose.yml`, `infra/nginx/nginx.conf`, `infra/postgres/init-db.sh`, `.env.example`, `.gitignore`, root/workspace `package.json` files, workspace TypeScript/Vite/Playwright/Oxlint configs, `scripts/gen-dev-certs.sh`, `scripts/play.sh`

- [x] **Step 1: Trace application startup** from the root scripts and Compose file to the Game service health endpoint.
- [x] **Step 2: Compare Game with Core and Chat service skeletons.** State what each currently owns and do not imply unimplemented product behavior.
- [x] **Step 3: Write the lesson** as a local-run walkthrough with a diagram-free service list and exact configuration links. Never include real secrets.
- [x] **Step 4: Assign every setup/configuration file** to this lesson or support-only with a concise reason. Keep lockfiles and lint configs as support references unless a concrete behavior requires a lesson.
- [x] **Step 5: Generate and validate the page and links.** Do not start or stop containers as part of authoring this lesson.

**Task 2 verification:** 36 course-generator tests passed; generation reported zero stale references, invalid anchors, or snapshot drift. `--check` still exits nonzero only because 35 files remain for Lesson 14/final disposition. The local script and Compose stack were not executed. PDF pages 9–10 and matching mandatory matrix rows were reviewed; the lesson explicitly distinguishes HTTP development paths and Compose scaffolding from compliance evidence, so the matrix remains unchanged.

### Task 3: Teach the test evidence and rebuild sequence

**Files:**
- Create: `.tours/learning/templates/0014-rewrite-with-tests.template.html`
- Generate: `.tours/learning/lessons/0014-rewrite-with-tests.html`
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/README.md`
- Source evidence: `packages/arena-harness/src/fake-judge.ts`, `packages/arena-harness/src/fixtures.ts`, `packages/arena-harness/src/judge-port.ts`, `packages/arena-harness/src/mock-game.ts`, `packages/arena-harness/test/bank.test.ts`, `packages/arena-harness/test/lifecycle.test.ts`, all in-scope unit/service/E2E test groups, `.tours/6-rebuild-the-game.tour`, `.tours/reference-baseline.md`, `prototype/game-ui/42-subject-compliance.md`, `CONTEXT.md`

- [x] **Step 1: Group existing tests by the behavior they prove**: domain, service/API, frontend, browser E2E, PostgreSQL, and Docker sandbox.
- [x] **Step 2: Write a beginner-friendly rewrite order** that starts with a small Match and tests, then adds Run, Submission, Reveal, Lobby, persistence, frontend, collaboration, and chat.
- [x] **Step 3: State the parity rule:** a gate passes only when an equivalent test in the new project ran and passed; this repository is a reference, not proof of rewrite behavior.
- [x] **Step 4: Explain the 42-subject matrix boundary.** A passing course or project test does not flip module status; only full requirement demonstration and team sign-off can do that.
- [x] **Step 5: Add exact links and generate the page.** Preserve current skipped-test, environment, and feature-limitation evidence.

**Task 3 verification:** 37 course-generator tests passed. Lesson 14 preserves the dated unit/Playwright/Docker records separately, labels skipped and unrun evidence, and includes the 2026-09-26 hidden-case confidentiality limitation without promoting it to an exploit test. The course index and Resources page now describe the complete 14-lesson course. Generation reports 178/178 files disposed, 325 current references, 11 reasoned support-only files, and no stale links, invalid anchors, unclassified files, source drift, or evidence drift. The 42-subject PDF (mandatory requirements and module-demonstration pages) and current matrix were reviewed; neither changed because course work does not alter production evidence or module status.

### Task 4: Complete the repository-wide coverage audit

**Files:**
- Modify: `.tours/learning/coverage-map.json`
- Review: `.tours/learning/reference-snapshot.json`
- Review: `.tours/learning/source-map.html`
- Review: `.tours/reference-baseline.md`

- [x] **Step 1: Run the source inventory** and compare all current files with the frozen source snapshot.
- [x] **Step 2: Resolve every path** as lesson-taught or support-only with a reason. Confirm all 178 initial inventory paths and every newly added in-scope path have a disposition.
- [x] **Step 3: Resolve every unclassified path, deleted path, broken anchor, changed fingerprint, missing template, and generated-output mismatch.** Do not accept a new snapshot until lesson and CodeTour impacts have been reviewed.
- [x] **Step 4: Run `node --test .tours/learning/scripts/*.test.mjs` and `node .tours/learning/scripts/build-catalog.mjs --check`.** Expected: zero missing/invalid/unclassified references, zero stale lesson sources, and all generated outputs current.
- [x] **Step 5: Run relevant workspace tests and report exact passes/skips.** Review the 42-subject matrix and update it only if the project evidence, scope, assumptions, or status changed.
- [ ] **Step 6: Open the generated course index and each lesson locally.** Confirm the correct order, readable source preview links, lesson freshness, and offline behavior.

**Task 4 audit:** The frozen snapshot remains `94e3592a698707cc`; inventory stayed at 178 paths, now with 326 current lesson references, 11 reasoned support-only files, and zero uncovered, stale, or unclassified paths. The Lesson 8 registry link was added to its coverage record and now opens at the registry boundary; the three Lesson 14 matrix citations remain direct local Markdown links because the matrix is deliberately excluded from the implementation preview inventory. All 37 course-generator tests, `--check`, the 60-file CodeTour baseline checksum check, and 41 frontend unit tests pass. A static offline audit resolved every local link across the index and all 14 lessons and found no remote runtime assets. The actual browser-open/visual portion remains unverified: Playwright Chromium could not launch under the macOS sandbox (`bootstrap_check_in` permission denied), CUA capture failed with ScreenCaptureKit errors, and the in-app browser surface was unavailable. No PDF requirement, production evidence, scope, assumption, or module status changed; the matrix remains untouched.
