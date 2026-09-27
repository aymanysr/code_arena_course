# Cross-process evaluation claim protocol

## Context

Graphify identifies `ArenaEngine` and `MatchRecord` as high-connectivity
bridges. The remaining correctness gap is that two Game processes can read
the same pending submission and both start the hidden judge. The existing
same-process in-flight guard does not coordinate separate processes.

## Goal

Make one pending evaluation have one active judge owner across Game
processes, while keeping the existing `MatchRecord`, `SubmissionRecord`, and
Postgres table schema unchanged.

## Global constraints

- Preserve the public submission and Match schemas.
- Keep the judge outside the short per-Match lock.
- Put durable coordination behind `MatchPersistence`.
- Use PostgreSQL as the source of truth; do not use Redis for evaluation
  ownership.
- A crashed process must release ownership automatically.
- Preserve existing receipts, retry behavior, and 42-subject module claims.
- Keep unrelated dirty and untracked workspace changes untouched.

## Task 1 — Add the persistence claim seam

Files: `packages/arena-game/src/persistence.ts`,
`packages/arena-game/test/persistence.test.ts`.

Add a domain-shaped `EvaluationClaim` handle and
`MatchPersistence.claimPendingEvaluation(evaluationId)`. The in-memory
adapter-backed implementation serializes claims locally and returns no claim
when the row is already terminal. Add contract tests for waiting behind an
active claim and for terminal rows.

Expected: focused persistence tests fail before the seam exists, then pass
after the minimal implementation.

## Task 2 — Implement the Postgres claim

Files: `packages/arena-game/src/postgres-store.ts`,
`packages/arena-game/test/postgres.test.ts`.

Use a PostgreSQL session advisory lock derived from `evaluationId`, held by a
dedicated checked-out client for the judge/commit window. After acquiring the
lock, re-read the submission and return a claim only if it is still pending.
Release the session lock and client through an idempotent claim handle. A
connection loss releases the advisory lock without a schema migration.

Expected: a Postgres persistence test shows that a second claimant waits,
then observes the terminal row without acquiring a second judge owner.

## Task 3 — Integrate claims into submit and recovery

Files: `packages/arena-game/src/engine.ts`,
`packages/arena-game/test/submit-path.test.ts`,
`packages/arena-game/test/postgres.test.ts`,
`packages/arena-game/test/reconnect.test.ts`.

Acquire a claim only after leaving the Match lock. Both normal Submit and
restart recovery must claim before invoking the judge. A loser waits outside
the Match lock, then returns the durable result; a crashed owner can be
reclaimed by a later process. Ensure every acquired claim is released in a
`finally` path and same-process in-flight retries keep their current behavior.

Add a two-engine Postgres regression proving one judge call for the same
evaluation and adjust the in-memory simulated-death fixture so it represents
an actually unclaimed pending row rather than a live parked evaluator.

Expected: focused red-green tests, then the full arena-game suite passes.

## Task 4 — Record the boundary and refresh the graph

Update ADR-0011, issue 25, `CONTEXT.md`, `.scratch/code-arena/spec.md`, and
`prototype/game-ui/42-subject-compliance.md` with the claim protocol and its
schema-preserving scope. Run Graphify update and diagnose; confirm no
dangling or collapsed references.

## Verification

- `npm test --workspace arena-game`
- `npm run typecheck --workspace arena-game-engine`
- `npm run typecheck --workspaces --if-present`
- `npm run build --workspaces --if-present`
- `npm test --workspace arena-frontend -- --run`
- `npm run lint --workspace arena-frontend`
- `git diff --check`
- Graphify update and diagnose

## Review focus

- No judge invocation occurs without a claim.
- No code waits for a claim while holding the Match lock.
- Claim release cannot fabricate a failed evaluation after a successful
  commit.
- The database schema and public receipt shapes remain unchanged.
- Two processes cannot both judge one pending evaluation, while a crashed
  process can be replaced.
