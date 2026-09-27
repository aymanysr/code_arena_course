# Code Arena — production specification

Date: 2026-09-25
Status: Defaults resolved 2026-09-23; chat ownership amended 2026-09-25 per user direction (checked against hard PDF/subject constraints — no conflicts found). Awaiting final team review.

## Purpose and sources

Build the competitive web game for the 42 ft_transcendence project: Code Arena coding battles in 1v1 and 2v2 modes. Two players (or two two-player teams) solve the same sequence of programming problems under time pressure, checking code against visible examples, submitting to a sealed hidden judging suite, and scoring the highest summed total across rounds.

- Requirements source: `ft_transcendence.pdf`, version 21.2. The PDF wins every conflict.
- Product decisions: [.scratch/ft-transcendence-wayfinder/decisions-2026-09-23.md](../ft-transcendence-wayfinder/decisions-2026-09-23.md) (pivot; supersedes the 2026-09-17 puzzle-race direction where conflicting).
- Interaction reference: `prototype/game-ui/09-arena.html` (frozen). Production preserves its `MatchMode` / `MatchPhase` / `PlayerStatus` model, phase-gated Run/Submit rules, single-toolbar submit with the 2v2 readiness gate, idle/running/passed/failed visible tests, sealed hidden suite with per-round reveal, and round rotation with readiness reset. Prototype code never ships.
- Vocabulary: `CONTEXT.md` (Code Arena glossary). Architecture: ADR-0001 (as amended), ADR-0002, ADR-0003 (sandboxed judging), ADR-0004 (Game Match persistence module), ADR-0005 (Arena transport seam), ADR-0006 (Socket.IO authorization context), ADR-0007 (Round lifecycle module), ADR-0008 (2v2 collaboration module), ADR-0009 (Match socket presence module), ADR-0010 (Arena sidecar lifecycle module), ADR-0011 (evaluation idempotency lock boundary), and ADR-0012 (evaluation and Judge0 adapter deepening).

## Decisions resolved 2026-09-23

Resolved per user direction after a hard-constraint check against `ft_transcendence.pdf` v21.2 and the standing decisions. No conflicts found; one deliberate deviation from the frozen reference is logged below (reference file unchanged).

