# Guided Code Arena Build Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach a C programmer to understand and independently build every agreed Code Arena responsibility, with a usable practice path now and precise guidance in the team's repository when it exists.

**Architecture:** Keep the generated, offline HTML course and its reviewed reference catalog. Add one build-path catalog, structured authored lessons, a shared visual lesson renderer, workspace mappings, and honest local activity records. Extend the existing generator at its output boundary; keep existing source lessons and snapshot acceptance intact.

**Tech Stack:** Node ESM, `node:test`, static HTML/CSS/browser JavaScript, existing Playwright tooling; teaching exercises use the reference's TypeScript/Vitest versions. No new platform framework, account service, embedded terminal, or code execution service.

**Spec:** [Approved design](../specs/2026-09-28-guided-code-arena-build-course-design.md).

**Status:** Implementation plan approved by the learner; Native execution started. The user approved the design on 2026-09-28 and previously chose **Native** execution. Preserve that method. This document does not claim implementation or authorize filling in the learner's game.

## Global Constraints

- “The existing coded game is the **reference**; the teammate's repository is the **destination**.”
- “The learner writes functions and tests; a setup aid may create reviewed empty/configuration files but must not fill in the game solution.”
- “A correct answer must not lock away explanations; a wrong answer must not block navigation.”
- “Practice success does not automatically mark team integration checked.”
- “A missing team profile disables only team-specific instructions; it does not prevent practice learning.”
- “Keep existing activity records as legacy activity; do not translate ‘read’ into ‘built’ or ‘verified.’”
- Easy English; explain new words beside the first use. Introduce only concepts needed by the next task. Use C comparisons with their limits.
- Dusk default, light toggle, semantic theme tokens, keyboard controls, visible focus, sufficient contrast, text cues, reduced motion, usable narrow layouts.
- Every lesson follows orient → see → understand → try → build → check/connect. One meaningful change per Build step, with explicit prerequisites, owner, path/action, command/cwd, expected outcome, recovery, completion, and next connection.
- Preserve legacy lesson IDs/URLs, source previews, freshness checks, authored dispositions, and explicit snapshot acceptance. Do not refresh source hashes to hide drift.
- Preserve invitation-first Lobby, one Match deadline and bounded grace, integer scoring and final tie-breaks, explicit Judge provider selection, Game-owned process-local chat, and documented deployment limitations.
- `ft_transcendence.pdf` takes precedence. Review `prototype/game-ui/42-subject-compliance.md` after every change; update when evidence/scope/status changes. Course results never promote game module claims.
- Run root `npm run lint` before completing UI changes. Never report blocked, simulated, or reference checks as target passes.
- Preserve unrelated dirty work. Use the worktree skill at execution time and explicit paths in commits. No public publishing or messaging is included.

## Review Focus

1. **Old/corrupt/hostile saved data:** recover without losing current-session navigation, executing content, or converting legacy activity into mastery. Tasks 2 and 5.
2. **No team repository or partial mapping:** all practice lessons remain usable; no invented target paths/commands or transferred pass evidence. Tasks 3 and 13.
3. **Zero time, late results, and repeated requests:** explain exact deadline/grace boundaries and safe identity retry separately from stale-revision refresh. Tasks 9 and 11.
4. **Offline, narrow viewport, keyboard, and denied storage:** the same learning path remains readable and operable, with export available. Tasks 4, 5, and 14.
5. **Reference drift and incomplete teaching:** preserve notes, mark relevant checks for review, and reject course-complete claims if behavior coverage or real environment evidence is missing. Tasks 1, 2, and 14.

## Delivery stages and stop conditions

| Stage                      | Tasks | Usable result                                                                                  | Gate                                                                          |
| -------------------------- | ----- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Shared experience       | 1–5   | Working route, lesson view, workspaces, help, themes, progress                                 | Browser and catalog checks                                                    |
| 2. Foundations             | 6–7   | Complete M00–M02; learner can create a separate practice workspace and write/test a small rule | Observe one real learner session before mass authoring                        |
| 3. Local game to screen    | 8–10  | M03–M07, including complete local 1v1 behavior with a fake Judge                               | Checked lesson exercises and feature walkthrough                              |
| 4. Durable multiplayer     | 11–12 | M08–M12: database, isolated execution, invitation Lobby, live play, 2v2, chat                  | Distinct real DB/Judge/browser evidence                                       |
| 5. Destination and closure | 13–14 | Team transition, M13, full coverage and course audit                                           | Actual team repository and integration results required for target completion |

The route shows all milestones immediately. Only fully authored lessons have Start/Continue links; future lessons say “Being written” and explain their intended outcome. That status is not a finished lesson. Continue never points at an unavailable page. Stage 2 feedback can change granularity and wording without changing stable IDs. If the learner is unavailable, keep that walkthrough pending and improve already authored lessons; do not declare it passed or mass-author the remaining format without the feedback gate.

Team transition becomes available after any checked step when a repository is supplied; it need not wait until M13. Platform implementation does not depend on the friend creating a repo. Target-specific guidance and final target verification do.

## File map and shared contracts

All paths below are repository-relative. `C = .tours/learning` is shorthand in prose only; commands use complete paths.

| File(s)                                                                                                       | Responsibility                                                                                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `.tours/learning/learning-path.json`                                                                          | Sole v2 build dependency graph, milestones, lesson manifest, behavior rows, file dispositions |
| `.tours/learning/content/M00.json` through `M13.json`                                                         | Authored lesson steps and visual cases, using stable IDs                                      |
| `.tours/learning/scripts/build-path.mjs`                                                                      | Parse/validate catalog and lesson contracts; no DOM or filesystem mutations                   |
| `.tours/learning/scripts/build-course.mjs`                                                                    | Read authored content; render new pages into the generator's output Map                       |
| `.tours/learning/scripts/build-catalog.mjs`                                                                   | Existing catalog remains authoritative; merge new outputs only                                |
| `.tours/learning/templates/build-home.template.html`, `build-lesson.template.html`, `workspace.template.html` | Semantic shared page markup                                                                   |
| `.tours/learning/assets/build-course.css`                                                                     | Scoped dusk/light lesson layout and visual tokens                                             |
| `.tours/learning/assets/build-progress.mjs`                                                                   | Pure versioned state validation/reduction, storage, import/export                             |
| `.tours/learning/assets/build-workspaces.mjs`                                                                 | Workspace profile validation and file/check resolution                                        |
| `.tours/learning/assets/build-visuals.mjs`                                                                    | Data-driven traces and the small boundary exercise; no arbitrary evaluation                   |
| `.tours/learning/assets/build-runtime.mjs`                                                                    | DOM binding, navigation, themes, help, reports, import/export                                 |
| `.tours/learning/assets/course-activity.mjs`                                                                  | Preserve existing legacy key/API unchanged; link legacy activity in new UI                    |
| `.tours/learning/workspaces/practice.json`                                                                    | Introduced practice files and check commands, no assumed absolute root                        |
| `.tours/learning/practice/package.json`, `tsconfig.json`                                                      | Reviewed setup configuration only, no completed game implementation                           |
| `.tours/learning/build/*.html`, `build/workspace.html`, `index.html`                                          | Generated pages; author content/templates, never patch generated prose                        |
| `.tours/learning/scripts/build-*.test.mjs`                                                                    | Catalog, state, profiles, rendering, content, and browser behavior tests                      |
| `.tours/learning/scripts/fixtures/build-course.mjs`                                                           | Small valid catalog/content fixture and mutation-test inputs                                  |
| `.tours/learning/reviews/2026-09-28-foundation-walkthrough.md`, `course-evidence.json`                        | Observations and separately scoped author checks; absence/blockers remain visible             |
| `.tours/learning/{README,MISSION,NOTES,RESOURCES,MAINTAINING}.md`                                             | Entry/maintenance instructions aligned to the implemented state                               |

`coverage-map.json` and `reference-snapshot.json` remain source authorities, not duplicated into another source registry. New references are `{ lessonId, path, startLine, endLine }` that must resolve to a containing existing reference anchor. New needed anchors are authored into `coverage-map.json` with reviewed evidence first.

### Exact data interfaces

Use JSDoc typedefs in the owning `.mjs` module; these TypeScript forms specify the contract. JSON contains data only. Strings rendered as text are escaped; author HTML templates are trusted local source, imported strings are never HTML.

```ts
type Phase = "orient" | "see" | "understand" | "try" | "build" | "check";
type Reference = {
  lessonId: string;
  path: string;
  startLine: number;
  endLine: number;
};
type Check = {
  id: string;
  command: string;
  cwd: string;
  expected: string;
  kind:
    | "explain"
    | "unit"
    | "service"
    | "database"
    | "judge"
    | "browser"
    | "integration";
  failure: { symptom: string; diagnostic: string; meaning: string }[];
};
type FileAction = {
  role: string;
  workspace: "reference" | "active";
  path: string;
  action: "read" | "create" | "edit";
  owner: string;
  change: string;
  pattern: string;
};
type Frame = {
  id: string;
  label: string;
  values: { label: string; value: string }[];
  codeLines: number[];
  explanation: string;
};
type Visual = {
  kind: "trace" | "boundary";
  title: string;
  code: string[];
  frames: Frame[];
  cases: { input: string; expected: string; reason: string }[];
};
type Step = {
  id: string;
  phase: Phase;
  title: string;
  question: string;
  explanation: string[];
  vocabulary: { term: string; meaning: string }[];
  visual?: Visual;
  hints: string[];
  files: FileAction[];
  checkIds: string[];
  prerequisiteCheckIds: string[];
  next: string;
  transfer?: string;
};
type Lesson = {
  id: string;
  milestoneId: string;
  title: string;
  why: string;
  outcome: string;
  prerequisites: string[];
  references: Reference[];
  steps: Step[];
  checks: Check[];
};
type LessonEntry = {
  id: string;
  milestoneId: string;
  title: string;
  status: "planned" | "ready";
  prerequisites: string[];
  output: string;
};
type Milestone = {
  id: string;
  title: string;
  why: string;
  enables: string;
  prerequisites: string[];
  lessonIds: string[];
  content: string;
};
type Behavior = {
  id: string;
  title: string;
  lessonIds: string[];
  referenceLessonIds: string[];
  checkIds: string[];
  scope: "required" | "support" | "optional";
  reason: string;
};
type Disposition = {
  path: string;
  kind: "build" | "support" | "exclude";
  lessonIds: string[];
  reason: string;
};
type BuildPath = {
  version: 2;
  revision: string;
  sourceSnapshotId: string;
  milestones: Milestone[];
  lessons: LessonEntry[];
  behaviors: Behavior[];
  dispositions: Disposition[];
};
type ReferenceData = {
  snapshotId: string;
  currentSnapshotId: string;
  referenceSnapshotId: string | null;
  lessons: {
    id: string;
    references: { path: string; startLine: number; endLine: number }[];
  }[];
  files: { path: string; sha256: string; lines: number; status: string }[];
  sourceChanges: { path: string; kind: string }[];
  evidenceChanges: { path: string; kind: string }[];
  invalidTourAnchors: object[];
  exclusions: { path: string; reason: string }[];
};
type ValidCourse = {
  path: BuildPath;
  lessons: Lesson[];
  changedReferencePaths: string[];
  referenceReviewRequired: boolean;
};
```

