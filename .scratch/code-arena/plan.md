# Code Arena — implementation plan

Date: 2026-09-23. Sources: `.scratch/code-arena/spec.md` (defaults resolved), `CONTEXT.md`, ADR-0001 (amended), ADR-0002, ADR-0003 (amended), frozen reference `prototype/game-ui/09-arena.html`.

Gate: implementation starts after team sign-off on the spec. No production code is written by this plan; it orders the work.

## Dependency graph

```
01 infra ──► 02 auth ──► 04 entry/lobby ──────────────────┐
                                                          ▼
03 state model ──► 06 judge spike ──► 07 run path ─────────┤
                        │              (03 also feeds      │
                        ▼               07 directly)       ▼
                 08 submit path ──► 10 scoring/reveal ──► 09 lifecycle-1v1 ◄── 12 frontend
                 ▲                                                      (mock-first      │
05 problem bank ─┘                                                       from 03,         ├─► 11 reconnect
                                                                        integrate        ├─► 14 presence/readiness ──► 15 shared doc
                                                                        after 09)        ├─► 16 team chat
                                                                                         └─► 13 editor (Monaco)

17 tests/security/compliance runs alongside everything; final gate before freeze.
```

Edges (ticket → blocked by): 02→01; 04→02,03; 06→03; 07→03,06; 08→03,06; 10→03,08; 09→04,07,10; 12→03 (integrate ←09); 11→02,09; 13→12; 14→09,12; 15→09,14; 16→04,09; 17→none (transversal). 01, 03, 05 start unblocked.

## Critical path

Longest chain to the Week-2 duel: **03 → 06 → 08 → 10 → 09** (state model, judge spike, submit path, scoring, lifecycle), tied with **01 → 02 → 04 → 09** (infra, auth, entry). 05 (one playable problem) and 07 (run path) must also land before 09 closes; 12 integrates with 09. Any slip on 03, 06, or 08 moves Week 2.

## Week-2 minimum playable slice

One complete 1v1 duel end-to-end with real judging. Required tickets: **01, 02, 03, 04, 05 (≥1 playable problem), 06, 07, 08, 09, 10, 12 (integrated), 17 (1v1-scope verification)**. Explicitly deferred: reconnect grace/resume (11), Monaco upgrade (13 — textarea-behind-seam ships first), all 2v2 work (14, 15, 16), OAuth UI (email/password only on the path).

Week-2 exit proof is the full loop, which 09 must demonstrate against the real stack: problem loaded → player codes → Run visible tests → Submit → isolated judge executes hidden suite → verdict/group scores returned → game service owns match state + reveal → next round → final result. Judge isolation and game orchestration stay separated across this path (06/07/08 vs 09/10). 2v2 then extends this proven loop; it is not a second architecture.

## Parallel tracks

- Wave 0 (start now, no blockers): 01 infra, 03 state model, 05 problem bank, 17 verification scaffolding.
- Wave 1: 02 auth (←01), 06 judge spike (←03), 12 frontend mock-first (←03).
- Wave 2: 04 entry (←02,03), 07 run (←03,06), 08 submit (←03,06).
- Wave 3: 10 scoring (←03,08), then 09 lifecycle (←04,07,10) with 12 integration.
- Week 3: 11 reconnect, 13 editor, 14 presence/readiness, 15 shared doc, 16 chat; 17 final gate.
- Staffing note: keep contributors off the same chain (e.g. whoever takes 06 should not also take 08/10); 01/02 suit the core/deployment owner, 12–16 the frontend owner, 06–10 the game-service owner.

## Ticket index

| # | Ticket | Category | Week 2 |
| --- | --- | --- | --- |
| 01 | compose-infra | foundation | yes |
| 02 | core-auth | foundation | yes |
| 03 | domain-state-model | domain/state model | yes |
| 04 | entry-lobby | 1v1 match lifecycle (entry) | yes |
| 05 | problem-bank | problem bank | yes (≥1 problem) |
| 06 | judge-contract-spike | judge contract + isolation spike | yes |
| 07 | run-path | Run path | yes |
| 08 | submit-hidden-path | Submit/hidden-suite path | yes |
| 09 | match-lifecycle-1v1 | 1v1 match lifecycle | yes |
| 10 | scoring-reveal | scoring/reveal | yes |
| 11 | reconnect-recovery | reconnect/recovery | no |
| 12 | frontend-arena-port | frontend Arena port | yes |
| 13 | editor-integration | editor integration | no |
| 14 | presence-readiness-2v2 | 2v2 presence/readiness | no |
| 15 | shared-editor-collab | shared editor collaboration | no |
| 16 | team-chat | team chat/pings | no |
| 17 | tests-security-compliance | tests/security/compliance | yes (1v1 scope) |

Ticket files live under `.scratch/code-arena/issues/`, one file per ticket, each declaring its own `Blocked by` edges. A ticket may be taken when every ticket it lists is done.

## Wave-0 exit criteria (gate before Wave 1)

All four must be green together, or Wave 1 carries foundational uncertainty:

1. `arena-model` imports cleanly across the workspace (services and harness resolve the shared package at install, typecheck, test, and container runtime).
2. `problem-bank` validates in CI (schema keys, starters, weight sums, provenance for every record).
3. Compose stack boots from a clean checkout (`docker compose up --build` after documented configuration; health/readiness endpoints answer through Nginx).
4. Harness drives a mocked full 1v1 lifecycle (fixture problem → code → Run → Submit → verdict → reveal → next round → final result, with failure capture).