1. Entry: one Arena entry point with mode selection (1v1 or 2v2). Invitation-code lobbies carry over as the entry default; no automatic matchmaking in the first release. The host selects the mode; all players must be ready before the first round intro.
2. Match = 3 rounds by default; one problem per round from the checked bank. Each new round rotates to a new problem and resets code, visible tests, and readiness; only the match score carries over.
3. Round score = 0–100% from weighted hidden test groups. Every round is normalized to 0–100 and carries equal match weight — a 100–99 round and a 100–20 round contribute exactly what their margins say, which is why partial-credit sums fit better than rounds-won. Match result = **sum of round scores** (see deviation log).
4. Tie-breaks, in order: (1) lower total scoring-submission time — per round, the elapsed server time at which the side achieved its final (counted) round score, i.e. the timestamp of the submission standing at reveal, summed across rounds (works at 100%, 78%, or 42% alike because it keys off the counted score, not perfection); (2) fewer total submissions across the match. If still tied, the match is a draw. Speed never reduces correctness: no time decay on the 0–100%; speed counts only in tie-break 1.
5. Submit is unlimited per round during `CODING` (2v2: both teammates Ready). Each completed hidden evaluation overwrites the round's pending score; the counted score is the last completed evaluation. Because resubmitting can replace a good score with a worse one, the submit control must carry this warning prominently (not a tooltip): “Submitting again replaces your current scored result for this round.” Request identifiers make retried submissions idempotent (repeating an identifier returns the original outcome, never a second transition).
6. Email/password is the only account requirement on the critical Arena path (register → entry → match → reveal). 42 OAuth linking lives outside the gameplay path (profile/settings). The OAuth module is still claimed: provider setup starts week 1, finished week 3 — but OAuth never gates play or the Week-2 milestone.
7. Match-scoped team chat plus quick pings is owned by Game through the Game service's `/chat` Socket.IO namespace. Game performs membership authorization and keeps 1v1 chat disabled. Amal is the primary implementer; if she misses the team's agreed delivery checkpoint, Aimane takes over the Game-owned chat path. Do not build duplicate implementations. The standalone `services/chat` app remains a deferred boot/readiness skeleton, not a first-release gameplay dependency.
8. Judging mechanism is an implementation-spike decision. The contract requires CPU, wall-clock, memory, output-size, and process-count limits plus isolation from game/auth services, databases, credentials, and the internal network (ADR-0003, amended with CPU/process limits).
9. The problem bank is curated and internal: original or compatibly-licensed content only — never copy LeetCode (or any third-party) content. First-release languages: C++, Python, C.
10. Reconnect: the player's place stays reserved until match end (standing principle). A grace window (`reconnectGraceSeconds`, default 90, configurable within 60–90) covers seamless resume; beyond it the player is marked disconnected and the side may continue short-handed, with no forfeit in the first release. Reconnect re-authenticates and restores the filtered snapshot; unacknowledged actions are never replayed as new actions.
11. Match countdown `MATCH_DURATION`: one match-wide clock, default 30:00, shared across all three rounds for a faster competitive feel — not per-round (a per-round timer would be named `ROUND_DURATION`; none exists). Configurable and server-owned.
12. Week 2 target: one complete playable 1v1 duel end-to-end (entry → 3 rounds → reveal, real judging) before full 2v2 collaboration is implemented.
13. Match persistence is one Game-owned deep module. It owns durable Match/Round records, Submissions, Reveals, shared team documents, and failure history; `ArenaEngine` owns transition validity; Presence, transport, Lobby queues, and judge execution stay outside. The implementation preserves the current JSONB schema, uses Postgres and in-memory adapters behind one `MatchPersistence` interface, treats Submission/evaluation identifiers as safe retry keys, and claims pending evaluations across Game processes before invoking the judge. PostgreSQL uses a session advisory lock keyed by evaluation ID. Ordinary Match snapshots use optimistic expected-revision compare-and-save with a typed 409 conflict; claim-owned Evaluation commits remain on their claim-session seam. Broader horizontal command coordination and realtime fan-out remain open.
14. Match authority is a separate in-process module behind the existing `ArenaEngine` facade. It owns trusted-principal membership checks, short per-Match command serialization, committed revision stamping, and current-Round lookup. Judge work, Socket.IO, persistence adapters, and long-running timers remain outside; the facade and existing transport calls stay compatible during extraction.
15. The frontend Arena UI depends only on `ArenaTransport`. `TransportSession` owns connection state and subscriber delivery; `SocketArenaTransport` owns HTTP/Socket.IO actions, reconnect, browser offline handling, stale-revision filtering, and submission/evaluation request identifiers. It retains one unconfirmed identical submit key across a lost acknowledgement, while a completed deliberate resubmit receives fresh identifiers. `MockArenaTransport` is a thin fixture adapter over `MockMatchAuthority`, which owns fixture Match rules. Fixture-only controls use an optional typed capability rather than concrete adapter imports or casts. This does not claim sticky sessions or shared pub/sub for horizontal realtime scale-out.
16. Game Socket.IO gateways share one `socket-auth.ts` authorization context. It parses the `DEV_PRINCIPAL` handshake seam, rejects conflicting auth/query identity, attaches a verified `SocketPrincipal`, and requires Match identity for game, collaboration, and team-chat namespaces. The lobby authenticates a user before `GameService.roomForMember` authorizes each private room. Namespace-specific Match capabilities remain in `GameService`; room identity is always server-derived. Replacing the seam with the real Core principal is a follow-up, not a second gateway refactor.
17. Round lifecycle is a separate Game-owned domain module behind the unchanged `ArenaEngine` facade. `RoundLifecycle` owns phase transitions, reveal preparation/publication state, round resets, Game-side verdict scoring, cumulative totals, and final-result tie-breaks. The facade keeps membership, per-Match locking, persistence, collaboration cleanup, event emission, and long-running judge execution. The extraction preserves the MatchRecord JSONB schema and does not promote a new 42 subject module claim.
18. Team collaboration is a separate Game-owned 2v2 domain module behind the unchanged `ArenaEngine` facade. `TeamCollaboration` owns Yjs document loading, authoritative source revisions, readiness invalidation, team-language starter resets, atomic document persistence/rollback, authoritative submission snapshots, and masked team views. The facade keeps trusted membership gates, per-Match locking, ordinary match persistence, and event emission. The module consumes the existing `MatchPersistence` seam and preserves the MatchRecord JSONB schema; it does not promote a new 42 subject module claim.
19. Match socket presence is a separate Game-side module behind the unchanged `GameService` socket lifecycle methods. `MatchSocketPresence` owns process-local socket counting, duplicate-close handling, and first-socket/last-socket transitions; it delegates durable 1v1 side or 2v2 member presence through an injected target seam. Gateways, authorization, room membership, and persistence remain outside. The extraction preserves the existing presence policy and does not promote a new 42 subject module claim.
20. Arena live sidecars are a separate frontend lifecycle module behind the existing `ArenaPage`/`ArenaTransport` seam. `createArenaSidecarLifecycle` owns collaboration/chat client factories, scope keys, stale-request cancellation, and disconnect cleanup. Collaboration is Round-scoped; match chat is Match-scoped; 1v1 and mock transports create no sidecars. UI rendering, transport authorization, and client semantics remain outside. The extraction preserves the existing MatchRecord JSONB schema and does not promote a new 42 subject module claim.
21. Evaluation retries stay outside the Match lock while waiting for an in-flight judge call. `ArenaEngine` validates immutable request identity (including Match, Round, problem version, side, IDs, language, source hash, and document revision), accepts and records under a short lock, claims one pending evaluation through `MatchPersistence`, judges lock-free, and commits under a fresh lock; same-identity retries wait after lock release and replay the original success or judge error, while identifier collisions with different data are rejected. Recovery uses the same identity metadata and the same claim seam. PostgreSQL session advisory locking prevents two live Game processes from owning one pending evaluation concurrently without changing the existing receipts or submission schema; if a claim session dies after judge start, takeover may re-drive the row but the stale owner cannot commit. A separate claim pool preserves write capacity, and the final Submission+Match write runs on the claim session. Lost claim sessions leave rows pending for takeover. This does not promote a new 42 subject module claim; broader horizontal command coordination remains open.
22. Evaluation orchestration remains Game-owned and provider-agnostic at the domain boundary. `ContainerJudge` stays the default; an optional self-hosted `Judge0Adapter` is selected once per Game process with no automatic fallback, explicit limits, and `enable_network: false`. An internal telemetry seam records provider timing and outcomes without changing Match state or adding a scheduler. Provider tokens, raw responses, hidden inputs, and expected outputs never enter browser-facing contracts. This does not promote a new 42 subject module claim; Judge0 production rollout still requires dedicated-host, security, and equivalence evidence.

