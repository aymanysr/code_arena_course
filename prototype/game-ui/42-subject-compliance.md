# 42 subject compliance matrix

Last reviewed: 2026-09-28 (guided learning-course design approval and implementation plan; prior Match deadline, Lobby, event-convergence, and source-linked course reviews retained; module rows intentionally unchanged — team sign-off required)
Authoritative source: [`../../ft_transcendence.pdf`](../../ft_transcendence.pdf), version 21.2

Scope reviewed: game concept, lobby/role-selection prototype, active-match prototype, outcome/recovery/journey prototypes, account/home/profile/policies prototypes, approved equal-coding-role prototype design and implementation plan, numbered file order, draft specification, ADRs, planned module set, UI-only Code Arena spike `09-arena.html` (mocked 1v1/2v2, no realtime/judging/matchmaking), production Match-deadline closure, Lobby reconciliation, and post-commit live-event behavior, plus the source-linked learning-course review for Lessons 1–14. Lesson 11's current chat sources were reviewed and required no refresh. Course content and focused tests do not change a subject-module claim.

PIVOT 2026-09-23: the production game is Code Arena (1v1/2v2 code battles) and `09-arena.html` is frozen as its approved interaction reference (see `.scratch/ft-transcendence-wayfinder/decisions-2026-09-23.md` and `.scratch/code-arena/spec.md`). The campus puzzle-race direction, its role/stage/clue mechanics, and the puzzle-specific prototypes below are historical evidence, not the production path. `CONTEXT.md` now carries the Code Arena glossary.

File order (player path): `index.html` forwards to `00-journey.html` (map, start here) → `01-account.html` (Account access) → `02-home.html` (Home) → `03-lobby.html` (Lobby) → `04-live-match.html` (Live match) → `05-outcomes.html` (Result) → `06-recovery.html` (Recovery branch) → `07-profile.html` (Profile & friends) → `08-policies.html` (Policies). `42-subject-compliance.md` stays unnumbered as the record, not a player step. `09-arena.html` is the frozen approved interaction reference for the production Code Arena game (adopted 2026-09-23); the `00`–`08` puzzle-race views are frozen historical prototypes.

Active prototype plan: [`../../docs/superpowers/plans/2026-09-18-critical-player-journey-prototypes.md`](../../docs/superpowers/plans/2026-09-18-critical-player-journey-prototypes.md) covers outcome states, recovery/interruption states, the whole-app journey map, and final selected-direction capture. Planned files are not evidence until their checks pass and this matrix is updated. Post-pivot (2026-09-23), production planning moves to `.scratch/code-arena/` tickets after spec review; this plan is historical.

## Maintenance rule

`AGENTS.md` requires every project artifact and change to adhere to `ft_transcendence.pdf`, with conflicts resolved in favor of the PDF. This matrix must be reviewed after every project change and updated in the same change whenever evidence, scope, module claims, assumptions, or compliance status changes. A checked prototype behavior is design evidence only; it is not implementation evidence for a production module.

## 2026-09-28 guided learning-course design review

The [guided build-course design](../../docs/superpowers/specs/2026-09-28-guided-code-arena-build-course-design.md)
records the approved C-to-TypeScript teaching direction, visual lesson format,
dusk theme, practice-workspace phase, and eventual transition into the team's
repository. The learner approved the written specification on 2026-09-28. The
[implementation plan](../../docs/superpowers/plans/2026-09-28-guided-code-arena-build-course.md)
is awaiting review and preserves the chosen Native execution method. The complete
guided course and target implementation are not delivered by this documentation change.

Reviewed the PDF's mandatory application, concurrency, validation, identity,
HTTPS, and accessibility requirements (printed pp.8–9), game/remote-player/
multiplayer and dependent-module requirements (pp.16–17), and README obligations
(pp.27–29). The course distinguishes the reference game, simplified exercises,
practice checks, and target-repository evidence. It preserves invitation-first
Lobby scope, the Match-wide deadline, explicit Judge-provider selection, and
Game-owned process-local team-chat history. Team authentication, deployment,
policies, and final integration remain explicit external dependencies.

The read-only catalog check matched source snapshot `4edc506dd9158d21` with
201 in-scope files, 381 current lesson links, and no uncovered, stale, or
unclassified files. This is course-reference coverage only. No game test run,
new runtime capability, completed subject module, or team sign-off is claimed;
module rows remain unchanged.

The plan-review documentation update was checked separately: the same source
snapshot and source-link coverage remain current, but the read-only catalog check
reports this compliance document as one changed checksum input and marks the
course home/source map outputs stale. That check is not reported as passing.
No baseline was accepted or generated course page changed during planning; the
existing reviewed-evidence refresh procedure remains required during execution.

## 2026-09-25 architecture-slice review

The following production seams were reviewed against the PDF requirements and
the Code Arena specification. They improve locality and testability without
changing the claimed subject-module set, the MatchRecord JSONB schema, or the
approved interaction reference:

- `MatchSocketPresence` keeps first-socket/last-socket presence policy in the
  Game service while preserving the existing 1v1 side and 2v2 member behavior.
  Focused tests plus real reconnect/service tests are evidence for this
  implementation slice; cross-process presence remains open.
- `createArenaSidecarLifecycle` keeps frontend collaboration and match-chat
  client lifetimes explicit. Collaboration is Round-scoped and chat is
  Match-scoped; 1v1 and mock transports remain sidecar-free. Focused tests,
  the full frontend suite, lint, typecheck, and build are evidence for this
  implementation slice.
- The evaluation boundary keeps the judge outside the short Match lock,
  releases the lock before same-identity retries wait, and rejects reuse of an
  evaluation ID with different immutable submission data while replaying the
  original success or judge error. Submit, concurrency, reconnect, Postgres,
  and service tests are evidence for this implementation slice. Cross-process
  evaluation ownership is covered by the Postgres claim tests; broader
  cross-process Match mutation locking remains open.
- Evaluation orchestration is now a named internal module: Submit and boot
  recovery share claim acquisition, Judge invocation, failure classification,
  and verdict commit coordination while `ArenaEngine` remains the facade.
  Public receipts and the MatchRecord/SubmissionRecord schema are unchanged.
- Ordinary Match writes use an expected revision in both memory and Postgres;
  stale snapshots return a typed 409 conflict. The frontend refreshes the
  authoritative snapshot and does not replay a non-idempotent command.
- Judge0 is documented and implemented only as an optional execution adapter.
  Local Game processes still default to ContainerJudge, Compose selects the
  internal WorkerJudgeAdapter, and Judge0 remains optional. Judge0 rollout,
  dedicated-host hardening, and equivalence/security evidence are still
  required before it is enabled. Process-local evaluation telemetry records
  rollout evidence without changing Match state; the worker queue is bounded
  FIFO and has no weighted per-match scheduling policy.
- Neither extraction is claimed as a completed 42 subject module. The
  real-time, remote-player, and user-interaction rows remain at their existing
  status until the required end-to-end and team-sign-off evidence is complete.

## 2026-09-27 Match deadline, Lobby, and event-convergence slice

Reviewed against `ft_transcendence.pdf` v21.2, especially the mandatory
multi-user/concurrency/realtime requirements (printed p.8, PDF p.9), the
responsive/accessibility and validation requirements (printed p.9, PDF p.10),
and the complete web game, remote-player, and 3+ player obligations (printed
p.16, PDF p.17). The slice keeps the Match server-authoritative, closes
expired Matches durably after bounded judging grace, reconciles Lobby views
from the active-state endpoint, and sends gameplay events only after their
Match write commits. These behaviors support the existing claimed-module
demonstrations but do not complete their full subject criteria.

- The first-release Lobby is invitation-only per the approved Code Arena
  specification. Public queue service/API code remains future-capability code;
  the frontend no longer exposes queue entry and clears a recovered waiting
  entry. The existing backend queue remains tested directly as an API.
- Match deadline handling now rejects Run/Submit at expiry, counts an accepted
  pre-deadline Evaluation only when its durable result settles inside reveal
  grace (including work owned by another Game process), persists the current
  Round Reveal and terminal `MATCH_COMPLETE` Match state, and leaves unplayed
  Rounds at zero. The final result is computed from saved Round records; the
  UI presents the saved Reveal before that result without a player advancing
  the Match.