IDs use lowercase words/numbers/hyphens, except milestone IDs `M00`–`M13`. Lesson IDs are `m02-boundary`; steps are `m02-boundary-build`; checks `m02-boundary-unit`. No positional array index becomes a persisted identity. Outputs are `build/<lesson-id>.html`, with safe relative paths and no `..`/absolute paths. Graph prerequisites are lesson IDs (and milestone IDs only in the milestone graph); check references must resolve to a check in the same lesson or an ancestor lesson. All entries have unique IDs. Ready lessons have every phase in order, one or more build steps, and a transfer prompt. Orientation/setup may use an `explain` check with `command: "Explain aloud"` and `cwd: "."`; never label it a terminal command in the UI.

Every coding Build step must supply at least one FileAction, at least one non-explanation Check, four escalating hints, and prerequisite check IDs except for the first setup action. All paths/commands in content describe the **practice profile**, until mapped. Command strings are displayed text, never executed by the platform.

### Dependency and authoring conventions

Within each milestone, the lesson table order is the recommended lesson dependency chain. The first lesson requires the last lesson of the minimum prerequisite milestone(s) from the design: M00 none; M01→M00; M02→M01; M03→M02; M04→M03; M05→M04; M06→M05; M07→M06; M08→M05/M06/M07; M09→M08; M10→M07/M08/M09; M11→M10; M12→M11; M13 final integration→M12. The workspace transition page is accessible at any point and does not impose M13 prerequisites on an early transfer. Reading later content remains permitted with a prerequisite notice.

`FileAction.workspace:'reference'` is read-only and resolves to the existing local source preview, with the reference root label; it is never remapped into the practice/team project. `workspace:'active'` uses the current profile and requires an explicit role mapping in team mode. Reference read actions do not create files. M00 notes live in course state until the learner chooses a practice root. Version checks before setup use `Check.cwd:'current-terminal'`; root-dependent commands use `'.'` or an explicit relative subdirectory. Copyable root-dependent commands require a selected root, while read-only version checks can be shown before one exists.

`referenceData` is the existing catalog's return object projected to `ReferenceData`; retain additional existing fields within the generator. `validateBuildPath` derives `changedReferencePaths` from `sourceChanges` and `evidenceChanges`, and `referenceReviewRequired` from drift, invalid anchors, or a missing reviewed baseline. Fixture records explicitly provide empty arrays and a saved baseline. A normal preview may show stale content with review notices; the strict completion audit rejects it. The current CLI loads the saved snapshot and checksum baseline; do not accidentally call it without them and manufacture a fresh baseline.

Legacy L01–L14 in the tables are readable shorthand; persist the actual IDs from `coverage-map.json` (for example `0001-submit-journey`), never literal `L01`. All lesson/test/phase IDs are validated. Test snippets illustrate the asserted behavior and are completed with the imports/setup named in their task; production examples and practice solutions remain separate.

## Stage 1 — Shared experience

### Task 1: Reconcile the catalogs and validate the teaching contract

**Files:** Create `learning-path.json`, `scripts/build-path.mjs`, `scripts/build-path.test.mjs`, `scripts/fixtures/build-course.mjs`, and `content/M00.json` beneath `.tours/learning/`. Review main dirty course changes and `/Users/ayousr/.codex/worktrees/learning-build-path/fearless-meitner/.tours/learning/learning-path.json` before editing. Do not import rejected prototype UI.

**Interfaces:** `validateBuildPath(raw:unknown, lessons:Lesson[], referenceData:ReferenceData, options?:{complete?:boolean}):ValidCourse` throws an Error naming the exact ID/field. `foundationFixture():{raw:BuildPath,lessons:Lesson[],referenceData:ReferenceData}` is a small independent valid fixture, including one complete orientation lesson and one planned successor.

- [ ] Inspect attached worktrees with `list_artifacts`, use the worktree skill, compare the old v1 graph and current dirty generator, and record which changes are retained in the plan execution log. Reuse a suitable active checkout; preserve dirty work using an explicit reviewed patch if another checkout is needed. Do not silently start from remote default and lose course improvements.
- [ ] Add mutation tests, using the fixture rather than the real course for malformed input:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateBuildPath } from "./build-path.mjs";
import { foundationFixture } from "./fixtures/build-course.mjs";
test("a cycle names the broken dependency", () => {
  const f = foundationFixture();
  f.raw.lessons[0].prerequisites = [f.raw.lessons[1].id];
  f.raw.lessons[1].prerequisites = [f.raw.lessons[0].id];
  assert.throws(
    () => validateBuildPath(f.raw, f.lessons, f.referenceData),
    /cycle/
  );
});
test("a ready build cannot hide its check instructions", () => {
  const f = foundationFixture();
  f.lessons[0].checks[0].expected = "";
  assert.throws(
    () => validateBuildPath(f.raw, f.lessons, f.referenceData),
    /expected/
  );
});
```

- [ ] Run `node --test .tours/learning/scripts/build-path.test.mjs`; expect missing module/export failure. Add cases for duplicate IDs, unknown prerequisites, nonexistent/escaping output, missing phase/template content, broken reference span, omitted recovery, missing check, duplicate output, and a planned prerequisite of a ready lesson.
- [ ] Implement validation in passes: root/version → duplicate/path/field checks → references → dependency DFS → ready lesson phase/check contract → behavior/disposition integrity. Keep DFS visiting/visited sets and print the cycle chain. Derive reference freshness from `referenceData`, never from a boolean supplied in lesson JSON. At normal build, incomplete teaching coverage is reported; `complete:true` rejects planned lessons, uncovered files, missing behavior checks, and exclusions without reasons.

```js
const phases = ["orient", "see", "understand", "try", "build", "check"];
const seen = lesson.steps
  .map((step) => step.phase)
  .filter((p, i, a) => i === 0 || p !== a[i - 1]);
if (seen.join("|") !== phases.join("|")) {
  throw new Error(`${lesson.id}: steps must follow ${phases.join(" → ")}`);
}
```

- [ ] Populate the M00–M13 graph using the approved spec and the lesson table in Tasks 6–13. Replace v1's eight coarse steps with v2; retain useful source anchors, not its Submit-first order. Mark unauthored entries planned. Complete the tiny M00 orientation lesson so the shell has real content. List all 19 behavior rows from design section 9; add file dispositions progressively, reporting outstanding counts honestly.
- [ ] Run the new tests and existing `node --test .tours/learning/scripts/build-catalog.test.mjs`. Review compliance. Commit only the named task files with `feat(course): add validated guided build catalog`.

### Task 2: Preserve honest progress, imports, and source review signals

**Files:** Create `.tours/learning/assets/build-progress.mjs`, `.tours/learning/scripts/build-progress.test.mjs`, and the pure profile validator in `.tours/learning/assets/build-workspaces.mjs` (expanded in Task 3). Existing `assets/course-activity.mjs` stays compatible.

**Interfaces:** Export `BUILD_PROGRESS_KEY = 'code-arena-learning:build:v1'`; `emptyProgress(course:ValidCourse):Progress`; `reduceProgress(state:Progress,event:ProgressEvent,course:ValidCourse):Progress`; `readProgress(storage:Storage|null,course:ValidCourse,fallback?:StorageLike):{state:Progress,warning:string|null}`; `saveProgress(storage:Storage|null,state:Progress,fallback?:StorageLike):'durable'|'temporary'|'unavailable'`; `importProgress(text:string,course:ValidCourse):Progress`; `exportProgress(state:Progress):string`.

```ts
type Report = {
  status: "untried" | "passed" | "failed" | "blocked";
  source: "learner-report" | "import";
  note: string;
  reportedAt: string;
  courseRevision: string;
  sourceSnapshotId: string;
  needsReview: boolean;
};
type WorkspaceRecord = {
  position: string | null;
  attempts: Record<string, number>;
  reports: Record<string, Report>;
  notes: Record<string, string>;
};
type Progress = {
  version: 1;
  courseRevision: string;
  sourceSnapshotId: string;
  theme: "dusk" | "light";
  activeWorkspace: string;
  workspaces: Record<string, WorkspaceRecord>;
  profiles: WorkspaceProfile[];
};
type ProgressEvent =
  | { type: "visit"; stepId: string }
  | { type: "attempt"; stepId: string }
  | { type: "report"; checkId: string; report: Report }
  | { type: "note"; stepId: string; text: string }
  | { type: "theme"; theme: "dusk" | "light" }
  | { type: "workspace"; id: string }
  | { type: "profile"; profile: WorkspaceProfile };
