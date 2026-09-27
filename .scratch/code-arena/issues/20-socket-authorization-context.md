# 20. Socket authorization context

Status: FIRST SLICE COMPLETE — REAL AUTH INTEGRATION OPEN (2026-09-25)
Category: architecture / realtime security
Week 2: yes (preserves the existing live Match paths)
Blocked by: none

## Scope

Give every Game Socket.IO namespace one trusted-principal context. Centralize
handshake parsing and verified identity attachment while leaving each
namespace's Match membership and capability checks explicit in `GameService`.

## Acceptance criteria

- [x] `socket-auth.ts` owns the `DEV_PRINCIPAL` handshake seam and rejects
      missing, conflicting, or disabled identity sources.
- [x] Game, collaboration, team-chat, and lobby gateways use the shared
      handshake parser.
- [x] Message handlers consume the attached principal instead of raw
      `client.data.userId` / `client.data.matchId` fields.
- [x] Game, collaboration, and team chat require Match identity; lobby uses
      user identity and delegates private-room authorization to `GameService`.
- [x] Socket authorization tests cover auth/query precedence, conflict
      rejection, Match-id requirements, attachment, and cleanup-safe reads.
- [ ] Replace `DEV_PRINCIPAL` with the real Core-authenticated principal and
      narrow production CORS origins.
- [ ] Add cross-instance socket fan-out/rate-limit state using sticky sessions
      or shared pub/sub before horizontal realtime scale-out.

## Decisions

- Identity extraction is shared; namespace capabilities are not collapsed into
  one generic authorization decision.
- Room identity stays server-derived.
- Socket disconnect cleanup never becomes a Match leave/forfeit.

## Evidence

- `services/game/src/game/socket-auth.ts`
- `services/game/src/game/socket-auth.test.ts`
- `services/game/src/game/game.gateway.ts`
- `services/game/src/game/collab.gateway.ts`
- `services/game/src/game/team-chat.gateway.ts`
- `services/game/src/game/lobby.gateway.ts`
- `docs/adr/0006-socket-authorization-context.md`
