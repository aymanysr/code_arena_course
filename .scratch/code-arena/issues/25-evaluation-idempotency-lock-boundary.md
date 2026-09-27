# 25. Evaluation idempotency lock boundary

Status: EVALUATION CLAIM + ORDINARY MATCH REVISION SAFETY COMPLETE — BROADER HORIZONTAL REALTIME COORDINATION OPEN (2026-09-25)
Category: architecture / submit and evaluation orchestration
Week 2: yes (preserves the playable 1v1 and 2v2 paths)
Blocked by: none

## Scope

Make evaluation retries safe around the short Match lock. The engine accepts
and records a submission under the lock, runs the judge lock-free, and commits
under a fresh lock. Same-identity retries wait outside the lock; a reused
identifier with different immutable submission data is rejected.

## Acceptance criteria

- [x] An in-flight retry cannot hold the Match lock while waiting for the
      original evaluation to commit.
- [x] Same-identity in-flight retries return one original receipt and invoke
      the judge once.
- [x] In-flight and completed identifier collisions with different submission
      data are rejected.
- [x] A waiting retry receives the original judge failure instead of a false
      success receipt.
- [x] Restart recovery carries the identity metadata required by the same
      boundary.
- [x] Existing submit, concurrency, reconnect, Postgres, and service tests
      remain green.
- [x] Add a cross-process claim/lock protocol so two live Game processes cannot
      own and judge the same pending evaluation concurrently; a stale owner
      cannot commit after its claim session is lost.
- [x] Add optimistic revision checks for ordinary Match writes so a stale
      snapshot cannot overwrite a newer Match; surface conflicts without a
      silent non-idempotent replay.

## Decisions

- Request identifiers are immutable idempotency keys, not aliases for arbitrary
  later payloads.
- Long-running judge work never runs while holding the Match lock.
- PostgreSQL claims pending evaluations with a session advisory lock keyed by
  evaluation ID on a separate claim pool; the existing JSONB and
  SubmissionRecord schemas remain unchanged. Lost claim sessions are detected
  before judge and by the final Submission+Match transaction, claim cleanup is
  idempotent, and claim-acquisition or ownership errors during recovery leave
  the row pending.
- No 42 subject module row is promoted by this improvement.
- Ordinary Match revision safety is conflict detection, not an automatic merge
  policy. Sticky sessions/shared pub-sub and broader horizontal command
  coordination remain outside this issue. Only idempotent recovery and
  grace-triggered snapshot reads retry after a conflict; gameplay commands do
  not replay automatically.

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
- `docs/adr/0011-evaluation-idempotency-lock-boundary.md`
- `docs/adr/0012-evaluation-and-judge-adapter-deepening.md`