### Deviation log

- Match result (sum of round scores) deviates from the frozen reference, which displays rounds-won (`matchScores` left–right). Rationale: sums handle drawn rounds and pair with the defined tie-breaks; the reveal UX (per-round percentages, group breakdown, cumulative totals) is preserved. The reference file is unchanged.

## First-release scope

- 1v1 private duels and 2v2 team battles with the reference phase machine (`ROUND_INTRO` → `CODING` ⇄ `RUNNING_TESTS` → `SUBMITTED` → `EVALUATING` → `SCORE_REVEAL` → next round / match end).
- Shared editor per side (1v1: private; 2v2: one shared document with teammate presence), language selection with per-problem starters, Run on visible examples, single-toolbar Submit with the 2v2 readiness gate and helper text.
- Sandboxed judging for C++, Python, C (visible runs and hidden evaluations) per ADR-0003.
- Team text chat plus quick pings in 2v2; no chat in 1v1. Opponent code is never exposed.
- Accounts, 42 OAuth, editable profiles, avatars, friends, online status. Relevant Privacy Policy and Terms pages before login.
- Responsive accessible UI preserving the reference behavior: skip link, keyboard-operable controls, focus-visible styling, live status announcements, text-plus-color statuses, readable disabled states, focus moved to the reveal.

Outside the first release: 2FA, tournaments, additional modes (e.g. 3v3), spectator mode, voice chat, a problem editor, AI opponents, automatic matchmaking, and mid-match player replacement.

## Player journey and rules (transcribed from the reference)

