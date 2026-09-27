# 21. Round lifecycle deep module

Status: FIRST SLICE COMPLETE — CROSS-PROCESS LOCKING OPEN (2026-09-25)
Category: architecture / Match lifecycle
Week 2: yes (preserves the playable 1v1 path)
Blocked by: none

## Scope

Give the Game-owned Match engine one focused Round lifecycle module. The
module owns phase-transition rules, reveal state, round reset rules,
Game-side verdict scoring, cumulative totals, and final-result tie-breaks.
`ArenaEngine` remains the compatibility facade and keeps membership,
serialization, persistence, collaboration cleanup, event emission, and judge
execution at their existing seams.

## Acceptance criteria

- [x] `RoundLifecycle` owns Round phase transitions, reveal preparation and
      commit, next-round reset rules, scoring, totals, and final results.
- [x] `ArenaEngine` delegates to the module without changing its public API.
- [x] The MatchRecord JSONB schema and phase/scoring behavior are preserved.
- [x] Focused lifecycle/scoring tests cover the new interface.
- [x] Existing Arena lifecycle, 2v2, reconnect, collaboration, and submit
      tests remain green when the local judge/database prerequisites are
      available.
- [ ] Add the cross-process row-lock or optimistic-revision protocol before
      horizontally mutating the same Match from multiple Game instances.

## Decisions

- Round rules form a domain seam, not a transport or persistence seam.
- Long-running judge work stays outside the module and outside the database
  transaction.
- No 42 subject module row is promoted by this extraction.

## Evidence

- `packages/arena-game/src/round-lifecycle.ts`
- `packages/arena-game/test/round-lifecycle.test.ts`
- `packages/arena-game/src/engine.ts`
- `docs/adr/0007-round-lifecycle-module.md`
