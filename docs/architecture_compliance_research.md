# Campus Puzzle Race — Architecture and 42 Subject Review

> Historical research for the superseded Campus Puzzle Race direction. The active Code Arena architecture and subject mapping live in `.scratch/code-arena/spec.md`, `docs/adr/`, and `prototype/game-ui/42-subject-compliance.md`.

## Purpose and sources

This document records the current Campus Puzzle Race production target. It replaces the old Pong and eight-service research. The authoritative sources are:

- `ft_transcendence.pdf`
- `.scratch/campus-puzzle-race/spec.md`
- `CONTEXT.md`
- `docs/adr/0001-three-service-backend.md`
- `docs/adr/0002-separate-databases-shared-postgres.md`
- `prototype/game-ui/42-subject-compliance.md`

The numbered HTML screens are throwaway design prototypes. They do not prove a completed module or production requirement.

## Product target

Campus Puzzle Race is a competitive web game. Two equal Teams solve the same generated puzzle Room. A Room has three ordered Stages. Each Player has one Role with private clues and controls. The Game service decides every Submission, penalty, and Match result.

The first release includes private invitation-code Lobbies, 2v2 and 3v3 Matches, Team chat, structured clue-card sharing, email/password accounts, explicit 42 account linking, profiles, avatars, friends, online status, retry cooldowns, Hints, Finish delays, and Match recovery rules.

## Architecture target

| Service | Production responsibility | Own persistent data |
| --- | --- | --- |
| Core | Email/password accounts, explicit 42 OAuth linking, sessions, profiles, avatars, friends, and online status | Users, password hashes, OAuth links, refresh sessions, friendship records, avatar metadata |
| Game | Lobbies, Teams, Roles, Rooms, puzzle templates, Stage actions, Submissions, penalties, and Match outcomes | Match and participant records, private puzzle state, Team progress, accepted-action identifiers, results |
| Chat | Team messages and explicitly shared clue cards | Conversation membership, messages, shared cards, message identifiers |

Each service owns its own PostgreSQL database and credentials. Services exchange stable IDs through authenticated APIs. They do not query another service database. Nginx is the public entry point. Browser traffic uses HTTPS and WSS.

## Mandatory requirements

| Requirement | Current evidence | Production work still required |
| --- | --- | --- |
| Web application with frontend, backend, and database | Player-path prototypes show intended screens | Build and connect the frontend, three services, and PostgreSQL databases |
| Responsive and accessible UI | Prototype checks cover desktop, mobile, keyboard focus, links, and control size | Apply the same checks to the production frontend |
| Secure email/password signup and login | Account prototype shows the intended flow | Server-side password hashing, secure sessions, frontend and backend validation |
| HTTPS for browser-to-backend traffic | Architecture specifies Nginx HTTPS and WSS | Configure and test TLS in containers |
| Privacy Policy and Terms of Service | Relevant draft policy screens exist before account access | Final legal content and production footer routes |
| Concurrent multi-user support | Spec defines Team and Match concurrency rules | Real-time transport, server serialization, durable writes, and concurrency tests |
| Containerized single-command launch | Planned architecture only | Docker or equivalent launch, documented configuration, and clean-start test |
| Clean latest-Chrome console | Prototype browser checks pass | Production browser check with no warnings or errors |

## Module target — 17 points

| Claimed module target | Points | Production demonstration required |
| --- | ---: | --- |
| Frontend and backend frameworks | 2 | Working React frontend and NestJS backend |
| Real-time features | 2 | Scoped updates, connection handling, and broadcasts across clients |
| User interaction | 2 | Working Team chat, profiles, friends, and friend list |
| Standard user management | 2 | Profile editing, avatars, friends, and online status |
| Complete web game | 2 | Competitive Match with clear rules and server-decided outcomes |
| Remote players | 2 | Separate computers, latency handling, and reconnection |
| Multiplayer with more than two Players | 2 | Four- and six-Player Matches with fair Role distribution |
| Backend microservices | 2 | Three separately owned services with authenticated APIs and separate data |
| 42 OAuth | 1 | Explicit account linking and later 42 sign-in |
| **Total target** | **17** | Every module must receive its own production demonstration |

No row above is implemented or awarded by the prototype files.

## Prototype evidence

The current numbered path gives the Team a shared design reference:

`index.html` → `00-journey.html` → Account access → Home → Lobby → Live Match → Result → Recovery → Profile and friends → Policies.

The path exposes the intended Lobby, Role, Stage, Submission, Failure trace, Retry cooldown, Hint, Finish delay, result, reconnect, and policy flows. It carries no network calls, authentication, persistence, shared state, or server authority.

## Production acceptance checks

Before a module is claimed, the Team must demonstrate:

1. Server-side authorization and validation for every Core, Game, and Chat action.
2. Correct private Role and Team isolation across concurrent Matches.
3. Idempotent Submission and Hint handling with durable result writes.
4. Real-time updates, disconnect handling, re-authentication, and role-filtered recovery.
5. HTTPS and WSS browser traffic, no console warnings or errors, responsive keyboard-usable screens, and final policy links.
6. Containerized clean start, documented configuration, schema documentation, and the required README evidence.

## Current status

The Team can use the current documents and prototypes for review and ticket planning. The Team must not present them as a completed game, completed services, or earned module points.
