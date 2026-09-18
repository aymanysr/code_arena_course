# 42 subject compliance matrix

Last reviewed: 2026-09-18  
Authoritative source: [`../../ft_transcendence.pdf`](../../ft_transcendence.pdf), version 21.2  
Scope reviewed: game concept, lobby/role-selection prototype, active-match prototype, outcome/recovery/journey prototypes, draft specification, ADRs, and planned module set.

Active prototype plan: [`../../docs/superpowers/plans/2026-09-18-critical-player-journey-prototypes.md`](../../docs/superpowers/plans/2026-09-18-critical-player-journey-prototypes.md) covers outcome states, recovery/interruption states, the whole-app journey map, and final selected-direction capture. Planned files are not evidence until their checks pass and this matrix is updated.

## Maintenance rule

`AGENTS.md` requires every project artifact and change to adhere to `ft_transcendence.pdf`, with conflicts resolved in favor of the PDF. This matrix must be reviewed after every project change and updated in the same change whenever evidence, scope, module claims, assumptions, or compliance status changes. A checked prototype behavior is design evidence only; it is not implementation evidence for a production module.

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
| Web application with frontend, backend, and database | Printed p.8 (PDF p.9) | React/Vite frontend; NestJS core, game, and chat services; PostgreSQL | Designed | Draft spec and ADR-0001/0002; production services still required |
| Meaningful Git history from every teammate and proper work distribution | Printed p.8 (PDF p.9) | Four contributors own documented areas; all must commit meaningful work | Required later | Git log and final README; never infer contribution from plans |
| Containerized deployment with one command | Printed p.8 (PDF p.9) | Docker Compose behind Nginx | Designed | Clean-machine single-command launch test |
| Latest stable Chrome compatibility and no JavaScript console warnings/errors | Printed p.8 (PDF p.9) | Browser prototypes target modern Chrome | Prototype evidence | Automated browser checks for both prototypes; production-wide Chrome run still required |
| Relevant, accessible Privacy Policy and Terms of Service pages | Printed p.8 (PDF p.9) | Pages are in delivery scope and must be reachable before login | Not started | Production navigation and content review; placeholder pages fail the subject |
| Multiple simultaneous users; concurrent actions; real-time updates; no races | Printed p.8 (PDF p.9) | Authoritative game state, serialized team actions, request identifiers, WebSockets | Designed | Multi-client and concurrency tests against production services |
| Clear, responsive, accessible frontend across devices | Printed p.9 (PDF p.10) | Responsive Operations Console direction, semantic controls, keyboard focus, live status, non-color labels | Prototype evidence | Lobby and match prototypes checked at desktop/mobile sizes; production accessibility review remains required |
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
| Complete web-based game | 2 | Live matches, clear rules, win/loss conditions | Campus Puzzle Race with three ordered stages and server-decided outcomes | Designed; lobby/match UI prototyped |
| Remote players | 2 | Separate computers, latency/disconnection handling, smooth UX, reconnection | Reserved role/slot, authenticated state restoration, network tests | Designed; disconnect state prototyped |
| Multiplayer game with more than two players | 2 | Three or more simultaneous players, fairness, client synchronization | Equal 2v2/3v3 teams, unique balanced roles, authoritative synchronized state | Designed; 3v3 assignment UI prototyped |
| Backend as microservices | 2 | Loosely coupled services, clear interfaces, REST/message communication, single responsibility | Core, game, and chat services per ADR-0001 with separate data ownership per ADR-0002 | Designed |
| OAuth 2.0 | 1 | Remote authentication using OAuth 2.0, including 42 as an example | Explicit 42 account linking and later 42 login | Designed |
| **Planned total** | **17** | Minimum is 14 | Count only modules that are complete and demonstrable | **No module is yet proven by prototype code alone** |

## Lobby and role-selection traceability

| Product rule | UI behavior in `lobby.html` | Production enforcement still required |
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
- Body text is at least 14px; interactive targets are at least 48px high.
- Critical content uses responsive grids and safe-area-aware bottom controls.
- Reduced-motion and increased-contrast preferences are respected.
- These choices support the mandatory accessible frontend requirement; they do **not** claim the optional WCAG 2.1 AA major module.

## Match outcome prototype evidence

`outcomes.html` exercises four local, fake-state scenarios for `MATCH-C42-014`: Blue wins with an earlier eligibility time before the deadline; Coral wins while Blue completes later; equal eligibility times resolve to a draw; and Blue's 60-second finish delay leaves the result pending while Coral can still win. The page shows the server-decision model, both Team timelines, Hint and Finish delay accounting, an idempotent local delay-advance probe, and a simulated result-persisted-once indicator.

This is design evidence only. It does **not** prove durable exactly-once result persistence, server clocks, transactional concurrency, deadline enforcement, multi-client synchronization, or any completed production module.

## Match recovery prototype evidence

`recovery.html` exercises four local, fake-state scenarios for `MATCH-C42-014`: Saad disconnects while the Match clock and Retry cooldown continue and the Answer builder Role remains reserved; reconnecting requires authentication without replaying unacknowledged actions; restoring returns a role-filtered Answer builder view alongside simulated shared Team progress, Team chat, and penalty state; and an unrecoverable game-service restart records no win or loss and requires a new Match. The page keeps continuity signals visible, distinguishes authentication from snapshot restoration, and states that teammates do not inherit private clues or controls.

