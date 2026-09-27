# Learning Catalog and Change Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the learning course generate any number of lessons and report every source or CodeTour change that needs human review.

**Architecture:** Keep authored lesson metadata and file dispositions in `coverage-map.json`; keep a frozen machine-readable source snapshot; use one audit module to compare the working tree with the snapshot and find affected lessons and CodeTours. The builder renders all lesson pages and the source map, but it never updates fingerprints unless the user runs an explicit reviewed-snapshot operation.

**Tech Stack:** Node.js ESM, existing `highlight.js`, HTML/CSS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-26-code-arena-learning-course-design.md`

## Global Constraints

- Teach one behavior or rule at a time. Use a short sequence: predict, trace a small path in the code, inspect the relevant test, then explain the behavior from memory.
- Start with real player actions and follow their actual UI, Arena transport, Game service, game rules, persistence, or Judge boundaries as needed.
- Use tests as evidence for the cases they exercise. A passing test does not prove untested behavior, security against every attack, or parity in a separate rewrite.
- Use `CONTEXT.md` terms consistently: Match, Round, Problem, Run, Submission, Hidden suite, Reveal, Readiness, Presence, Player status, and Match phase.
- Preserve the distinction between current implementation, test evidence, design documents, prototypes, and planned behavior.
- Never mark exposure, a correct click, or a local self-check as mastery.
- Do not change game behavior, database schema, module claims, or team sign-off as part of this learning-course work.
- The Judge isolation spike must always be labeled as an experiment, not runtime behavior.
- Keep the existing scope and exclusions unless a later reviewed course change explicitly revises them.
- Every lesson must state its goal and key terms, cite source/tests, explain what cited tests demonstrate and do not, and include a prediction, short trace, retrieval check with a useful hint, and rewrite-test prompt; target 7–12 minutes.
- Preserve all existing Git index and worktree changes; do not stage or commit unrelated paths.

## Review Focus

- A dirty worktree differs from Git `HEAD`; test that snapshot metadata records both while file-content hashes, not `HEAD`, determine freshness (Task 5).
- A changed path may be referenced by several lessons and CodeTours; test that every consumer is returned, not only the first (Task 1).
- A deleted path, moved line range, or changed anchor must remain visible as stale instead of disappearing; test missing and out-of-range anchors (Tasks 3 and 5).
- An added in-scope file with no lesson or support disposition must keep the course check failing; a source-like out-of-scope file needs an explicit exclusion reason; test all three states (Task 3).
- Malformed or changed reference data must fail closed, and normal check/generation must not rewrite it; test parser rejection and read-only behavior (Tasks 1 and 5).

---

## File Structure

- Modify `.tours/learning/coverage-map.json` to store ordered lesson metadata, source/test anchors, explicit support-only dispositions, and explicit out-of-scope exclusions with reasons.
- Add `.tours/learning/reference-snapshot.json` as the frozen path/hash inventory for the 178 in-scope files.
- Add `.tours/learning/scripts/reference-audit.mjs` for parsing snapshots, comparing files, and mapping changed paths to lessons, CodeTours, and baseline/evidence records.
- Add `.tours/learning/scripts/reference-audit.test.mjs` for isolated audit tests.
- Modify `.tours/learning/scripts/build-catalog.mjs` to use lesson metadata, render every lesson, report coverage and freshness, and expose non-mutating check behavior.
- Modify `.tours/learning/scripts/build-catalog.test.mjs` for multi-lesson output, source disposition, and generated-output checks.
- Modify `.tours/learning/templates/source-map.template.html` for generated lesson navigation and support/stale states.
- Modify `.tours/learning/templates/0001-submit-journey.template.html` only as needed to inject lesson metadata and shared snapshot/freshness information.
- Modify `.tours/learning/README.md`, `.tours/learning/MISSION.md`, and `.tours/learning/NOTES.md` to describe the new check and reviewed-refresh procedure.
- Keep `.tours/reference-baseline.md` and `.tours/reference-baseline.sha256` as the CodeTour evidence record; the audit reads them and does not silently bless changed files.

## Interfaces

- `parseReferenceSnapshot(text)` returns `{ schemaVersion, recordedAt, gitHead, snapshotId, files: Map<path, sha256> }` or a descriptive validation error.
- `compareReferenceFiles({ expectedFiles, currentFiles })` returns sorted `{ path, kind, expectedSha256, currentSha256 }` records, where `kind` is `added`, `changed`, or `deleted`.
- `parseCodeTour(text, tourPath)` returns a normalized `{ path, title, steps }` with only file-and-line anchors; title-only steps are ignored for source impact.
- `findReferenceConsumers({ changedPaths, coverageMap, tours, referenceBaseline })` returns `{ lessons, tours, baselineRecords }` with every affected consumer; `referenceBaseline` is `{ path, files: Map<sourcePath, sha256> }`.
- `buildCatalogData({ repoRoot, coverageMap, referenceSnapshot, referenceBaseline })` returns file statuses, supporting dispositions, explicit scope exclusions, affected artifacts, broken references, and one current snapshot ID.
- Each lesson catalog record contains `id`, `order`, `title`, `goal`, `template`, `output`, and `references`; a reference contains `path`, `startLine`, `endLine`, and `label`.
- Each support-only record contains `path` and a non-empty `reason`.
- Each out-of-scope source-like record contains `path` and a non-empty `reason`.

## Tasks

### Task 1: Pin the reference-diff behavior with failing tests

**Files:**
- Create: `.tours/learning/scripts/reference-audit.test.mjs`

- [x] **Step 1: Write the checksum parser test.** Test two valid `shasum -a 256` rows, blank lines, duplicate paths, malformed hashes, and paths containing spaces. Require duplicate and malformed entries to fail with the offending line.
- [x] **Step 2: Write the manifest parser test.** Use a literal schema-version-1 JSON snapshot with `recordedAt`, `gitHead`, `snapshotId`, and path/hash entries. Assert valid data parses, while malformed JSON, missing metadata, duplicate/invalid file entries, and unsupported schema versions are rejected.
- [x] **Step 3: Write a CodeTour parser test.** Parse an actual-shape fixture with one title-only step and one file/line step; assert only the anchored step is returned with its one-based step number.
- [x] **Step 4: Write the added/changed/deleted diff test.** Given expected and current maps, assert one result of each kind and stable path sorting.
- [x] **Step 5: Write the reverse-reference test.** Use two lesson records, two normalized tour objects with one-based step numbers, and a baseline evidence row that refer to the same changed path. Assert the result names every lesson ID, every tour title/step, and the baseline/evidence record.
- [x] **Step 6: Run `node --test .tours/learning/scripts/reference-audit.test.mjs`.** Expected: assertion failures saying the audit exports are missing—not module-import errors—before implementation.

### Task 2: Implement the audit module

**Files:**
- Create: `.tours/learning/scripts/reference-audit.mjs`
- Test: `.tours/learning/scripts/reference-audit.test.mjs`

- [x] **Step 1: Implement `parseReferenceSnapshot` and the checksum-list parser.** Reject duplicate paths, non-hex or non-64-character digests, missing snapshot metadata, and unsupported schema versions.
- [x] **Step 2: Implement `compareReferenceFiles`.** Compare complete path/hash maps and return added, changed, and deleted paths without writing files.
- [x] **Step 3: Implement `parseCodeTour`.** Normalize one CodeTour JSON document, extract each step's `file` and `line`, and ignore title-only steps; catalog directory loading is wired in Task 5.
- [x] **Step 4: Implement `findReferenceConsumers`.** Index lesson references, parsed tour anchors, and baseline/evidence records before looking up changed paths. Preserve multiple consumers of one path.
- [x] **Step 5: Run `node --test .tours/learning/scripts/reference-audit.test.mjs`.** Expected: PASS.

### Task 3: Make the catalog account for every inventoried file

**Files:**
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/scripts/build-catalog.mjs`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Modify: `.tours/learning/templates/source-map.template.html`