Entry and lobby per resolved default 1 above. From round intro: Start round → `CODING` (editing enabled, Run enabled, Submit per mode/readiness) → Run moves tests to running with player status Running, then returns to `CODING` with passed/failed results and editor contents intact → Submit locks the solution (`SUBMITTED`), evaluates the hidden suite (`EVALUATING`, scores sealed), and discloses round percentages plus group breakdown (`SCORE_REVEAL`, focus moved to the reveal) → next round intro or match end. Statuses progress Coding → Running → Submitted → Evaluating → Locked in; presence stays separate. No score or hidden-test content is visible before the reveal. Match result is the sum of round scores with the resolved tie-breaks; cumulative totals are shown from the first reveal on. Browser countdowns display server state and never decide outcomes. Terminal results persist exactly once.

Disconnection reserves the player's place until match end without transferring anything to teammates; timers continue. Within the grace window, reconnect re-authenticates and restores the filtered snapshot (own code or shared team document, visible tests, readiness, chat, penalties) for seamless resume; beyond it the player is marked disconnected while the reservation stands. Unacknowledged actions are never replayed as new actions. There are no forfeits in the first release.

## Components and data flow

React, Vite, TypeScript, Tailwind frontend. Core and Game are the first-release NestJS runtime services behind Nginx; `services/chat` remains a deferred NestJS boot/readiness skeleton. Docker Compose retains the one PostgreSQL instance, service database/credential boundaries, and Redis, plus the isolated judging component. Nginx terminates HTTPS, serves the frontend and approved avatar files, and proxies APIs and secure WebSocket connections.

| Component | Responsibility | Owned persistent data |
| --- | --- | --- |
| Frontend | React Arena UI, editor, transport seam, collaboration/chat clients, and local draft state | None; local drafts are browser-scoped and authoritative Match state comes from Game |
| Core | Email/password login, 42 OAuth, tokens, profiles, friends, avatars | Users, password hashes, OAuth links, refresh sessions, friendship records, avatar metadata |
| Game | Lobbies, sides, problems/rounds, run/submit orchestration, readiness, phases, scoring, results, Match persistence, and 2v2 team chat/pings on `/chat` | Matches, participants, round state, submissions with request identifiers, results, shared team documents, failure history, and durable team-chat records when persistence is implemented |
| Judging | Sandboxed compile/run for visible and hidden tests | None durable |
| Chat (deferred) | Boot/readiness only; not on the first-release match-chat path | None for the first-release gameplay path |

Core and Game touch only their own first-release databases; the deferred Chat skeleton has no first-release gameplay data path. Cross-service references use stable IDs and APIs. Game sends each player only what they may view (own code or shared team document, own visible tests, own readiness, sealed-everything-else); hiding delivered data in the UI is insufficient. Game's `/chat` namespace admits players by Game-verified membership and fails closed. Internal APIs require service authentication. Only Nginx is public.

## Authentication, storage, and failure handling

Per the carried-over direction: core hashes/salts passwords and issues signed tokens; Game verifies locally and authorizes each first-release game and chat action; secure HttpOnly cookies; OAuth state verification with the explicit-link rule; email/password survives an OAuth outage. Avatar validation, safe filenames, persistent volume, read-only Nginx mount, default avatar, self-only replacement.

Game stays authoritative against old or manipulated client values. `ArenaEngine` decides whether a transition is valid; the Game-owned `MatchPersistence` module commits accepted Match/Round, Submission, Reveal, shared-document, and failure state. Mutations and deduplication complete before durable success is acknowledged. Redis is never the source of truth for scores, submissions, or future durable chat records. Game chat outage shows connection state and retries without marking messages delivered; the match clock continues. Unauthorized or unpersistable operations never report success. Game restart follows the interrupted-match policy.

## PDF compliance and module evidence

Mandatory foundation unchanged: frontend, backend, database, styling solution, clear schema, concurrent users, responsive accessible UI, secure email/password signup/login, two-sided validation, HTTPS for backend access, one-command containerized launch, secrets in ignored local env with a clean example, latest-stable-Chrome with zero console warnings/errors, pre-login policy pages, meaningful history from all four contributors, and the English README with attribution, logins, roles, schema, module math, and individual contributions.

