# Extract 2v2 collaboration as a deep Game module

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`ArenaEngine` had already delegated durable Match state, membership, and
Round rules, but it still directly managed the complete 2v2 collaboration
workflow: lazy Yjs loading, application revision changes, readiness
invalidation, language starter replacement, atomic persistence rollback,
authoritative submission snapshots, and masked team views. Those rules change
together and form one domain seam, while Match locking and transport events
belong to the facade.

## Decision

- Introduce `TeamCollaboration` as the Game-owned 2v2 collaboration module.
- Keep Yjs memory state inside the module and use the existing
  `MatchPersistence.commitMatchAndTeamDocuments` seam for durable state.
- Keep trusted-principal membership checks, short per-Match locking, ordinary
  Match persistence, and event emission in `ArenaEngine`.
- Keep the existing public `ArenaEngine` methods and `MatchRecord` JSONB schema.
- Keep opponent masking, current-round rejection, revision-gated readiness,
  and authoritative frozen submission source behavior unchanged.
- Treat this as a domain-module extraction, not a new 42 subject module
  claim.

## Consequences

- Collaboration behavior is testable through a focused interface without
  constructing `ArenaEngine`, Socket.IO, or a judge.
- Changes to Yjs loading, revision invalidation, language reset, and rollback
  stay local to one implementation.
- `ArenaEngine` coordinates authorization, locking, persistence of ordinary
  Match state, and post-commit events through a smaller facade surface.
- Cross-process Match locking and realtime scale-out remain open follow-ups.

## Evidence

- `packages/arena-game/src/team-collaboration.ts`
- `packages/arena-game/test/team-collaboration.test.ts`
- `packages/arena-game/src/engine.ts`
- `CONTEXT.md` glossary
- `.scratch/code-arena/issues/22-team-collaboration-module.md`
