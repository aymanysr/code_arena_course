# Campus puzzle race — design specification

Date: 2026-09-17
Status: SUPERSEDED 2026-09-23 by the Code Arena pivot. Do not implement from this document. The production spec is now [.scratch/code-arena/spec.md](../code-arena/spec.md); the pivot record is [decisions-2026-09-23.md](../ft-transcendence-wayfinder/decisions-2026-09-23.md). Preserved below as history.

## Purpose and sources

Build a competitive web game for the 42 ft_transcendence project in one month. Two teams cooperate internally to solve a C-fundamentals escape room and restore a fictional campus computer system before the other team.

The requirements source is [ft_transcendence.pdf](../../ft_transcendence.pdf), version 21.2. Product decisions come from the [current decision record](../ft-transcendence-wayfinder/decisions-2026-09-17.md). Use [CONTEXT.md](../../CONTEXT.md) for vocabulary and [ADR-0001](../../docs/adr/0001-three-service-backend.md) and [ADR-0002](../../docs/adr/0002-separate-databases-shared-postgres.md) for approved architecture.

The earlier Pong agenda and v14.1-based research are historical inputs, not the current specification. Module credit depends on demonstrated implementation, not this tally alone.

## Decisions proposed for this written review

The overall game, stack, service boundaries, scoring target, retry rules, hint cost, reconnection policy, and schedule have been approved in conversation. The following defaults complete the design and require approval as part of this document:

1. Private invitation-code lobbies; no automatic matchmaking in the first release. The host selects 2v2 or 3v3; all players must be ready before starting.
2. Two progressively more useful hints per stage, each purchased once per team. Any teammate may request one; a different teammate must confirm it.
3. Any teammate may submit the team's assembled answer. A stage requires valid contributions through each role's controls; the server checks those prerequisites. Concurrent actions are serialized per team.
4. Compare server-recorded completion eligibility times; an exact tie is a draw. An eligibility time at or beyond the deadline does not win.
5. Existing email/password accounts can explicitly link 42 while signed in. Later 42 sign-ins use that link. Matching email addresses alone never link accounts; an unlinked 42 sign-in directs the player to register or sign in and link explicitly.
6. Run one instance of each service. Redis holds expiring presence/session-revocation information; PostgreSQL owns durable business data. Reliable active-match recovery after a game-service restart remains outside scope.
7. Amal owns the chat backend as well as chat integration, with Saad reviewing authentication and service boundaries. The supporting developer takes bounded tasks reviewed by the relevant lead.

## First-release scope

- One campus-lockdown room with three sequential stages: loop tracing, string/character reasoning, and array-function repair.
- Competitive 2v2 and 3v3 matches. Both teams have the same size and receive the same puzzle instance, while their progress, private clues, and chat remain isolated.
- One balanced role per player. Each stage has separate two-player and three-player clue/control arrangements; two-player mode does not give someone two roles.
- Players choose unoccupied roles or request random assignment. Remaining roles are assigned without duplication before start and remain fixed during the match.
- In-app text chat and structured clue-card sharing within the team.
- Structured answer entry and selection; no execution of arbitrary player-submitted programs.
- Randomized inputs, symbols, and mappings from checked puzzle templates, with a solution generated before its corresponding clues.
- Accounts, 42 OAuth, editable profiles, avatars, friends, and online status.

Outside the first release: 2FA, tournaments, a separate Q&A/quiz service, additional rooms, voice chat, a room editor, AI opponents, automatic matchmaking, and mid-match player replacements.

## Player journey and rules

### Entry and lobby

A registered player creates a lobby and shares its invitation code. Authenticated players join and choose an available team and role. A role change clears readiness; starting requires two full teams with all players ready. The invitation code identifies a lobby; it is not an authentication credential. Requests to join full or started matches are rejected with clear feedback.

### Puzzle cooperation

Each stage divides information and controls so every role contributes. In two-player mode, for example, one player may hold code and select a candidate transformation while the other holds inputs and assembles the resulting output. Three-player mode splits those responsibilities into three essential contributions. No puzzle requires three simultaneous physical actions.

The interface distinguishes private role information from explicitly shared clue cards. Clients receive only information their role or team may view; hiding already-delivered answers in the UI is insufficient. Only the game service holds the complete solution and determines correctness.

The first room uses loops, conditions, string indexing, and arrays. Templates avoid undefined or platform-dependent C behavior. A seed identifies a repeatable instance for verification, but seed and solution material are not exposed during play. Later-stage clues unlock only when the previous stage is passed.

### Submissions and failure traces

Submitting checks the team's current stage and assembled answer. On failure, return a trace identifying failed checks and safe diagnostic details without revealing the correct answer or another role's unshared information. Trace content is authored alongside each template and tested for leakage.

