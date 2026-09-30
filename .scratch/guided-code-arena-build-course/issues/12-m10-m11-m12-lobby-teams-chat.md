# 12 — M10 Lobby and live play, M11 2v2, M12 chat

Plan Task: 12 (approved plan Task 12 — Author M10 invitation/live play, M11 2v2, M12 chat).

Status: needs-triage

Blocked by: 11 (M08–M09 durability and Judge)

**What to build:** Thirteen ready lessons that assemble sides in an invitation Lobby, start one durable Match, authorize sockets, track Presence apart from Player status, reconnect from authoritative snapshots, play real 1v1 and 2v2 in browsers, manage Readiness and Round-scoped collaboration, and run Match-scoped team chat with sidecar lifecycle.

- [x] Author all thirteen M10–M12 lessons with source spans, step visuals, exact practice files, and four progressive hints for each code change
- [x] Add exact Socket.IO package setup before gateway code; teach verified principal → Game membership check → private room, first-open/last-close Presence wiring, and browser chat history/live deduplication
- [x] Add the Task 12 content regression test; it was run red before the missing setup and wiring steps were added, then passed with the content and path suites (30/30)
- [x] Rehearse available checks in /private/tmp/arena-course-task12-rehearsal: TypeScript typecheck, four Socket.IO dependency resolutions, and 14 author-rehearsal check rows; Vitest suite passes 10 files / 16 tests
- [x] Add Task 12 evidence records, including five honestly blocked Postgres/live-browser checks; review the subject requirements and compliance matrix
- [ ] Generate Task 12 pages and finish the full course test/lint/catalog verification after M13 and Task 14 are authored
- [ ] Run the real Postgres transaction test and live reconnect, 1v1, 2v2, and chat browser journeys when the local stack is available; keep every result blocked until then

## Comments

Approved plan Task 12. References L04/L09/L10/L11/L12 and ADRs 0006–0013. Practice paths only; map each role to source. No combined Socket.IO/Yjs/chat setup in one step.

Task 12 authoring continuation (2026-09-29): exact Socket.IO versions are based on the reviewed Game manifest and lockfile. A fake-socket practice test checks membership-before-room and Presence calls; it is not live transport evidence. Practice rehearsal passed 14 recorded checks and 16 tests. The Postgres gate and four live-browser checks remain blocked. Learner walkthrough remains pending; teammate destination repo is unavailable. No source implementation, target evidence, or module claim is inferred.