- Match events carry the revision read after commit. Failed Match writes
  publish no event; listener exceptions do not roll back state. Events remain
  transient and reconnect/refresh use the latest snapshot; no outbox or Match
  schema change was introduced.
- Course refresh (2026-09-27): Lessons 1–3 now distinguish the configured
  Judge-provider boundary, normal Round Reveal, and terminal Match-deadline
  path. They link to current source and tests and do not present course
  content or focused tests as completed subject-module evidence.
- Lesson 4 describes the invitation-only Lobby first-release path, treats
  Lobby events as refresh hints, and documents that the public queue API stays
  in code as a future capability. Its tests and source links do not change the
  approved product scope or a subject-module claim.
- Lessons 8–9 now describe post-commit Match-event delivery and recovery from
  the latest authoritative snapshot. Lesson 12 distinguishes the deadline
  Reveal-first presentation from ordinary terminal rendering and says that
  its component tests assert initial markup rather than the action click. These
  source links and test limits do not change the approved product scope or a
  subject-module claim.
- Lesson 7 now separates Game authority, explicit provider selection, and the
  WorkerJudgeAdapter contract. Lesson 13 documents direct local ContainerJudge
  versus Compose's internal Judge Worker, including socket ownership,
  readiness, and bounded queue configuration. Lesson 14 distinguishes adapter,
  worker-service, static topology, fake-runner, and Docker security evidence.
  Its current focused run passed 20 tests; six HTTP API cases could not bind
  `127.0.0.1` (`EPERM`) and are not recorded as passing. This course update
  does not claim hostile-code isolation or change product/module scope.
- Verification in this workspace: deadline closure (7 tests), post-commit
  events (2), Lobby reconciliation (6), terminal presentation (2), reconnect
  regression, and the frontend suite (49) pass; frontend lint, workspace
  typecheck/build, Playwright test discovery, and `git diff --check` pass. The
  full workspace test command was attempted: 165 engine, 19 harness, 68 model,
  and 49 frontend tests passed. Docker-backed judging tests could not access
  the Docker socket; 12 Postgres checks were skipped because no test database
  was available; local Game and judge-worker HTTP fixtures could not bind
  `127.0.0.1` (`EPERM`). Those checks are not recorded as passing evidence. No
  subject-module status row or point claim changes in this slice.

## Status key

| Status | Meaning |
| --- | --- |
| Prototype evidence | The throwaway UI demonstrates the intended behavior locally. |
| Designed | The behavior is specified but not implemented in production. |
| Not started | No production evidence exists yet. |
| Required later | Delivery documentation or evaluation evidence is required before submission. |

## Mandatory foundation

| Subject requirement | Subject location | Project response | Current status | Evidence or next proof |
| --- | --- | --- | --- | --- |
| Web application with frontend, backend, and database | Printed p.8 (PDF p.9) | React/Vite frontend; NestJS Core and Game services plus a deferred Chat skeleton; PostgreSQL | Designed | Draft spec and ADR-0001/0002; service skeletons live behind compose (ticket 01) with 1v1 duel, lobby, reconnect, editor, 2v2, collab, Game-owned chat, and the internal single-host judge worker path proven — full production hardening and external auth remain required |
| Meaningful Git history from every teammate and proper work distribution | Printed p.8 (PDF p.9) | Four contributors own documented areas; all must commit meaningful work | Required later | Git log and final README; never infer contribution from plans |
| Containerized deployment with one command | Printed p.8 (PDF p.9) | Docker Compose behind Nginx | Designed | Clean-machine single-command launch test |
| Latest stable Chrome compatibility and no JavaScript console warnings/errors | Printed p.8 (PDF p.9) | Browser prototypes target modern Chrome | Prototype evidence | Automated browser checks for both prototypes; production-wide Chrome run still required |
| Relevant, accessible Privacy Policy and Terms of Service pages | Printed p.8 (PDF p.9) | Draft layout in `08-policies.html` reachable before login with Code Arena scope (account/match/round/run/submit/hidden-suite/reveal/readiness/chat); final text and production footer links still required | Prototype evidence | Throwaway draft with relevant Code Arena scope holds no placeholder; production content review and pre-login navigation still required |
| Multiple simultaneous users; concurrent actions; real-time updates; no races | Printed p.8 (PDF p.9) | Authoritative game state, serialized team actions, request identifiers, WebSockets | Designed | Multi-client and concurrency tests against production services |
| Clear, responsive, accessible frontend across devices | Printed p.9 (PDF p.10) | Responsive Exam shell direction, semantic controls, keyboard focus, live status, non-color labels | Prototype evidence | Lobby and match prototypes checked at desktop/mobile sizes; production accessibility review remains required |
| CSS framework or styling solution | Printed p.9 (PDF p.10) | Tailwind CSS planned for production; prototype uses isolated plain CSS | Designed | Production build/configuration |
| Secrets in ignored `.env`; provide `.env.example` | Printed p.9 (PDF p.10) | Local secrets and safe example configuration are planned | Not started | Git ignore audit and startup test using `.env.example` |
| Clear database schema and relations | Printed p.9 (PDF p.10) | Separate core/game/chat databases on one PostgreSQL instance | Designed | Schema migrations, relation documentation, final README |
| Secure email/password signup and login | Printed p.9 (PDF p.10) | Core service owns accounts and secure password authentication | Designed | Security tests and production authentication flow |
| Validate all forms and inputs in frontend and backend | Printed p.9 (PDF p.10) | Client validation for UX; server validation is authoritative | Designed | Boundary, malformed-input, authorization, and direct-request tests |
| HTTPS for every external backend connection | Printed p.9 (PDF p.10) | Nginx terminates HTTPS/WSS; only Nginx is public | Designed | Deployment/network inspection and certificate test |
| At least 14 module points; only complete modules count | Printed p.10-11 (PDF p.11-12) | Planned set totals 17 points | Designed | Demonstrate every row below; remove any incomplete claim before evaluation |

## Planned module evidence - 17 points

| Claimed module | Points | Exact subject obligation | Planned project evidence | Current status |
| --- | ---: | --- | --- | --- |
| Framework for frontend and backend | 2 | Use a frontend framework and backend framework | React frontend and NestJS backend running as the real application | Designed |
| Real-time features | 2 | Cross-client updates, graceful connection/disconnection, efficient broadcasting | Scoped WebSocket events; lobby readiness/connection and live match state | Designed; UI states prototyped |
| User interaction | 2 | Basic chat, view profiles, add/remove friends, see friends list | Team chat plus profile and friendship flows | Designed |
| Standard user management and authentication | 2 | Profile updates, avatar/default avatar, friends/online status, profile page | Core service and account/profile UI | Designed |
| Complete web-based game | 2 | Live matches, clear rules, win/loss conditions | Code Arena 1v1/2v2 code battles: round rotation, hidden judging, reveal, win/loss/draw (adopted 2026-09-23; replaces the puzzle-race plan) | Designed |
| Remote players | 2 | Separate computers, latency/disconnection handling, smooth UX, reconnection | Reserved role/slot, authenticated state restoration, network tests | Designed; disconnect state prototyped |
| Multiplayer game with more than two players | 2 | Three or more simultaneous players, fairness, client synchronization | 1v1 private duels and 2v2 team battles (four simultaneous players), shared document sync, one shared team score; 3v3 and other extra modes are outside the first release per spec | Designed; 2v2 presence/readiness/collab proven (tickets 14/15) |
| Backend as microservices | 2 | Loosely coupled services, clear interfaces, REST/message communication, single responsibility | Core, Game, and deferred Chat service boundary per ADR-0001/0002; first-release match chat is owned by Game via `/chat` | Designed |
| OAuth 2.0 | 1 | Remote authentication using OAuth 2.0, including 42 as an example | Explicit 42 account linking and later 42 login | Designed |
| **Planned total** | **17** | Minimum is 14 | Count only modules that are complete and demonstrable | **No module is yet proven by prototype code alone** |

## Lobby and role-selection traceability

