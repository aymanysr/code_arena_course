# Current design decisions

Recorded from the user's design discussion on 2026-09-17. This is a decision record, not an approved implementation specification. It supersedes the earlier Pong premise and older conflicting scoring research for this discussion.

## Sources and precedence

- Requirements: repository `ft_transcendence.pdf`, version 21.2; verified identical to the supplied Downloads copy.
- Product choices: explicit user answers in the current discussion.
- Earlier agenda, questionnaire, research, and vote boards: historical proposals. Saved answer cells are blank and issues 01–07 were open when inspected.
- Glossary: [CONTEXT.md](../../CONTEXT.md).
- Architecture: [three-service decision](../../docs/adr/0001-three-service-backend.md).

## Confirmed constraints

- One-month target; four contributors, three main contributors and one with a smaller contribution. The user and Saad have web experience; the other two contributors' web experience is not established. All are undertaking the 42 final Common Core project.
- Target 17 module points through the approved package below.

## Approved team roles

| Member | Roles |
| --- | --- |
| Aimane (the user) | Product Owner, Technical Lead, Developer; owns game rules, puzzles, game service, and alignment with the PDF |
| Saad | Project Manager, Technical Lead, Developer; owns core service, authentication, database setup, deployment, integration coordination, and deadlines |
| Amal | Technical Lead, Developer; owns frontend, player experience, and chat integration |
| Fourth contributor (name/login pending) | Supporting Developer; takes clearly defined tasks wherever needed, reviewed by the relevant lead |

The user approved these ownership areas as responsibilities rather than restrictions on who can contribute. Leads handle routine decisions within their area; changes affecting service interfaces, scope, or deadlines are reviewed together. Saad's area is broad, so the supporting developer should help there early. All four contribute to implementation, testing, documentation, and the mandatory foundation. The fourth contributor's name/login and the chat backend's primary owner still need to be recorded; chat integration ownership alone does not specify backend ownership.

## Confirmed game scope

- Campus-lockdown setting: cooperating teammates compete against another team to restore a fictional campus system.
- Equal team sizes: 2v2 and 3v3. One balanced role per player, with separate clue/control arrangements for two-player and three-player teams.
- Players choose available roles or request random assignment of remaining roles. Roles stay fixed during a match.
- In-app team text chat and structured clue sharing; separate information and communications for opposing teams.
- One room with three connected stages and randomized values/mappings from checked templates. Both teams receive the same generated challenge.
- First room entirely C fundamentals: loop tracing, string/character reasoning, and array-function repair. Programming knowledge stays within 42 Common Core topics. Later topics are not part of the first room.
- Players reason about code and submit structured answers; arbitrary submitted-code execution is outside the agreed first-room approach.
- Fifteen-minute match deadline. First team to solve all stages and clear its finish delay before the deadline wins. If neither does, draw.
- Optional hints: 30 seconds of finish delay per hint, visible cost and confirmation by another teammate. Two hints per stage were proposed, but the exact count has not been explicitly confirmed.
- Unlimited submissions. Failed submissions provide traces, never solutions, and block team resubmission for 15, 30, 60, then 90 seconds. Further failures remain at 90 seconds; the sequence resets for each stage. The match timer continues.
- Retry cooldown and hint finish delay are distinct. These timings are game decisions, not claims about official 42 exam timings.
- Reconnection: reserve the disconnected player's place and role until match end; no mid-match replacement or transfer of their private clues/controls to teammates. The timer continues. Rejoining restores that player's private clues, team progress, chat, and current penalties. This records the recommended reservation/private-role approach the user accepted; service-restart behavior remains open.

## Approved architecture

Core, game, and chat services; responsibilities are recorded in ADR-0001.

The user approved the existing proposed stack: React, Vite, TypeScript, and Tailwind for the frontend; NestJS for all three backend services; PostgreSQL, Redis, Nginx, and Docker Compose for infrastructure. Versions, Redis responsibilities, and database access tooling remain implementation-design details.

