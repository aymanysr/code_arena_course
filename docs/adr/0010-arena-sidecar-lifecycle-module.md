# Extract Arena live sidecar lifecycle as a frontend module

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`ArenaPage` needed to create and clean up the live collaboration and team-chat
clients while the authoritative transport, Match, and Round changed. Keeping
factory imports, stale-request cancellation, scope keys, and disconnect calls
inside the page coupled React rendering to live-client lifecycle rules. The
lifetimes are different: collaboration must be replaced for every Round,
while chat remains Match-scoped.

## Decision

- Introduce `createArenaSidecarLifecycle` as the frontend live-client module.
- Give it injected factories so scope and cancellation behavior can be tested
  without Socket.IO or Yjs connections.
- Key collaboration by transport, Match, and Round; key chat by transport and
  Match so a round change preserves the Match chat client.
- Cancel stale factory requests and disconnect any client that resolves after
  its scope has been replaced.
- Keep `ArenaPage` responsible for rendering, editor subscription, and the
  existing browser test handles; it receives clients from the lifecycle seam.
- Keep `ArenaTransport` as the UI's authority seam and preserve the existing
  1v1/mock behavior with no live sidecars.
- Treat this as a frontend lifecycle extraction, not a new 42 subject module
  claim.

## Consequences

- Live client cleanup and scope policy are local, explicit, and unit-testable.
- Round transitions cannot leave an old collaboration provider attached, while
  chat does not reconnect unnecessarily within the same Match.
- The module owns client lifecycle only; transport authorization, server
  membership, and message/document semantics remain in their existing seams.

## Evidence

- `frontend/src/arena/sidecars.ts`
- `frontend/src/arena/sidecars.test.ts`
- `frontend/src/components/ArenaPage.tsx`
- `frontend/src/arena/chat.ts`
- `frontend/src/arena/collab.ts`
- `CONTEXT.md` glossary
- `.scratch/code-arena/issues/24-arena-sidecar-lifecycle-module.md`
