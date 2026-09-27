# Live Multiplayer Learning Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach how the current game handles live transport, authorization, Presence, reconnect, 2v2 collaboration, and team chat.

**Architecture:** Organize lessons around player-visible live behavior. Trace the browser, Socket.IO boundary, trusted principal, Game-owned state, and tests only as far as needed for one concept. Keep Match state, shared-document state, Presence, and chat separate.

**Tech Stack:** HTML/CSS lesson templates, Node.js MJS course builder, existing frontend and Game-service Vitest tests, Playwright E2E evidence.

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

- A trusted socket identity does not replace Match/room membership authorization; compare principal extraction in `socket-auth.test.ts` with member authorization in `team-2v2.test.ts` (Task 1).
- Presence is not Player status, and 1v1 disconnect behavior differs from 2v2; verify `PlayerStatus has no connectivity value` plus the 1v1/2v2 cases in `reconnect.test.ts` and `match-socket-presence.test.ts` (Task 1).
- A team-document change invalidates readiness; a stale revision cannot authorize Submit; verify `persists a changed Yjs source once and invalidates both approvals`, `only exposes the authoritative current document at its approved revision`, and `stale readiness (R1 approval, R2 current) blocks submit` (Task 2).
- Team chat is Game-owned but does not mutate Match state or the shared editor; verify isolation/history in `team-chat.test.ts` and the four-client separation scenario in `live-team-chat.spec.ts` (Task 3).
- E2E evidence and unit evidence must be labeled separately; an unrun browser test is not proof; preserve execution status in Task 4.

---

## Tasks

### Task 1: Teach transport, socket identity, Presence, and reconnect

**Files:**
- Create: `.tours/learning/templates/0009-live-connection.template.html`
- Generate: `.tours/learning/lessons/0009-live-connection.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `frontend/src/arena/transport.ts`, `frontend/src/arena/socket.ts`, `frontend/src/arena/useArena.ts`, `frontend/src/arena/types.ts`, `services/game/src/game/socket-auth.ts`, `services/game/src/game/match-socket-presence.ts`, `services/game/src/game/game.gateway.ts`, `services/game/src/game/principal.ts`, `packages/arena-game/test/reconnect.test.ts`, `services/game/src/game/socket-auth.test.ts`, `services/game/src/game/match-socket-presence.test.ts`, `frontend/e2e/reconnect.spec.ts`

- [x] **Step 1: Trace one snapshot/event path** from the Game service through the Arena transport to the UI.
- [x] **Step 2: Read socket-auth, presence, revision, and reconnect tests.** Record the exact distinction between trusted identity, room membership, Presence, and Player status.
- [x] **Step 3: Write the lesson** around the question “What does reconnect restore, and what does it not change?” Include separate 1v1 and 2v2 evidence where they differ.
- [x] **Step 4: Add catalog references and generate the page.** Mark scale-out limitations as current limitations, not solved behavior.
- [x] **Step 5: Run course tests, `--check`, and focused frontend/service reconnect tests.** Report any unavailable E2E environment.

Task 1 verification: renderer and navigation tests passed. Focused runs passed: frontend socket transport 12/12, Game-service socket-auth/Presence 7/7, Arena reconnect and 2v2 55/55, and course tests 31/31. Browser Playwright E2E scenarios are linked as source evidence but were not run. The catalog reports 109 uncovered files, 0 stale lesson links, 0 source/evidence drift, and 0 invalid anchors. Reviewed the 42-subject compliance matrix and its PDF-backed reconnect/multiplayer requirements; auth remains explicitly labeled development-only and no module status changed.

### Task 2: Teach 2v2 collaboration and Readiness

**Files:**
- Create: `.tours/learning/templates/0010-team-collaboration.template.html`
- Generate: `.tours/learning/lessons/0010-team-collaboration.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `packages/arena-game/src/team-collaboration.ts`, `packages/arena-game/src/collab.ts`, `packages/arena-game/src/records.ts`, `packages/arena-game/src/engine.ts`, `services/game/src/game/collab.gateway.ts`, `frontend/src/arena/collab.ts`, `frontend/src/components/ReadyState.tsx`, `packages/arena-game/test/team-collaboration.test.ts`, `packages/arena-game/test/team-2v2.test.ts`, `services/game/src/game/collab-ws.test.ts`, `frontend/e2e/live-collab.spec.ts`

