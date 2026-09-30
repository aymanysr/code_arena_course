# Maintaining the Code Arena course

The generated course uses `learning-path.json`, milestone content files, the reference inventory, the reviewed source snapshot, and `course-evidence.json`. The teammate-repo map is separately authored in `reference-build-path.json`; its validator checks step order, dependencies, lesson IDs, and source/test paths. The 14 reference lessons are generated from their templates, `coverage-map.json`, the reviewed source snapshot, and the CodeTour reference list. Generated pages are outputs, not authored lesson source.

## Routine checks

Run from the repository root:

```sh
node .tours/learning/scripts/build-catalog.mjs
node --test .tours/learning/scripts/*.test.mjs
node .tours/learning/scripts/build-catalog.mjs --check
node .tours/learning/scripts/build-catalog.mjs --check-build-complete
npm run lint
git diff --check
```

The build writes generated pages but never writes execution evidence or accepts source hashes. `--check` checks generated drift and source/reference freshness and reports authored coverage counts. It can pass while the course gate is still open during incremental authoring. `--check-build-complete` is read-only and fails unless file/behavior coverage and required current author-rehearsal checks pass. It reports `targetComplete` separately; that status requires checks from the actual teammate repository. A passed strict course gate would still not mean the learner completed the foundation walkthrough or their game.

Generation rebuilds the M00–M13 route, the Before Lesson 1 orientation, the teammate-repo map and lesson build cards, the reference lessons, and `source-map.html`. When generating from a separate integration worktree, set `COURSE_EDITOR_ROOT` to the learner's checkout so editor links and the reference-folder check use that checkout; running from the learner's checkout needs no override.

If Docker, PostgreSQL, the browser stack, or a team repository is unavailable, record the named check as blocked or leave it without evidence. Never replace it with a mock or a disposable fixture result.

## Course content and file coverage

- Add a milestone's complete lesson content in `.tours/learning/content/Mxx.json`; keep IDs and prerequisite order in `learning-path.json`.
- Give each lesson all six phases, a visual explanation when useful, exact practice files and checks, and a changed-case transfer question. Keep visible and hidden Judge data separate.
- Every source inventory path and explicit scope exclusion has exactly one `dispositions` entry. `build` must name ready lessons that cite the exact file. `support` needs a specific read-only reason and no build lesson IDs. `exclude` must preserve the reviewed reason in `coverage-map.json`.
- Each `required` behavior row needs one or more check IDs owned by lessons in that row. Its ready lessons contribute their non-explanation checks to the author and team gates. `support` and `optional` behavior rows do not add required build checks.
- Review all 201 currently scoped files and 21 exclusions from the live inventory; those counts can change. Do not hard-code them into the audit as permanent values.

## Evidence rules

Each evidence row in `course-evidence.json` records `lessonId`, exact `checkId`, `workspace`, `kind`, the command and working directory actually used, result, observation, ISO timestamp, course revision, and source snapshot ID. Do not infer the command or working directory from the lesson when recording a real run. The team's command and folder can differ from practice after they are confirmed.

Accepted workspaces are `author-rehearsal`, `reference`, `learner-practice`, and `team`; results are `passed`, `failed`, or `blocked`. The exact course check ID, owning lesson, and kind must match. A row with missing or unknown fields, stale course revision/snapshot, or an unknown check is rejected. The latest valid result for each workspace/check ID controls that gate, so a newer failure or blocker reopens it.

Only author-rehearsal passes satisfy the course gate. Only team passes from the actual destination can satisfy `targetComplete`. A practice, reference, mock Judge, or disposable mapping fixture cannot stand in for a target run. Browser activity reports are stored separately and are not execution evidence.

## Workspace profile and learner progress

The Team mapping page only stores learner-confirmed paths, commands, and reasons. It cannot inspect a repository or run its commands. Preview before saving. A saved check begins unverified. The browser offers progress export/import; import requires confirmation and workspace progress stays separate. If local saving is blocked, use a temporary session copy across course pages and export it before closing the tab. When both browser storage options are blocked, the course uses a tab-only fallback and warns before moving to another page; if that fallback also fails, progress stays only in the current page. Self-reported activity is not mastery.

## When the game source changes

1. Run `node .tours/learning/scripts/build-catalog.mjs --check`. Save its source and evidence impact report.
2. Read each changed source and test. Compare implementation evidence with `ft_transcendence.pdf`; a spec, prototype, or passing test alone does not establish behavior.
3. Review every affected lesson and CodeTour. Update line spans and explanations where needed; include reviewed lesson IDs even when no text change is needed.
4. Run focused game checks, relevant course tests, and lint. Record only commands actually run and blockers actually observed.
5. Accept a new snapshot only after the affected lessons, anchors, tour steps, and evidence are reviewed:

   ```sh
   node .tours/learning/scripts/build-catalog.mjs --accept-reviewed-snapshot --reviewed-lessons=0001-submit-journey,0002-reveal-cutoff
   ```

   Replace the example IDs with the complete affected list. Snapshot acceptance records hashes; it does not execute tests.

6. Regenerate pages, rerun course tests and `--check`, and inspect the diff. Never refresh a snapshot just to hide drift.

## 42-subject requirements

After any project change, review `prototype/game-ui/42-subject-compliance.md` against the applicable mandatory and claimed-module requirements in `ft_transcendence.pdf`. Update the matrix in the same change if evidence, scope, assumptions, claims, or status changed. Course content and tests are not module sign-off.
