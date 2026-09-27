# Extract Round lifecycle as a deep Game module

Accepted 2026-09-25 during the Code Arena architecture review.

## Context

`ArenaEngine` already delegates durable state to `MatchPersistence` and
membership/serialization to `MatchAuthority`, but it still owned several
different Round concepts directly: phase transitions, reveal construction,
round resets, verdict scoring, cumulative totals, and final-result tie-breaks.
Those rules changed together but were mixed with locks, persistence calls,
Socket.IO-facing events, collaboration cleanup, and judge execution.

## Decision

- Introduce `RoundLifecycle` as the deep domain module for Match/Round state
  transitions, reveal state, round reset rules, Game-side verdict scoring, and
  final-result calculation.
- Keep `ArenaEngine` as the compatibility facade. It remains responsible for
  trusted membership, per-Match locking, persistence, event emission,
  collaboration cleanup, and the long-running judge call.
- Keep `MatchPersistence`, `MatchAuthority`, `GameJudge`, and Socket.IO
  gateways behind their existing seams. `RoundLifecycle` does not know their
  implementations.
- Preserve the existing MatchRecord JSONB schema, public ArenaEngine methods,
  phase machine, scoring/tie-break behavior, and hidden-suite boundaries.
- Treat `RoundLifecycle` as a domain module, not a new 42 subject module
  claim. This extraction improves locality and test surface without changing
  the subject-module matrix.

## Consequences

- Round rules can be tested through one focused interface without constructing
  persistence, sockets, or a judge.
- `ArenaEngine` coordinates the workflow while `RoundLifecycle` hides the
  details of phase legality, reveal snapshots, round resets, and scoring.
- Judge failures still return the same `JudgeInfraError` path, and the judge
  remains outside the persistence transaction.
- Cross-process Match locking, external authentication, and realtime scale-out
  remain unchanged follow-ups.

## Evidence

- `packages/arena-game/src/round-lifecycle.ts`
- `packages/arena-game/test/round-lifecycle.test.ts`
- `packages/arena-game/src/engine.ts`
- `CONTEXT.md` glossary
- `.scratch/code-arena/issues/21-round-lifecycle-module.md`
