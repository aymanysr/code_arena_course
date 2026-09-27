# Backend Reliability Learning Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach how the current game claims and evaluates Submissions, runs untrusted code, stores Match state, and recovers after service failure.

**Architecture:** Build these lessons after the core Match path. Keep Judge execution, Evaluation orchestration, Match authority, and Match persistence distinct. Each lesson uses current source and tests and clearly states the limits of that evidence.

**Tech Stack:** HTML/CSS lesson templates, Node.js MJS course builder, existing `node:test` tooling, Vitest Game suites, Docker/Postgres only where available.

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

- Same-identity Evaluation retry and reused-ID-with-different-data are distinct; verify `idempotent retry of the same evaluationId` and both conflicting-reuse cases in `submit-path.test.ts` (Task 1).
- Judge infrastructure failure is not an ordinary contestant verdict; verify `infrastructure failure counts for history but not for tiebreak` and missing-Docker behavior in `submit-path.test.ts` and `container-judge.test.ts` (Tasks 1–2).
- Hidden test names/inputs/expected results must not be described as client-visible; verify `reveal discloses groups but never raw hidden inputs or expected values` in `sealing.test.ts` (Task 2).
- Recovery can re-drive pending work, but only durable Evaluation state affects the Match; inspect restart/recovery and claim cases in `postgres.test.ts` and `reconnect.test.ts` (Tasks 1 and 3).
- Postgres, Docker, and claim-pool tests count only when they actually execute; record actual execution or skip status in the batch verification (Task 4).

---

## Tasks

### Task 1: Teach Evaluation identity, retries, and failure outcomes

**Files:**
- Create: `.tours/learning/templates/0006-evaluation-retries.template.html`
- Generate: `.tours/learning/lessons/0006-evaluation-retries.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `packages/arena-game/src/evaluation-orchestration.ts`, `packages/arena-game/src/engine.ts`, `packages/arena-game/src/persistence.ts`, `packages/arena-game/test/submit-path.test.ts`, `packages/arena-game/test/evaluation-orchestration.test.ts`, `packages/arena-game/test/concurrency.test.ts`, `packages/arena-game/test/match-revision.test.ts`

- [x] **Step 1: Read the normal Submit and recovery ownership paths** and list which IDs are stable across a retry.
- [x] **Step 2: Read tests for duplicate identity, different payload reuse, failure replay, claim loss, and stale Match revision.** Do not generalize one case to all retry errors.
- [x] **Step 3: Write the lesson** around the question “What makes a retry the same Evaluation?” Include a short identity trace and one test example for a rejected ID reuse.
- [x] **Step 4: Add catalog anchors and generate the page.** Explain that orchestration coordinates work; the Judge still only executes code.
- [x] **Step 5: Run course tests, `--check`, and focused evaluation/submit tests.** Run Postgres tests only when their database is available.

### Task 2: Teach the Judge boundary, hidden data, and sandbox evidence

**Files:**
- Create: `.tours/learning/templates/0007-judge-boundary.template.html`
- Generate: `.tours/learning/lessons/0007-judge-boundary.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `packages/arena-game/src/judge.ts`, `packages/arena-game/src/container-judge.ts`, `packages/arena-game/src/judge0.ts`, `services/game/src/game/game.service.ts`, `packages/arena-game/test/sealing.test.ts`, `packages/arena-game/test/judge-security.test.ts`, `packages/arena-game/test/container-judge.test.ts`, `packages/arena-game/test/judge0.test.ts`, `spikes/judge-isolation/DECISION.md`, `spikes/judge-isolation/results.md`

- [x] **Step 1: Confirm current wiring**: ContainerJudge is the default; Judge0 is optional and selected through configuration.
- [x] **Step 2: Trace one sealed evaluation through `GameJudge` and ContainerJudge.** Keep the game-rule decision outside the Judge explanation.
- [x] **Step 3: Compare sealing tests with Docker security tests.** State what each suite proves and what it does not prove; label the spike as experimental.
- [x] **Step 4: Write the lesson** with one trust-boundary question, an implementation trace, a test-reading prompt, and a rewrite security-test prompt.
- [x] **Step 5: Add catalog anchors, generate the page, and run course tests plus focused Judge suites.** Count Docker tests only if they execute.

