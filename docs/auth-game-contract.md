# Auth → Game integration contract

Owner: auth contributor. Game is a consumer only — game code implements nothing below.

## What game needs from auth

HTTP: every game request arrives with a trusted principal the game can read as
`principal.userId` (stable, unique). `sessionId`/`username` may ride along when available.
Game resolves match membership and side/team ownership server-side from `userId` and
never trusts `userId`/`playerId`/`teamId`/`side` from client action payloads.

WebSocket: the connection handshake authenticates once, attaches the trusted principal
to the socket, and authorizes the requested room/match. The game needs a way to reject
expired/revoked sessions at connect (and to learn about revocation afterwards if the
auth design supports push; polling/lookup on each action is also acceptable).

## What game must NOT need to know

Passwords, password hashes, OAuth secrets, token-signing internals, cookie crypto.
Token verification itself belongs to auth; game receives the already-verified principal
at an injectable boundary (middleware/provider) so tests can substitute a fixture.

## Test/mock principal (dev/test only)

Game tests and local development use an explicit test principal fixture
(`{ userId: "test-…" }`), never a fake production auth path. Production code marks
exactly where the real auth middleware/provider plugs in.

## Expected cross-boundary tests (auth owner + game owner together)

- Authenticated HTTP request reaches game with the correct `userId`.
- Forged/expired/revoked token never yields a game principal (rejected before game logic).
- Authenticated socket carries the principal; game authorizes room/match from it.
- Two different users receive different `userId`s; one user cannot act as another
  (game-side membership tests cover the rest).