- [x] **Step 1: Add a failing catalog test** for an in-scope file that has no lesson reference and no support-only reason. Require a reported incomplete disposition.
- [x] **Step 2: Add a failing test** for a support-only file with a reason and assert it appears as supporting reference, not as taught behavior.
- [x] **Step 3: Add failing tests** that a file referenced by two lessons lists both lesson links and is current only when its snapshot hash matches, and that a missing source file or line range beyond EOF is reported as invalid rather than dropped.
- [x] **Step 4: Add failing tests** that a source-like path outside the inventory is incomplete until listed in `scope.excluded` with a non-empty reason, and that an in-scope path cannot be hidden by an exclusion.
- [x] **Step 5: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: the new assertions fail before implementation.
- [x] **Step 6: Add lesson metadata, `supportingFiles`, and `scope.excluded` validation.** Require unique IDs/orders, existing templates, unique output paths, non-empty goals, valid source anchors, and non-empty support/exclusion reasons.
- [x] **Step 7: Make the inventory summary distinguish current lesson references, stale references, supporting references, uncovered files, out-of-scope exclusions, and unclassified files.** Keep source links separate from mastery language.
- [x] **Step 8: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: PASS.

### Task 4: Render every lesson from catalog metadata

**Files:**
- Modify: `.tours/learning/scripts/build-catalog.mjs`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Modify: `.tours/learning/templates/source-map.template.html`
- Modify: `.tours/learning/templates/0001-submit-journey.template.html`