Failures impose team-wide retry cooldowns of 15, 30, 60, then 90 seconds, capped at 90 seconds for later failures. The sequence resets at each new stage. Players can read, discuss, and change proposed answers during cooldown, but cannot resubmit. There is no attempt limit. Invalid transport requests and duplicate requests do not count as wrong answers.

Every submission has a request identifier. Repeating that identifier returns the original outcome rather than applying a second transition or penalty. A second distinct submission arriving during the resulting cooldown or for a completed stage is rejected without another failure count.

### Hints and match result

Show the hint cost before confirmation. A different teammate confirms; each accepted purchase is charged once and revealed to the whole team. Each hint adds 30 seconds of finish delay, separate from retry cooldowns. Hints guide reasoning and never reveal the full solution.

The match deadline is 15 minutes after the server starts the match. After all stages are passed, a team's eligibility time is its final successful submission time plus its accumulated hint delay. The first team to reach an eligibility time strictly before the deadline wins; another team may win while its opponent is waiting out a finish delay. Equal eligibility times produce a draw. If neither team becomes eligible before the deadline, the match is a draw. Penalties never pause the match clock.

Persist a terminal match result exactly once. Browser countdowns display server state and do not decide outcomes.

### Disconnection and interruption

A disconnected player's place and role remain reserved until match end. Their private controls and clues do not transfer to teammates. The timer and cooldowns continue. On reconnection, authenticate again and restore the correct role-specific snapshot, shared progress, chat, and penalties; do not replay unacknowledged actions as new actions.

If a player never returns, normal deadline rules still apply. An unrecoverable game-service restart instead marks unfinished matches interrupted, awarding no win or loss; players create a new match. A stored terminal result survives restart unchanged.

## Components and data flow

The frontend uses React, Vite, TypeScript, and Tailwind. Three NestJS services sit behind Nginx; Docker Compose runs them with one PostgreSQL instance and Redis. Nginx terminates HTTPS, serves the frontend and approved avatar files, and proxies APIs and secure WebSocket connections.

| Component | Responsibility | Owned persistent data |
| --- | --- | --- |
| Core | Email/password login, 42 OAuth, tokens, profiles, friends, avatars | Users, password hashes, OAuth links, refresh sessions, friendship records, avatar metadata |
| Game | Lobbies, teams, roles, templates, stage actions, checks, penalties, outcomes | Match and participant records, private puzzle state, team progress, accepted-action identifiers, results |
| Chat | Team messages and explicit clue sharing | Authorized conversation membership records, messages, shared cards, message identifiers |

Each service has its own PostgreSQL database and credentials. It accesses only its own database. Cross-service references use stable IDs and APIs rather than cross-database queries or foreign keys. The final README documents schemas, fields, types, and relations within each database as well as these logical cross-service references.

Game sends filtered state to each authorized player. Chat verifies match/team membership through game when admitting a player to a conversation and fails closed if membership cannot be verified. It accepts messages only from authenticated members. For structured cards, game validates the sender's access and supplies a shareable projection; chat cannot request or broadcast a complete puzzle solution. Ordinary text is displayed as text, not executable HTML.

Internal APIs require service authentication. Browser and externally accessible backend traffic uses HTTPS/WSS; internal backend traffic may use unencrypted private-network connections as permitted by the PDF. Only Nginx is exposed publicly.

## Authentication, storage, and failure handling

Core hashes and salts passwords, validates account input, and issues signed tokens. Game and chat verify token signatures locally and independently authorize each action. Core retains the signing secret/private key; downstream services receive verification material. Token expiry, refresh rotation, logout, and revoked-session checks apply to both HTTP requests and WebSocket actions. Exact durations and library selections belong in the implementation plan.

Browser sessions use secure, HttpOnly cookies, with appropriate same-site settings, origin validation, and protection against cross-site state changes. OAuth verifies callback state and uses the explicit linking rule above. An OAuth outage leaves email/password login usable.

Core validates avatar size and image content, assigns safe server-generated filenames, and stores approved images in a persistent volume. Nginx mounts the served files read-only. Profiles receive a default avatar until an upload succeeds. Users can replace only their own avatar; rejected uploads do not replace existing images.

Game remains authoritative even when a client sends old or manipulated values. Permission checks prevent access to another role, opposing team, or unrelated match. PostgreSQL mutations and action deduplication must complete before acknowledging durable success. Redis is not the source of truth for scores or puzzle answers.

If chat is temporarily unavailable, show its connection state and retry without accepting messages as delivered until acknowledged. Game state remains intact and the match clock continues. Authentication or storage failures return controlled errors; operations that cannot be authorized or persisted do not report success. A game restart follows the approved interrupted-match policy.

## PDF compliance and module evidence

