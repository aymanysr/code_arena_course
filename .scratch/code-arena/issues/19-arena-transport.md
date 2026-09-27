# 19. Arena transport seam

Status: FIRST SLICE COMPLETE — REALTIME SCALE-OUT OPEN (2026-09-25)
Category: architecture / frontend transport
Week 2: yes (keeps the 1v1 Arena path unchanged)
Blocked by: none

## Scope

Make the frontend `ArenaTransport` interface the only UI dependency for Match
snapshots and commands. Centralize connection/subscriber delivery, keep
Socket.IO reconnect behavior in the production adapter, and move fixture Match
rules into a dedicated mock authority.

## Acceptance criteria

- [x] `TransportSession` owns connection state, subscriptions, and explicit
      notification delivery for both adapters.
- [x] `SocketArenaTransport` keeps HTTP, Socket.IO, reconnect, browser offline,
      stale-revision, and submit request-id behavior inside the production
      adapter; lost acknowledgements can retry the same logical submit.
- [x] `MockMatchAuthority` owns fixture phase, readiness, scoring, reveal, and
      round rules without knowing connection mechanics.
- [x] `MockArenaTransport` is a thin adapter over the fixture authority.
- [x] Arena UI uses the optional typed fixture capability and does not import,
      narrow, or cast to `MockArenaTransport`.
- [x] Frontend typecheck, lint, unit tests, and production build pass.
- [ ] Add sticky-session or shared pub/sub support before horizontal realtime
      scale-out; current socket, collaboration, chat, and rate-limit state is
      still process-local.

## Decisions

- UI depends only on `ArenaTransport`.
- Socket.IO and fixture implementations are adapters.
- Mock Match rules are test fixture authority, not transport mechanics.
- No deployment scaling claim is made by this frontend refactor.

## Evidence

- `frontend/src/arena/transport.ts`
- `frontend/src/arena/mock-authority.ts`
- `frontend/src/arena/mock.ts`
- `frontend/src/arena/socket.ts`
- `frontend/src/components/ArenaPage.tsx`
- `frontend/test/transport-session.test.ts`
- `docs/adr/0005-arena-transport-seam.md`
