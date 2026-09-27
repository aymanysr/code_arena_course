# 23. Match socket presence module

Status: FIRST SLICE COMPLETE — CROSS-PROCESS PRESENCE OPEN (2026-09-25)
Category: architecture / realtime presence
Week 2: yes (preserves the existing 1v1 and 2v2 paths)
Blocked by: none

## Scope

Extract process-local socket counting and first-socket/last-socket presence
policy from `GameService` into `MatchSocketPresence`. Keep the service's
public socket lifecycle methods and delegate durable side/member presence
through an injected target interface.

## Acceptance criteria

- [x] The module tracks sockets per user and Match and ignores duplicate or
      unknown closes.
- [x] 1v1 presence remains side-based and 2v2 presence remains member-based.
- [x] Multi-tab presence stays online until the last socket closes.
- [x] Existing `GameService` socket lifecycle contracts remain unchanged.
- [x] Focused module tests and real reconnect/service tests stay green.
- [ ] Add shared or cross-process presence coordination before horizontally
      scaling Game instances.

## Decisions

- Connection counting is a domain seam, not a NestJS gateway concern.
- The module owns only in-process socket IDs; the Match authority owns durable
  presence updates.
- No 42 subject module row is promoted by this extraction.

## Evidence

- `services/game/src/game/match-socket-presence.ts`
- `services/game/src/game/match-socket-presence.test.ts`
- `services/game/src/game/game.service.ts`
- `services/game/src/game/reconnect.test.ts`
- `docs/adr/0009-match-socket-presence-module.md`