Historical (puzzle-race direction, superseded 2026-09-23). Preserved as prototype evidence for the mechanics it explored; the production arena entry flow is specified in `.scratch/code-arena/spec.md`. Production UI must be rebuilt with production tests and must not promote these throwaway prototype files directly.

| Product rule | UI behavior in `03-lobby.html` | Production enforcement still required |
| --- | --- | --- |
| Private invitation-code lobby | Shows a shareable code and states that it is not authentication | Authenticated join endpoint, expiring/unique code, authorization |
| Host selects 2v2 or 3v3 | Visible match-size controls rebuild equal teams | Server validates size and freezes it after start |
| Players choose a team and an unoccupied role or request random assignment | Team controls, role radio controls, and open-role assignment | Atomic role claim preventing concurrent duplication |
| One balanced role per player | Same role catalogue appears on both teams; occupied roles are unavailable | Puzzle-specific balance and server-side filtered role data |
| Role change clears readiness | Every team/role change clears the player's ready state | Authoritative state transition and broadcast |
| Two full teams and all players ready before start | Host gate explains missing conditions and rejects early starts | Transaction/lock ensuring start happens exactly once |
| Full/started joins are rejected clearly | Operations Matrix variant includes both rejection probes | Real response codes and unchanged durable state |
| Disconnect keeps the player's role reserved | Connection toggle shows `Reserved` and blocks start while disconnected | Presence expiry, reconnect authentication, restored filtered snapshot |
| Invitation code is not authentication | UI says this beside creation/copy feedback | Every join/action separately authenticates the user |

## Prototype accessibility and responsive checks

- Native buttons, radio inputs, fieldsets, legends, tables, and dialogs are used instead of simulated controls.
- Skip link, landmark, sequential headings, visible focus, polite status announcements, and non-color status labels are present.
- Body text is at least 14px; interactive targets are at least 44px high.
- Critical content uses responsive grids and safe-area-aware bottom controls.
- Reduced-motion and increased-contrast preferences are respected.
- These choices support the mandatory accessible frontend requirement; they do **not** claim the optional WCAG 2.1 AA major module.

## Match outcome prototype evidence

Historical (puzzle-race finish-delay/draw mechanics, superseded 2026-09-23; the arena decides rounds by hidden-suite percentage with its own tie/draw rules).

`05-outcomes.html` exercises four local, fake-state scenarios for `MATCH-C42-014`: Blue wins with an earlier eligibility time before the deadline; Coral wins while Blue completes later; equal eligibility times resolve to a draw; and Blue's 60-second finish delay leaves the result pending while Coral can still win. The page shows the server-decision model, both Team timelines, Hint and Finish delay accounting, an idempotent local delay-advance probe, and a simulated result-persisted-once indicator.

This is design evidence only. It does **not** prove durable exactly-once result persistence, server clocks, transactional concurrency, deadline enforcement, multi-client synchronization, or any completed production module.

## Match recovery prototype evidence

Historical (puzzle-race role/clue reservation mechanics, superseded 2026-09-23; the arena carries over only the reservation principle — reserved place, re-authentication, filtered snapshot restore, no action replay — without roles or private clues).

`06-recovery.html` exercises four local, fake-state scenarios for `MATCH-C42-014`: Saad disconnects while the Match clock and Retry cooldown continue and the Answer builder Role remains reserved; reconnecting requires authentication without replaying unacknowledged actions; restoring returns a role-filtered Answer builder view alongside simulated shared Team progress, Team chat, and penalty state; and an unrecoverable game-service restart records no win or loss and requires a new Match. The page keeps continuity signals visible, distinguishes authentication from snapshot restoration, and states that teammates do not inherit private clues or controls.

This is intended UX design evidence only. Network latency, WebSocket behavior, authentication, snapshot filtering, persistence, and restart behavior still require production evidence. It does **not** prove graceful disconnection handling, real reconnection logic, concurrent client synchronization, durable role reservation, or any completed production module.

## Critical journey map prototype evidence

`00-journey.html` is a local, fake-state navigation map for the seven product surfaces: Account access, Home, Lobby, Live match, Result, Profile & friends, and Policies. It shows the primary Account access → Home → Lobby → Live match → Result route, the Live match recovery branch, and links to all eight local test views: Account access, Home, Lobby, Live match, Result, Recovery, Profile & friends, and Policies. Its evidence rail names the mandatory foundation and planned 17-point module total without claiming a completed module.

This is navigation/design evidence only. Production services exist as working skeletons with proven 1v1, lobby, reconnect, editor, 2v2, collab, chat, and single-host Compose judging paths (see Ticket 17 record and the 2026-09-26 judging evidence below); remaining production hardening (external auth, README/policy pages, module sign-off) is still unimplemented. The map does **not** prove OAuth linking, final policy text, authorization, or any completed production module.

## Account, Home, Profile, and Policies prototype evidence

`01-account.html` exercises five local, fake-state scenarios: sign-up, sign-in, explicit 42 link while signed in, sign-in via linked 42, and 42 outage with email fallback. It shows front-end email/password checks, states that server checks are authoritative, enforces the explicit-link rule (same email alone never links; unlinked 42 goes to register/sign-in first), and links to Policies before login.

`02-home.html` exercises four local scenarios: empty friends list, friends with online status, Lobby create with private invitation code, and Lobby join via code. It states that the code names the Lobby and is not auth, and that full/started joins reject on the server.

`07-profile.html` exercises four local scenarios: view profile, edit name/bio, default vs custom avatar, and friends list with add/remove and online status. It shows the default-avatar rule and states that Core owns validation, safe file names, and friendship records.

`08-policies.html` shows draft Privacy Policy and Terms with relevant Code Arena scope: stored account/match/round/submission/chat data, run-visible/submit-hidden sealing, sum-of-scores result with tie-breaks, invitation-code limits, and reservation-until-match-end with no first-release forfeits. Pages are reachable before login via footer and page links.

This is design evidence only. It does **not** prove secure password storage, signed tokens, HTTPS, server validation, OAuth flow, avatar checks, friendship persistence, concurrent-user correctness, or final legal text. Production proof remains required.

## Validated prototype decisions

- **Production game (2026-09-23): Code Arena 1v1/2v2**, with `09-arena.html` frozen as the approved interaction reference. Everything below in this section is historical puzzle-race evidence, kept for reusable patterns only (shell layout, reservation principle, exactly-once result discipline).
- **Active Match (historical):** Variant A, **Exam shell**, was the selected puzzle-race direction.
- **Lobby (historical):** Variant A, **Team Bays**, was the selected puzzle-race direction.
- **Next role-system prototype:** the approved design in [`../../docs/superpowers/specs/2026-09-19-equal-coding-role-system-design.md`](../../docs/superpowers/specs/2026-09-19-equal-coding-role-system-design.md) is now implemented as a throwaway prototype by its OpenCode execution plan in [`../../docs/superpowers/plans/2026-09-19-equal-coding-role-prototype.md`](../../docs/superpowers/plans/2026-09-19-equal-coding-role-prototype.md): blind pre-match style cards in `03-lobby.html` Variant A and separate 2v2/3v3 `packet_router` component pipelines with owner-only simulated editors in `04-live-match.html` Variant A, verified by `prototype/game-ui/checks/exam-shell-check.js` (570 assertions, PASS). This remains design evidence only; it proves no production module.
- **Outcomes:** one Operations Console shell presents scenario-driven, fake server-result states.
- **Recovery:** reserved Roles and continuing clocks are shown separately from the interrupted-Match state.
- **Whole-app scope:** the seven-node journey map now links eight local test views: Account access, Home, Lobby, Live match, Result, Recovery, Profile & friends, and Policies.

Variants B and C remain historical alternatives in the Lobby and Active Match prototype switchers. Production UI must be rebuilt with production tests and must not promote these throwaway prototype files directly.

### Exam Shell prototype evidence

The equal-coding-role design is now implemented as the selected Variant A prototype described below. The previous Code Writer/Test Operator `loop_checksum` simulation has been fully replaced and must no longer be cited as current evidence.

`03-lobby.html` Variant A is a local, fake-state blind-assignment lobby. What the repo-local browser check proves:

