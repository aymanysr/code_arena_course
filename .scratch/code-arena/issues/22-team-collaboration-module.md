# 22. Team collaboration deep module

Status: FIRST SLICE COMPLETE — CROSS-PROCESS LOCKING OPEN (2026-09-25)
Category: architecture / 2v2 collaboration
Week 2: yes (keeps the playable 1v1 path unchanged)
Blocked by: none

## Scope

Give the Game-owned Match engine one focused 2v2 collaboration module.
`TeamCollaboration` owns Yjs document loading, authoritative application
revisions, readiness invalidation, team-language starter replacement, atomic
document persistence and rollback, authoritative submission snapshots, and
masked team views. `ArenaEngine` remains the compatibility facade and keeps
membership, Match locking, ordinary Match persistence, and event emission.

## Acceptance criteria

- [x] `TeamCollaboration` owns collaboration document loading and Yjs update
      application behind a focused interface.
- [x] Readiness, revision, language, submission-source, and opponent-masking
      rules stay in the module.
- [x] `ArenaEngine` delegates without changing its public methods or payloads.
- [x] The MatchRecord JSONB schema and collaboration behavior are preserved.
- [x] Focused module tests cover authoritative updates and submission snapshots.
- [x] Existing 2v2 collaboration, team, submit, reconnect, and 1v1 tests stay
      green when Docker/Postgres prerequisites are available.
- [ ] Add the cross-process row-lock or optimistic-revision protocol before
      horizontally mutating the same Match from multiple Game instances.

## Decisions

- Collaboration rules form a domain seam, not a second persistence seam.
- The module consumes `MatchPersistence.commitMatchAndTeamDocuments` so the
  Match row and shared-document row remain one transaction.
- No 42 subject module row is promoted by this extraction.

## Evidence

- `packages/arena-game/src/team-collaboration.ts`
- `packages/arena-game/test/team-collaboration.test.ts`
- `packages/arena-game/src/engine.ts`
- `docs/adr/0008-team-collaboration-module.md`
