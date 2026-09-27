# 14. 2v2 presence and readiness

Status: complete (2026-09-24, ticket-14 domain foundation)
Category: 2v2 presence/readiness
Week 2: no
Blocked by: 09, 12

## Scope

2v2 multiplayer interaction layer: per-player presence (online/offline, separate from gameplay status), per-player readiness with both-required submit gating enforced live, per-round readiness reset, single-toolbar submit enablement with the waiting/ready helper text, and both-teams status display through Coding → Running → Submitted → Evaluating → Locked in with one shared Team Alpha score. Reuses the 04 lobby sides and the 09 lifecycle extended to two teams.

## Acceptance criteria

- [ ] Submit enables only with both teammates Ready (server-enforced per 08); readiness resets each round; helper text tracks state.
- [ ] Presence flaps never corrupt gameplay status; status display uses the canonical labels for both teams.
- [ ] Full 2v2 match (both sides live) completes with one shared team score per side.

## Notes

Week 3, after the 1v1 slice. Only the multiplayer interaction layer differs — problem/editor/test architecture stays shared per the reference.

## Comments

- 2026-09-24: verified — 31 engine tests, 8 service/socket tests, 4-client
  live proof + all 1v1 e2e green, workspace 234 green, typecheck/lint/build
  clean. Teams ARE sides (sideId = team identity, participants[] =
  membership). Strict rule: any team-doc edit invalidates BOTH approvals.
  No Yjs installed; editor stays a local mock source (stated in UI code).