- only programming-style cards are shown (`Sequence transformation`, `Deterministic search` in 3v3 only, `Stateful constraints`); the subject, component names, function contracts, examples, and starter code never appear before match start (eight subject tokens asserted absent from both the rendered body and the lobby file);
- every card carries `Equal expected workload` copy stating style is not difficulty or importance;
- duplicate claims are rejected (occupied styles disable; a forced claim leaves the player's style unchanged), changing a claimed style clears readiness, both teams carry the same ordered style IDs, and Start stays disabled until every slot on both teams is filled, connected, and ready (including the disconnect-reservation gate);
- the start transition hands `teamSize` and the chosen `role` to `04-live-match.html?variant=A`.

`04-live-match.html` Variant A is a local, fake-state `42-INSPIRED SIMULATION · FAKE GRADER` workstation for the original `packet_router` subject, labelled `EXPLORATION ONLY — NOT PRODUCTION CODE EXECUTION`. What the same browser check (570 assertions, PASS) proves:

- reveal of the full frame rules, the `0314` public example, and the pipeline contract table; 2v2 resolves to exactly Routing Interpreter and Queue Scheduler, 3v3 to exactly Packet Decoder, Route Planner, and Congestion Controller, with an explicit `style → component` reveal line and identical mappings for both teams;
- one editable file per component with owner-only editing, read-only teammate visibility (`Read-only teammate file`), generated-stub copy, comparable-workload hypothesis copy (explicitly not a proven balance claim), and a why-required note per stage;
- a disclosed `SIMULATED` surface-marker recognizer (comment-stripping, no compilation, no execution, no correctness proof); starter code fails locally; public-pass sources pass only their own component; local checks never create traces, cooldowns, or submissions;
- penalty-free integration (`BLOCKED — compile every component`, named-contract mismatch without player blame, `PASSED — pipeline contracts connected` with a recorded revision key) over the public example plus stored team-authored inputs; adding a team case invalidates readiness without touching clocks or penalties; editing after green resets the component and integration, clears the trace, and disables Submit; teammate edit attempts cannot land;
- hidden submission only after green integration: public-pass sources fail once with a generic `SIMULATED hidden evaluation` trace that reveals no hidden markers, one submission record, and a 15-second cooldown that debits the Match clock exactly 15 seconds while editing, checks, integration, and chat stay available; hidden edge behavior passes, finishes the subject (`SUBJECT COMPLETE`, focused heading), and notes a voluntary swap could only belong to a future subject;
- disconnect reservation (`RESERVED · OFFLINE`, disabled owner editor, unchanged ownership/source/clocks, rejected owner checks) with full restoration and no teammate inheritance;
- the opponent strip shows only `Opponent components 0/N` and `Submission hidden`; opponent code, activity, diagnostics, and ownership are never exposed;
- Variant A Hint keeps the two-step request-plus-teammate-confirm flow with `+30s` finish delay; Variants B/C keep their legacy immediate-Hint behavior as historical alternatives;
- no document overflow, minimum 44px targets (label-proxied radios excluded by rule), minimum 14px text, visible keyboard focus, exactly one `<h1>`, exactly one page-wide polite live region, `window.__MATCH_STATE__` clone isolation, B/C switcher and arrow-key regression with the typing-focus guard, and zero console/page errors across Lobby A (2v2/3v3), Live A (all five team-size/role URLs), Lobby B/C, and Live B/C at both 1440x1000 and 390x844; six screenshots captured under `/private/tmp/campus-equal-coding-role-screenshots/` (lobby, 2v2 live, 3v3 live desktop/mobile pairs) and inspected at full resolution. Screenshots document capture, not independent proof.

Explicit non-evidence:

- no compiler, sandbox, arbitrary-code execution, backend, database, authorization, persistence, WebSocket synchronization, concurrent-player enforcement, or secure server grader;
- marker inspection and fake hidden evaluation are deliberately disclosed simulation in page source, not grading;
- ownership is locked during the subject; no second subject or swap is implemented;
- no module status changes from `Designed` to complete; the fake grader is not production compliance evidence.

The retired plan (`docs/superpowers/plans/2026-09-18-exam-shell-prototype.md`) described the replaced Code Writer/Test Operator simulation and no longer matches the prototype; the active plan is `docs/superpowers/plans/2026-09-19-equal-coding-role-prototype.md`.

### Verification record - last updated 2026-09-25

- Pivot to Code Arena (2026-09-23): production game is 1v1/2v2 code battles; `09-arena.html` frozen as the approved interaction reference. `CONTEXT.md` replaced by the Code Arena glossary; pivot recorded in `.scratch/ft-transcendence-wayfinder/decisions-2026-09-23.md`; production spec drafted at `.scratch/code-arena/spec.md` (awaiting team review); judging/security constraints recorded in `docs/adr/0003-sandboxed-code-judging.md` with ADR-0001 amended; puzzle-race prototypes and `campus-puzzle-race/spec.md` marked historical. No module status changes from `Designed` to complete; nothing here is implementation evidence.
- Defaults closed 2026-09-23 (spec resolved 1–12, decision log updated, ADR-0003 amended with CPU/process limits): 3-round matches, sum-of-round-scores result (deliberate deviation from the reference's rounds-won display, logged in the spec), server-timestamp/fewer-submission tie-breaks, 2v2 single shared result, run-visible/submit-hidden sealing, 90s-configurable reconnect grace with reservation-to-match-end kept, curated problem bank, C++/Python/C, OAuth off the critical path, the then-current assumption that the Chat service owned team chat (superseded by the 2026-09-25 amendment below), judging stays a spike with a limits-and-isolation contract, Week 2 = playable 1v1 duel first. Implementation plan at `.scratch/code-arena/plan.md` with 17 dependency-linked tickets under `.scratch/code-arena/issues/`. No blockers. No module status changes.
- Chat ownership amendment 2026-09-25: Game owns match-scoped team chat and quick pings through its `/chat` namespace; `services/chat` remains a deferred boot/readiness skeleton and is not first-release gameplay evidence. Amal is the primary implementer; Aimane is the contingency owner if Amal misses the agreed delivery checkpoint. This changes the architecture/spec assumption and ticket ownership only; no module status changes and no durable-chat or cross-instance claim is being promoted to complete.
- Wave-0 greenlight clarifications (same day): `MATCH_DURATION` is one match-wide 30:00 clock shared across all rounds; tie-break 1 sums per-round elapsed times at each final (counted) score; normalization invariant recorded (every round 0–100, equal weight); Week-2 exit proof is the full problem→run→submit→isolated-judge→reveal loop. Wave 0 started: ticket 03 implemented as `packages/arena-model/` (51 vitest tests pass, `tsc --noEmit` clean); ticket 05 seeded (`packages/problem-bank/`: schema + original `even-ledger` problem, all 10 expected outputs machine-verified, judge reproduction pending 06). No module status changes; module claims still require complete end-to-end demonstration.
- Wave 0 closed 2026-09-23: ticket 01 delivered (npm workspaces; three NestJS skeletons with `/health`+`/ready` only; compose with postgres/redis/nginx; verified HTTPS health through nginx, readiness true, 3 DBs + least-privilege roles, then stack brought down clean). Ticket 17 delivered (`packages/arena-harness/`: `JudgePort` seam, `FakeJudge`, `MockGame`, 8 tests green incl. mocked 1v1 proof path, sealing, and failure capture). Harness TDD exposed one protocol gap, fixed in-model: recovery-only `SUBMITTED → CODING` unlock on evaluation failure (no lock without a verdict), pinned in ticket 08. Exact submit-warning copy preserved in spec + 08 + 12. Wave-0 exit criteria all green: model imports workspace-wide, bank validates in CI lane, compose boots clean, harness drives the mocked lifecycle. No module status changes.

- Code Arena UI spike `09-arena.html` (`?mode=1v1|2v2`): shared `ArenaShell` composition (ArenaHeader, ProblemPanel/ProblemExample, CodeWorkspace/CodeEditor/EditorToolbar, TestPanel/TestCaseRow, MatchPanel duel/team, PlayerStatus, TeamPresence, ReadyState, TeamChat, RoundScoreReveal/MatchResult, EventLog) with explicit typed `MatchPhase` (`MATCH_FOUND`…`MATCH_COMPLETE`) and mocked `MatchAdapter`/`PresenceAdapter`. Explicit 3-round model (`rounds: [{backspace-compare},{islands},{two-sum}]`, active problem derived from `rounds[round-1]`); next round rotates the problem, restores the editor starter, resets visible tests to idle, resets 2v2 readiness to false/false, clears reveal, and keeps the match score. 1v1 keeps a private editor with no chat and independent submissions; 2v2 uses one shared editor with mocked teammate cursors, team submissions, readiness gate, and team-only chat/pings; opponent code is never exposed. Single primary submit lives in the editor toolbar (2v2 label `Submit Team Solution`, disabled until both teammates are Ready, with `Waiting for teammate readiness` / `Both teammates ready` helper text); no duplicate submit in TeamPanel. Only `CODING` enables Run/Submit and editing; `ROUND_INTRO` keeps the editor visible but read-only with both actions disabled so Start round gates play; `RUNNING_TESTS` shows `Running examples…` with player status Running then returns to `CODING`; `SUBMITTED`/`EVALUATING`/`SCORE_REVEAL` lock the editor. Visible tests use `idle`/`running`/`passed`/`failed` with icon-plus-text (no green checks before Run, `Not run` summary); hidden groups stay sealed until reveal with no score shown before reveal. Team gameplay state uses `status` as the source of truth via `STATUS_LABEL` with separate `presence: online|offline`; no `detail` second-status field. Editor rendering/input is isolated in `CodeEditor()`/`handleEditorInput()` for a future Monaco/CodeMirror swap (textarea retained). Repo-local Playwright check via system Chrome (1440/1024/768/320px plus 2v2 320px): 50 assertions covering 1v1 intro-gated Start → idle tests → Run → results → hidden submit → reveal → rotated next round, and 2v2 presence, false/false readiness, single submit, readiness-gated enable, Running/Coding transitions, submitted/evaluating/locked progression with one shared Team Alpha score, readiness reset plus problem rotation, responsive overflow, and editor primacy; zero console/page errors. No backend, database, auth, WebSocket, judging, matchmaking, or persistence; realtime/judge wiring is an explicitly deferred later phase behind the adapters. No module status changes from `Designed` to complete.

- Numbering change renamed all views to player-path order with no behavior change: `index.html` now forwards to `00-journey.html`; `01-account.html`, `02-home.html`, `03-lobby.html`, `04-live-match.html`, `05-outcomes.html`, `06-recovery.html`, `07-profile.html`, `08-policies.html`. Cross-links and the journey map were updated to the new paths. Checks below still refer to the same views under new names.
- New account/home/profile/policies check rendered `01-account.html` (signup/signin/link/login42/outage), `02-home.html` (empty/friends/create/join), `07-profile.html` (view/edit/avatar/friends), and `08-policies.html` (privacy/terms) at 1440x1000 and 390x844. It verified one H1 per view, URL scenario switching, state hooks, no document overflow, no target below 44px, and no console/page errors. Footer policy links now meet the 44px target.
- Embedded lobby JavaScript parsed successfully.
- All three lobby variants rendered at 1440x1000 and 390x844.
- Team moves, unique role selection, readiness clearing, 2v2/3v3 equality, start gating, disconnected-slot reservation, full/started rejection feedback, and the state inspector were exercised in Chromium.
- The six checked viewports had no document-level horizontal overflow or interactive target below 44px.
- The checked browser sessions produced zero JavaScript console errors.
- The outcome browser check exercised `win`, `loss`, `draw`, and `delay` at 1440x1000 and 390x844, including the 30-second-per-Hint rule, the exact 60-second Finish delay, before-deadline eligibility, equal-time draw, persisted-once indicator, required accounting/timelines and navigation links, one finish-delay finalization, URL scenario switching, and the native state dialog. Keyboard scenario activation retains visibly styled focus on the replacement selected control; keyboard delay advancement moves visibly styled focus to the updated result heading. It also verified at least 14px visible text, no prose-only `time` elements, no document overflow, no undersized targets, and no console/page errors.
- The recovery browser check exercised `disconnected`, `reconnecting`, `restored`, and `interrupted` at 1440x1000 and 390x844. It verified the reserved Role, continuing Match clock, unavailable private controls while disconnected, re-authentication without action replay, restored role-filtered clues/controls plus simulated shared progress, Team chat, and penalty state, and no fabricated interruption result. It also checked URL scenario switching, the two-step `Continue recovery` transition, native state inspector, no document overflow, no interactive target below 44px at either viewport, and no console/page errors.
- The journey browser check rendered all seven navigation nodes at 1440x1000 and 390x844. It verified all eight exact local test-view links, text labels for Prototype available, Production planned, and Mandatory delivery, the mandatory-foundation and 17-point evidence rail, skip-link and visible keyboard focus behavior, no document overflow, no interactive target below 44px, and no console/page errors.
- The final critical-journey browser check rendered Journey, selected Lobby Variant A, selected Active Match Variant A, delayed Outcome, and disconnected Recovery at 1440x1000 and 390x844. It verified one H1, visible Prototype labeling, a visible `00-journey.html` return route on every non-map page (including after the selected-A Lobby fake start transition), the exact selected-direction labels, focused visible post-start Journey route, no document overflow, no interactive target below 44px, and no console/page errors. Fresh desktop and mobile screenshots were reviewed for unclipped content, readable text, visible primary actions, no switcher collision, and accurate prototype-only claims.
- The exam-shell browser check (`prototype/game-ui/checks/exam-shell-check.js`) passed all 570 assertions in this workspace's Chromium with zero console/page errors: blind lobby style cards with subject-leak scan, duplicate/role-change/readiness gating, and teamSize+role handoff in 2v2 and 3v3; reveal, pipeline mapping, owner-only editing, stub copy, limited opponent strip, full `window.__MATCH_STATE__()` shape, clone isolation, and invalid-URL fallback across all five live Variant A URLs; per-role starter-fail and public-pass local checks with teammate read-only tabs; blocked/mismatch/passed integration, team-case storage/display/invalidation, green-state edit invalidation, and teammate-edit rejection; hidden-evaluation failure (generic trace, one record, 15s cooldown, exact 15s clock debit, exploration still available) then hidden-edge pass with `SUBJECT COMPLETE` focus in both 2v2 and 3v3; disconnect reservation/restoration in both sizes; security-boundary token scan of both files; B/C historical-alternative labels with switcher and arrow-key regression (including lobby switching and the typing-focus guard in chat and editor inputs); the full 11-case lobby/live viewport matrix (overflow, 44px targets, 14px text, visible focus, one h1) with six screenshots written to `/private/tmp/campus-equal-coding-role-screenshots/` and inspected at full resolution. A static `rg` scan for `eval\(|new Function|fetch\(|Worker\(|WebSocket\(|localStorage|sessionStorage|<script[^>]+src=|<link[^>]+href=` in `03-lobby.html` and `04-live-match.html` returned no matches. These runs passed in this workspace only; a reviewer sandbox that cannot launch Chromium cannot independently confirm them.
- The updated `/private/tmp/campus-critical-journey-check.js` passed with the exact summary: `critical journey pages rendered: 5/5 desktop, 5/5 mobile`; `single h1, prototype flag, and journey-route checks: passed`; `selected-direction labels: 2/2`; `horizontal overflow failures: 0`; `small interactive target failures: 0`; `browser console/page errors: 0`. Only its stale lobby readiness button changed from `Lock role and mark ready` to `Lock style and mark ready`.
- The updated `/private/tmp/campus-game-ui-check.js` passed with the exact summary: `variants rendered: 3/3 desktop, 3/3 mobile`; `interactions passed: variant switch, keyboard guard, chat, cooldown, trace, hint, state dialog`; `horizontal overflow failures: 0`; `browser console errors: 0`. Its stale Variant A challenge heading changed from `loop_checksum` to `packet_router` (exact match), while the historical answer/cooldown/Hint assertions still run against Variant B, where that legacy behavior remains supported. A failure-path hang in that temporary script (browser left open on assertion failure) was fixed outside the repository by forcing process exit in its catch handler.
- `./scripts/check-run-opencode-plan-launcher.sh` reported `PASS: durable launcher validates modes, locks, baselines, Desktop seams, terminal, and finalizer`. It verifies Build/Fix/Review guarded prompts, directory-only Desktop delivery (clipboard compact plus `opencode://new-session?directory=` with no plan, sentinel, spaces, or newlines; large plans do not enlarge the link), single active-run locking with explicit stale close, fix prior-handoff context with fresh sessions, read-only review, baseline versus final-state distinction, and a handoff-validated finalizer that alone updates `.scratch/opencode-handoffs/latest.md` and releases the lock. It pins `opencode/muse-spark-1.3-contributor-free` plus `xhigh` with verified/unverified reporting and never false-claims the session selection, and covers file/text/clipboard/Desktop/terminal/dry-run/paths-with-spaces/safety via fake executable seams and filesystem assertions with full state restoration. `zsh -n` passes for the launcher, finalizer, and check; `git diff --check` is clean. The raw global JSON and `opencode debug config` both resolved to Muse as the default model and Muse/xhigh for the Build agent while preserving existing MCP, provider, plugin, and shell settings; installed model metadata advertises reasoning and the `xhigh` variant. These launcher/configuration results are not product or module evidence.
- `git diff --check` produced no output. No generated PNG remains under `prototype/game-ui/checks/`; equal-coding-role screenshots are temporary files under `/private/tmp`.
- Production 1v1 duel E2E (2026-09-24, tickets 09/12): `frontend/e2e/live-1v1.spec.ts` passes 4/4 viewports (1440/1024/768/320, zero console/page errors asserted) against the real stack — NestJS game service + `ContainerJudge` (one-compile → N executions) + Postgres stores: entry → 3× (start → visible run → concurrent sealed submits → game-owned auto-reveal) → `MATCH_COMPLETE` with sum-of-scores final (`you 300 · opponent 84`). Hidden test ids/inputs/expecteds verified absent from both clients' DOM at reveal; hidden group display names intentionally remain visible as the scoring breakdown. Workspace verify same day: `typecheck --workspaces` clean, `test --workspaces` green (incl. engine concurrency/postgres suites and service HTTP/socket/PG-restart integration 4/4), `oxlint` clean, `git diff --check` clean except a pre-existing blank-line nit in `AGENTS.md`. This is new production evidence for the 1v1 duel path only; no module row changes from `Designed` to complete — module claims still require full criteria demonstration and team sign-off at evaluation.
- Variant A readability restyle (CSS-only, no DOM/string/behavior change in `04-live-match.html`): cold steel tokens replace the acid-green wall, sans headings/body with mono reserved for code/contracts/chips, station cards with tinted eyebrow chips (read amber / write cyan / check violet / ship green, each with a signal dot; no edge-bar device), warm-dark manifest subject card (`#171208` with amber accents) as the night-safe anchor instead of the earlier light paper, chip eyebrows and prose measure for scanning. Combined frontend-design + Vanguard pass: Ethereal Glass vibe (OLED `#050505`, amber/emerald mesh, hairline cards with inner highlight, 1.4rem squircles), system grotesk (Inter removed per agency ban; no CDN fonts per prototype no-external-asset rule), pill action buttons with spring `cubic-bezier(0.32,0.72,0,1)` hover/press physics, circular island chat-send, staggered transform-only entry (reduced-motion guarded). Deviations from the agency spec, all forced by prototype constraints: no premium webfonts, no film-grain overlay (GPU guardrail), no scroll reveals (app viewport, entry animation instead), eyebrow tags kept at the 14px accessibility floor. Re-ran `exam-shell-check.js`: PASS (570 assertions), zero console/page errors; `rg` forbidden-primitive scan clean; `git diff --check` clean; desktop/mobile screenshots reviewed for section separation and manifest contrast. Design evidence only; no module or production claim changes.
- This record verifies only the throwaway prototype behavior described here; production evidence remains outstanding wherever the tables say Designed, Not started, or Required later.
- Production reconnect/resume (2026-09-24, ticket 11): engine presence/grace/forfeit/leave + boot recovery (pending-evaluation idempotent retry, interrupted-reveal repair) proven by 19 engine unit tests (injected clock), 10 service integration tests (real WebSockets + Postgres + SIGKILL + short-grace forfeit), and Playwright reconnect scenarios A–D (transport drop, offline submit, offline reveal, hard reload) plus the existing 1v1 duel suite at 4 widths — all green with zero app errors. SCOPE FLAG: 1v1 grace-expiry forfeit was implemented per the ticket brief, but the team spec + ticket scope state "no forfeits in the first release"; spec amendment is required to ratify before evaluation. No module row changes from `Designed` to complete.
- Production editor swap (2026-09-24, ticket 13): the textarea behind the EditorAdapter seam is now CodeMirror 6 (state 6.7.6 / view 6.43.13 / commands 6.11.1 / language 6.12.4 / lang-cpp 6.0.3 / lang-python 6.2.1) with line numbers, C/C++ (shared cpp grammar) and Python highlighting, controlled document, read-only locking, font-size via CSS var, and focus/selection via `EditorAdapterHandle`; no `@codemirror/*` imports outside the seam file, no IDE extras. Verified by 3 new unit tests (language routing), the live 1v1 duel suite at 4 widths, and reconnect A–D — all green, zero app errors. Design/production evidence for the editor path only; no module row changes from `Designed` to complete. Tickets 14/15 (2v2 presence/readiness, Yjs collab) remain NOT STARTED — the engine still rejects non-1v1 matches.
- Production 2v2 domain foundation (2026-09-24, ticket 14): `ArenaEngine` runs 1v1 and 2v2 — explicit team membership (teams ARE sides: sideId is the team identity, participants[] the membership relation; 4 distinct users, 2 per side), per-side team activity, per-member per-round readiness bound to an opaque shared-document revision (monotonic integer, Yjs-agnostic), strict rule (any team-doc edit invalidates BOTH approvals), revision-gated team Submit (one submissionId/evaluationId per team action, last-wins per team), team-owned language, per-member Presence without 2v2 grace forfeit, round reset (fresh revision 1, cleared approvals), masked opponent snapshots (no opponent source/revision/sealed data). Proven by 31 engine tests (creation validation, cross-team/stranger rejection, independent team activity incl. concurrent evaluating, one-stream submission incl. concurrent double-submit determinism, stale-revision rejection, edit/language invalidation, round reset, ready/edit/submit race over 10 trials, team reveal, 1v1 regression), 8 real service/socket tests (4-client rooms, masked snapshots, readiness events, invalidation, server-side gate, independent counting, reconnect restore, 4-client reveal), a live 4-client Ticket-14 proof (membership, presence, both-ready gating, revision invalidation, one team submit, independent Beta activity, equal team reveal, round reset; no convergence claimed — no Yjs installed), plus the full 1v1 battery (duel 4/4 widths, reconnect A–D) and 234 workspace tests green. Design/production evidence for the 2v2 game substrate only; no module row changes from `Designed` to complete.
- Production shared-editor collaboration (2026-09-24, ticket 15): real Yjs path CodeMirror 6 → y-codemirror.next → Y.Text (`source`) → Y.Doc → authenticated `/collab` Socket.IO namespace (separate from game socket; game authority never flows there). Server applies each accepted frame to the authoritative Y.Doc and bumps DocumentRevision exactly once only when the source really changes; 2v2 Submit judges the frozen authoritative snapshot (client payload ignored, split-language rejected); team language switch atomically replaces Y.Text with the starter; rooms are server-derived match:round:side (stranger/1v1/cross-team/old-round rejected before sync, zero bytes leaked). Persistence is strictly transactional and atomic via single DB transaction `saveMatchAndCollab` covering `collab_documents` and `matches` with rollback on failed commit (in-memory Y.Doc rolled back to committed DB state, documentRevision rolled back, approvals retained, zero uncommitted events emitted). Lost ack duplicate replay is idempotent (revision unchanged, readiness not re-invalidated, no duplicate text). Temporary dev seam `notifyDocumentChanged` and `POST /doc-changed` completely removed. Proven by 18 engine tests (incl. failure-injected atomicity rollback, language switch rollback, duplicate replay, and post-reboot revision bump 2→3 against real PostgreSQL), 9 service tests (namespace auth, frame relay, dupe, cursor, stale-round, 404 on removed dev route), 6 frontend unit tests, and complete Playwright E2E suite (17/17 passing, incl. Scenarios B, C, E, G, H, I, J covering bidirectional drop, drop during evaluation, process kill & restart with DB persistence, rapid flap cycles, stale-round write rejection, awareness reconnect clock preservation, and concurrent typing stress). Design/production evidence for the collaboration path only; no module row changes from `Designed` to complete.

## Ticket 17 final verification record (2026-09-25)

Technically verified, awaiting team sign-off — NO module row is flipped by
this change (module claims still require full-criteria demonstration and
team sign-off at evaluation, per the table above):

- Baseline green: typecheck/lint clean all workspaces; unit suites green
  (engine 163 incl. Postgres-gated lobby-atomic, harness 19, model 68,
  game service 45 incl. new dev-fixture gate + chat lost-ack tests, frontend
  32 — per `.scratch/code-arena/issues/17-tests-security-compliance.md`; Codex QA reran host verification: 315 passed, 12 environment-gated engine tests skipped); frontend build clean; `git diff --check` clean.
- Trust boundary: identity/side/team/score/phase/hidden-suite all
  server-derived from the trusted principal (engine `requireMember`/`sideOf`
  on every action); private side requests are validated capacity/membership
  requests, not authority. `POST /matches` direct creation is now gated
  behind `DEV_PRINCIPAL` (was reachable with any principal) — lobby mints
  matches internally and is unaffected; E2E fixtures run with the seam on.
- Hidden/opponent data: snapshots are per-caller filtered (opponent
  revision/language null, no opponent source, visible-tests only, sealed
  group results carry ids/status only); cross-match/cross-team engine tests
  (6) and browser hidden-marker assertions pass.
- Judge: 9-attack Docker matrix green (TLE/MLE/output/fork/rootfs/
  traversal/egress/env/cleanup) + compile-error/pathological-compile in the
  container suite; limits `--network none`, nobody, cap-drop ALL,
  no-new-privileges, read-only rootfs, 1 CPU / 256 MB / pids 64, output cap,
  `--rm`. Finding fixed: missing docker binary previously synthesized fake
  graded verdicts — now raises `JudgeInfraError` (no phantom attempts).
- Hidden-case confidentiality boundary (2026-09-26): `ContainerJudge` now
  starts one isolated container per case. The player receives source and only
  its current input; expected answers and other hidden inputs stay in trusted
  worker memory. The trusted caller compares captured output and ignores
  runner pass metadata. Fake-runner tests reject forged pass status, and
  adversarial Python tests scanning environment and `/scratch` cannot find a
  unique expected answer or another hidden case's input. The Docker isolation
  matrix and C/C++/Python verdict tests pass. This closes the documented
  in-container exposure for the tested runner paths; it does not change any
  subject-module status or make a new 42-module claim.
- Judging-boundary follow-up (2026-09-27): Python submitted code can no longer
  append a runner record after the trusted result; the shell writes one record
  after the Python process exits. Captured print and comparison output share
  the output limit. Compose gives `JUDGE_WORKER_TOKEN` only to Game and the
  worker. Appended-record, output-cap, and Compose credential tests were added;
  fake-runner and Compose topology tests pass. The new real-container attack
  test and Docker matrix were not rerun here because Docker socket access was
  denied. This narrows execution and credential exposure only; module status
  remains unchanged.
- Single-host judge deployment (2026-09-26): Compose starts Game with the
  authenticated worker on a private internal network; only the worker has the
  Docker socket, the worker has no database credentials or published port,
  and Nginx has no worker route. Worker Docker/image readiness is healthy.
  Two real 1440px HTTPS/WSS browser runs exercised visible Run, both players'
  concurrent Submit, hidden evaluation, and reveal across three rounds; hidden
  markers stayed absent. A public request to `/v1/run-visible` returned 404.
  The proof used the development identity seam and self-signed localhost TLS;
  production auth/certificate integration and load beyond this scenario remain
  open.
- Deployment: clean service-container startup with `docker compose up --build`
  (found + fixed: game image omitted problem-bank data so matchmaking 500d;
  `DATABASE_URL` now wired from `GAME_DB_*`); HTTPS health + redirect + WSS
  through Nginx proven; judging now runs through the internal worker described
  above. The standalone Chat service remains a deferred boot/readiness skeleton.
- Workspace verification (2026-09-26): `npm test` passed 386 tests and
  skipped 12 Postgres lobby checks gated on `DATABASE_URL`; engine/Game
  Docker- and Postgres-backed judging/recovery suites ran and passed.
  `npm run typecheck`, `npm run build`, and `npm run lint` passed. The
  `DATABASE_URL`-gated lobby concurrency tests remain unverified in this run.
- Final E2E: full Playwright suite 26/26 (1v1 duel 4/4 widths, 2v2 proof,
  collab + reconnect matrices, lobby 1v1/2v2 + recovery, team chat + 1v1
  no-chat, reconnect A–D), zero app errors.
- Multi-instance (2 services, 1 Postgres): cross-instance queue matching
  and the tested HTTP game flows SUPPORTED for their demonstrated scenarios;
  arbitrary cross-process Match mutations, socket fan-out, collab docs, and
  chat history/rate limits remain process-local/LIMITED (sticky sessions or
  shared pub/sub plus broader Match coordination are required before
  horizontal scale-out).
- Architecture deepening (2026-09-25): Game now exposes one `MatchPersistence`
  seam for durable Match/Round records, Submissions, Reveals, shared team
  documents, and failure history; the existing JSONB schema is preserved.
  In-memory contract coverage passes and the Postgres contract is gated on the
  local database. Ordinary Match writes now use optimistic expected-revision
  compare-and-save, with stale snapshots surfaced as 409 conflicts rather than
  silently overwriting newer state. Claim-owned Evaluation commits remain on
  their claim-session seam. This improves locality and concurrency evidence
  only; no module row is promoted, and broader horizontal command coordination
  remains an explicit follow-up before unrestricted scale-out. Idempotent
  recovery and grace-triggered snapshot reads retry after a revision conflict;
  gameplay commands still surface 409 without replay.
- Evaluation claim boundary (2026-09-25): `MatchPersistence` now gives Submit
  and boot recovery one live pending-evaluation owner across Game processes;
  takeover after a lost session may re-drive the row, but stale ownership
  cannot commit.
  PostgreSQL holds a session advisory lock keyed by the immutable evaluation
  ID through judge and the final Submission+Match transaction; a separate
  claim pool protects ordinary persistence writes, and a lost process/session
  releases ownership automatically. The engine refuses to judge or commit
  after claim loss and leaves the pending row reclaimable. The existing JSONB, `MatchRecord`,
  `SubmissionRecord`, receipt, and 42 subject module claims are unchanged.
  Two-engine Submit/recovery races, claim waiting, terminal replay,
  claim-acquisition failure preservation, pool-starvation prevention, and
  terminated-session handling are covered by the engine/Postgres suites.
  Ordinary Match revision conflicts are covered by the in-memory persistence
  contract and frontend refresh/no-replay tests. Broader horizontal command
  coordination remains open; no module row is promoted.
- Evaluation and Judge adapter deepening (2026-09-25): `EvaluationOrchestrator`
  now owns the shared Submit/recovery workflow while preserving the existing
  facade, receipts, records, and JSONB schema. `ContainerJudge` remains the
  default; the optional self-hosted `Judge0Adapter` uses explicit limits and
  `enable_network: false`, exposes no provider token/raw response/hidden
  expected value, and never falls back silently to another backend. Internal
  telemetry records provider timing and outcomes without changing Match state
  or adding a scheduler. This is architecture and execution-boundary evidence
  only; Judge0 deployment/equivalence evidence and all 42 module claims remain
  outstanding, so no module row is promoted.
- Match authority extraction (2026-09-25): trusted membership, per-Match
  command serialization, current-Round lookup, and revision stamping now live
  in `MatchAuthority` behind the unchanged `ArenaEngine` facade. Judge,
  Socket.IO, persistence adapters, and long-running waits remain outside this
  module. This is architecture/test evidence only; no subject module row is
  promoted.
- Arena transport seam (2026-09-25): frontend Arena UI now depends only on
  `ArenaTransport`; `TransportSession` owns connection state and subscriber
  delivery, `SocketArenaTransport` retains HTTP/Socket.IO reconnect, stale
  revision, and submit request-id behavior, and `MockArenaTransport` delegates
  fixture Match rules to `MockMatchAuthority`. Fixture controls use an optional
  typed capability, so the UI does not import or cast to a concrete adapter.
  This is architecture and test evidence only; no subject module row is
  promoted. Sticky sessions or shared pub/sub remain required before horizontal
  realtime scale-out because game sockets, collaboration, chat, and their rate
  limits are still process-local.
- Socket authorization context (2026-09-25): Game, collaboration, team-chat,
  and lobby gateways now share `socket-auth.ts` for the trusted handshake seam,
  verified `SocketPrincipal` attachment, conflict rejection, and cleanup-safe
  identity reads. Match namespaces require a Match identity before their
  namespace-specific `GameService` membership checks; lobby room access still
  goes through `roomForMember`. This is architecture/security-test evidence
  only; the real Core auth principal and production CORS narrowing remain open,
  and no subject module row is promoted.
- Round lifecycle module (2026-09-25): `RoundLifecycle` now owns Match/Round
  phase transitions, reveal preparation and publication state, round resets,
  Game-side verdict scoring, cumulative totals, and final-result tie-breaks
  behind the unchanged `ArenaEngine` facade. Persistence, Match authority,
  judge execution, collaboration cleanup, locking, and event emission remain
  outside the module. The MatchRecord JSONB schema and gameplay contracts are
  preserved. This is architecture and focused-test evidence only; no subject
  module row is promoted and cross-process Match locking remains open.
- Team collaboration module (2026-09-25): `TeamCollaboration` now owns the
  cohesive 2v2 collaboration rules behind the unchanged `ArenaEngine` facade:
  Yjs loading, authoritative document revisions, readiness invalidation,
  language starter resets, atomic document persistence/rollback, frozen
  submission snapshots, and masked team views. Match membership, per-Match
  locking, ordinary Match persistence, and event emission remain in the
  facade. This consumes the existing `MatchPersistence` seam, preserves the
  MatchRecord JSONB schema and public gameplay contracts, and adds no new 42
  subject module claim. Cross-process Match locking and realtime scale-out
  remain open.
- Load: 30 concurrent queue joins → 15 exact matches, no duplicates/500s;
  cancels + room burst clean. Yjs: 3000 edits → 38k-char doc, 131k state
  bytes (3.45×), 9 ms reconnect apply — acceptable for match durations.
- Rate limits inventoried (lobby 15/10s per user; run 10/min per side;
  chat 5/2s + pings 3/3s per socket; collab frames 256 KB; source 100 KB /
  64 KB HTTP) — all process-local (see multi-instance note).
- Still required from the team: forfeit/spec ratification (spec says no
  first-release forfeits; 1v1 grace-expiry forfeit implemented), production
  auth integration (seam + CORS narrowing), worker secret/certificate
  production configuration, final README/policy pages, and module sign-off.

### Codex Review/QA follow-up (2026-09-25)

Codex returned Standards 3 blockers + 1 nit and Spec 5 blockers with runtime verification green (typecheck/lint/build clean, 315 tests passed / 12 env-gated skipped, 570-assertion prototype check clean, `git diff --check` clean, no full Playwright rerun, no module rows flipped). All doc/spec items are fixed in this change, still with NO module row flipped:

- Policies prototype rewritten from retired Campus Puzzle Race scope (role/stage/room/hint/finish-delay/clue) to Code Arena scope (`08-policies.html`).
- Module mapping corrected from `2v2/3v3 + balanced roles` to 1v1/2v2 team battles with 3v3 explicitly out of first-release scope; `role` stays retired vocabulary.
- New `index.html` forwarder now carries one `<h1>` and a polite live region (was missing both).
- `stripComments()` helper removes the duplicated comment-stripping normalization in `04-live-match.html` (single definition, two call sites).
- Staged snapshot made commit-safe: the pure-rename stage is paired with the new `index.html` forwarder so committing no longer deletes the entry point; content fixes ride in the same change.
- `CONTEXT.md` winner rule corrected from most-rounds-won to sum-of-round-scores with spec tie-breaks (deliberate deviation from the frozen reference, already logged in the spec deviation log).
- `00-journey.html`, `03-lobby.html`, and `04-live-match.html` now flag the puzzle-race selections as historical (superseded 2026-09-23, production = Code Arena per `09-arena.html`); the in-prototype Variant A `Selected direction` label substring is preserved so `checks/exam-shell-check.js` still passes.
- Stale service claims corrected (skeletons + proven 1v1/lobby/reconnect/editor/2v2/collab/chat paths replace "still required"/"remains unimplemented"); Ticket-17 counts reconciled with the ticket file.
- Submit-overwrite warning (`frontend/src/components/EditorToolbar.tsx`) raised from `text-xs` to prominent `text-sm font-medium` with an amber notice treatment (keeps `aria-describedby`/`role=status` wiring and the exact required sentence).
- Ticket-17 team-owned gaps (forfeit/spec, judging-in-Compose, auth/CORS, README/policies, module sign-off) reconfirmed still open; README still absent at root.

## Ticket 04 production entry evidence (2026-09-24)

Canonical entry/lobby ticket completed with external auth remaining a dependency outside this implementation scope. Private rooms require full sides, all ready and host start; public queue uses FIFO for 1v1/2v2. PostgreSQL persists queue/rooms/membership and commits authoritative match/round/side creation together with lobby linkage. Membership checks protect reads/subscriptions, broadcasts target current members, and reconnect restores persisted waiting or matched state. MATCH_COMPLETE releases admission; expiry prevents start.

Verified 24 focused lobby tests (12 unit + 12 real PostgreSQL, including rollback injection, matcher/admission/cancel/fill/side/ready/start races), 6 service/socket tests, 7 live lobby browser scenarios (including 1v1 Run/Submit/reveal, public/private four-player Yjs/readiness/chat attachment and isolation, queue/private offline recovery), and 8 existing Arena browser regressions. Workspace: 296 tests passed, with environment-gated lobby database cases verified separately. Typecheck, UI lint and builds passed. The preview was built with an explicit game URL; broad heading assertions were corrected to avoid treating the lobby heading as evidence of Arena entry. Full evidence: `.scratch/code-arena/ticket-04-verification.md`.

Reviewed the authoritative PDF's mandatory simultaneous-user/no-race requirements (printed p.8), input/database/HTTPS requirements (p.9), real-time disconnect requirements (p.12), and gaming/remote-player/multiplayer synchronization requirements (pp.16–17). This adds local implementation evidence for concurrency, persistence, membership and recovery only. Test services used local HTTP with trusted development principals; HTTPS/WSS deployment, external authentication integration, distributed notification/rate-limit behavior and final evaluation remain unproven here. No module row is promoted from Designed to complete. Ticket 16 remains accepted COMPLETE; its two existing hardening notes stay in Ticket 17.

## Requirements not demonstrated by these prototypes

The local HTML files do not demonstrate a backend, database, authentication, authorization, WebSockets, concurrent-user correctness, race prevention, HTTPS, Docker, persistence, latency handling, reconnection, secure cookies, OAuth, final policy text, or production error handling. Those remain production work with their own tests and evaluation evidence.

## README and evaluation obligations

Before submission, the root `README.md` must follow printed pp.27-29 (PDF pp.28-30): italicized curriculum attribution with actual logins, English description and instructions, prerequisites, resources and precise AI-use disclosure, team roles, project management, stack justification, database schema, features and owners, module calculation/justification/implementation/owners, and honest individual contributions and challenges.

During evaluation, demonstrate each claimed module end-to-end. The subject explicitly assigns zero points to incomplete or non-functional modules.
