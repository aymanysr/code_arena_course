# Extract Match socket presence as a Game module

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`GameService` had to remember every socket opened by a participant so it could
apply the first-socket/last-socket presence policy. That bookkeeping was mixed
with the service's HTTP and Socket.IO orchestration, while the actual durable
presence decisions already belonged to the Match authority. The policy is
independent of NestJS and can be tested without booting a gateway or database.

## Decision

- Introduce `MatchSocketPresence` as a narrow Game-side module.
- Let it own socket counting, duplicate-close handling, and first/last socket
  transitions.
- Inject membership, mode, and durable presence operations through a focused
  target interface.
- Keep `GameService.noteSocketOpen` and `noteSocketClosed` as compatibility
  methods that delegate to the module.
- Preserve the existing policy: 1v1 persists side presence, while 2v2
  persists each member's presence; a multi-tab user stays online until the
  last socket closes.
- Keep actual namespace handling, authorization, room membership, and
  persistence outside the module.
- Treat this as a realtime/domain extraction, not a new 42 subject module
  claim.

## Consequences

- Socket lifecycle policy is directly unit-testable and no longer depends on
  gateway construction.
- The service remains the compatibility facade for existing callers and
  namespace behavior.
- Cross-process presence storage and horizontal socket fan-out remain open
  deployment work; this module intentionally holds process-local socket IDs.

## Evidence

- `services/game/src/game/match-socket-presence.ts`
- `services/game/src/game/match-socket-presence.test.ts`
- `services/game/src/game/game.service.ts`
- `services/game/src/game/reconnect.test.ts`
- `CONTEXT.md` glossary
- `.scratch/code-arena/issues/23-match-socket-presence-module.md`