Mandatory foundation: a frontend, backend, database, styling solution, clear schema, concurrent-user support, responsive and accessible UI, secure email/password signup/login, frontend and backend input validation, HTTPS for backend access, and a single-command containerized launch after documented configuration. Keep secrets in a Git-ignored local environment file and provide an example without credentials. The application must work on latest stable Chrome without JavaScript console warnings/errors.

Provide relevant Privacy Policy and Terms of Service pages accessible before login. Use meaningful Git history from all four contributors. The English README must include the required italicized curriculum attribution with actual logins, description, prerequisites and run instructions, resources and AI-use disclosure, team roles, project management, stack justification, schema, features, module calculations, and individual contributions.

| Claimed module | Points | Demonstration |
| --- | ---: | --- |
| Frameworks for frontend and backend | 2 | Working React frontend and NestJS backend |
| Real-time features | 2 | Updates across clients, scoped broadcasts, connection/disconnection handling |
| User interaction | 2 | Send/receive chat, view profiles, add/remove friends and view friend list |
| Standard user management | 2 | Profile edits, avatar/default avatar, profiles, friends and online status |
| Complete web game | 2 | Competitive live match with clear rules and win/loss conditions |
| Remote players | 2 | Separate computers, latency/disconnection handling, working reconnection |
| Multiplayer with more than two players | 2 | Four- and six-player play, fair role distribution, synchronized clients |
| Backend microservices | 2 | Three services with clear interfaces, separate responsibilities, API communication |
| OAuth | 1 | Link 42 identity and subsequently log in through 42 |
| **Total** | **17** | All requirements of each claimed module must be demonstrated |

The overlapping user and game modules require their own complete demonstrations. Database use alone is mandatory, not an extra module; framework points are counted once. No points are claimed for excluded features.

## Verification and acceptance

1. Puzzle checks: every template and supported team-size arrangement is solvable, each role contributes, generated clues agree with the solution, and safe C semantics hold across the supported input domain. Use exhaustive checks for small domains and deterministic sampled seeds for larger domains.
2. State checks: invalid answers, cooldown escalation/reset, hint confirmation/deduplication, finish delays, ties, and the deadline boundary produce the defined outcome. Inject a clock so timing tests do not wait in real time.
3. Concurrency checks: simultaneous requests cannot duplicate a role, advance a stage twice, apply a hint twice, count a retried submission twice, or finalize a result twice.
4. Access checks: another role's private data, opponents' messages, private API endpoints, and unauthorized avatar operations are inaccessible, including through direct requests and forged WebSocket messages.
5. Multiplayer checks: complete a 2v2 and a 3v3 match; run concurrent matches; test realistic network delay, refresh, disconnect, expired authentication, and reconnection with correct filtered state.
6. Failure checks: restart game during a match and after a completed match; verify interruption without a fabricated loss and preservation of the completed result. Verify chat reconnection and unavailable dependencies return usable error states.
7. Delivery checks: clean configured startup with one command, persistent data after container recreation, HTTPS/WSS, Chrome console, responsive layouts, keyboard-accessible controls and readable feedback, both policy pages, and every module's demonstration.
8. Defense rehearsal: all contributors explain their work and the overall design; rehearse a small live modification as preparation for the PDF's possible evaluation request.

## Team and delivery

| Member | Approved responsibilities |
| --- | --- |
| Aimane | PO, TL, developer: game rules, puzzles, game service, PDF alignment |
| Saad | PM, TL, developer: core, auth, database setup, deployment, integration and deadlines |
| Amal | TL, developer: frontend, player experience, chat integration; chat backend ownership is a proposed default in this review |
| Supporting developer | Bounded tasks wherever needed, with review by the relevant lead; help Saad early given his broader area |

Leads decide routine matters in their areas. Changes to interfaces, scope, or deadlines are reviewed together. Everyone implements, tests, and documents contributions. Actual member logins and the supporting developer's identity must be collected before the required README is finalized; do not invent names or contribution percentages.

| Week | Checkpoint |
| --- | --- |
| 1 | Docker startup, HTTPS, email/password registration/login, service connections, basic lobby |
| 2 | One complete puzzle in 2v2 and 3v3, private roles, chat, submissions, penalties |
| 3 | Three stages, randomization, hints, reconnection, OAuth, profiles, avatars, friends |
| 4 | Feature freeze, module verification, fixes, README/policy completion, evaluation rehearsal |

The schedule is relative to the team's start date. OAuth registration and callback configuration must begin in week one even though the finished module is due in week three. Test puzzle cooperation with real teammates during week two; adjust clue distribution before producing the remaining stages.

## Review boundary

This document is the consolidated design for review, not authorization to implement. After approval, produce the implementation plan and separate dependency-linked tickets under this feature's `issues/` directory according to the local tracker conventions. Verify current framework and authentication documentation when selecting implementation APIs and libraries. Any proposal changing the approved module scope returns to the team for a decision.
