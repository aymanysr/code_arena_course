# Keep Arena transport mechanics behind one frontend seam

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

The Arena UI already consumed an `ArenaTransport` interface, but the concrete
adapters still owned their own subscriber delivery and the fixture adapter also
contained Match phase, readiness, scoring, and reveal rules. The UI therefore
had to identify the mock class to expose development controls, and the mock was
doing two jobs at once.

## Decision

- Keep `ArenaTransport` as the only interface used by Arena UI modules for
  snapshots and Match commands.
- Put connection state, subscription delivery, and explicit event/baseline
  notification in the shared `TransportSession` helper. Adapters still decide
  when a server baseline or transport event should be delivered.
- Keep Socket.IO, HTTP actions, reconnect/re-handshake handling, browser
  offline signals, stale revision filtering, request refreshes, and
  submission/evaluation request identifiers inside `SocketArenaTransport`.
  The adapter retains one unconfirmed identical submit key across a lost
  acknowledgement; a completed deliberate resubmit gets fresh identifiers.
- Move fixture Match state and rules into `MockMatchAuthority`. The
  `MockArenaTransport` adapter only delegates commands and translates authority
  changes into transport notifications.
- Expose local fixture-only controls through an optional typed capability on
  `ArenaTransport`; UI code must not import a concrete transport or use
  `instanceof`/casts to reach them.
- Preserve the existing Socket.IO room/auth and HTTP contracts. This slice does
  not claim sticky sessions, shared pub/sub, or multi-instance socket fan-out;
  those remain required before horizontal realtime scale-out.

## Consequences

- React components depend on one stable transport interface, so replacing a
  fixture with Socket.IO does not change their Match logic.
- Reconnect and revision behavior remains local to the production transport,
  while the fixture authority can test Match semantics without reimplementing
  connection mechanics.
- Transport delivery has one shared implementation and focused tests for
  connection changes, notification delivery, and unsubscribe behavior.
- The optional fixture capability is intentionally a development seam, not a
  production gameplay contract.

## Follow-up

Before horizontally scaling the realtime path, add sticky-session or shared
pub/sub support for game socket fan-out, collaboration documents, team chat,
and their process-local rate limits. Keep those deployment changes separate
from the UI transport seam.