- [x] **Step 1: Add a failing test** with two lesson records and separate templates. Assert the renderer returns both output paths and each page has its own ID, title, and freshness badge.
- [x] **Step 2: Add a failing test** that course navigation lists all lessons in `order` sequence and routes source anchors to the syntax-colored preview.
- [x] **Step 3: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: the multi-lesson assertions fail.
- [x] **Step 4: Replace the hard-coded Lesson 1 read/render/output entries** with a loop over validated lesson records. Keep the existing template output byte-stable except for metadata and freshness placeholders.
- [x] **Step 5: Render the source map's lesson list and coverage state from the same catalog data.** Keep local self-check language explicitly non-mastery.
- [x] **Step 6: Run the generator tests.** Expected: PASS for two or more lesson outputs, ordered navigation, and source preview links.

### Task 5: Add the full frozen source snapshot and impact report

**Files:**
- Create: `.tours/learning/reference-snapshot.json`
- Modify: `.tours/learning/scripts/build-catalog.mjs`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Modify: `.tours/reference-baseline.md` only if its inventory/test-snapshot description needs correction

- [x] **Step 1: Add a failing test** where one lesson source changes but its reference hash is not accepted. Assert `--check` reports the file and all affected lesson IDs, CodeTour steps, and baseline/evidence records.
- [x] **Step 2: Add failing cases** for one added in-scope file and one deleted baseline file. Assert neither is silently ignored.
- [x] **Step 3: Add failing tests** that ordinary `--check` and page generation do not rewrite the frozen snapshot or CodeTour checksums, and that the accepted record stores Git `HEAD` separately from the working-tree snapshot ID while file hashes determine freshness in a dirty worktree.
- [x] **Step 4: Implement snapshot loading and comparison.** Include the recorded Git HEAD and the complete working-tree content snapshot; do not use HEAD as a substitute for content hashes.
- [x] **Step 5: Make normal check mode fail on stale, added, deleted, unclassified, or undisposed paths.** Print all impacted lessons and tours in one report.
- [x] **Step 6: Add an explicit `--accept-reviewed-snapshot` operation.** Require that flag before writing new hashes; keep ordinary page generation and `--check` read-only with respect to baselines. After review, generate every lesson and the source map from that same accepted snapshot ID.
- [x] **Step 7: Run the audit and catalog unit tests.** Expected: PASS, with the repository's actual changed paths reported rather than auto-accepted.

### Task 6: Document the refresh process and establish the first full inventory

**Files:**
- Modify: `.tours/learning/README.md`
- Modify: `.tours/learning/MISSION.md`
- Modify: `.tours/learning/NOTES.md`
- Create/modify: `.tours/learning/reference-snapshot.json`
- Modify: `.tours/learning/coverage-map.json`

- [ ] **Step 1: Document the commands** for normal check, impact report, and explicit reviewed-snapshot acceptance. State that lesson prose and test evidence need a human review.
- [ ] **Step 2: Classify all current 178 paths** as lesson-taught or support-only with a reason, and classify each discovered source-like out-of-scope path as explicitly excluded with a reason. Do not mark the course complete while lesson content or file dispositions remain unfinished.
- [ ] **Step 3: Run `node --test .tours/learning/scripts/*.test.mjs`.** Expected: all course tooling tests pass.
- [ ] **Step 4: Review the proposed initial snapshot and impact report**, including dirty-worktree metadata, CodeTour consumers, file dispositions, and unchanged game evidence; only then run `--accept-reviewed-snapshot` and regenerate all course outputs from its snapshot ID.
- [ ] **Step 5: Run `node .tours/learning/scripts/build-catalog.mjs --check` and `git diff --check`; inspect `prototype/game-ui/42-subject-compliance.md`.** Expected: generated pages and anchors are current, coverage counts are honest, and no relevant compliance evidence changed; do not change module rows without new evidence.
- [ ] **Step 6: Re-run the full course tooling test command.** Expected: all tests still pass after the accepted baseline and generated outputs are saved.