Task 1–2 verification: Lesson 6 renderer test was observed RED then GREEN; focused submit/evaluation/concurrency/revision suites pass 25/25. Lesson 7 renderer test was observed RED then GREEN; scripted Judge0 tests, engine sealing tests, and the missing-Docker error-classification case pass (8 tests; six real-container cases skipped by the name filter). Full Docker security/container suites were not run: `docker info` is denied access to `/Users/ayousr/.docker/run/docker.sock`. Course tests pass 29/29; generated source links are current, and `--check` reports only the 128 intentionally uncovered paths (0 source drift, 0 evidence drift, 0 invalid anchors). Source review identified that `INP`/`EXP` and scratch case files appear readable by submitted code in the default container path. This is explicitly labeled an unexecuted source-review finding in Lesson 7 and recorded in the 42-subject matrix; no game fix or module-status change was made.

### Task 3: Teach Match persistence and recovery

**Files:**
- Create: `.tours/learning/templates/0008-persistence-recovery.template.html`
- Generate: `.tours/learning/lessons/0008-persistence-recovery.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `packages/arena-game/src/store.ts`, `packages/arena-game/src/persistence.ts`, `packages/arena-game/src/postgres-store.ts`, `packages/arena-game/src/match-authority.ts`, `services/game/src/game/game.service.ts`, `infra/postgres/init-db.sh`, `docker-compose.yml`, `packages/arena-game/test/persistence.test.ts`, `packages/arena-game/test/postgres.test.ts`, `packages/arena-game/test/reconnect.test.ts`

- [x] **Step 1: Trace one Match save through the persistence interface** and compare the in-memory and Postgres implementations.
- [x] **Step 2: Read boot recovery and pending Evaluation recovery tests.** Distinguish durable state from process-local work and presence.
- [x] **Step 3: Write the lesson** around “What survives a Game-service restart?” Cite a transaction/schema path and a recovery test; label unrun database cases.
- [x] **Step 4: Add catalog anchors and generate the page.** Keep the existing JSONB schema-preservation statement tied to current source evidence.
- [x] **Step 5: Run course tests, `--check`, and persistence tests.** Report database access failures as blocked/skipped, not passing.

Task 3–4 verification: Lesson 8 renderer coverage passed; source review covers 20 persistence/reliability runtime and test paths (no missing lesson/support dispositions). The in-memory persistence contract passed 2/2; Postgres integration cases were safely skipped (12 skipped) by directing the test URL to an unusable loopback endpoint because the suite can create a database and truncates its configured database. Reconnect/recovery tests passed 24/24. Full course suite passes 30/30. The catalog check reports 120 uncovered paths while confirming 0 stale links, 0 source drift, 0 evidence/CodeTour drift, and 0 invalid anchors; course-wide coverage remains in progress. The existing CodeTour checksum baseline did not change. Reviewed the 42-subject matrix; the hidden-case caveat remains source-review-only and no module status changed.

### Task 4: Verify the backend reliability batch

**Files:**
- Modify: `.tours/learning/README.md`
- Modify: `.tours/learning/coverage-map.json`
- Review: `.tours/reference-baseline.md`

- [x] **Step 1: Verify all Judge, Evaluation, persistence, recovery, and related test files** have a lesson reference or an explicit support reason.
- [x] **Step 2: Check all prose** for unsupported claims about retries, security, durability, provider behavior, or cross-process guarantees.
- [x] **Step 3: Run `node --test .tours/learning/scripts/*.test.mjs` and the catalog `--check`.** Expected: all affected lesson freshness badges match the frozen snapshot.
- [x] **Step 4: Review `prototype/game-ui/42-subject-compliance.md`.** Keep module status unchanged unless implementation evidence itself changed.
