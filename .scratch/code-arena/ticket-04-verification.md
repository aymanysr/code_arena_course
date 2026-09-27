# Ticket 04 verification — 2026-09-24

## Verdict and scope

COMPLETE for `.scratch/code-arena/issues/04-entry-lobby.md`, using the external trusted-principal seam. Ticket 16 remains accepted COMPLETE; no chat, judge, Yjs, scoring, or round-state semantics changed. No commit was made.

The canonical ticket explicitly requires side assembly, change-clears-ready, all players ready, full sides, and host start. These override automatic private-room start in the pasted brief. Public FIFO queue and four-player proofs extend the canonical minimum. Authentication remains external. This is tested local implementation evidence, not a claim of completed subject modules or production deployment.

## Architecture and persistence

Public: principal → validated mode → persisted queue admission → per-mode matcher transaction → FIFO participants (1v1: first left, second right; 2v2: first two left, next two right) → ArenaEngine creates MATCH_FOUND → match/round/side records and queue linkage commit together → principal-derived user-channel notification → Arena URL.

Private: principal → create/join by code → server-validated side requests and readiness → host starts only with full sides and everyone ready → ArenaEngine creates MATCH_FOUND → match/round/side records and room linkage commit together → current members' user-channel notification → Arena URL.

The engine's existing creation logic accepts a persistence callback so the lobby transaction saves the actual authoritative record using the existing `saveMatchTx`. It does not reimplement match construction. A failed queue/room linkage rolls back the match, rounds, and sides.

| Table | Columns | Keys and indexes |
| --- | --- | --- |
| arena_queue_entries | id, user_id, mode, status, joined_at, matched_match_id, cancelled_at, queue_order | PK id; unique user_id WHERE status='waiting'; FIFO index (mode, joined_at, queue_order) WHERE status='waiting'; queue_order BIGSERIAL breaks timestamp ties |
| arena_private_rooms | id, code, mode, owner_user_id, status, created_at, expires_at, match_id | PK id; unique code |
| arena_private_room_members | room_id, user_id, side_id, ready, joined_at | PK (room_id,user_id); room_id FK with ON DELETE CASCADE |

Admission transactions take a PostgreSQL advisory lock per user before checking all three exclusive states. Matchers serialize per mode and lock selected queue rows. Room mutations lock the room row. Match creation plus queue/room linkage share a single transaction; notifications follow commit. In-memory development mutations serialize through a promise chain and share the engine's match store for active-match checks.

The server selects three rounds from the existing `even-ledger` and `double-it` bank records; repeats are possible because only two records are selected from. ArenaEngine persists the resolved bank problem identifiers and hidden-suite references. Client problem overrides are ignored. Existing bank versioning semantics are unchanged.

## Private contract

