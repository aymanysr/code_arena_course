# Use core, game, and chat services

Accepted in the design discussion on 2026-09-17. For a one-month project targeting 16–17 module points, use three backend services with clear responsibilities, retaining the existing documents' microservices direction while reducing the original eight-service scope. A single backend was considered; the user chose the three-service structure, with microservices eligibility dependent on satisfying the PDF's requirements rather than the container count.

## Original 2026-09-17 boundary

- **Core:** accounts, login, OAuth, profiles, friends, and avatars.
- **Game:** lobbies, teams, roles, puzzle generation, answer checking, timers, penalties, and match results.
- **Chat:** team messages and shared clue cards; membership is checked against the game service.

## Amendment 2026-09-23 (Code Arena pivot)

Service boundaries stand; game responsibilities change. Game now owns arenas (1v1/2v2), problems and rounds, visible-run and hidden-suite judging orchestration (execution itself lives in the isolated judging component per ADR-0003), readiness, phase transitions, scoring, and match results. Roles, clue cards, puzzle templates, and hint/cooldown mechanics are dropped. Chat carries team text plus quick pings only. See the pivot record `.scratch/ft-transcendence-wayfinder/decisions-2026-09-23.md` and the code-arena spec.

This decision establishes responsibilities. Inter-service contracts and failure behavior still need design. Storage ownership is recorded in [ADR-0002](0002-separate-databases-shared-postgres.md). The user subsequently confirmed React/Vite/TypeScript/Tailwind, NestJS, PostgreSQL, Redis, Nginx, and Docker Compose; see the current design decision record for remaining questions.

## Amendment 2026-09-25 (Game-owned match chat)

For the first-release Code Arena runtime, **Game owns match-scoped team chat and quick pings**. The Game service's `/chat` Socket.IO namespace performs the membership check and carries the live transport alongside the other match namespaces. This supersedes the 2026-09-23 sentence that assigned match chat to the standalone Chat service.

- `services/chat` remains a deferred boot/readiness skeleton so the service boundary is available for a later decision, but it is not on the first-release gameplay path and has no first-release match-chat responsibility.
- When durable match-chat storage is added, it belongs to the Game data boundary; the current gateway history is process-local and is not durable evidence.
- Amal is the primary implementer for the Game-owned chat path. If she misses the team's agreed delivery checkpoint, Aimane takes over that path. This is a contingency handoff, not parallel duplicate implementation.
