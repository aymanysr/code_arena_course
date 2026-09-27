# 24. Arena live sidecar lifecycle module

Status: FIRST SLICE COMPLETE (2026-09-25)
Category: architecture / frontend realtime lifecycle
Week 2: yes (preserves 1v1 and mock UI behavior)
Blocked by: none

## Scope

Extract live collaboration and team-chat client creation, replacement,
cancellation, and cleanup from `ArenaPage` into a small frontend lifecycle
module. Collaboration is Round-scoped; team chat is Match-scoped.

## Acceptance criteria

- [x] Collaboration clients are replaced when the Round changes.
- [x] Match chat survives a Round change and is disposed on Match or transport
      replacement.
- [x] Stale factory resolutions are cancelled and disconnected.
- [x] 1v1 and mock transports create no live sidecars.
- [x] Focused lifecycle tests, the full frontend suite, lint, and typecheck
      pass.
- [x] The existing `ArenaPage` browser handles and client subscriptions remain
      compatible.

## Decisions

- Factories are injected at the lifecycle seam so scope rules are independently
  testable.
- The module owns client lifetime, not transport authorization or chat/editor
  semantics.
- No 42 subject module row is promoted by this extraction.

## Evidence

- `frontend/src/arena/sidecars.ts`
- `frontend/src/arena/sidecars.test.ts`
- `frontend/src/components/ArenaPage.tsx`
- `docs/adr/0010-arena-sidecar-lifecycle-module.md`