| Claimed module | Points | Demonstration (arena mapping) |
| --- | --- | --- |
| Frameworks for frontend and backend | 2 | Working React frontend and NestJS backend |
| Real-time features | 2 | Cross-client phase/status/test updates, scoped broadcasts, connection/disconnection handling |
| User interaction | 2 | Team chat and pings, profiles, friends add/remove and list |
| Standard user management | 2 | Profile edits, avatar/default avatar, profiles, friends and online status |
| Complete web game | 2 | Live 1v1/2v2 code battles with rounds, hidden judging, reveal, win/loss/draw |
| Remote players | 2 | Separate computers, latency/disconnection handling, working reconnection with reservation |
| Multiplayer with more than two players | 2 | 2v2 (four simultaneous players), shared document sync, one shared team score |
| Backend microservices | 2 | Core, Game, and deferred Chat service boundary with clear interfaces; first-release match chat is Game-owned via `/chat` (judging remains an isolated execution component) |
| OAuth | 1 | Link 42 identity and subsequently log in through 42 |
| **Total** | **17** | Every claimed module must be demonstrated complete |

## Verification and acceptance

1. Reference-parity checks: the production UI reproduces the arena acceptance set (intro gating, idle tests, run transitions, readiness gating, single submit, submit/evaluate/reveal progression, rotation with readiness reset, responsive overflow, zero console errors) against the real backend — with the resolved sum-of-scores result and cumulative totals in place of the reference's rounds-won display.
2. Judging checks: escape, fork bomb, network egress, oversized output, over-limit verdicts, and language toolchains; hidden tests never leak through Run responses (assert on payloads, not just UI); problem-bank content is original/compatibly licensed.
3. State checks: phase-transition legality (only `CODING` submits), readiness gating, idempotent retries, round-rotation resets, sum/tie-break/draw outcomes and the scoring-time accounting, grace-window expiry, and the deadline boundary produce the defined outcome. Inject a clock so timing tests do not wait in real time.
4. Concurrency checks: simultaneous submits, readiness races, and concurrent matches cannot double-count, double-advance, or double-finalize.
5. Access checks: opponent code, hidden tests, other-side chat, and private endpoints are unreachable, including via direct requests and forged socket messages.
6. Multiplayer checks: full 1v1 and 2v2 matches on separate machines; delay, refresh, disconnect, expired auth, and reconnect with correct filtered snapshots.
7. Delivery checks: one-command clean startup, persistence across container recreation, HTTPS/WSS, Chrome console, responsive/keyboard/policy pages, every module demonstration.
8. Defense rehearsal: each member explains their work; rehearse a small live modification.

## Team and delivery

| Member | Responsibilities |
| --- | --- |
| Aimane | PO, TL, developer: game rules, problem bank, judging, game service, Game-owned chat fallback, PDF alignment |
| Saad | PM, TL, developer: core, auth, database setup, deployment, integration and deadlines |
| Amal | TL, developer: frontend, player experience, primary Game-owned chat integration; Aimane is contingency owner if her delivery checkpoint is missed |
| Supporting developer | Bounded tasks wherever needed, reviewed by the relevant lead; help Saad early |

| Week | Checkpoint |
| --- | --- |
| 1 | Docker startup, HTTPS, email/password registration/login, service connections, basic lobby |
| 2 | One complete playable 1v1 duel end-to-end (entry → 3 rounds → reveal, real judging) before full 2v2 collaboration |
| 3 | Full 2v2 (shared document, readiness, team chat), problem bank, reconnection, OAuth, profiles, avatars, friends |
| 4 | Feature freeze, module verification, fixes, README/policy completion, evaluation rehearsal |

Relative to the team's start date. OAuth provider setup begins in week one. Playtest real duels in week two; adjust judging quotas and timers before week three. Actual logins and the supporting developer's identity are collected before README finalization; never invent them.

## Review boundary

This document is the consolidated design for review, not authorization to implement. After approval, produce the implementation plan and dependency-linked tickets under `.scratch/code-arena/issues/`. Verify current framework, sandboxing, and authentication documentation when selecting implementation APIs. Any proposal changing the module scope or the reference behavior returns to the team for a decision.
