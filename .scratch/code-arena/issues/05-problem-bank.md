# 05. Curated problem bank (format, seed content, licensing)

Status: ready-for-agent
Category: problem bank
Week 2: yes (≥1 playable problem; full bank week 3)
Week 2 minimum: one fully worked problem (statement, examples, constraints, starters for C++/Python/C, visible tests, weighted hidden groups with reference verdicts).
Blocked by: none

## Scope

Problem record format (statement, examples, constraints, per-language starters, visible tests, weighted hidden groups, limits) plus seed content. All content is original or compatibly licensed — never copied from LeetCode or other third-party banks; record provenance per problem. Hidden tests are sealed data under the same access discipline as private match state. Conform to the 03 event/model shapes for round delivery.

## Acceptance criteria

- [ ] Format documented; ≥1 problem complete with verified visible tests and hidden-group verdicts reproduced by the judge (06).
- [ ] Provenance recorded per problem; no third-party content (license spot-check).
- [ ] Hidden groups unreachable through any run-path payload (asserted with 07/08).
- [ ] Rotation across 3 rounds serves distinct problems (supports 09/10).

## Notes

Content work, not a decision blocker. Full bank depth (3+ problems) lands week 3.

## Comments

2026-09-23 (Wave 0): format defined as `packages/problem-bank/schema.json`; seed problem `even-ledger` (original content, provenance recorded) authored with 3 visible + 7 hidden tests across 3 groups (weights 40/30/30). All 10 expected outputs machine-verified against the alternating-sum rule; weights sum to 100. Remaining for close-out: judge-06 reproduction of verdicts, bank growth to 3+ problems, and loader wiring (01/06). Note: the frozen reference's three problems are known third-party tasks, so none were carried over — the bank starts original.
