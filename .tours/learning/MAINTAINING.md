# Maintaining the Code Arena course

The build route is authored in `learning-path.json` and the `content/` lessons. The 14 reference lessons are generated from their templates, `coverage-map.json`, the reviewed source snapshot, and the CodeTour reference list. Keep reference claims tied to actual code and tests; do not refresh a snapshot merely to clear a stale status.

## Routine course checks

From the repository root:

```sh
node .tours/learning/scripts/build-catalog.mjs
node --test .tours/learning/scripts/*.test.mjs
node .tours/learning/scripts/build-catalog.mjs --check
```

Generation rebuilds the build-route home and lesson pages, the reference-lesson home and pages, and `source-map.html`. Prettier ignores these generated pages; edit their source templates and regenerate them instead. Generation does not accept source hashes or change the CodeTour baseline. The test command checks route dependencies, authored lesson content, workspace and progress rules, reference-catalog rules, generated navigation, source previews, and browser behavior. `--check` is read-only: it reports stale source links, uncovered files, invalid anchors, changed tour evidence, and generated-page drift.

For product verification, also run the relevant workspace tests and `npm run lint`, `npm run typecheck`, and `npm run build` from the repository root. Run `npm test` when its environment is available. If Docker, PostgreSQL, local socket binding, or Chrome blocks a check, record the command and exact blocker as skipped; do not report that check as passing.

## When game code changes

1. Run `node .tours/learning/scripts/build-catalog.mjs --check` and save the complete report. It identifies changed source and evidence inputs, the affected lessons, invalid CodeTour anchors, and files that need a disposition.
2. Inspect each changed implementation and its tests. Compare observed behavior with the agreed game behavior and the requirements in `ft_transcendence.pdf`; do not use a design note or a passing test as a substitute for implementation evidence.
3. Review every affected reference lesson named by the impact report and each affected build-route step. Update its authored source paths, target-repository file guidance, checks, and related CodeTour step when behavior or evidence changed. If an item needs no text change, still inspect it. Add each new in-scope file to a reference lesson or give it an explicit support-only reason in `coverage-map.json`.
4. Run the focused game tests for the changed behavior, course tests, lint, and any available build/type checks. Update dated evidence notes to state exactly which tests ran and which were skipped.
5. Accept only after every affected lesson was reviewed, anchors and course order are valid, and the evidence is current:

   ```sh
   node .tours/learning/scripts/build-catalog.mjs --accept-reviewed-snapshot --reviewed-lessons=0001-submit-journey,0002-reveal-cutoff
   ```

   Replace the example IDs with every affected lesson ID from the impact report. Acceptance updates `.tours/learning/reference-snapshot.json`, `.tours/reference-baseline.sha256`, `.tours/reference-baseline.md`, and the generated pages. It records the current source hashes; it does not run the tests for you.

6. Run the course tests and `node .tours/learning/scripts/build-catalog.mjs --check` again. Require zero stale links, uncovered or unclassified files, broken anchors, order errors, and generated drift before calling the course current.

## CodeTour reference baseline

`.tours/reference-baseline.sha256` covers the direct inputs to the six CodeTours; `reference-snapshot.json` covers the broader declared source inventory. Keep these records separate. Reviewed-snapshot acceptance refreshes both baselines and the dated summary together. Review every affected tour and its referenced test before accepting; refreshing hashes alone does not update claims or create test evidence.

## 42 subject requirements

After every project change, review [`prototype/game-ui/42-subject-compliance.md`](../../prototype/game-ui/42-subject-compliance.md) against the relevant mandatory and claimed-module requirements in [`ft_transcendence.pdf`](../../ft_transcendence.pdf). Update the matrix in the same change if requirement evidence, scope, module claims, assumptions, or compliance status changed. Course content and course checks are not evidence that a subject module is complete.