This is intended UX design evidence only. Network latency, WebSocket behavior, authentication, snapshot filtering, persistence, and restart behavior still require production evidence. It does **not** prove graceful disconnection handling, real reconnection logic, concurrent client synchronization, durable role reservation, or any completed production module.

## Critical journey map prototype evidence

`journey.html` is a local, fake-state navigation map for the seven product surfaces: Account access, Home, Lobby, Live match, Result, Profile & friends, and Policies. It shows the primary Account access → Home → Lobby → Live match → Result route, the Live match recovery branch, status labels for prototype, planned, and mandatory-delivery work, and links to the checked Lobby, Live match, Result, and Recovery prototypes. Its evidence rail names the mandatory foundation and planned 17-point module total without claiming a completed module.

This is navigation/design evidence only. Account access, Home, Profile & friends, Policies, and every production service surface remain unimplemented. The map does **not** prove authentication, OAuth linking, policy content, backend/database behavior, persistence, authorization, WebSockets, concurrent-user correctness, or any completed production module.

## Validated prototype decisions

- **Active Match:** Variant A, **Operations Console**, is the selected direction.
- **Lobby:** Variant A, **Team Bays**, is the selected direction.
- **Outcomes:** one Operations Console shell presents scenario-driven, fake server-result states.
- **Recovery:** reserved Roles and continuing clocks are shown separately from the interrupted-Match state.
- **Whole-app scope:** the seven-node journey map has prototype evidence only for Lobby, Live match, Result, and Recovery.

Variants B and C remain historical alternatives in the Lobby and Active Match prototype switchers. Production UI must be rebuilt with production tests and must not promote these throwaway prototype files directly.

### Verification record - 2026-09-18

- Embedded lobby JavaScript parsed successfully.
- All three lobby variants rendered at 1440x1000 and 390x844.
- Team moves, unique role selection, readiness clearing, 2v2/3v3 equality, start gating, disconnected-slot reservation, full/started rejection feedback, and the state inspector were exercised in Chromium.
- The six checked viewports had no document-level horizontal overflow or interactive target below 44px.
- The checked browser sessions produced zero JavaScript console errors.
- The outcome browser check exercised `win`, `loss`, `draw`, and `delay` at 1440x1000 and 390x844, including the 30-second-per-Hint rule, the exact 60-second Finish delay, before-deadline eligibility, equal-time draw, persisted-once indicator, required accounting/timelines and navigation links, one finish-delay finalization, URL scenario switching, and the native state dialog. Keyboard scenario activation retains visibly styled focus on the replacement selected control; keyboard delay advancement moves visibly styled focus to the updated result heading. It also verified at least 14px visible text, no prose-only `time` elements, no document overflow, no undersized targets, and no console/page errors.
- The recovery browser check exercised `disconnected`, `reconnecting`, `restored`, and `interrupted` at 1440x1000 and 390x844. It verified the reserved Role, continuing Match clock, unavailable private controls while disconnected, re-authentication without action replay, restored role-filtered clues/controls plus simulated shared progress, Team chat, and penalty state, and no fabricated interruption result. It also checked URL scenario switching, the two-step `Continue recovery` transition, native state inspector, no document overflow, no interactive target below 44px at either viewport, and no console/page errors.
- The journey browser check rendered all seven navigation nodes at 1440x1000 and 390x844. It verified the four exact prototype links, text labels for Prototype available, Production planned, and Mandatory delivery, the mandatory-foundation and 17-point evidence rail, skip-link and visible keyboard focus behavior, no document overflow, no interactive target below 44px, and no console/page errors.
- The final critical-journey browser check rendered Journey, selected Lobby Variant A, selected Active Match Variant A, delayed Outcome, and disconnected Recovery at 1440x1000 and 390x844. It verified one H1, visible Prototype labeling, a visible `journey.html` return route on every non-map page, the exact selected-direction labels, no document overflow, no interactive target below 44px, and no console/page errors. Fresh desktop and mobile screenshots were reviewed for unclipped content, readable text, visible primary actions, no switcher collision, and accurate prototype-only claims.
- This record verifies only the throwaway prototype behavior described here; production evidence remains outstanding wherever the tables say Designed, Not started, or Required later.

## Requirements not demonstrated by these prototypes

The local HTML files do not demonstrate a backend, database, authentication, authorization, WebSockets, concurrent-user correctness, race prevention, HTTPS, Docker, persistence, latency handling, reconnection, secure cookies, OAuth, policy pages, or production error handling. Those remain production work with their own tests and evaluation evidence.

## README and evaluation obligations

Before submission, the root `README.md` must follow printed pp.27-29 (PDF pp.28-30): italicized curriculum attribution with actual logins, English description and instructions, prerequisites, resources and precise AI-use disclosure, team roles, project management, stack justification, database schema, features and owners, module calculation/justification/implementation/owners, and honest individual contributions and challenges.

During evaluation, demonstrate each claimed module end-to-end. The subject explicitly assigns zero points to incomplete or non-functional modules.