```

`StorageLike` is the small `getItem`/`setItem`/`removeItem` interface used by the session fallback. `WorkspaceProfile` is defined in Task 3; the state module consumes its pure validator. Implement those typedefs and validator before tests need the import, without duplicating a second schema. Workspace records are keyed by validated IDs. A workspace switch creates an empty record; it never clones reports. `reportedAt` is supplied by the caller for deterministic tests. Record command output summaries as plain text, not terminal execution evidence. Unknown removed steps/checks on import produce a named validation error and leave current state intact; changed revisions retain notes with reports marked for review.

- [ ] Add tests for blocked `getItem`/`setItem`, malformed/future versions, invalid IDs/statuses/dates, `__proto__` keys, oversize imports (>1 MB), legacy v1 untouched, export/import round trip, target switch, changed revision, and malicious note text. Test the reducer without a browser:

```js
test("practice success is not a team check", () => {
  const course = validateBuildPath(f.raw, f.lessons, f.referenceData);
  let state = emptyProgress(course);
  state = reduceProgress(
    state,
    {
      type: "profile",
      profile: { id: "team-a", kind: "team", root: null, mappings: [] },
    },
    course
  );
  state = reduceProgress(
    state,
    {
      type: "report",
      checkId: course.lessons[0].checks[0].id,
      report: {
        status: "passed",
        source: "learner-report",
        note: "Explained the map",
        reportedAt: "2026-09-28T12:00:00.000Z",
        courseRevision: course.path.revision,
        sourceSnapshotId: course.path.sourceSnapshotId,
        needsReview: false,
      },
    },
    course
  );
  state = reduceProgress(state, { type: "workspace", id: "team-a" }, course);
  assert.deepEqual(state.workspaces["team-a"].reports, {});
  assert.equal(
    Object.values(state.workspaces.practice.reports)[0].status,
    "passed"
  );
});
```

Declare `const f = foundationFixture()` inside each test. Add a second import assertion that every imported report has `source:'import', needsReview:true`, even when revision is unchanged.

- [ ] Run `node --test .tours/learning/scripts/build-progress.test.mjs`; expect missing API/failing state assertions.
- [ ] Implement whitelist validation and a pure reducer returning fresh records. Access storage within try/catch, including obtaining `window.localStorage` in the DOM module. Use session storage as a temporary cross-page fallback and a namespaced `window.name` fallback only if browser storage is denied; label each save as durable, temporary, or unavailable and tell the learner to export before closing or leaving. On corrupt storage return empty in-memory state with a warning; pause automatic writes while the corruption warning is active; overwrite corrupt text only after the learner explicitly confirms replacing it with the current session record. Imported data replaces local state only after preview and confirmation. Preserve the old `COURSE_ACTIVITY_KEY` and display it separately as reading activity.

```js
const importedReports = Object.fromEntries(
  Object.entries(record.reports).map(([id, report]) => [
    id,
    { ...report, source: "import", needsReview: true },
  ])
);
```

- [ ] Compare each check's referenced source files with current reference freshness. On changed source mark only associated reports `needsReview:true`; global course revision changes conservatively mark all reports if an affected-step mapping is unavailable. Never delete notes or turn a failure into a pass.
- [ ] Run new and legacy activity tests. Review compliance. Commit explicit files with `feat(course): preserve workspace-scoped learning progress`.

### Task 3: Make practice and team file guidance precise

**Files:** Expand `.tours/learning/assets/build-workspaces.mjs`; create `.tours/learning/workspaces/practice.json` and `.tours/learning/scripts/build-workspaces.test.mjs`.

**Interfaces:** `validateWorkspaceProfile(raw:unknown):WorkspaceProfile`; `resolveBuildStep(step:Step,lesson:Lesson,profile:WorkspaceProfile):ResolvedStep`; `quoteShellPath(path:string):string`. Resolver never accesses a filesystem or runs a command.

```ts
type Mapping = {
  role: string;
  referencePath: string | null;
  practicePath: string;
  targetPath: string;
  action: "reuse" | "create" | "extend";
  reason: string;
  checks: {
    checkId: string;
    command: string;
    cwd: string;
    verification: "unverified" | "learner-reported";
  }[];
  dependency: string | null;
};
type WorkspaceProfile = {
  id: string;
  kind: "practice" | "team";
  root: string | null;
  mappings: Mapping[];
};
type ResolvedStep = {
  workspace: string;
  root: string | null;
  files: FileAction[];
  checks: Check[];
  blockedBy: string[];
};
```

Practice uses authored paths/checks; a confirmed absolute root is required before presenting copyable `cd` commands. Team requires mappings for all step roles and checks. A missing role blocks only that team's file/check instructions, shows the missing responsibility, and offers practice. Keep team notes/learning text visible. Reject absolute mapped file paths, traversal, duplicate (role, practicePath) pairs/check IDs, control characters, and empty commands. Match each target path to its exact practice path; one responsibility may cover multiple files. A root may contain spaces/apostrophes; reject newlines/NUL, not normal path punctuation. No automatic repository discovery or installation.

- [ ] Write tests for null root, incomplete team mappings, reused team implementation, duplicate role/check, `../` path, root with spaces/apostrophe, and practice availability alongside unmapped team:

```js
test("a missing team mapping does not reuse a practice command", () => {
  const f = foundationFixture();
  const lesson = f.lessons[0];
  const step = lesson.steps.find((s) => s.phase === "build");
  const result = resolveBuildStep(step, lesson, {
    id: "team-a",
    kind: "team",
    root: "/tmp/team app",
    mappings: [],
  });
  assert.equal(result.checks.length, 0);
  assert.ok(result.blockedBy.length > 0);
});
```

- [ ] Run `node --test .tours/learning/scripts/build-workspaces.test.mjs`; expect failure until resolver exists.
- [ ] Implement profile validation and role/check lookup. `quoteShellPath` uses POSIX single-quote escaping; command cards show cwd separately, with optional safe `cd` line. Do not interpolate user text into scripts or automatically trust imported command text. Store verification label as a report only.

```js
export function quoteShellPath(value) {
  if (/[\x00\r\n]/.test(value)) throw new Error("root: control character");
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
```

- [ ] Run resolver tests, including a shell parser round-trip in a temporary directory without executing any imported command. Review compliance. Commit explicit files with `feat(course): resolve practice and team build instructions`.

### Task 4: Render and integrate the approved lesson experience

**Files:** Create `.tours/learning/scripts/build-course.mjs`, `build-course.test.mjs`, `assets/build-course.css`, `templates/build-home.template.html`, `templates/build-lesson.template.html`, `templates/workspace.template.html`. Modify `scripts/build-catalog.mjs`, `scripts/course-experience.test.mjs`, root `package.json` and `package-lock.json`; regenerate course outputs. Preserve legacy source lessons.

**Interfaces:** `loadBuildCourse(learningDir:string,referenceData:ReferenceData):Promise<ValidCourse>`; `renderBuildOutputs({learningDir,referenceData,course,runtimeSource}:object):Promise<Map<string,string>>`; `bundleBuildRuntime(learningDir:string):Promise<string>`. All Map keys are absolute paths under `learningDir`. Builder loads path/content once, validates, then renders. `renderCatalogOutputs(...)` retains its `{data,files}` return and adds guided outputs only when `learning-path.json` exists, preserving existing temporary fixture tests without that file.

- [ ] Add rendering tests for: beginner home Continue points to first ready lesson; planned items have no lesson links; all 14 existing lesson outputs remain; unknown template fails with path; script-closing strings in content cannot escape embedded JSON; source links resolve relative to `/build/`; generated file changes fail `--check`.

```js
test("a guided build does not remove reference lessons", async () => {
  const coverage = JSON.parse(
    await readFile(path.join(learningDir, "coverage-map.json"), "utf8")
  );
  const { files } = await renderCatalogOutputs(
    repoRoot,
    learningDir,
    coverage,
    { tours: [] }
  );
  for (const lesson of coverage.lessons)
    assert.ok(files.has(path.join(learningDir, lesson.output)));
  assert.match(
    files.get(path.join(learningDir, "index.html")),
    /data-build-continue/
  );
  assert.ok(files.has(path.join(learningDir, "build/m00-destination.html")));
});
```

Use existing `node:fs/promises`, `node:path`, repository-root setup from `course-experience.test.mjs`. Add separate guided browser tests; update old home assertions to the new entry, but retain assertions for legacy lesson deep links and source previews.

- [ ] Run `node --test .tours/learning/scripts/build-course.test.mjs`; expect missing guided output assertions.
- [ ] Read the modern-web-guidance skill before HTML/CSS implementation. Build semantic landmark templates with skip link, course route, current milestone, workspace/root, question, connected explanation/visual, code, progressive hints, file action cards, and check form. Use native links/buttons/details. One step is active; all content remains available through a no-JavaScript linear fallback. Route reading never requires passing a quiz. Back/Next update hash and focus the heading; direct hashes resolve stable IDs.
- [ ] Use scoped tokens with dusk as the default: background `#191f22`, surface `#232c30`, text `#e4eae5`, muted text `#adbcb6`, border `#3b4749`, accent `#99d7bf`, accent surface `#293f36`. Define light equivalents and validate contrast; do not assume palette choices alone guarantee compliance. At wide view show compact route + explanation/work area; at 390 px stack in reading order without horizontal page overflow. Code may scroll inside its own labeled region. Maintain 44px practical control height, explicit labels, focus outline, and `prefers-reduced-motion` treatment.
- [ ] Declare `esbuild` **0.28.2** as a direct root devDependency (already present in the inspected lockfile), using it only to bundle local course modules into one inline IIFE. Avoid brittle string removal of imports. Recheck the lockfile at execution, and inspect the dependency diff. No CDN/network assets or runtime fetch of JSON.

```js
import { build } from "esbuild";
export async function bundleBuildRuntime(learningDir) {
  const result = await build({
    entryPoints: [path.join(learningDir, "assets/build-runtime.mjs")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: false,
  });
  return result.outputFiles[0].text.replaceAll("</script", "<\\/script");
}
const embedded = JSON.stringify(pageData).replaceAll("<", "\\u003c");
```

Until Task 5, render with `runtimeSource:''`, all steps visible, and native links between complete static lessons. Task 5 connects `bundleBuildRuntime` once the real runtime exists and enables the one-step view. Do not create a fake runtime entry. Merge guided outputs **after** rendering the legacy home so `index.html` becomes the beginner entry, while the reference route remains accessible. Include CSS/runtime source in output generation to make `--check` detect drift.

- [ ] Run rendering and existing source-preview/catalog tests; run generator, read-only `--check`, and `npm run lint`. Review compliance. Commit explicit source plus generated output files with `feat(course): integrate the guided lesson layout`.

### Task 5: Wire visual traces, help, themes, and recovery

**Files:** Create `.tours/learning/assets/build-visuals.mjs`, `assets/build-runtime.mjs`, `scripts/build-visuals.test.mjs`, `scripts/build-experience.test.mjs`; regenerate outputs.

**Interfaces:** `boundaryResult(seconds:number,operator:'>'|'>='|'<'):boolean`; `selectFrame(visual:Visual,id:string):Frame`; `mountBuildCourse(root:Document,course:ValidCourse,lesson:Lesson|null,storage:Storage|null):{dispose():void}`. Runtime entry reads the builder's escaped `#build-course-data` JSON, validates it, then mounts. DOM IDs/data attributes are stable test hooks, not stored progress identities.

- [ ] Test the simplified teaching boundary without executing code strings:

```js
test("the wrong inclusive operator explains exactly zero", () => {
  assert.equal(boundaryResult(0, ">="), true);
  assert.equal(boundaryResult(0, ">"), false);
  assert.equal(boundaryResult(-2, ">"), false);
  assert.throws(() => boundaryResult(Number.NaN, ">"), /finite/);
});
```

- [ ] Run `node --test .tours/learning/scripts/build-visuals.test.mjs` and see the missing export fail. Implement a finite-number guard and explicit operator switch. Frame selection uses authored allowed IDs; reject an unknown frame. Trace frames show values + line highlights + explanatory text together, advanced by buttons. Never `eval`, `Function`, or run learner programs in the browser.
- [ ] Implement runtime handlers with `addEventListener`, `textContent`, `hidden`, and `aria-current`; maintain in-session state even if saving fails. Hints reveal goal → relevant value → analogous example → walkthrough. Record attempts separately from reported checks. Check form offers Not tried / Passed / Failed / Blocked, command and workspace shown above the form, optional short note, and a label “You reported this result.” No automatic “verified” badge from a quiz.

```js
function showReport(node, report) {
  node.textContent = report
    ? `${report.source === "import" ? "Imported" : "You reported"}: ${report.status}${report.needsReview ? " — check again" : ""}`
    : "Not checked yet";
}
```

- [ ] Add native reset confirmation showing which workspace data will be cleared; cancel preserves everything. Export a JSON download. Import reads at most 1 MB, validates and previews workspace/count/date, then confirms replacement; on error preserve current state and show the exact reason. Theme works before storage writes and saves opportunistically. Preserve active workspace/profile in export. Unknown hash shows the first step with a helpful notice, not a blank page.
- [ ] Add browser fixture setup by reusing the existing test's temporary rendered-directory/server lifecycle. Test both served pages and permitted direct-file access; if file access is blocked by the environment, record that limitation rather than bypassing it. Add two viewports (1280×900, 390×844), keyboard-only navigation, reduced motion, denied storage, invalid import, reset cancel, and round-trip resume. Test local behavior via observed controls:

```js
await page.getByRole("button", { name: "Light theme", exact: true }).click();
assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
await page.getByRole("button", { name: "Next step", exact: true }).click();
const stepId = await page
  .locator("[data-build-step]:visible")
  .getAttribute("data-build-step");
await page.reload();
assert.equal(
  await page
    .locator("[data-build-step]:visible")
    .getAttribute("data-build-step"),
  stepId
);
assert.equal(
  await page.locator("[data-build-report]").innerText(),
  "Not checked yet"
);
```

Name the toggle by the destination theme; show current theme separately. For blocked storage test, create context with a `Storage.prototype.setItem` rejection before navigation, configure a workspace on `workspace.html`, open a lesson, and assert the path and check commands remain visible; record a result, navigate to another lesson, return, and confirm the result survived. Export must still work, and the warning must say the copy is temporary. For imported `<img onerror=...>` note, assert literal visible text and absence of an image/event effect. No fixed sleep for state assertions.

- [ ] Run `node --test .tours/learning/scripts/build-*.test.mjs`, the existing course experience test, generator/check and `npm run lint`. Inspect actual dusk/light screenshots at both widths; record accessibility checks and console errors. Review compliance; commit explicit files with `feat(course): add guided interactions and progress recovery`.

## Stage 2 — Foundations before the first feature

### Authoring and verification method used by Tasks 6–13

Each row in the lesson tables below is a **separate small lesson**, not one giant milestone page. Each gets all six phases and a changed independent task. Several Build steps may introduce files/tests in sequence; each step still makes one change. The tables give exact lesson IDs, practice file homes, conceptual order, visuals, checks, and failure cases. Fill `content/Mxx.json` with fully authored prose, not automatic expansions of table labels. Every new coding lesson is rehearsed in a disposable author workspace; do not create or solve the user's actual practice project.

Create `.tours/learning/scripts/build-content.test.mjs` in Task 6 with this reusable structural test and one behavioral browser assertion per new interaction. It consumes `loadBuildCourse` and `validateBuildPath`; derive repository root using `process.cwd()` and `learningDir = path.join(repoRoot,'.tours/learning')`. Read `coverage-map.json`, call `buildCatalogData` for `referenceData`, then `loadBuildCourse`. Tests below use the resulting `course`.

```js
for (const lesson of course.lessons) {
  test(`${lesson.id}: learner has an actionable build and transfer`, () => {
    const builds = lesson.steps.filter((s) => s.phase === "build");
    assert.ok(builds.length > 0);
    for (const step of builds) {
      assert.ok(step.files.length > 0);
      assert.equal(step.hints.length, 4);
      const checks = step.checkIds.map((id) =>
        lesson.checks.find((c) => c.id === id)
      );
      assert.ok(checks.length > 0 && checks.every(Boolean));
      for (const check of checks) {
        assert.ok(
          check.command.trim() && check.cwd.trim() && check.expected.trim()
        );
        assert.ok(
          check.failure.some((f) => f.symptom && f.diagnostic && f.meaning)
        );
      }
    }
    assert.ok(
      lesson.steps.some((s) => s.phase === "check" && s.transfer?.trim())
    );
  });
}
```

This structural check prevents missing guidance; it does not prove teaching quality or game correctness. Behavioral checks run actual rehearsal code, not assertions that lesson strings contain particular words. Keep the rehearsal code outside published/downloadable course content. In `.tours/learning/course-evidence.json`, record entries `{lessonId,checkId,workspace:'author-rehearsal'|'reference'|'learner-practice'|'team',kind,command,cwd,result:'passed'|'failed'|'blocked',observed,checkedAt,revision,sourceSnapshotId}`. Rehearsal/reference results do not become learner reports. This evidence file is authored data, never consumed as execution authority.

For each row, the implementation cycle is: author the six small steps → rehearse each path/command from its stated cwd → trigger the named failure → verify the diagnostic helps → correct the implementation → record evidence → mark ready and regenerate. If a check requires an unavailable environment, record blocked and keep that lesson's verification pending. Do not publish commands as verified on the basis of syntax review.

### Task 6: Author M00 orientation and M01 practice setup

**Files:** `.tours/learning/content/M00.json`, `M01.json`, `learning-path.json`, `practice/package.json`, `practice/tsconfig.json`, `scripts/build-content.test.mjs`, `course-evidence.json`; generated outputs.

**Interfaces:** Existing Lesson/Check/FileAction data; `practice/package.json` supplies `npm run typecheck`, `npm run build`, `npm test`, and `npm run demo`. Practice file roles below become stable mappings, e.g. `rule.submit-window`, `test.submit-window`, `config.package`, `config.typescript`, `notes.learning`.

| Lesson ID         | First explanation/visual                                                                                                        | Practice file actions                                                                                                                                             | Check and recovery                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m00-destination` | Labeled storyboard: invite → Problem/editor → Run → Submit → Reveal → next Round → final sum; describe three Rounds and 1v1/2v2 | Read reference `CONTEXT.md`; create a short personal explanation in `learning-notes.md` only after a practice root exists; before setup store it as a course note | Explain Run versus Submit and point to server/DB/Judge; wrong score prediction returns to one visible/hidden comparison                                     |
| `m00-workspaces`  | Three labeled folders: reference/read, practice/write, team/waiting                                                             | Read course workspace labels; no invented team folder                                                                                                             | Explain where the next file will go; selecting unavailable team offers practice with explanation                                                            |
| `m01-tools`       | Editor/file vs terminal/cwd vs process; C compiler analogy with TypeScript limits                                               | Read tool versions; select an actual parent directory and confirm separate `code-arena-practice/` root                                                            | `pwd`, `node --version`, `npm --version`, `git --version`; command-not-found leads to a named tool install page for actual OS, then rerun the version check |
| `m01-folder`      | Folder tree grows one directory at a time                                                                                       | Create root, `src/`, `test/`, `learning-notes.md`; check directory is not the reference checkout; explain `git init` before using it                              | `pwd`, `git status --short`; existing nonempty folder means inspect/reuse deliberately, never overwrite                                                     |
| `m01-package`     | Manifest script → installed tool → action; explain local dependency/lockfile                                                    | Create `package.json` with shown configuration; run install; create `.gitignore` for `node_modules/`, `dist/`, `.env`                                             | `npm install`, then `npm ls --depth=0`; network/install failure remains here, no build instruction pretending install succeeded                             |
| `m01-first-run`   | Input 12 → comparison → boolean → output; C/TS responsibility highlight                                                         | Create `tsconfig.json`, `src/submit-window.ts` and `src/demo.ts`; learner writes function, then import/call                                                       | `npm run typecheck`, `npm run build`, `npm run demo`; explain missing export vs wrong import vs stale compiled output                                       |

M00 is a conceptual check: its FileAction may read `CONTEXT.md`; do not create notes outside a chosen workspace. For `m01-tools`, use FileAction `read` for the visible workspace configuration, explicitly labeled course setup. These non-code checks retain clear labels instead of fake file creation.

- [ ] Add failing content tests requiring these six lesson IDs, complete steps, and no ready M02 before its M01 prerequisites. Run `node --test .tours/learning/scripts/build-content.test.mjs`; expect absent lesson failures.
- [ ] Author the small configuration below, explaining each key at the moment it is introduced. These are scaffold files, not game answers:

```json
{
  "name": "code-arena-practice",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "demo": "node dist/src/demo.js",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "22.20.4",
    "typescript": "5.9.3",
    "vitest": "3.2.7"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "rootDir": ".",
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

These package versions match the inspected reference lockfile. Establish and test a Node version compatible with this exact manifest before publishing; report the actual version used, not a claim of universal compatibility. The author host was Node `v26.10.0`; install guidance should use an officially supported compatible release checked during implementation. Explain why NodeNext imports use `.js` although the learner edits `.ts`. Do not teach test execution until a test file exists.

- [ ] Rehearse from an empty temporary directory with spaces in its name. Install and compile a tiny author-written example, inspect emitted JS to show annotations disappear, and run the demo. Deliberately remove an export to verify the lesson's diagnostic. Do not install into or modify the user's practice workspace.
- [ ] Run content tests, full course checks, browser walkthrough of workspace selection, and `npm run lint`. Update evidence/compliance, mark only verified authored lessons ready, and commit named content/config/generated files with `feat(course): teach orientation and practice setup`.

### Task 7: Author M02 and observe an independent foundation exercise

**Files:** `.tours/learning/content/M02.json`, `learning-path.json`, `scripts/build-content.test.mjs`, `scripts/build-experience.test.mjs`, `reviews/2026-09-28-foundation-walkthrough.md`, `course-evidence.json`; generated outputs.

**Interfaces:** Learner writes `isSubmitWindowOpen(secondsLeft:number):boolean` and then an independently changed `isLimitReached(used:number,limit:number):boolean`. They write tests; course provides an analogous tiny assertion and explicit cases, not a complete solution file.

| Lesson ID           | Explain and show                                                                                 | Build                                                                                               | Check / failure                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `m02-boundary`      | C function/TS function; 12, 0, -2 highlight input/decision/return; teaching clock label          | Edit `src/submit-window.ts`, create `test/submit-window.test.ts`                                    | `npm test -- test/submit-window.test.ts`; 0 must be false; wrong `>=` produces an explained assertion failure                            |
| `m02-types-runtime` | Annotations disappear; `number` is not C `int`; distinguish compile check and runtime values     | Edit `src/demo.ts`, intentionally pass a string in a temporary experiment, then repair              | `npm run typecheck`; show diagnostic, emitted JS, then correct runtime output; no claim that types validate HTTP                         |
| `m02-records`       | Values inside a player object/array; string ID, object fields; optional field and missing lookup | Create `src/players.ts` and `test/players.test.ts`; simple lookup returning object or undefined     | `npm test -- test/players.test.ts`; missing player is handled before property access; explain shared object references vs C memory model |
| `m02-modules`       | File owner → export → import → call; one named contract                                          | Move an already learner-written helper into `src/rules.ts`; update its imports                      | `npm run typecheck`, `npm test`; wrong relative path/export routes to file tree, not reinstalling packages                               |
| `m02-transfer`      | Hide worked example; restate input/output and equality decision in words                         | Create `src/limit.ts`, `test/limit.test.ts`; learner chooses cases for used below/equal/above limit | `npm test -- test/limit.test.ts`; equal counts as reached, unlike previous timing rule; explain the changed comparison                   |

- [ ] Add these five IDs to content acceptance tests. Add a browser assertion that choosing `>=` at 0 displays expected false/observed true and does not lock Next or hints. Run relevant tests to see absent lesson/interaction failures.
- [ ] Author minimal examples such as the following explanation of one test, then ask the learner to write the related rule's boundary tests:

```ts
import { expect, test } from "vitest";
// This example tests an unrelated ready flag, not the learner's timing rule.
test("a ready flag is true", () => {
  const ready = true;
  expect(ready).toBe(true);
});
```

Include a red→green→explain sequence: a test fails on the intended boundary, the learner changes the rule, the assertion passes, and they explain why equality is excluded or included. Hints reveal reasoning progressively; never auto-insert the target function into their project.

- [ ] Rehearse each lesson and transfer case with the exact practice commands; record evidence. Run content/visual/browser checks and `npm run lint` after regeneration.
- [ ] Invite one real learner session: predict at zero, explain the highlighted comparison, create the file themselves, run and interpret a failing test, solve the changed limit task, leave and resume. Record observed stalls, help used, and independent explanation in the review document. Do not infer learning from approval of colors or layout. Keep this gate pending until the learner participates.
- [ ] Fix observed wording/granularity/navigation issues, rerun only affected checks, review compliance, and commit exact files with `feat(course): teach C to TypeScript through checked practice`. Stage 3 starts after the foundation walkthrough gate is satisfied.

## Stage 3 — Build a local game, then expose it

### Task 8: Author M03 state and M04 Problem/Run

**Files:** Create `.tours/learning/content/M03.json` and `M04.json`; modify `learning-path.json`, `scripts/build-content.test.mjs`, `course-evidence.json`; regenerate outputs. Source anchors: legacy L03/L05/L07, `packages/arena-model/src/model.ts`, `transitions.ts`, `packages/arena-game/src/match-authority.ts`, `file-bank.ts`, `judge.ts`, and their referenced tests.

**Interfaces:** Practice uses explicit boundaries `Clock = {now():number}`, `Judge = {run(request:RunRequest):Promise<RunResult>}`; the lesson authors define the smallest local `RunRequest`/`RunResult` records when introducing the Judge. They document the later mapping to actual `JudgeAdapter` types rather than claiming identical names. Dependency injection first means passing one object to a constructor/function; Nest decorators come later. New stable roles: `domain.match`, `domain.rules`, `port.clock`, `domain.problem`, `port.judge`, `workflow.run` and corresponding `test.*` roles.

| Lesson ID         | Visual and prerequisite idea                                       | Practice files introduced/edited                           | Required demonstrated behavior and failure branch                                                                                                         |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m03-records`     | Draw Match → current Round → sides → players; recap objects/arrays | `src/match.ts`, `test/match.test.ts`                       | Construct 1v1 records with explicit IDs; reject duplicate/missing membership; inspect the input object when identity check fails                          |
| `m03-transitions` | Phase arrow, action label, resulting phase; no timer yet           | `src/transitions.ts`, `test/transitions.test.ts`           | Allowed transition changes state; illegal transition preserves it and returns a useful error                                                              |
| `m03-membership`  | Trusted actor → side lookup → allowed command                      | `src/membership.ts`, `test/membership.test.ts`             | Member succeeds, outsider fails; wrong ID is a membership issue, not a missing type assertion                                                             |
| `m03-clock`       | Fixed injected timestamp against one Match deadline                | `src/clock.ts`, edit `src/rules.ts`, `test/rules.test.ts`  | `now < deadline` accepts; equality rejects; tests use supplied time without sleeping; replace the simplified seconds-left model explicitly                |
| `m04-problem`     | Public statement/examples/starter vs server-only hidden bundle     | `src/problem.ts`, `test/problem.test.ts`                   | Validate malformed bank input; public projection contains no hidden cases, answers, weights, or private paths                                             |
| `m04-judge-port`  | Call starts → waiting → resolved/rejected Promise                  | `src/judge.ts`, `test/fake-judge.ts`, `test/judge.test.ts` | Fake returns visible case results or an infrastructure error; explain `await`, rejected Promise, and test cleanup                                         |
| `m04-run`         | Editor source → visible cases → results, score unchanged           | `src/run.ts`, `test/run.test.ts`                           | Run never calls hidden-suite evaluation or changes score; errors distinguish compile/runtime/infrastructure; illegal phase/deadline does not invoke Judge |

Each coding row uses `npm test -- test/<name>.test.ts` at the practice root and `npm run typecheck` after changing interfaces. Exact `Check.cwd` is `.`. Keep hidden data server-side even during practice; the public DTO is deliberately selected fields, not object spread followed by deletion.

- [ ] Add content tests asserting all seven IDs and reference spans; run them failing before authoring. Add representative author-rehearsal acceptance cases for membership, equality, and no-score Run; this test form belongs in the disposable practice test directory and is authored alongside the lesson's local interface:

```ts
// src/rules.ts is specified in m03-clock to export this pure boolean decision.
import { isBeforeDeadline } from "../src/rules.js";
import { expect, test } from "vitest";
test("equality is already closed", () => {
  expect(isBeforeDeadline(99, 100)).toBe(true);
  expect(isBeforeDeadline(100, 100)).toBe(false);
  expect(isBeforeDeadline(101, 100)).toBe(false);
});
```

- [ ] Author each row using the six-phase contract. State signature `isBeforeDeadline(now:number,deadline:number):boolean`; explain that membership and phase checks remain separate and required. Show small examples for a different phase/value, then require a changed case independently. Illustrate fake Judge with controlled resolution/rejection, never executing supplied player code.
- [ ] Rehearse listed checks and deliberate failure paths; verify public projection by serialization and recursive forbidden-field checks against authored private fixture data. Compare invariants to the actual source tests; do not copy production files into practice.
- [ ] Run content/browser/generation checks, `npm run lint`, review compliance, update evidence/dispositions and mark ready. Commit named files with `feat(course): teach state problem data and visible runs`.

### Task 9: Author M05 Submit through terminal Match

**Files:** `.tours/learning/content/M05.json`, `learning-path.json`, `scripts/build-content.test.mjs`, `scripts/build-experience.test.mjs`, `course-evidence.json`; generated outputs. Reference L01/L02/L03/L06 and `evaluation-orchestration.ts`, `round-lifecycle.ts`, `packages/arena-model/src/scoring.ts`, `deadline-closure.test.ts`.

**Interfaces:** Teaching local `SubmissionReceipt`, immutable request identity, and `EvaluationOutcome` are defined with fields matching the behaviors below; the course must show the mapping to the source contract. Never require one giant `ArenaEngine` before explaining the smaller jobs. Practice roles `workflow.submit`, `workflow.evaluation`, `domain.scoring`, `domain.lifecycle`.

| Lesson ID            | One change / visual                                                             | Practice files                                      | Acceptance and useful failure                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m05-accept`         | Trusted member/phase/time gates → immutable accepted source and receipt         | `src/submit.ts`, `test/submit.test.ts`              | Reject before judging; receipt locks the accepted source even if the editor changes                                                                                  |
| `m05-pending`        | Separate accepted receipt from finished verdict                                 | `src/evaluation.ts`, `test/evaluation.test.ts`      | Controlled delayed fake Judge produces pending then settled; rejection is recorded explicitly, not a fabricated zero-score success                                   |
| `m05-retry`          | Same identity/same content joins original outcome; conflicting content rejected | Edit `src/evaluation.ts`, `test/evaluation.test.ts` | Concurrent duplicate requests yield one counted result; original error replays; wait happens outside the short Match lock                                            |
| `m05-score`          | Passed/total/group weight → basis points → one rounding point                   | `src/scoring.ts`, `test/scoring.test.ts`            | Groups total 100; invalid counts reject; rationally equivalent ratios score equally; never “round every case”                                                        |
| `m05-reveal`         | Private verdict → permitted Reveal → public breakdown                           | `src/lifecycle.ts`, `test/lifecycle.test.ts`        | No early hidden data; both normal settlement and evaluation failure are explained                                                                                    |
| `m05-round-reset`    | Before/after records: code/tests/readiness reset, Match totals retained         | Edit `src/lifecycle.ts`, `test/lifecycle.test.ts`   | Correct next Problem, fresh Round-scoped fields, unchanged Match-wide deadline                                                                                       |
| `m05-final-result`   | Sum scores → lower total scoring time → fewer submissions → draw                | Edit `src/scoring.ts`, `test/scoring.test.ts`       | Include equal totals with differing times, equal times with differing counts, exact draw; final counted submission is used                                           |
| `m05-deadline`       | Timeline: accepted before deadline, result at/after grace end                   | `src/deadline.ts`, `test/deadline.test.ts`          | Reject new Run/Submit at exact deadline; settle at grace boundary if permitted by actual reference; late result cannot replace terminal result; unplayed Rounds zero |
| `m05-complete-match` | Three-Round sequence with failed evaluation and retry                           | `test/local-match.test.ts`                          | Entire fake-Judge journey, then changed independent sequence; explain which checks remain fake and what persistence adds next                                        |

For all rows command is `npm test -- test/<name>.test.ts` plus typecheck at practice root. Use controlled clocks/promises, not timing sleeps. Every failure card distinguishes rule rejection from test setup mistakes; retry lesson shows why changing the identifier is not a safe fix for a network uncertainty.

- [ ] Add lesson availability and reference tests, then fail before writing content. Add browser timeline assertions for accepted-at-99/deadline-100 and result exactly at versus beyond grace; label it a simulation. Use source-backed authored frames; do not claim the diagram ran the engine.
- [ ] Teach scoring with an analogous example and rehearse actual checks with these independently computed expected values:

```ts
import { expect, test } from "vitest";
import { scoreGroups } from "../src/scoring.js";
// scoreGroups([{weight,passed,total}]) -> whole integer percent.
test("partial groups use one final rounding step", () => {
  expect(
    scoreGroups([
      { weight: 40, passed: 1, total: 3 },
      { weight: 60, passed: 1, total: 2 },
    ])
  ).toBe(43);
  expect(() => scoreGroups([{ weight: 90, passed: 1, total: 1 }])).toThrow();
});
```

- [ ] Author nine complete lessons. Each one recalls its immediate prerequisite; next lessons explicitly remove temporary simplifications. For deadline completion explain persisted Reveal-before-terminal behavior is demonstrated in M08, while this milestone checks local rules only. No statement that each Round gets a fresh clock.
- [ ] Rehearse same-identity success/error, conflicting reuse, equality, grace failure and final tie-breaks. Add evidence with exact commands and outcomes. Compare reference tests before marking content current.
- [ ] Run content/visual/browser/generation checks, `npm run lint`; review compliance and commit `feat(course): guide Submit scoring Reveal and deadlines`.

### Task 10: Author M06 HTTP and M07 browser UI

**Files:** `.tours/learning/content/M06.json`, `M07.json`, `learning-path.json`, `scripts/build-content.test.mjs`, `course-evidence.json`; generated outputs. Reference L01/L09/L12/L13; frontend and service manifests, controller/service/bootstrap, components, transport/session and their tests.

**Interfaces:** Introduce practice `src/server/` and `src/client/` only now; explain process separation and ownership before creating directories. Practice uses the reference Nest/React/Vite stack after inspecting and pinning the exact lockfile versions. Team mode uses mapped existing equivalents. Lesson check IDs map to `test/http.test.ts`, `test/transport.test.ts`, `test/ui.test.tsx` and a browser journey. Manifests/scripts are authored/rehearsed during this task as explicit configuration steps; never assume a framework CLI has silently created files.

| Lesson ID            | Change / visual                                                                   | Practice paths                                                           | Acceptance/failure                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `m06-http`           | Client request → listening process/port → JSON response                           | `src/server/main.ts`, `test/http.test.ts`                                | Start server; send one request; connection refused means check process/port, not modify domain rule                                 |
| `m06-controller`     | Route parses, service calls existing pure behavior; constructor injection diagram | `src/server/game.module.ts`, `game.controller.ts`, `game.service.ts`     | Route calls the already-tested rule; explain imports/decorators/provider registration before adding them                            |
| `m06-validation`     | Untrusted JSON → runtime parser → valid command                                   | `src/server/input.ts`, edit controller/tests                             | Missing/wrong fields fail 400; TS annotations alone do not reject JSON                                                              |
| `m06-identity`       | Verified server identity → membership, distinct from body player ID               | `src/server/identity.ts`, edit service/tests                             | Missing/untrusted/outsider actor fails; practice identity adapter conspicuously development-only                                    |
| `m07-browser-basics` | HTML element, CSS rule, event listener; browser is another process                | `src/client/index.html`, `src/client/basic.ts`, `src/client/style.css`   | One labeled input/button/output; keyboard operation; wrong selector explained via inspected DOM                                     |
| `m07-react-state`    | Event → state → render; props vs local state                                      | `src/client/main.tsx`, `App.tsx`, `test/ui.test.tsx`                     | Replace the simple demo deliberately; no direct DOM mutation alongside React; state update shows output                             |
| `m07-transport`      | Screen → interface → HTTP adapter; request loading/error/success                  | `src/client/transport.ts`, `http-transport.ts`, `test/transport.test.ts` | Loading ends on error, stale reply discarded, rejection displayed; network failure offers a diagnostic not blind Submit replay      |
| `m07-editor-run`     | Problem public DTO → editor → visible TestPanel                                   | `src/client/ProblemPanel.tsx`, `CodeEditor.tsx`, `TestPanel.tsx`         | CodeMirror lifecycle/language setup; Run result without score change, hidden fixture text absent from browser data                  |
| `m07-submit-reveal`  | Pending receipt → reveal → final result                                           | `src/client/SubmitPanel.tsx`, `RevealPanel.tsx`, `ResultPanel.tsx`       | Disable with explained reason, pending not final; terminal Reveal appears before result; authoritative refresh on revision conflict |
| `m07-local-journey`  | Bring the known pieces together; route map highlights all                         | `src/client/Arena.tsx`, `test/browser/local-game.spec.ts`                | Browser completes local 1v1 against server/fake Judge, including failed request, keyboard, and narrow screen                        |

- [ ] Add content tests for all ten IDs and distinct `service`/`browser` check kinds. Run failing. Create exact practice scripts for `dev:server`, `dev:client`, `test:service`, `test:ui`, `test:browser` in authored setup steps, with ports/expected ready output checked in rehearsal. List every created config file on a separate Build step, including Vite, JSX TypeScript settings, and service decorators configuration.
- [ ] Author actual request/response examples with small malformed cases. Introduce a temporary request shape for validation **before** gameplay wiring, so the learner can isolate the concept:

```ts
// The isolated validation exercise defines POST /practice-decision.
// Its command contains {secondsLeft:number}; it does not authorize a game Submit.
const bad = await fetch(`${baseUrl}/practice-decision`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ secondsLeft: "12" }),
});
expect(bad.status).toBe(400);
```

Rehearsal defines `baseUrl` from the actual server address in test setup and closes it in teardown. The gameplay controller then consumes trusted identity and authoritative Match time, not this teaching payload.

- [ ] Author each row, with request diagrams, one JSX concept at a time, a small analogous component, and a changed independent component. Explain effect subscription cleanup when the first subscription enters, not as unexplained boilerplate. State which browser data is private/public and show corresponding network payloads.
- [ ] Rehearse commands and complete one real browser-to-practice-server journey; fake Judge remains labeled. Trigger stopped server, 400, 401/403, 409 and Judge failure separately, confirm each diagnostic branch. Unit mocks alone cannot close browser checks.
- [ ] Run course tests/generation/lint, review compliance/evidence, and commit exact files with `feat(course): teach server and screen integration`.

## Stage 4 — Persistence, execution, and multiplayer

### Task 11: Author M08 persistence and M09 real Judge

**Files:** `.tours/learning/content/M08.json`, `M09.json`, `learning-path.json`, `scripts/build-content.test.mjs`, `course-evidence.json`; generated outputs. Read ADRs 0003/0004/0011/0012/0013 and legacy L06/L07/L08/L13/L14. Reference actual persistence/Postgres/evaluation/provider/worker tests before writing claims.

**Interfaces:** Practice introduces `src/store/`, `src/judge/`, `src/worker/`, `infra/`, and environment-aware test scripts. The persistence port describes load/save/revision/claim responsibilities; the Judge port separates verdict data from Game-owned scoring. Learner builds both ports incrementally, with local names explicitly mapped to reference interfaces. Each DB/Judge check uses its own `Check.kind`; no substitution by unit tests.

| Lesson ID          | Build and visual                                                              | Practice paths                                                                            | Required check / recovery                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `m08-store-port`   | Memory store vs durable store, one operation at a time                        | `src/store/store.ts`, `memory-store.ts`, `test/store.test.ts`                             | Same domain action via injected memory store; explain test isolation/cleanup                                                             |
| `m08-postgres`     | Row/schema/relations/JSONB vs JS object; ownership diagram                    | `src/store/postgres-store.ts`, `infra/schema.sql`, `test/postgres.test.ts`                | Real round-trip and restart from persisted record; connection failure check host/port/env rather than weakening assertions               |
| `m08-transactions` | Begin → update → commit/rollback, revision comparison                         | Edit store, `test/revision.test.ts`                                                       | Two writers: stale save rejected, authoritative refresh, no blind replay; failed transaction leaves prior durable state                  |
| `m08-claims`       | Accept under lock → claim → Judge outside lock → owner-session commit         | `src/evaluation-claims.ts`, `test/claims.test.ts`                                         | Concurrent workers cannot count twice; session loss makes pending reclaimable; stale owner cannot commit; dedicated claim pool explained |
| `m08-events`       | Failed write has no event; committed revision stamps delivery                 | `src/events.ts`, `test/events.test.ts`                                                    | Publish only after commit, listener failure isolated; missed event recoverable via snapshot, no promised durable outbox                  |
| `m08-recovery`     | Restart pending evaluation; persisted Reveal followed by failed terminal save | `src/recovery.ts`, `test/recovery.test.ts`                                                | Idempotent sweep finishes after a later retry; accepted timing/grace preserved; broader cross-process mutation limitations labeled       |
| `m09-isolation`    | Game passes data across private worker boundary; untrusted process per case   | Read dedicated Judge design and `.env.example`; create `src/judge/contract.ts`            | Explain compiler/program/worker failures and why Game process must never execute source directly                                         |
| `m09-provider`     | Explicit configured provider → adapter; no fallback arrow                     | `src/judge/provider.ts`, `container-judge.ts`, `worker-judge.ts`, `test/provider.test.ts` | Invalid config fails clearly; selected unavailable provider fails, never silently switches; Judge0 optional/reference-only               |
| `m09-case-runner`  | Compile once where contract permits; isolated cases, capped I/O/resources     | `src/judge/case-runner.ts`, `infra/judge.Dockerfile`, `test/judge.test.ts`                | Real C/C++/Python known cases, compile/runtime/time/memory/output failures, hidden input sealing; Docker unavailable recorded blocked    |
| `m09-worker`       | Authenticated private job endpoint and finite queue                           | `src/worker/main.ts`, `queue.ts`, `readiness.ts`, `test/worker.test.ts`                   | Queue full, timeout, malformed result, worker unavailable, readiness; cleanup creates no orphan execution                                |
| `m09-replace-fake` | Same Game contract, real adapter; compare fake and actual evidence            | Edit server wiring, `test/real-evaluation.test.ts`                                        | Actual submitted program settles via configured provider; scoring remains in Game; bounded test load                                     |

Practice command families: `npm test -- test/<name>.test.ts` for pure tests; author/rehearse explicit `test:db` and `test:judge` scripts for live dependencies with their env files and cwd shown. Do not put secrets in lesson commands, imported profiles, or evidence. Show `.env.example` variable names and `.gitignore` instruction.

- [ ] Add content tests for eleven IDs and ensure every real environment lesson contains the corresponding check kind; run failing. Add an evidence fixture where a DB check is blocked alongside passed unit checks; keep the DB gate pending. Task 14 consumes this fixture in the complete-course audit test.
- [ ] Author the lock/claim timeline with explicit frames and failure cases. An actual rehearsal test for post-commit behavior has this locally introduced port contract:

```ts
// saveThenPublish(save:()=>Promise<void>, publish:()=>void):Promise<void>
import { saveThenPublish } from "../src/events.js";
import { expect, test, vi } from "vitest";
test("failed durability cannot announce success", async () => {
  const publish = vi.fn();
  await expect(
    saveThenPublish(async () => {
      throw new Error("write failed");
    }, publish)
  ).rejects.toThrow("write failed");
  expect(publish).not.toHaveBeenCalled();
});
```

This small function teaches ordering. The subsequent integration test uses the actual Postgres transaction and authoritative revision; it cannot be replaced by the mocked assertion.

- [ ] Rehearse real database concurrency/restart/claim loss; real configured Judge failures and resource bounds; private worker HTTP/queue/readiness. Read runner security requirements before executing untrusted fixtures; bounded benign failure fixtures only. Record exact environment and results; absent Docker/DB is a visible blocker.
- [ ] Verify source-backed course wording: no arbitrary code in Game/browser, no hidden suite in public DTO/logs, explicit provider choice, no production-auth claim from practice credentials, and no horizontal scalability claim beyond actual reference limitations.
- [ ] Run content/browser/generation/lint checks, update evidence/dispositions/compliance, and commit `feat(course): teach durable recovery and isolated judging`.

### Task 12: Author M10 invitation/live play, M11 2v2, M12 chat

**Files:** `.tours/learning/content/M10.json`, `M11.json`, `M12.json`, `learning-path.json`, `scripts/build-content.test.mjs`, `course-evidence.json`; generated outputs. Reference L04/L09/L10/L11/L12 and ADRs 0006–0013.

**Interfaces:** Practice introduces Lobby reconciliation, socket authorization/presence, shared document revision/readiness, and sidecar lifecycle as separate owners. Code paths below are practice paths, not instructions to duplicate modules in a team repo. Every role has a source/practice mapping.

| Lesson ID            | Explanation/visual and file home                                                                                                                                                                                                                                                                                                                                                                       | Required check and failure                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `m10-invite`         | Invitation code, sides, host; `src/lobby.ts`, `test/lobby.test.ts`                                                                                                                                                                                                                                                                                                                                     | Invalid invite, full side, concurrent joins; public queue retained only as explained reference scope                                                                                                         |
| `m10-start`          | Ready + host + full sides → one durable Match; edit Lobby tests                                                                                                                                                                                                                                                                                                                                        | Concurrent starts return one handoff; failed creation does not create phantom membership                                                                                                                     |
| `m10-socket-auth`    | Handshake → trusted principal → per-Match membership; `src/server/socket-auth.ts`, `test/socket-auth.test.ts`                                                                                                                                                                                                                                                                                          | Missing identity/nonmember rejected; no trust in client-supplied player IDs                                                                                                                                  |
| `m10-presence`       | Two sockets, one player, first connect/last disconnect; `src/presence.ts`, `test/presence.test.ts`                                                                                                                                                                                                                                                                                                     | Closing one tab does not mark player offline while another remains; presence separate from game status                                                                                                       |
| `m10-reconnect`      | Event hints + authoritative snapshot + revision; `src/client/socket-transport.ts`, `lobby-session.ts`, `test/reconnect.test.ts`                                                                                                                                                                                                                                                                        | Stale responses ignored, active room rejoined, handoff once, 409 refresh without unsafe replay; lost event recovered from state                                                                              |
| `m10-two-clients`    | Browser A/B each owns UI but sees one server Match; `test/browser/live-1v1.spec.ts`                                                                                                                                                                                                                                                                                                                    | Real invitation and complete 1v1 with disconnect/reconnect, not two clients sharing a mock authority                                                                                                         |
| `m11-document`       | Local Y.Doc → authenticated Game-derived room → Socket.IO update relay → browser provider → CodeMirror Y.Text binding; `src/collaboration.ts`, `src/server/collab.gateway.ts`, `src/client/collab-provider.ts`, `src/client/collaboration-editor.ts`, `test/collaboration.test.ts`, `test/collaboration-transport.test.ts`, `test/collaboration-provider.test.ts`, `test/collaboration-editor.test.ts` | Two authorized teammates receive updates, the opposite side and strangers receive no document bytes, reconnect applies a fresh baseline; install exact Yjs and editor-binding versions before importing them |
| `m11-ready`          | Each teammate's Ready at revision r; edit advances revision and clears Ready                                                                                                                                                                                                                                                                                                                           | `src/readiness.ts`, `test/readiness.test.ts`; both Ready required; edit/language change invalidates; accepted Submit captures agreed snapshot                                                                |
| `m11-round-lifetime` | Old Round client disposed, new document attached; `src/client/collab-session.ts`, `test/collab-session.test.ts`                                                                                                                                                                                                                                                                                        | Reconnect and Round changes cannot leak old callbacks/updates or retain old Ready                                                                                                                            |
| `m11-four-clients`   | Two visibly isolated teams; `test/browser/live-2v2.spec.ts`                                                                                                                                                                                                                                                                                                                                            | Real four-client edit/Ready/Submit/Reveal with cross-team rejection and recovery                                                                                                                             |
| `m12-chat`           | Game namespace → Match → team; `src/chat.ts`, `src/server/chat.gateway.ts`, `test/chat.test.ts`                                                                                                                                                                                                                                                                                                        | Message/ping validation, membership, bounded history; history reset on process restart explained honestly                                                                                                    |
| `m12-sidecars`       | Round-scoped collaboration vs Match-scoped chat; `src/client/sidecars.ts`, `test/sidecars.test.ts`                                                                                                                                                                                                                                                                                                     | Round change replaces collaboration and preserves chat; Match change disposes both; canceled late factory result disposed                                                                                    |
| `m12-live-chat`      | Chat follows actual multiplayer journey; `test/browser/live-chat.spec.ts`                                                                                                                                                                                                                                                                                                                              | Only teammates receive history/messages/pings, no duplicate listeners after reconnect                                                                                                                        |

- [ ] Add thirteen lesson IDs, real-browser check kinds, and required isolation/cleanup behaviors to content acceptance. Run failing. Use a meaningful independent rehearsal assertion, introducing the local presence contract explicitly:

```ts
// Presence.open(userId,socketId), close(socketId), isOnline(userId):boolean
const presence = new Presence();
presence.open("alice", "tab-a");
presence.open("alice", "tab-b");
presence.close("tab-a");
expect(presence.isOnline("alice")).toBe(true);
presence.close("tab-b");
expect(presence.isOnline("alice")).toBe(false);
```

Place the complete test (imports, construction, named `test`) in the rehearsal `test/presence.test.ts`. Explain Set/Map only when introducing socket membership.

- [ ] Author lessons one at a time with network diagrams and before/after state frames. Avoid adding Socket.IO, Yjs, chat and four-player state in a single setup step. Provide exact manifest additions from reviewed versions, scripts/cwd/expected server logs, then incrementally introduce gateway and client files.
- [ ] In M11, create the membership/sync integration test before the collaboration gateway, the provider unit test before the browser provider, and the editor test before the CodeMirror binding. Give each check a command that targets the test file just introduced.
- [ ] Rehearse invitation joins/start, stale fetch and reconnect, multiple sockets, team isolation, readiness invalidation/source snapshot, Round cleanup, chat history bounds and canceled client factories. Unit tests run `npm test -- test/<name>.test.ts`; authored `test:browser` executes the actual named multi-client specs against the practice stack. Distinguish tests blocked by infrastructure from implementation failures.
- [ ] Run course/browser/generation/lint checks, update evidence/dispositions/compliance, and commit named files with `feat(course): guide live invitation play teams and chat`.

## Stage 5 — Team destination and complete coverage

### Task 13: Ship the team transition workflow and M13 integration guidance

**Files:** `.tours/learning/content/M13.json`, `templates/workspace.template.html`, `assets/build-runtime.mjs`, `assets/build-workspaces.mjs`, `scripts/build-workspaces.test.mjs`, `scripts/build-experience.test.mjs`, `learning-path.json`, `course-evidence.json`; generated outputs.

**Interfaces:** Reuse `WorkspaceProfile`, `Mapping`, `validateWorkspaceProfile`, `resolveBuildStep`, and the progress `profile`/`workspace` events. No second mapping schema or automatic repository writer. Team profile is created from inspected repository facts and explicit learner entries, stored/exported with progress. `verification:'learner-reported'` labels the origin; it never upgrades an imported record to fresh execution evidence.

| Lesson ID          | Guidance/file responsibility                                                                                                                   | Check and unavailable state                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `m13-inspect-team` | Read actual README, manifests, contribution rules, owners, tooling and identity/deployment contracts; show reference/practice/team differences | Named observations required before mapping; no repo yet → practice remains available and this team check remains blocked       |
| `m13-map-rule`     | Map one existing learner-authored pure rule and its test; explain import/config adaptation and reuse/create/extend choice                      | Run actual team test command at actual cwd; record independent target result; do not copy practice pass                        |
| `m13-integrate`    | Feature-by-feature mapping of server identity, navigation, database/config ownership, editor/transport and errors                              | Reuse teammate implementations where present; unresolved owner/contract appears as a named external dependency                 |
| `m13-compose`      | Explain Dockerfile vs image vs container vs Compose services/network/volumes; private worker and DB                                            | Actual team's documented one-command launch, readiness and restart checks; Docker missing is a blocker, not a passed checklist |
| `m13-tls`          | Browser HTTPS → Nginx → private services; WSS, dev certificates, ignored secrets                                                               | Real HTTPS/WSS path and identity failure check; no hard-coded secrets or disabled verification as the finished path            |
| `m13-parity`       | Behavior matrix compares expected/target/reference evidence                                                                                    | Actual 1v1, 2v2, isolation, reconnect, deadline, Judge/DB/worker failures; record intentional differences with reasons         |
| `m13-handover`     | English README, prerequisites, roles, stack, schema, modules, contribution and AI-use disclosure                                               | Review against PDF, team-owned pages/auth/requirements checked by responsible owners; incomplete obligations remain visible    |

- [ ] Write browser test for team unavailable → switch back to practice → practice lesson intact. Write a test creating a partial team profile with only one rule mapping; mapped step resolves, unmapped HTTP step displays a named missing dependency, and no practice command appears under the team label. Run failing.
- [ ] Build the workspace page with root entry, read-only reference/practice columns, editable target path/action/reason/check/cwd/dependency, review summary and explicit save. Preview changes before replacing a profile. Explain that the browser cannot inspect the real repo; provide a short inspection checklist the learner can answer or bring into the conversation. Do not pretend a typed path has been checked on disk.

```js
const next = validateWorkspaceProfile(formValue);
const resolved = resolveBuildStep(step, lesson, next);
// Use DOM text nodes for every imported or entered string.
rootLabel.textContent = next.root ?? "Choose the team repository root";
missingList.replaceChildren(
  ...resolved.blockedBy.map((reason) => {
    const item = document.createElement("li");
    item.textContent = reason;
    return item;
  })
);
```

`formValue`, `step`, `lesson`, `rootLabel`, and `missingList` are local bindings in the workspace form handler; select them from current validated course/profile state, not global arbitrary page data.

- [ ] Author seven full M13 lessons. Inspection instructions are runnable now; actual team command cards remain unresolved until the repo exists and is inspected. Explain how existing stack differences change file mapping without requiring a new framework. For a partially implemented feature, offer a specific extend/reuse action after inspection, never a blind overwrite command.
- [ ] Rehearse transition with a disposable fixture repo using a different directory layout and test command. Verify changed root, imports, command/cwd, missing team component, existing implementation reuse, and separate reported results. Label this a workflow test, not verification of the friend's repo.
- [ ] If the real team repo has become available, inspect it and prepare its concrete profile with the learner; guide their first rule/test transfer. Otherwise complete the platform and content, leave target checks blocked, and state that distinction in the completion report.
- [ ] Run workspace/state/browser/generation tests and `npm run lint`, review compliance, update evidence, and commit named files with `feat(course): guide transition into the team repository`.

### Task 14: Close file and behavior coverage, verify, and hand off

**Files:** Create `.tours/learning/scripts/build-coverage.mjs`, `scripts/build-coverage.test.mjs`. Modify `learning-path.json`, `scripts/build-catalog.mjs`, `scripts/build-content.test.mjs`, `.tours/learning/{README,MISSION,NOTES,RESOURCES,MAINTAINING}.md`, `course-evidence.json`, and `prototype/game-ui/42-subject-compliance.md` if evidence/status changes; regenerate outputs.

**Interfaces:**

```ts
type Evidence = {
  lessonId: string;
  workspace: "author-rehearsal" | "reference" | "learner-practice" | "team";
  kind: Check["kind"];
  command: string;
  cwd: string;
  result: "passed" | "failed" | "blocked";
  observed: string;
  checkedAt: string;
  revision: string;
  sourceSnapshotId: string;
  checkId: string;
};
type CoverageResult = {
  courseReady: boolean;
  targetComplete: boolean;
  issues: { id: string; reason: string; scope: "course" | "target" }[];
};
// referenceData is the existing buildCatalogData return object.
function auditBuildCoverage(
  course: ValidCourse,
  referenceData: ReferenceData,
  evidence: Evidence[]
): CoverageResult;
```

Include `checkId` in the evidence records introduced in Task 6 so this task never matches results by vague command text. This authored evidence is separate from browser self-reports. Unknown/malformed evidence is rejected, not silently counted. Passed author checks must match current revision, source snapshot, and the exact check ID/kind; only team evidence may contribute to target completion. Any failed/blocked latest result keeps its gate open.

- [ ] Add these five coverage cases, then run `node --test .tours/learning/scripts/build-coverage.test.mjs` failing: new inventoried file without disposition; mapped file without required behavior check; old source snapshot; blocked actual-Judge check despite passing unit mocks; passed rehearsal with zero target evidence. Sample assertion:

```js
test("reference and rehearsal passes cannot complete the destination", () => {
  const f = foundationFixture();
  const course = validateBuildPath(f.raw, f.lessons, f.referenceData);
  const result = auditBuildCoverage(course, f.referenceData, []);
  assert.equal(result.targetComplete, false);
  assert.ok(result.issues.some((issue) => issue.scope === "target"));
});
```

For the positive fixture, make every manifest entry ready, give every scoped file one disposition, every required behavior a checked lesson, and current author-rehearsal evidence for every required non-explanation check. Then add matching team evidence and confirm only `targetComplete` changes. Add a subsequent blocked team result and confirm it changes back to false. Foundation learner walkthrough remains its own human gate; do not infer it from evidence count.

- [ ] Implement audit by enumerating actual catalog files, joining dispositions, joining behavior lesson/check IDs, checking freshness, and grouping evidence by workspace/check ID with most recent ISO timestamp. Do not count optional/support rows toward required build obligations; retain their reasons in the output. A stale reference is a course issue even with old passing evidence. Call the audit from `build-catalog.mjs`; add `--check-build-complete` for the strict course gate. Normal `--check` still detects current generated/source drift while reporting authored coverage counts during incremental delivery.

```js
const strict = process.argv.includes("--check-build-complete");
const report = auditBuildCoverage(course, data, evidence);
if (strict && !report.courseReady) process.exitCode = 1;
```

`course`, `data`, and `evidence` come from the validated loader, existing reference catalog, and parsed evidence file in `main`; do not re-run source acceptance or mutate hashes. Ordinary build never writes new execution evidence.

- [ ] Review **every inventoried file**, including the 16 previously support-only files and 21 explicit exclusions from the design baseline. Assign a build lesson, explained support role, or reviewed exclusion with a specific reason. Recheck current counts; do not hard-code 201 as a perpetual invariant. Reconcile all 19 behavior rows from the spec with demonstrated checks. Public queue/Judge0/harnesses/spike/Core/Chat skeletons/telemetry remain reasoned dispositions, not silently required production features.
- [ ] Revise README to describe the implemented beginner entry and reference library; revise MISSION/NOTES with full build scope and evidence distinctions; keep research links and limits in RESOURCES; document authoring schema, new tests, profile export/import, content changes, freshness review and strict coverage check in MAINTAINING. Avoid claiming every lesson complete until strict check and human content review pass.
- [ ] Run final relevant checks from repository root:

```sh
node .tours/learning/scripts/build-catalog.mjs
node --test .tours/learning/scripts/*.test.mjs
node .tours/learning/scripts/build-catalog.mjs --check
node .tours/learning/scripts/build-catalog.mjs --check-build-complete
npm run lint
git diff --check
```

Run actual rehearsal/target commands recorded by each lesson as needed to close remaining risks, not broad repeated game suites unrelated to course changes. If generator integration changes production scripts/dependencies, also run root typecheck/build. Do not invent a success for unavailable browser/Docker/Postgres. A blocked mandatory gate remains in the handoff.

- [ ] Browser walkthrough: new learner → choose practice → explain C/TS mapping → boundary error/hint → file/build/check → changed transfer task → return/resume → export/import → team profile with missing mapping → complete one actual feature journey. Inspect dusk/light, 390 px and wide screens, keyboard, reduced motion, direct source navigation, offline behavior, storage denial, and zero console warnings/errors. Retain screenshots and exact observed results.
- [ ] Review relevant PDF mandatory/module requirements and compliance matrix. Record course evidence only; preserve team module sign-off boundaries. Commit exact task files with `docs(course): complete guided build coverage and verification` after checks. Use the finishing-a-development-branch skill for integration options, preserving existing uncommitted user work. No automatic publishing is included.

## Self-review against the approved design

| Design requirement                                              | Owning tasks and verification                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| C learner, easy English, explain why/order/dependencies         | 1, 6–7, all lesson tables; independent learner session                   |
| Whole-game scope with no “build the rest” ending                | 8–13; 19 behavior rows and per-file audit in 14                          |
| Reference/practice/team distinction                             | 2–3, 6, 13; no inherited target pass tests                               |
| Six phases, exact file/check/help contract                      | 1, 4–7; structural + behavioral + human checks                           |
| Visual cues, C comparison, workspace/root visibility            | 4–5, 7; browser observations and boundary exercise                       |
| Dusk/light, responsiveness, keyboard, reduced motion            | 4–5, 14; screenshots and keyboard/browser checks                         |
| Small examples, fading help, retrieval, changed transfer task   | 5, 7–13; one transfer per lesson, observed independent exercise          |
| No copy/paste finished game or browser code runner              | 5–7; config-only downloads, data-driven visuals, actual learner coding   |
| M00–M13 with correct prerequisites                              | 1 and 6–13; graph validator and complete-course gate                     |
| Full timing/scoring/retry/persistence and real execution detail | 9, 11; source-backed cases and actual environment checks                 |
| Invitation live play, safe teams, Game-owned chat/lifetimes     | 12; real multi-client rehearsal and lifecycle cases                      |
| Storage/import failure, safe rendering, resume, old activity    | 2, 5; pure state + browser failure tests                                 |
| Progress/freshness/evidence/compliance kept distinct            | 1–2, 14; old/new revision and scope-specific evidence tests              |
| Team transition at any checked point; missing repo allowed      | 3, 13; fixture transition and visible outstanding target checks          |
| Preserve reference URLs/snapshots and dirty course work         | 1, 4, 14; reconciliation record, legacy tests, unchanged acceptance flow |
| Author complete content, source review and maintenance          | 6–14; rehearsal evidence, dispositions, maintenance docs                 |

### Execution notes

- **Planning review:** Checked 14 implementation tasks, 68 unique lesson IDs across M00–M13, balanced code fences, document links, schema/API consistency, spec coverage, and the five Review Focus cases. No lesson implementation or learner workspace creation occurred while writing this plan. Existing work is preserved.
- **Reference check on 2026-09-28:** The read-only catalog check retained snapshot `4edc506dd9158d21`, 201 source files, and 381 current links with zero source drift. It exited nonzero because the compliance-document update changed one checksum input and made `index.html`/`source-map.html` stale. This is recorded, not a passing check. Review that documentation evidence and refresh the affected generated outputs through the existing acceptance procedure during execution; no source hashes were accepted while planning.
- **User gate:** The writing-plans skill requires review of this concrete plan before implementation. Keep the user's **Native** execution choice; do not ask for the method again.
- **Native start:** After plan review, read executing-plans and using-git-worktrees, confirm/reconcile the checkout, then implement tasks in order. Each task's commit uses explicit files and includes generated outputs only when changed by its source.
- **Completion language:** A finished lesson shell is Stage 1, not the complete course. A finished course is not the learner's completed game. A passing reference or author rehearsal is not a passing target repository. Report each accurately.
