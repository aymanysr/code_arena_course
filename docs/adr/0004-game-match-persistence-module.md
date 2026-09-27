# Make Match persistence a deep module

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`ArenaEngine` previously coordinated separate `MatchStore`, `SubmissionStore`,
`RevealStore`, and shared-document persistence adapters. It also received a
special callback for the atomic MatchRecord + collaboration commit. That made
the authority module know too much about storage implementations and made
idempotency rules easy to spread across the engine and adapters.

## Decision

- Introduce one domain-shaped `MatchPersistence` interface.
- Keep the Match authority behind the `ArenaEngine` facade: `MatchAuthority`
  validates membership and serializes commands, while `RoundLifecycle` owns
  phase, Round transitions, scoring, and Reveal rules.
- Keep durable ownership in Match persistence: Match/Round records,
  Submissions, Reveals, shared team documents, and failure history carried by
  the MatchRecord.
- Keep Presence, transport, Lobby queues, and judge execution outside the
  persistence module. Judge execution remains outside the database transaction.
- Preserve the current MatchRecord JSONB schema and existing relational
  indexes/uniqueness constraints. This refactor does not introduce a schema
  migration.
- Make Submission and evaluation identifiers safe retry keys. Replaying the
  same immutable request returns the stored row; reusing an identifier for
  different data fails with `DuplicateError`.
- Keep Postgres and in-memory implementations behind the same interface. The
  Postgres implementation supplies the MatchRecord + shared-document
  transaction; the in-memory implementation relies on the engine's per-Match
  lock for test-local atomicity.
- Keep the old individual-store constructor fields as a temporary migration
  adapter. New production wiring passes `PostgresStores.persistence` directly;
  the compatibility path can be removed after downstream callers migrate.

## Consequences

- `ArenaEngine` has one persistence seam and no longer coordinates individual
  storage adapters directly.
- Contract tests can exercise the same idempotency and durable-state behavior
  against in-memory and Postgres implementations.
- Storage details stay local to the persistence implementation, which leaves
  future row-lock or optimistic-concurrency work in one module.
- The first change improves locality without changing the public MatchRecord
  schema or the Game domain behavior.

## Amendment 2026-09-25 (cross-process evaluation claim)

`MatchPersistence` now exposes `claimPendingEvaluation` so Submit and restart
recovery acquire one owner before invoking a hidden judge. The Postgres adapter
uses a session advisory lock keyed by the immutable evaluation ID and keeps its
client checked out through judge and commit; a lost client releases ownership
automatically. The in-memory adapter provides the equivalent local claim
queue. This closes duplicate judge execution without changing the existing
JSONB or `SubmissionRecord` schemas. It does not serialize arbitrary
cross-process MatchRecord mutations; the broader row-lock or optimistic
revision follow-up remains required before horizontal Match mutation.

## Follow-up

The current engine lock serializes mutations within one process. Before
running multiple Game instances against the same Match, the persistence
implementation must add a cross-process concurrency protocol (row lock or
optimistic revision check) and a corresponding multi-instance test. That is a
follow-up inside this seam, not a reason to split Match state across more
modules.

## Amendment 2026-09-25 (Match authority extraction)

The existing `ArenaEngine` facade now delegates Match loading, trusted
membership resolution, side resolution, current-Round lookup, per-Match
serialization, and event revision stamping to `MatchAuthority`. This keeps the
public transport-facing methods stable while making the authority seam explicit.
Judge execution, Socket.IO, persistence adapters, and long-running waits stay
outside the module. The cross-process locking follow-up remains unchanged.

## Amendment 2026-09-25 (Round lifecycle extraction)

`RoundLifecycle` now owns the focused Round-domain rules that were previously
implemented inline in the facade: phase transitions, reveal preparation and
publication state, round resets, Game-side verdict scoring, cumulative totals,
and final-result tie-break calculation. `ArenaEngine` remains the compatibility
facade and still owns membership, per-Match locking, persistence, event
emission, collaboration cleanup, and long-running judge orchestration. This
does not change the MatchRecord schema or the persistence boundary.

## Amendment 2026-09-25 (optimistic ordinary Match writes)

`MatchPersistence.saveMatch` and the atomic Match-plus-document commit now
accept an optional expected revision. In-memory and Postgres adapters reject a
stale ordinary snapshot with `MatchRevisionConflictError` instead of
overwriting a newer Match. `MatchAuthority` stamps and compare-saves ordinary
locked mutations; claim-owned Evaluation commits remain on their existing
claim-session transaction seam. The existing JSONB schema is unchanged.

The frontend refreshes authoritative state after a 409 and rethrows the stale
command error; it does not automatically replay non-idempotent commands.
