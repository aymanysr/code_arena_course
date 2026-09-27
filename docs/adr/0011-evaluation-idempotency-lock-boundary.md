# Keep evaluation retries outside the Match lock

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`ArenaEngine.submit` has three distinct phases: accept and persist the
submission, run the hidden judge, and commit the verdict. The judge must stay
outside the short Match lock so another side can continue. A same-process retry
of an in-flight evaluation used to await the original promise while still
holding that lock. The original evaluation then could not re-enter the lock to
commit, leaving both requests waiting indefinitely.

The persistence contract already treats submission and evaluation identifiers
as immutable request keys. The engine also needed to enforce that contract
before attaching an in-flight or completed retry.

## Decision

- Keep acceptance and verdict commit under separate short Match-lock phases.
- When a retry finds an in-flight evaluation, validate its Match, Round,
  problem version, side, submission ID, language, document revision, and
  source hash, then return a wait handle from the locked phase.
- Await that handle only after the Match lock has been released, then load the
  stored outcome and return the original receipt or replay the original judge
  error.
- Apply the same immutable-identity check to pending and terminal persisted
  rows, including the problem version. Reusing an identifier with different submission data raises
  `DuplicateError` and never starts a second judge attempt.
- Give restart recovery the same in-flight identity metadata so recovery and
  live retries share the same safety boundary.
- Preserve the existing public `ArenaEngine.submit` receipt and
  `MatchRecord`/`SubmissionRecord` schemas.
- Treat this as an evaluation-orchestration boundary improvement, not a new
  42 subject module claim.
- Coordinate pending evaluations across Game processes through
  `MatchPersistence.claimPendingEvaluation`. The Postgres adapter holds a
  session advisory lock keyed by `evaluationId` on a dedicated client through
  judge and the final Submission+Match transaction; claim clients use a
  separate pool so long-running judges cannot starve ordinary persistence
  writes. The claim handle detects a lost database session, and the engine
  leaves the row pending for takeover rather than committing under stale
  ownership. No table, column, or public record schema changes are required.
  The in-memory adapter supplies a process-local equivalent.
- If a second process finds the evaluation already terminal after waiting for
  the claim, it returns the stored outcome without judging. If claim
  acquisition fails during recovery, the pending row remains pending and the
  infrastructure error is surfaced; it is not fabricated as a judge failure.
- Ordinary Match writes now use an optimistic expected-revision compare-and-save
  through `MatchAuthority`. A stale writer receives a typed 409 conflict rather
  than overwriting newer state; claim-owned Evaluation commits remain on the
  claim-session transaction seam.

## Consequences

- Same-process lost-ack retries cannot deadlock the Match lock.
- Request IDs now bind to the exact accepted submission payload, preventing
  accidental or malicious identifier reuse from returning another request's
  result.
- The judge remains parallel across sides and the existing recovery path keeps
  re-driving pending rows under their original identifiers.
- While the claim session survives, two Game processes cannot both own and
  invoke the judge for the same pending evaluation. If the session dies after
  the judge has started, a replacement may re-drive the pending row; the
  stale owner's claim-session commit is rejected, so only a live owner can
  publish the durable result.
- Claim-session capacity is isolated from the write pool, at the cost of a
  second pool's database-connection budget per Game process.
- Optimistic revision checks prevent ordinary stale overwrites, but they do not
  merge arbitrary concurrent commands or provide horizontal realtime fan-out.
  Sticky sessions/shared pub-sub and a broader command-coordination policy are
  still required before unrestricted horizontal Match mutation is enabled.

## Evidence

- `packages/arena-game/src/engine.ts`
- `packages/arena-game/test/submit-path.test.ts`
- `packages/arena-game/test/reconnect.test.ts`
- `packages/arena-game/test/concurrency.test.ts`
- `packages/arena-game/test/postgres.test.ts`
- `packages/arena-game/src/persistence.ts`
- `packages/arena-game/src/postgres-store.ts`
- `packages/arena-game/src/match-authority.ts`
- `packages/arena-game/test/match-revision.test.ts`
- `frontend/src/arena/socket.ts`
- `CONTEXT.md` glossary
- `.scratch/code-arena/issues/25-evaluation-idempotency-lock-boundary.md`

## Amendment 2026-09-25 (ordinary Match revision safety)

The cross-process follow-up now has an optimistic safety boundary for ordinary
Match snapshots: in-memory and PostgreSQL persistence compare the stored
revision before replacing a row, and `MatchAuthority` supplies the revision
observed at the start of its short lock. A conflict is surfaced as 409 and the
frontend refreshes without automatically replaying the command. Only idempotent
boot recovery and grace-triggered snapshot reads retry by reloading after such
a conflict. This closes stale overwrites; it does not claim conflict-free
horizontal command routing or realtime scale-out.
