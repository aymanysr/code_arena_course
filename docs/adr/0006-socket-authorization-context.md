# Centralize Socket.IO authorization context

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

The Game service had four Socket.IO gateways: Arena game, collaboration,
team chat, and lobby. Each gateway parsed `DEV_PRINCIPAL` handshake fields on
its own, and match-scoped handlers read raw `client.data.userId` and
`client.data.matchId`. The repeated parser made it easy for a namespace to
drift in precedence, missing-field handling, or cleanup behavior.

## Decision

- Add one `socket-auth.ts` module that reads the current trusted-principal
  handshake seam, rejects disabled or incomplete authentication, and fails
  closed when auth and query identity disagree.
- Attach the verified `SocketPrincipal` to the Socket.IO session once. Message
  handlers read it through `requireSocketPrincipal`; disconnect cleanup uses the
  non-throwing `socketPrincipal` reader.
- Require a Match id for game, collaboration, and team-chat namespaces. The
  lobby namespace authenticates a user first, then authorizes each requested
  private room through `GameService.roomForMember`.
- Keep namespace-specific membership and capability checks in `GameService`:
  game snapshots/presence, collaboration sync, team-chat context, and lobby
  room membership remain separate authorization decisions.
- Keep room identity server-derived. The client cannot select a Match, team,
  or collaboration room by writing socket data or sending a room name.
- Preserve the existing `DEV_PRINCIPAL` contract. Replacing it with the real
  auth principal remains a single seam in this module and does not change the
  Game domain methods.

## Consequences

- All namespaces share one identity parser, precedence rule, and missing-field
  behavior.
- Gateways no longer trust duplicated raw identity fields; they consume the
  verified principal context.
- Namespace-specific authorization remains visible at the point where the
  required Match capability is known instead of being hidden in a generic
  gateway guard.
- The socket context is still process-local. Sticky sessions or shared pub/sub
  remain required before horizontal realtime fan-out and rate limits scale out.

## Follow-up

Replace `DEV_PRINCIPAL` with the authenticated Core principal and narrow CORS
origins before production auth integration. Keep the same `SocketPrincipal`
interface so the gateways and Game service do not need another identity
refactor.
