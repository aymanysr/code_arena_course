# Match deadline, Lobby reconciliation, and event convergence

Accepted 2026-09-27 during the Code Arena implementation follow-up.

## Context

The shared Match clock, Lobby socket messages, and Match live events cross
process and client boundaries. Their behavior must remain server-owned when a
player submits at the deadline, receives Lobby messages out of order, or
misses an event while disconnected. The first-release specification excludes
automatic matchmaking, while the existing backend queue remains useful for a
future release.

## Decision

- At the exact Match deadline, reject new Run and Submit commands. A Submission
  accepted before the deadline may count if its judge result commits no later
  than the configured reveal-grace boundary. Use the acceptance timestamp for
  the scoring-time tie-break.
- After reveal grace, complete an expired Match durably without player action.
  Persist the current Round's Reveal, then save the terminal Match state and
  final result through the normal Match persistence boundary. If that Match
  write fails, a later sweep resumes from the persisted Reveal. If expiration
  occurs in Match Found or Round Intro, save a zero-score Reveal. Rounds that
  were never played contribute zero. Show the terminal Reveal before the
  final result in the UI.
- Keep `ArenaEngine` as the owner of gameplay events and
  `MatchAuthority` as the owner of Match locks, persistence, and revisions.
  Buffer events until the command's durable write succeeds, stamp them with
  the revision read after commit, and isolate listener failures. Events remain
  transient; reconnect and refresh recover from the latest authoritative
  snapshot. Do not add a durable outbox in this release.
- Let the Lobby active-state endpoint own the rendered Lobby snapshot. Socket
  updates and room-state mutations trigger an authoritative fetch; discard a
  response when a newer request has already started. Rejoin the active room
  channel after reconnect and hand off to a Match at most once. The Start Match
  response may route using its server-committed Match ID.
- Keep public queue service and API code, but hide queue entry from the
  first-release Lobby. Cancel a recovered legacy waiting entry so it cannot
  continue automatic matchmaking in the invite-only flow. Preserve recovery
  of a player whose queue entry was already matched.
- Preserve the current Match JSONB schema and 42 subject-module matrix. These
  changes do not add a claimed module.

## Consequences

- Submission acceptance time and judge-completion time serve different rules:
  the former determines tie-break speed, while the latter decides whether a
  deadline result falls within reveal grace.
- A failed Match commit publishes no event. A missed or failed live delivery
  can leave clients temporarily stale until the next authoritative refresh;
  durable replay of every individual event is out of scope.
- Reveal and terminal Match persistence are separate writes. If the terminal
  Match save fails after the Reveal is persisted, the idempotent deadline sweep
  uses that saved Reveal to finish the Match without publishing early events.
- The Lobby reconciler is testable through an injected client port and owns
  request ordering, room-channel membership, and Match handoff. The React page
  renders its snapshot and keeps only form presentation state.
- Direct backend access to the public queue remains possible for existing
  integrations and tests; the first-release frontend does not expose it.

## Evidence

- `packages/arena-game/src/engine.ts`
- `packages/arena-game/src/evaluation-orchestration.ts`
- `packages/arena-game/src/match-authority.ts`
- `packages/arena-game/src/round-lifecycle.ts`
- `packages/arena-game/test/deadline-closure.test.ts`
- `packages/arena-game/test/post-commit-events.test.ts`
- `frontend/src/arena/lobby-session.ts`
- `frontend/src/arena/lobby-session.test.ts`
- `frontend/src/components/LobbyPage.tsx`
- `frontend/e2e/live-lobby.spec.ts`