- `POST /lobby/rooms {mode:"1v1"|"2v2"}` → `{ok:true,room,members}`.
- `POST /lobby/rooms/join {code}` → `{ok:true,room,members,full}`.
- Six cryptographically generated characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`: 32^6 possibilities, 30 bits. Codes normalize case and surrounding whitespace.
- Capacity 2 or 4, respectively; side capacity 1 or 2. Lifetime 20 minutes.
- Repeated admission rejected with 409. Recovery uses `/lobby/active`, not join.
- Host departure closes the room; another member's departure frees a slot. Leaving users no longer receive room broadcasts.
- Invalid code 404; expired 410; full/started/duplicate/admission conflict 409; non-host/member 403; invalid input/start gate 400; rate limit 429.
- Lobby mutations use the existing 15-actions/10-second per-user limiter. Cross-process limits and brute-force load testing remain Ticket 17.

## Exactly-once and recovery evidence

Real PostgreSQL tests verify eight users form exactly two distinct 2v2 matches across concurrent matchers, with no repeated participant; failed queue and room writes leave no authoritative match; same-user simultaneous queue/room admissions have one winner; cancellation before matching leaves the player cancelled, while cancellation blocked behind matching returns that match; one winner takes the final 2v2 room slot; concurrent readiness/start cannot start unready or twice; concurrent side changes cannot overfill.

Active matches block all new admission paths. MATCH_COMPLETE releases admission and is omitted from queue/private recovery. Expired rooms cannot start or block admission. Queue membership survives disconnection. Browser recovery after an offline queue match, private-room reload, and private start while offline all pass. Reconnect reads `/lobby/active` on Socket.IO `connect` (initial connection and reconnection), then restores room subscription or navigates to the persisted match.

## Browser evidence

Final lobby suite: 7/7 PASS against PostgreSQL on port 3224, isolated schema `ticket04_verify_1790280700`; preview port 4173.

- Entry/mode controls.
- Private 1v1 ready gate and shared Arena handoff.
- Public 1v1 entry → same match → Run → both Submit → score reveal.
- Public queue matched while offline → reload recovers Arena.
- Public 2v2 → same MATCH_FOUND match → coding → Alpha/Beta shared-document convergence and opponent isolation → team chat and isolation → readiness gate.
- Private 2v2 same proof, plus fifth-player rejection.
- Private membership reload, offline start recovery, invalid code rejection.

Representative final-run IDs:

| Flow | Match | Participants |
| --- | --- | --- |
| Public 1v1 | acae4367-7919-48f7-9a32-f3f36998afbc | qp1-1790280882803 left; qp2-1790280882803 right |
| Public 2v2 | 0fa4f5e0-d921-4265-9feb-f5e491a33deb | queue-1790280886416-0/-1 left; -2/-3 right |
| Private 2v2 | d0a1cc42-961a-4c83-8cfb-d2f816a51bd7 | private-1790280888432-0/-1 left; -2/-3 right |

Existing browser regressions: 8/8 PASS (four responsive 1v1 full duels, existing 2v2, Yjs collaboration, Ticket 16 team-chat proof, and absence of team chat in 1v1).

## Security and limits

Lobby payloads cannot choose identity or bank versions. Public teams are server-assigned. Private participants can request a side for themselves, subject to server membership/capacity checks and readiness invalidation, as required by the canonical ticket. Duplicate queues and simultaneous active admissions are rejected. Invalid codes and capacity overflow are rejected. Room HTTP reads and socket subscriptions require membership. Broadcast recipients are current server-owned members, preventing departed subscribers from receiving later updates. Lobby responses contain no hidden-test content.

Direct `POST /matches` remains the existing development fixture API used by Arena regression tests. The trusted-principal seam remains explicitly development-only; deployment/auth integration remains external. No claim that production authentication is implemented.

## Defects reproduced and corrected

1. Missing build-time VITE_GAME_URL prevented lobby rendering; rebuilt with explicit URL.
2. Browser heading substring matched the lobby itself; exact Arena heading now prevents premature assertions.
3. Non-members could read and subscribe to rooms; shared membership check now covers both.
4. Departed members kept receiving broadcasts; fan-out now uses current membership.
5. Invalid mode returned HTTP 201 and unknown codes mapped to 500; now 400/404.
6. Match creation committed separately from lobby linkage; failure injection now proves atomic rollback.
7. Same-user concurrent admissions succeeded three times; per-user transaction lock now yields one winner.
8. In-memory concurrent matchers duplicated creation, and room joins bypassed queue/other-room checks; serialized mutations and shared admission checks fix both.
9. Matched-offline public clients stayed in entry; connect/reconnect recovery now handles matched queue entries.
10. Expired rooms could start, and completed matches stayed in recovery; expiry and lifecycle filtering corrected.
11. Queue matching errors were silently discarded; immediate matching is awaited and the existing service timer retries persisted queues.
12. Duplicate private join returned success; now 409, with recovery kept on the active endpoint.

## Verification commands

From repository root unless stated otherwise:

```sh
VITE_GAME_URL=http://localhost:3220 npm run build --workspace arena-frontend
npm run build --workspace arena-game-engine
npm run build --workspace arena-game
VITE_GAME_URL=http://localhost:3224 npm run build --workspace arena-frontend
npm run typecheck
npm run lint
npm test
DATABASE_URL=postgres://postgres:postgres@localhost:5433/arena_test npm test --workspace arena-game-engine -- --run test/lobby.test.ts test/lobby-atomic.test.ts
npm test --workspace arena-game -- --run src/game/lobby.test.ts
git diff --check
```

From `frontend/`:

```sh
npx playwright test e2e/live-lobby.spec.ts
E2E_GAME_URL=http://localhost:3224 npx playwright test e2e/live-lobby.spec.ts
E2E_GAME_URL=http://localhost:3224 npx playwright test e2e/live-1v1.spec.ts e2e/live-2v2.spec.ts e2e/live-collab.spec.ts e2e/live-team-chat.spec.ts
```

The isolated live service was started with `PORT=3224 DEV_PRINCIPAL=true DATABASE_URL='postgres://postgres:postgres@localhost:5433/arena_test?options=-c%20search_path%3Dticket04_verify_1790280700' node dist/main.js` from `services/game/`. Existing service on 3220 was left untouched. Browser launch initially failed under the filesystem sandbox; rerunning with the approved local execution permission allowed Chromium to start. The preview server served the rebuilt bundle without requiring a restart.

Coverage added in this continuation: 2 in-memory tests; 10 PostgreSQL atomicity/race/lifecycle tests; 3 service/socket tests; 4 Playwright tests, plus strengthened existing assertions and Run/Submit proof. No standalone frontend unit test added. Total relevant suites: 12 lobby unit + 12 PostgreSQL (2 existing, 10 new); 6 lobby service/socket; 7 lobby browser tests.

Build/typecheck/lint/diff checks passed. Workspace run passed 296 tests; environment-gated lobby PostgreSQL checks are verified separately (24/24 lobby tests including in-memory). Existing engine PostgreSQL and collaboration persistence tests also ran in the workspace suite. Vite retains its existing large-bundle advisory; Node emits an experimental localStorage warning in test execution. Neither is a browser-console game error.

## Files changed in this continuation

- `packages/arena-game/src/engine.ts`: reuse match creation with transaction-bound persistence.
- `packages/arena-game/src/postgres-store.ts`: expose the existing transaction writer.
- `packages/arena-game/src/lobby.ts`: transaction atomicity, admission serialization, FIFO ties, expiry/completed filtering, memory parity, duplicate admission.
- `packages/arena-game/test/lobby.test.ts`: development-store concurrency/admission regressions.
- `packages/arena-game/test/lobby-atomic.test.ts`: isolated real-database failure and race checks.
- `services/game/src/game/game.service.ts`: transaction callback, shared membership authorization, awaited/retried matching, current-member notifications, consistent mutation limits.
- `services/game/src/game/lobby.controller.ts`: input error statuses and member-only reads.
- `services/game/src/game/lobby.gateway.ts`: member-only subscription and current-member fan-out.
- `services/game/src/game/errors.ts`: preserve 404 mapping.
- `services/game/src/game/lobby.test.ts`: access, revocation, and status regressions.
- `frontend/src/arena/lobby.ts`: connection recovery callback.
- `frontend/src/components/LobbyPage.tsx`: recovery, matched responses, closed-room state.
- `frontend/e2e/live-lobby.spec.ts`: accurate Arena assertions, full entry proofs and offline recovery.
- `.scratch/code-arena/issues/04-entry-lobby.md`: acceptance and completion evidence.
- `.scratch/code-arena/issues/17-tests-security-compliance.md`: remaining hardening findings.
- `.scratch/code-arena/ticket-04-verification.md`: this evidence record.
- `prototype/game-ui/42-subject-compliance.md`: subject review and bounded implementation evidence.

## Subject review and Ticket 17 handoff

Reviewed authoritative PDF general multi-user concurrency requirements, technical validation/database/HTTPS requirements, WebSocket disconnect handling, and gaming/remote-player/multiplayer synchronization requirements. The local tests add evidence for concurrency, persistence, validated membership and reconnect. They do not demonstrate a complete subject-compliant deployment; module rows remain Designed.

Real remaining findings:

- Lobby notifications and per-user limiters remain process-local; multi-instance fan-out/rate-limit/load validation remains before scaling.
- Invite-code brute-force/load testing remains; 30-bit codes expire after 20 minutes and join attempts are limited per principal.
- Existing Nginx configuration lacks a demonstrated end-to-end frontend/API/WSS deployment path; tested direct HTTP ports are local verification only. HTTPS/WSS and one-command delivery remain final compliance work.
- Existing bank identifier/version immutability enforcement, production fixture-route exposure, and external-principal integration need final boundary review; no bank/auth redesign performed here.
- Keep the accepted Ticket 16 notes: process-local ephemeral chat history/limits and unproven server-side lost-ack message idempotency. No reopening of 16.

Remaining roadmap: 17 — tests / security / compliance. No new tickets.