- [x] **Step 1: Trace one accepted shared-document edit** and identify who owns the current source revision.
- [x] **Step 2: Read the edit, readiness invalidation, stale-submit, rollback, and reconnect tests.** Distinguish a Yjs update from the application `DocumentRevision`.
- [x] **Step 3: Write the lesson** around “Why does an edit clear both teammates’ Ready state?” Explain which source the server evaluates.
- [x] **Step 4: Add exact source/test anchors and generate the page.** Include limits on any test evidence that did not run.
- [x] **Step 5: Run course tests, `--check`, and focused collaboration suites.** Use Postgres/Playwright results only when those checks execute.

Task 2 verification: course generator tests 32/32 and focused in-memory 2v2 tests 33/33 passed; the Game-service build passed. The collaboration socket test was attempted with `DATABASE_URL` unset, but the sandbox rejected binding the local service (`listen EPERM`), so its nine cases did not execute. The browser E2E was not run. The Postgres failure-injection test was not run because it truncates tables; its existing case covers a language switch, not a failed source edit. `build-catalog.mjs --check` exits 1 only because the course remains unfinished (100 uncovered files); it reports 0 stale links, 0 source/evidence drift, and 0 invalid anchors. Snapshot remains `94e3592a698707cc`. Reviewed the 42-subject matrix against mandatory simultaneous-user/concurrency and gaming synchronization requirements; the lesson changes no runtime behavior, requirement evidence, scope, assumption, or module status, so no matrix edit was warranted.

### Task 3: Teach team chat and frontend sidecar lifetimes

**Files:**
- Create: `.tours/learning/templates/0011-team-chat.template.html`
- Generate: `.tours/learning/lessons/0011-team-chat.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `services/game/src/game/team-chat.gateway.ts`, `services/game/src/game/team-chat.test.ts`, `packages/arena-model/src/chat.ts`, `frontend/src/arena/chat.ts`, `frontend/src/arena/sidecars.ts`, `frontend/src/arena/sidecars.test.ts`, `frontend/src/components/TeamChat.tsx`, `frontend/e2e/live-team-chat.spec.ts`

- [x] **Step 1: Trace one team-chat message** from client namespace to other team members and identify which state it cannot mutate.
- [x] **Step 2: Read history, authorization, reconnect, and cleanup tests.** Confirm that current history is process-local and lost on service restart.
- [x] **Step 3: Write the lesson** around “Why is chat not part of the shared editor or Match state?” Include Match-scoped chat versus Round-scoped collaboration lifetimes.
- [x] **Step 4: Add catalog references and generate the page.** Do not describe process-local history as durable storage.
- [x] **Step 5: Run course tests, `--check`, and relevant chat/sidecar tests.** Report browser tests that did not run.

Task 3 verification: course generator tests 33/33 and focused frontend chat/sidecar tests 9/9 passed. Service chat socket tests and Playwright were not run; the same OS restriction established during Task 2 rejects the required local listener (`listen EPERM`). `build-catalog.mjs --check` exits 1 only because the course is still being built (91 uncovered files); 0 stale links, 0 source/evidence drift, and 0 invalid anchors. Snapshot remains `94e3592a698707cc`. Reviewed the PDF's mandatory multi-user requirement and the User interaction/basic chat module criteria against the compliance matrix. This is learning material only: no new production evidence, claim, assumption, or status was added, so the matrix remains unchanged.

### Task 4: Verify the live multiplayer batch

**Files:**
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/README.md`

- [x] **Step 1: Verify all socket, collaboration, Presence, chat, reconnect, and live E2E files** have lesson references or support reasons.
- [x] **Step 2: Check every 1v1/2v2 statement** against its exact service, engine, and frontend test evidence.
- [x] **Step 3: Run course tests and the catalog `--check`.** Expected: no broken links and only the final operations/parity batch remains open.
- [x] **Step 4: Review `prototype/game-ui/42-subject-compliance.md`.** Do not change module status because a lesson cites passing tests.

Task 4 verification: all seven frontend E2E files are assigned to Lessons 1, 4, 9, 10, or 11; their links distinguish test source from a run in this lesson update. The real-service reconnect and 2v2 suites, the Yjs reconnect E2E, and the existing browser suites were inspected but not run; the restart E2E's TCP-3220 `SIGKILL` behavior is called out in the lesson and README. Safe focused runs passed: Arena reconnect/team rules 55/55, server-free CollabClient 6/6, and course generator 34/34. Catalog `--check` exits 1 only for the remaining 85 files assigned to the planned Lessons 12–14; it reports 0 stale references, 0 source/evidence drift, 0 invalid anchors, and 0 unclassified paths. Snapshot remains `94e3592a698707cc`. Reviewed the authoritative PDF's concurrent-user/no-race, WebSocket/chat, remote-player/reconnect, and >2-player synchronization requirements against the compliance matrix; no runtime evidence, scope, assumption, claim, or module status changed, so the matrix remains untouched.