The user approved one PostgreSQL container with three separate databases and credentials, with each service restricted to its own data and using APIs for cross-service information. Ownership and trade-offs are recorded in [ADR-0002](../../docs/adr/0002-separate-databases-shared-postgres.md).

## Approved authentication direction

Secure email/password registration and login satisfy the mandatory foundation. The user approved 42 as the additional OAuth provider. Account-linking behavior remains to be designed.

The user approved local token verification: core issues signed login tokens; game and chat verify them locally and check permissions for each action. Token expiry, refresh, revocation, and signing-key handling remain design details.

## Approved avatar storage

Core validates avatar uploads and stores approved images in a persistent Docker volume. Nginx serves the approved images. A dedicated MinIO service is outside this agreed storage approach; upload validation and safe serving details remain to be specified.

## Approved module package

The user approved this 17-point package and excluded 2FA, tournaments, and a separate Q&A/quiz service from the first release. OAuth remains in scope; the puzzle race is the sole game.

| Module in v21.2 | Points |
| --- | ---: |
| Frontend and backend frameworks together | 2 |
| Real-time features | 2 |
| User interaction: chat, profiles, friends | 2 |
| Standard user management | 2 |
| Complete competitive web game | 2 |
| Remote players | 2 |
| Multiplayer with more than two players | 2 |
| Backend microservices | 2 |
| OAuth | 1 |
| Total | 17 |

Claims require complete implementation and demonstration. Overlapping features must meet every claimed module's criteria. OAuth, 2FA, and tournaments are each minor modules in v21.2. Frameworks together earn two points; PostgreSQL alone is not a separately credited module. Earlier v14.1-based corrections are not applicable.

Mandatory requirements remain separate: frontend/backend/database, secure email/password registration and login, input validation on both sides, HTTPS for backend access, responsive accessible UI, simultaneous users, one-command containerized launch, environment-secret handling, meaningful contributions from all members, relevant Privacy Policy and Terms pages, and the required English README and documented team roles.

## Approved delivery milestones

Work proceeds in parallel across the agreed ownership areas.

| Week | Working result |
| --- | --- |
| 1 | Docker startup, HTTPS, registration/login, service connections, and a basic lobby |
| 2 | One complete puzzle playable in 2v2 and 3v3, with private roles, chat, submissions, and penalties |
| 3 | All three stages, randomized challenges, hints, reconnection, OAuth, profiles, avatars, and friends |
| 4 | Feature freeze: verify every claimed module, fix failures, complete the README and policy pages, and rehearse evaluation |

The critical checkpoint is a complete multiplayer puzzle by the end of week two. These are relative milestones; exact calendar dates and per-person availability have not been specified.

## Approved reliability and verification approach

- Game is authoritative for answers, cooldowns, deadlines, and winners; browser clocks cannot change results.
- Duplicate submissions count once, including retries caused by connection trouble.
- A game-service restart interrupts unfinished matches without awarding wins or losses. Full recovery of active matches after a server restart is outside the first release.
- Tests cover four- and six-player matches, simultaneous submissions, reconnects, private-clue access, penalty timing, and generated-puzzle correctness.
- Evaluation rehearsal covers every claimed module, clean container startup, Chrome console checks, and each member explaining their contribution.

## Remaining design review

The consolidated [specification](../campus-puzzle-race/spec.md) contains the accepted direction and a clearly labeled set of proposed defaults for the remaining details. The written specification awaits user review; those defaults are not previously approved decisions.

- Define the approved infrastructure's responsibilities and authentication lifecycle.
- OAuth account-linking behavior.
- Private-lobby entry and invitation flow; automatic matchmaking is not approved scope.
- Exact stage actions, submission authority, trace content, hint count, and simultaneous-finish rule.
- Service interfaces, detailed schemas, and authorization of private clues/chat; database ownership is settled in ADR-0002.
- Fourth contributor's identity and chat backend's primary owner; the verification approach is approved above.

Existing benchmark-like RAM/build figures, commit-percentage targets, and claims of guaranteed module acceptance are not established PDF requirements or measured facts.
