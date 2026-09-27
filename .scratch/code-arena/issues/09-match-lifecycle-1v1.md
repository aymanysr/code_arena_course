# 09. Match lifecycle 1v1 (phases, timers, rotation, results)

Status: ready-for-agent
Category: 1v1 match lifecycle
Week 2: yes
Blocked by: 04, 07, 10

## Scope

Authoritative 1v1 match machine from lobby handoff to terminal result: `ROUND_INTRO` (Start round gates play) → `CODING` ⇄ `RUNNING_TESTS` (07) → `SUBMITTED` → `EVALUATING` → `SCORE_REVEAL` (08/10) → next round intro (new problem, starter restored, tests idle, reveal cleared, match score kept) or match end. One server-owned match-wide `MATCH_DURATION` countdown (default 30:00, configurable, shared across all rounds); browser clocks display only. Terminal results persist exactly once; game restart interrupts unfinished matches with no fabricated result. All transitions broadcast per the 03 event catalog.

## Acceptance criteria

- [ ] Full 1v1 duel playable end-to-end (entry → 3 rounds → reveal → terminal result) against real judging.
- [ ] Illegal transitions rejected (only `CODING` runs/submits); rotation resets verified; cumulative totals shown from first reveal.
- [ ] Timer expiry, injected-clock tests for deadline boundaries, and exactly-once result persistence (including restart-after-completion).
- [ ] Restart-during-match marks matches interrupted with no win/loss.

## Notes

Integrates 04 (entry), 07 (run), 10 (scoring). 12 integrates its UI against this lifecycle.

## Comments

2026-09-23 (IN PROGRESS — engine integration green): `test/lifecycle-1v1.test.ts` proves problem→run→submit→sealed→reveal ×3 → final with the real bank record, scripted judge, server 30:00 clock (monotonic, never reset), all arena events, and timeout behavior. `test/container-judge.test.ts` proves real isolated execution (Python snippet grading + C/C++ stdio + TLE/compile-error mapping). Remaining for closure: HTTP/socket transport in `services/game`, `SocketArenaTransport` in frontend, 4-viewport Playwright pass. No auth code; principal fixture only.

2026-09-24 (E2E CLOSED — full duel green live): `frontend/e2e/live-1v1.spec.ts` 4/4 widths pass (1440/1024/768/320, 17.5s total, zero console/page errors asserted per run) against real judging + Postgres: entry → 3× (start → run → concurrent submits → auto-reveal) → final `300/84` + `MATCH_COMPLETE`. Two live bugs found and fixed: (1) `SocketArenaTransport` passed the server `RevealSnapshot` (per-side maps) straight into `RevealView` and crashed `RoundScoreReveal` (`groups.map is not a function`) — fixed by `adaptReveal()` in `frontend/src/arena/socket.ts` (server scores/groups/totals → viewer-side `RevealView`), pinned by new `frontend/src/arena/socket.test.ts` (3 tests, failing-first). (2) Final-round reveal rendered no advance control (`round < totalRounds` gate), leaving `MATCH_COMPLETE` unreachable via UI — `ArenaPage.tsx` now always renders the advance button (`Next round`, final round: `See final result`). Spec flow corrected: second client follows into CODING via socket (no second Start click — the button vanishes once the round starts), hidden-marker list no longer treats intentionally-visible group display names as leaks. Criterion map: full duel E2E ✓ (this run); illegal transitions + rotation + cumulative totals ✓ (`test/lifecycle-1v1.test.ts`, totals visible from first reveal in E2E); timer/injected-clock + exactly-once persistence incl. restart ✓ (lifecycle + `service.test.ts` 4/4, green in today's workspace run); restart-during-match interruption marking still open — not claimed. Live incident re-verified: concurrent-submit lost update stays fixed (`test/concurrency.test.ts` green in workspace run).
