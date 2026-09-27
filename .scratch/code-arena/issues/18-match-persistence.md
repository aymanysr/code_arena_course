# 18. Match persistence deep module

Status: FIRST TWO SLICES COMPLETE — EVALUATION CLAIM COMPLETE; BROADER CROSS-PROCESS LOCKING OPEN (2026-09-25)
Category: architecture / persistence
Week 2: yes (supports the 1v1 slice without changing the schema)
Blocked by: none

## Scope

Give the Game Match authority one persistence interface. The module owns
durable Match/Round records, Submissions, Reveals, shared team documents, and
failure history. It preserves the current JSONB schema and keeps Postgres and
in-memory implementations substitutable.

## Acceptance criteria

- [x] `ArenaEngine` uses one `MatchPersistence` seam.
- [x] Production `PostgresStores.persistence` supplies the same seam as tests.
- [x] Match + shared-document commits use the existing Postgres transaction.
- [x] Replaying the same immutable Submission/evaluation request is safe.
- [x] Reusing an identifier with different data fails with `DuplicateError`.
- [x] Contract tests cover the in-memory implementation and the Postgres path
      when the test database is available.
- [x] `MatchAuthority` owns trusted membership, Match loading, per-Match
      command serialization, current-Round lookup, and revision stamping.
- [x] Existing `ArenaEngine` methods remain the compatibility facade.
- [x] `RoundLifecycle` owns focused Round transitions and Game-side scoring;
      the Match persistence boundary remains unchanged.
- [x] Pending evaluations have one live cross-process claim owner before judge
      execution; a lost session leaves the row reclaimable and the Postgres
      implementation preserves the existing schema.
- [ ] Add a cross-process row-lock or optimistic-revision protocol before
      horizontally mutating the same Match from multiple Game instances.
- [ ] Remove legacy individual-store constructor fields after downstream
      callers migrate to `persistence`.

## Decisions

- Match authority decides transition validity; persistence decides durability.
- Presence, transport, Lobby queues, and judge execution stay outside the
  persistence module.
- Judge execution stays outside the database transaction.
- MatchRecord JSONB remains canonical; existing relational uniqueness/index
  tables stay in place.
- Long-lived PostgreSQL evaluation claims use a separate connection pool from
  ordinary Match/Submission writes. Lost claim sessions are surfaced to the
  engine before commit, and the pending row remains reclaimable.

## Evidence

- `packages/arena-game/src/persistence.ts`
- `packages/arena-game/test/persistence.test.ts`
- `docs/adr/0004-game-match-persistence-module.md`
- `docs/adr/0011-evaluation-idempotency-lock-boundary.md`
- `CONTEXT.md` glossary and `.scratch/code-arena/spec.md` decision 13
