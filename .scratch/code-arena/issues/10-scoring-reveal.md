# 10. Scoring and reveal (sums, tie-breaks, sealed disclosure)

Status: ready-for-agent
Category: scoring/reveal
Week 2: yes
Blocked by: 03, 08

## Scope

Pure scoring engine plus reveal payloads: round 0–100% from weighted hidden groups, every round normalized 0–100 with equal match weight (invariant — a 100–99 and a 100–20 round contribute exactly their margins); speed never decays correctness. Match result = sum of round scores. Tie-breaks: (1) total scoring-submission time — per round, the elapsed server time at which the side achieved its final (counted) score, summed across rounds (works at any score, not just 100%); (2) fewer total submissions across the match; then draw. Reveal discloses round percentages, group breakdown, and cumulative totals only at `SCORE_REVEAL`. Consumes the per-round counted score, scoring timestamp, and submission count recorded by 08; integrated by 09.

## Acceptance criteria

- [ ] Weighted-group math, sums, and both tie-breaks unit-tested including exact-tie draws and drawn rounds.
- [ ] No score, group, or cumulative value is derivable before reveal (payload + access tests).
- [ ] Scoring-submission timestamps are server-sourced; client values cannot influence them.
- [ ] Reveal payload matches what 12 renders (percentages, groups, cumulative).

## Notes

Kept separate from 09 so the math is testable without the lifecycle; 09 owns when reveal fires.

## Comments

2026-09-23 (COMPLETE): scoring delegates to `arena-model` (`roundScoreFromGroups`, `matchSum`, `compareSides`) — no duplicated formulas. Round 0–100, match = 3-round sum, tiebreaks final-score-time → fewer attempts → draw. Reveal only via `publishRoundReveal(CODING, REVEAL_CONDITION_MET)`; evaluation never auto-reveals. In-flight policy encoded + tested: closing blocks new submits, in-grace verdicts count, post-cutoff verdicts superseded (history only), one immutable snapshot, late verdicts never alter it. 12/12 tests green (`test/scoring-reveal.test.ts`).
