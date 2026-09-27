# 07. Run path (visible/example/custom tests, scoreless)

Status: ready-for-agent
Category: Run path
Week 2: yes
Blocked by: 03, 06

## Scope

Game-service orchestration of reference Run behavior: allowed only in `CODING`; sets tests to running and player status to Running; executes only visible/example/custom tests through the 06 contract; returns per-example output with runtime; restores `CODING`/Coding with editor contents intact. Custom-input runs evaluate visible behavior only. Rate limits per the plan (abuse without punishing legitimate use).

## Acceptance criteria

- [ ] Run rejected outside `CODING`; running state visible to the player (tests + status) during execution.
- [ ] Results show output and runtime per example with icon-plus-text statuses; idle→running→passed/failed transitions tested.
- [ ] Response payloads provably contain no hidden-test content (assert on payloads).
- [ ] Run never changes scores, phases beyond the running excursion, or editor contents.

## Notes

Builds on the 06 contract; pairs with 08 (submit) into the 09 lifecycle.

## Comments

2026-09-23 (COMPLETE): `packages/arena-game/` (`arena-game-engine`) implements the real Run path on `GameJudge`: trusted-principal → server-side membership/side resolution → round-CODING + side-coding gates → language/source validation → runId → side running → visible-tests-only judge call → `tests.updated` → side coding. Opponent fully independent throughout. Configurable per-side rate window + concurrent-run block. 9/9 acceptance tests green (`test/run-path.test.ts`); no auth code (test principal fixture per `docs/auth-game-contract.md`).
