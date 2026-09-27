# Code Arena Course Refresh and Learner Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 14 Code Arena lessons onto the current reviewed implementation, then give the learner one accessible course home with honest local activity and a consistent route through the lessons.

**Architecture:** Keep `coverage-map.json` as the single source for lesson order, four curriculum batches, source references, and file dispositions. Extend the existing Node generator to produce a learner-facing `index.html` beside the maintainer-facing `source-map.html`, and inject one small offline activity runtime into generated pages. Refresh course prose, CodeTours, evidence, and the frozen snapshot only after each changed behavior and source anchor has been reviewed.

**Tech Stack:** Node.js ESM, `node:test`, Playwright, static HTML/CSS/JavaScript, existing Vitest suites, existing course catalog and snapshot tooling.

**Spec:** `docs/superpowers/specs/2026-09-26-code-arena-learning-course-design.md`; learner experience direction: `docs/code-arena-learning-platform-ux-research.md`; visual interaction reference: `.scratch/learning-platform-ux-prototype.html`

## Global Constraints

- Teach one behavior at a time with the established sequence: predict, trace current source, inspect a relevant test and its limits, retrieve the explanation, then state a rewrite-test contract.
- Use the domain terms in `CONTEXT.md`: Match, Round, Problem, Run, Submission, Hidden suite, Reveal, Readiness, Presence, Player status, Match phase, Match deadline, Lobby, and Match event.
- Preserve the current 14-lesson order and the four approved batches; this work refreshes and presents the curriculum rather than replacing it.
- Keep the course static, local, offline-compatible, and dependency-free in the browser. Do not add a framework, login, cloud sync, LMS, AI tutor, adaptive scoring, or learner analytics.
- Store activity only as `not started`, `started`, or `self-check recorded`. Never label activity as mastery, parity, module completion, or team sign-off.
- Track the last opened lesson only. Do not persist a lesson's internal stage unless the Lesson 1 pilot demonstrates that last-lesson resume is insufficient.
- Prediction questions and hints must never block the trace or explanation.
- Keep **Learn**, **Explore code**, and **Maintain the course** as distinct routes. `index.html` is the learner start page; `source-map.html` remains the complete audit and code explorer; maintenance commands live in `MAINTAINING.md`.
- A generated page is current only when its lesson references match the deliberately accepted source snapshot. Never refresh hashes merely to make `--check` pass.
- The Judge isolation spike remains labeled as an experiment. The Game service, Judge worker, and configured provider adapters must be described according to current runtime behavior.
- Course content and test results are implementation evidence only. They do not create or promote a 42 subject module claim.
- The course UI must remain clear, responsive, usable at 320 CSS pixels, keyboard-operable, and compatible with the latest stable Google Chrome. It must emit no browser console errors.
- Use native HTML controls and landmarks. Keep visible focus, a working skip link, sequential headings, 44-pixel minimum interactive targets, reduced-motion support, non-color status text, and source previews in the existing native `<dialog>`.
- Run `npm run lint` before completing the UI work, as required by `AGENTS.md`. Also run the course checks, focused game tests, build/type checks, and `git diff --check` listed in the final task.
- Review `ft_transcendence.pdf` and `prototype/game-ui/42-subject-compliance.md` before completion. Update the matrix only if requirement evidence, assumptions, scope, module claims, or compliance status changed.
- Preserve unrelated working-tree files, including `.trigger-tree/` telemetry and locally installed agent skills.

## Review Focus

- A Match deadline can expire in Round Intro or Coding, can count a pre-deadline Submission only inside the absolute bounded grace, and persists the current Round Reveal plus terminal `MATCH_COMPLETE` state; the final result is computed from saved counted Round records, with unplayed Rounds at zero. Task 2 pins every case to `deadline-closure.test.ts`.
- Lobby socket payloads and mutation responses are hints, so delayed responses must not restore stale room state and the first-release UI must remain invitation-only; Task 3 pins the stale-response, mutation-refresh, reconnect, and legacy-queue cases.
- Match events must publish after a successful save with the committed revision, while a reconnect recovers from an authoritative snapshot; Task 4 pins failed-save suppression and revision behavior.
- Local storage can be missing, denied, malformed, or contain a removed lesson ID; Task 8 verifies that every page remains usable and Course Home falls back to Lesson 1 without calling activity mastery.
- Generated navigation can drift from catalog order or break at local `file://`, keyboard, narrow viewport, and source-dialog boundaries; Tasks 7-9 exercise catalog validation, direct-file navigation, focus, 320-pixel layout, and console output.

---

## File Structure

### New files

- `.tours/learning/templates/course-home.template.html` - authored learner-facing home shell with one Start/Continue action and four batch regions.
- `.tours/learning/index.html` - generated Course Home output.
- `.tours/learning/assets/course-activity.mjs` - dependency-free activity parsing, safe storage, Start/Continue resolution, and browser wiring; inlined into generated pages.
- `.tours/learning/scripts/course-activity.test.mjs` - pure activity-state tests and malformed/unavailable storage cases.
- `.tours/learning/scripts/course-experience.test.mjs` - Chrome/Playwright checks for Course Home, resume, keyboard navigation, local-file behavior, responsive layout, and console errors.
- `.tours/learning/MAINTAINING.md` - snapshot review, generation, test, and acceptance workflow for course maintainers.

### Existing files changed by the source refresh

- `.tours/learning/coverage-map.json` - schema version 2, four batches, current source ranges, all 23 new-file dispositions, and the `.codex` scope exclusion.
- `.tours/learning/templates/0001-submit-journey.template.html` through `0014-rewrite-with-tests.template.html` - reviewed prose, links, evidence limits, shared learner navigation hooks, and current behavior.
- `.tours/learning/lessons/*.html` - regenerated lesson outputs from the reviewed snapshot.
- `.tours/1-code-arena-big-picture.tour` through `.tours/6-rebuild-the-game.tour` - repaired source anchors and changed-behavior steps.
- `.tours/reference-baseline.md`, `.tours/reference-baseline.sha256`, and `.tours/learning/reference-snapshot.json` - updated only through the explicit reviewed-snapshot command.

### Existing files changed by the learner experience

- `.tours/learning/scripts/build-catalog.mjs` - schema validation, batch rendering, Course Home generation, shared navigation rendering, and runtime injection.
- `.tours/learning/scripts/build-catalog.test.mjs` - batch, home, generated navigation, output drift, and refreshed evidence assertions.
- `.tours/learning/scripts/source-preview.test.mjs` - fixture schema version 2 and Course Home/source-map route assertions.
- `.tours/learning/templates/source-map.template.html` - Explore-code labeling and a quiet link back to Course Home; the audit content remains intact.
- `.tours/learning/assets/course.css` - Course Home, shared lesson header/footer, activity statuses, responsive rules, visible focus, and reduced-motion behavior.
- `.tours/learning/README.md` - short start instructions pointing to Course Home.
- `.tours/learning/MISSION.md`, `.tours/learning/NOTES.md`, and `.tours/learning/RESOURCES.md` - current route descriptions, pilot record, and evidence limits.

## Shared Interfaces

### Catalog schema version 2

```json
{
  "version": 2,
  "batches": [
    {
      "id": "follow-one-match",
      "order": 1,
      "title": "Follow one Match",
      "description": "Start from player actions and trace what the game decides.",
      "lessonIds": [
        "0001-submit-journey",
        "0002-reveal-cutoff",
        "0003-rounds-and-final-score",
        "0004-lobby-to-match",
        "0005-problem-editor-run"
      ]
    },
    {
      "id": "understand-boundaries",
      "order": 2,
      "title": "Understand the boundaries",
      "description": "See which layer owns each responsibility and where the evidence stops.",
      "lessonIds": [
        "0006-evaluation-retries",
        "0007-judge-boundary",
        "0008-persistence-recovery"
      ]
    },
    {
      "id": "live-multiplayer",
      "order": 3,
      "title": "Follow live multiplayer behavior",
      "description": "Trace reconnect, shared work, chat, and the Arena screen.",
      "lessonIds": [
        "0009-live-connection",
        "0010-team-collaboration",
        "0011-team-chat",
        "0012-arena-screen"
      ]
    },
    {
      "id": "operate-and-rebuild",
      "order": 4,
      "title": "Operate and rebuild the reference",
      "description": "Run the project, read its evidence, and define parity gates for a rewrite.",
      "lessonIds": [
        "0013-running-the-project",
        "0014-rewrite-with-tests"
      ]
    }
  ]
}
```

`validateCoverageMap()` returns `{ scope, batches, lessons, supportingFiles }`. It rejects duplicate batch IDs/orders, an unknown lesson ID, a lesson listed twice, an omitted lesson, and lesson order that disagrees with the flattened batch order.

### Activity state

```ts
const COURSE_ACTIVITY_KEY = "code-arena-learning:activity:v1";
type ActivityStatus = "started" | "self-check-recorded";
type CourseActivity = {
  version: 1;
  lastLessonId: string | null;
  lessons: Record<string, ActivityStatus>;
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type OrderedLesson = { id: string; order: number; output: string };

readCourseActivity(storage: StorageLike | null, validLessonIds: string[]): CourseActivity
writeCourseActivity(storage: StorageLike | null, activity: CourseActivity): boolean
markLessonActivity(activity: CourseActivity, lessonId: string, status: ActivityStatus): CourseActivity
resolveContinueLesson(activity: CourseActivity, orderedLessons: OrderedLesson[]): OrderedLesson
installCourseActivity(root: Document, storage: StorageLike | null, orderedLessons: OrderedLesson[]): void
```

Every storage read/write catches access errors. Invalid JSON, wrong schema versions, invalid statuses, and removed lesson IDs normalize to an empty version-1 record. `resolveContinueLesson()` returns the recorded lesson when valid and the first ordered lesson otherwise.

### Generated page rendering

```ts
renderCourseHomeTemplate(template: string, stylesheet: string, runtime: string, data: CatalogData): string
renderCourseNavigation(lessons: LessonRecord[], currentLessonId: string): string
renderCatalogOutputs(
  repoRoot: string,
  learningDir: string,
  coverageMap: CoverageMapV2,
  options?: CatalogOptions,
): Promise<{ data: CatalogData; files: Map<string, string> }>
```

`renderCourseNavigation()` emits Course Home, Explore code, previous, and next links from catalog order. `renderLessonTemplate()` injects that navigation and the activity runtime into explicit placeholders; lesson templates do not hand-maintain neighboring lesson URLs.

## Tasks

### Task 1: Pin the current drift and the new catalog dispositions

**Files:**
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Modify: `.tours/learning/coverage-map.json`
- Inspect: `.tours/learning/reference-snapshot.json`

**Interfaces:**
- Consumes: current `buildCatalogData()` file statuses and `formatAuditReport()` output.
- Produces: exact test expectations for the 23 initially uncovered files, one `.codex` exclusion, and the affected lesson IDs that Tasks 2-5 must satisfy.

- [x] **Step 1: Add the repository drift fixture to a failing end-state test.** Capture these exact paths as the current diagnostic input, then assert that the completed catalog maps each path to the disposition matrix in Step 3 and leaves `uncovered` empty. The disposition assertion provides the initial failure:

```js
assert.deepEqual(uncovered, [
  "frontend/src/arena/lobby-session.test.ts",
  "frontend/src/arena/lobby-session.ts",
  "frontend/src/components/ArenaPage.test.tsx",
  "packages/arena-game/src/worker-judge.ts",
  "packages/arena-game/test/container-judge-trust.test.ts",
  "packages/arena-game/test/deadline-closure.test.ts",
  "packages/arena-game/test/post-commit-events.test.ts",
  "packages/arena-game/test/worker-judge.test.ts",
  "services/game/src/game/judge-factory.test.ts",
  "services/game/src/game/judge-factory.ts",
  "services/judge-worker/Dockerfile",
  "services/judge-worker/docker-entrypoint.sh",
  "services/judge-worker/package.json",
  "services/judge-worker/src/http-server.ts",
  "services/judge-worker/src/job-queue.ts",
  "services/judge-worker/src/main.ts",
  "services/judge-worker/src/readiness.ts",
  "services/judge-worker/test/compose-topology.test.ts",
  "services/judge-worker/test/http-server.test.ts",
  "services/judge-worker/test/job-queue.test.ts",
  "services/judge-worker/test/readiness.test.ts",
  "services/judge-worker/tsconfig.build.json",
  "services/judge-worker/tsconfig.json",
]);
assert.deepEqual(data.unclassified.map(({ path }) => path), [".codex/PLAN.md"]);
```

- [x] **Step 2: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: the new end-state assertions fail because the new paths have no dispositions.
- [x] **Step 3: Add the intended disposition matrix to the test.** Require taught references for:

```js
const taughtByLesson = {
  "frontend/src/arena/lobby-session.ts": ["0004-lobby-to-match"],
  "frontend/src/arena/lobby-session.test.ts": ["0004-lobby-to-match"],
  "frontend/src/components/ArenaPage.test.tsx": ["0003-rounds-and-final-score", "0012-arena-screen"],
  "packages/arena-game/test/deadline-closure.test.ts": ["0002-reveal-cutoff", "0003-rounds-and-final-score"],
  "packages/arena-game/test/post-commit-events.test.ts": ["0008-persistence-recovery", "0009-live-connection"],
  "packages/arena-game/src/worker-judge.ts": ["0001-submit-journey", "0007-judge-boundary"],
  "packages/arena-game/test/worker-judge.test.ts": ["0007-judge-boundary"],
  "packages/arena-game/test/container-judge-trust.test.ts": ["0007-judge-boundary"],
  "services/game/src/game/judge-factory.ts": ["0001-submit-journey", "0007-judge-boundary", "0013-running-the-project"],
  "services/game/src/game/judge-factory.test.ts": ["0007-judge-boundary", "0013-running-the-project"],
  "services/judge-worker/src/http-server.ts": ["0013-running-the-project"],
  "services/judge-worker/src/job-queue.ts": ["0013-running-the-project"],
  "services/judge-worker/src/main.ts": ["0013-running-the-project"],
  "services/judge-worker/src/readiness.ts": ["0013-running-the-project"],
  "services/judge-worker/test/http-server.test.ts": ["0014-rewrite-with-tests"],
  "services/judge-worker/test/job-queue.test.ts": ["0014-rewrite-with-tests"],
  "services/judge-worker/test/readiness.test.ts": ["0014-rewrite-with-tests"],
  "services/judge-worker/test/compose-topology.test.ts": ["0014-rewrite-with-tests"],
};
```

Require explicit support-only reasons for the worker Dockerfile, entrypoint, package manifest, and both TypeScript configuration files. The reason must state that Lesson 13 teaches the service topology through the Compose/runtime anchors while these files are supporting build configuration.
- [x] **Step 4: Add `.codex` to `scope.excluded`.** Use the reason: `Agent planning state; it is neither game runtime nor learner course content.`
- [x] **Step 5: Verify RED before adding lesson dispositions.** The initial end-state assertion must fail with the 23 uncovered paths. As Tasks 2-5 land, update its exact `expectedRemaining` list and explicitly pending cross-lesson references; Task 1 stays open until the final expected uncovered list is empty. Final catalog gate: 0 uncovered and 0 unclassified.
- [x] **Step 6: Commit the catalog gate with the first semantic lesson change.** The staged gate checks the exact known remaining paths so each later task keeps the full course suite green. Commit it with Task 2 as `docs(course): teach deadline closure and final reveal`; finish Task 1's zero-uncovered assertion with Task 5.

### Task 2: Refresh deadline, Reveal, and final-result teaching

**Files:**
- Modify: `.tours/learning/templates/0001-submit-journey.template.html`
- Modify: `.tours/learning/templates/0002-reveal-cutoff.template.html`
- Modify: `.tours/learning/templates/0003-rounds-and-final-score.template.html`
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Evidence: `packages/arena-game/test/deadline-closure.test.ts`
- Evidence: `packages/arena-game/test/post-commit-events.test.ts`
- Evidence: `frontend/src/components/ArenaPage.test.tsx`

**Interfaces:**
- Consumes: the current Match deadline definition in `CONTEXT.md` and public `ArenaEngine` commands/events.
- Produces: current Lessons 1-3 with exact anchors for deadline closure, grace, saved Reveal, immediate completion, and zero unplayed Rounds.

- [x] **Step 1: Write failing lesson-content assertions.** Require Lesson 2 to name `Match deadline`, `bounded reveal grace`, `sweepExpiredMatches`, `MATCH_COMPLETE`, and `unplayed Rounds count as zero`. Require Lesson 3 to explain that the server persists the Reveal and terminal Match state, computes the final result from saved Round records, and lets the UI stage their presentation. Require both lessons to link `deadline-closure.test.ts` through catalog ranges.
- [x] **Step 2: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: FAIL because the templates and ranges still describe only manually published Round Reveal.
- [x] **Step 3: Review the real deadline path before editing prose.** Read the Match deadline closure and sweep paths, `RoundLifecycle.prepareReveal`, `RoundLifecycle.computeFinal`, `deadline-closure.test.ts`, and `ArenaPage.test.tsx`. Record source ranges from the current files rather than reusing stale line numbers.
- [x] **Step 4: Update Lesson 2's four moments.** The trace must state:

```text
1. At the exact Match deadline, Run and Submit are rejected and closure starts once.
2. A Submission accepted before the deadline can count only if its Evaluation settles before the existing absolute grace cutoff, including when another Game process owns it.
3. At cutoff, unfinished Evaluations are superseded and the current Round Reveal is frozen; expiry during Round Intro produces a zero-score Reveal.
4. The same durable closure saves MATCH_COMPLETE immediately; the final score and outcome are available from persisted Round records, and no player action advances an expired Match.
```

- [x] **Step 5: Update Lesson 3's final-result section.** Explain that every played Round contributes its frozen score, unplayed Rounds contribute zero after deadline closure, tie-break inputs come only from counted Submissions, and the frontend may display the saved Reveal before exposing the final result computed from those persisted Round records.
- [x] **Step 6: Correct Lesson 1's provider sentence while its stale anchors are reviewed.** State that `ContainerJudge` remains the development default, `WorkerJudgeAdapter` is the configured Compose/provider boundary, and Judge0 remains an optional configured adapter. Keep the lesson focused on the `GameJudge` contract.
- [x] **Step 7: Add current source/test ranges to Lessons 1-3.** Include the deadline-closure test ranges in Lessons 2 and 3. Leave `post-commit-events.test.ts` in Task 1's pending list for Task 4's persistence/event explanation.
- [x] **Step 8: Run focused behavior tests.** Run:

```sh
npx vitest run packages/arena-game/test/deadline-closure.test.ts packages/arena-game/test/post-commit-events.test.ts frontend/src/components/ArenaPage.test.tsx
```

Expected: all named tests pass. Record the command and result in the lesson evidence language without expanding the claim beyond those cases.
- [x] **Step 9: Run the course test.** `node --test .tours/learning/scripts/build-catalog.test.mjs` must pass all tests, including the deadline semantics, current source links, and exact pending-disposition list. Source snapshot acceptance remains Task 6.
- [x] **Step 10: Commit.** Commit `docs(course): teach deadline closure and final reveal`.

### Task 3: Refresh the invitation-only Lobby lesson

**Files:**
- Modify: `.tours/learning/templates/0004-lobby-to-match.template.html`
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Evidence: `frontend/src/arena/lobby-session.ts`
- Evidence: `frontend/src/arena/lobby-session.test.ts`
- Evidence: `frontend/src/components/LobbyPage.tsx`
- Evidence: `frontend/e2e/live-lobby.spec.ts`

**Interfaces:**
- Consumes: `LobbySession` public snapshot/actions and the existing Lobby HTTP/socket adapter.
- Produces: Lesson 4 as the invitation-code first-release path with authoritative refresh and stale-response rejection; public queue code is labeled future capability.

- [x] **Step 1: Write failing assertions for the changed flow.** Require the Lesson 4 template to contain `invitation-only`, `socket payloads are refresh hints`, `stale responses are discarded`, and `public queue backend code remains for a future release`. Require catalog references to both `lobby-session.ts` and its test.
- [x] **Step 2: Run the course unit test.** Expected: FAIL because Lesson 4 currently presents private rooms and public queue as equal current entry paths.
- [x] **Step 3: Update the prediction.** Ask what the client should show when an older `getActive()` response arrives after a newer Lobby update refresh. The visible answer says the older response is discarded and the response from the newest still-current authoritative request supplies the view.
- [x] **Step 4: Replace the trace with the current first-release path.** Teach: open Lobby -> recover active state -> create or join invitation room -> subscribe to that room -> treat socket events and ordinary room-mutation results as refresh triggers -> host starts only when both sides are full and Ready -> use the successful start response's Match ID for one handoff.
- [x] **Step 5: Add a bounded future-capability note.** Link the public queue implementation/tests as code that remains available but state that `LobbySession` cancels a recovered waiting entry and `LobbyPage` does not expose a queue action in this release.
- [x] **Step 6: Add exact current anchors.** Cite the stale request version guard, mutation refresh, channel rejoin, legacy waiting-queue cancellation, and duplicate Match handoff tests.
- [x] **Step 7: Run focused tests.** Run:

```sh
npx vitest run frontend/src/arena/lobby-session.test.ts services/game/src/game/lobby.test.ts packages/arena-game/test/lobby.test.ts
```

Expected: in-memory LobbySession/domain cases pass. In this workspace 18 passed and 2 Postgres cases skipped; the Game service integration suite did not boot (`service did not boot`, consistent with the baseline loopback-bind restriction), so its six cases did not run.
- [x] **Step 8: Run course tests and commit.** `node --test .tours/learning/scripts/build-catalog.test.mjs` passes all 39 tests. Commit `docs(course): teach authoritative invitation lobby`.

### Task 4: Refresh post-commit events, reconnect, and terminal Arena presentation

**Files:**
- Modify: `.tours/learning/templates/0008-persistence-recovery.template.html`
- Modify: `.tours/learning/templates/0009-live-connection.template.html`
- Modify: `.tours/learning/templates/0012-arena-screen.template.html`
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Evidence: `packages/arena-game/test/post-commit-events.test.ts`
- Evidence: `frontend/src/components/ArenaPage.test.tsx`

**Interfaces:**
- Consumes: post-commit `ArenaEngine` events stamped with committed Match revision and snapshot-based reconnect.
- Produces: Lessons 8, 9, and 12 that distinguish durability, transient delivery, reconnect recovery, and staged terminal UI.

- [x] **Step 1: Add failing content assertions.** Require Lesson 8 to say that a failed Match save publishes no terminal event; Lesson 9 to say live events are transient and snapshots recover missed updates; Lesson 12 to explain the expired Match Reveal -> `See final result` -> result computed from saved Match state presentation.
- [x] **Step 2: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: FAIL before the new evidence is cited.
- [x] **Step 3: Update Lesson 8.** Add a short persistence boundary section: save the accepted Match revision first, publish only after commit, isolate listener failures, and use the committed revision in event payloads. Cite the failing-store test as evidence and state that it does not create a durable outbox.
- [x] **Step 4: Update Lesson 9.** Add one reconnect rule: socket events prompt clients to obtain/accept newer authoritative state, missed individual events are not replayed, and the snapshot's committed revision prevents an older live message from moving the view backward.
- [x] **Step 5: Update Lesson 12.** Teach the initial-render evidence in `ArenaPage.test.tsx`: deadline completion with `remainingSeconds === 0` shows the current Round Reveal and a presentation action, while ordinary completed flow shows the Match result directly. Explain that the current snapshot computes the result from saved Match state. State that the component test does not click the presentation action; its handler is source evidence.
- [x] **Step 6: Re-anchor unchanged stale sources in Lessons 5, 6, 9, and 10.** Review every reported range in `ArenaPage.tsx`, `engine.ts`, `evaluation-orchestration.ts`, `team-2v2.test.ts`, and related templates. Change prose only when behavior changed; record each reviewed lesson in the final accept list.
- [x] **Step 7: Run focused tests.** Run:

```sh
npx vitest run packages/arena-game/test/post-commit-events.test.ts packages/arena-game/test/reconnect.test.ts services/game/src/game/reconnect.test.ts frontend/src/components/ArenaPage.test.tsx
```

Expected: in-memory/frontend cases pass; service cases that require restricted sockets or Postgres must be reported as environment-gated rather than claimed as passing. This workspace: 29 tests passed; all 10 real-socket/Postgres service scenarios were skipped after the service failed to boot (`service did not boot`).
- [x] **Step 8: Run course tests and commit.** `node --test .tours/learning/scripts/build-catalog.test.mjs` passes 40/40. Commit `9e4b6d5 docs(course): teach committed events and terminal presentation`.

### Task 5: Refresh Judge worker, runtime topology, and rewrite evidence

**Files:**
- Modify: `.tours/learning/templates/0007-judge-boundary.template.html`
- Modify: `.tours/learning/templates/0013-running-the-project.template.html`
- Modify: `.tours/learning/templates/0014-rewrite-with-tests.template.html`
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Evidence: `packages/arena-game/src/worker-judge.ts`
- Evidence: `services/game/src/game/judge-factory.ts`
- Evidence: `services/judge-worker/`

**Interfaces:**
- Consumes: the `GameJudge` contract, startup-only provider selection, `WorkerJudgeAdapter`, and Judge worker HTTP/job queue boundaries.
- Produces: current Judge boundary and operations lessons with exact evidence limits and full dispositions for the remaining new files.

- [x] **Step 1: Add failing provider/topology assertions.** Require Lesson 7 to distinguish `ContainerJudge`, `WorkerJudgeAdapter`, and Judge0 without fallback. Require Lesson 13 to list the Judge worker service and its health/startup boundary. Require Lesson 14 to cite worker adapter, queue, readiness, HTTP, and Compose topology tests as separate evidence classes.
- [x] **Step 2: Run the course test.** Expected: FAIL because the lessons predate the worker service.
- [x] **Step 3: Update Lesson 7's boundary trace.** Teach that Game owns authorization, hidden-group selection, scoring, and durable Evaluation state; `WorkerJudgeAdapter` authenticates to one configured worker endpoint, validates response shape and case identity, converts transport failures to `JudgeInfraError`, and never falls back to a different provider.
- [x] **Step 4: Update Lesson 13's runtime topology.** Teach the local in-process container default separately from Compose's Game -> Judge worker HTTP path. Cover `JUDGE_BACKEND`, `JUDGE_WORKER_URL`, token, timeout, worker readiness, bounded queue, Docker socket access, and Nginx's external routing. Keep the separate Chat container labeled startup/health scaffolding when that remains current.
- [x] **Step 5: Update Lesson 14's evidence table.** Separate:

```text
Pure adapter tests: request authentication, timeout/failure mapping, response validation.
Worker service tests: readiness, bounded queue, HTTP contract, Compose topology.
Container security tests: actual Docker isolation and attack cases.
Service/Postgres/browser tests: environment-dependent integration evidence.
```

Record exact commands and observed results from this implementation run. Do not carry historical pass counts forward as current results.
- [x] **Step 6: Add all remaining dispositions.** Link behavior-bearing worker files to Lessons 7, 13, or 14 using the matrix in Task 1. Mark only the Dockerfile, entrypoint, package manifest, and two `tsconfig` files support-only with the agreed runtime-build reason.
- [x] **Step 7: Review Lesson 11.** Confirm its chat sources remain unchanged and current; keep it out of `--reviewed-lessons` unless a referenced file actually drifted. The audit shows no Lesson 11 impact.
- [x] **Step 8: Run focused tests.** Run:

```sh
npx vitest run packages/arena-game/test/worker-judge.test.ts packages/arena-game/test/container-judge-trust.test.ts services/game/src/game/judge-factory.test.ts services/judge-worker/test/*.test.ts
```

Expected: pure tests pass; any host-network or Docker restriction is recorded beside the exact skipped command.
- [x] **Step 9: Run course tests and commit.** The catalog suite passes 40/40 and reports 0 uncovered and 0 unclassified source files. Commit `docs(course): teach judge worker boundaries`.

### Task 6: Repair CodeTours and accept one reviewed implementation snapshot

**Files:**
- Modify: `.tours/1-code-arena-big-picture.tour`
- Modify: `.tours/2-submission-journey.tour`
- Modify: `.tours/3-match-state-and-rounds.tour`
- Modify: `.tours/4-judging-and-sandbox.tour`
- Modify: `.tours/5-storage-collaboration-and-chat.tour`
- Modify: `.tours/6-rebuild-the-game.tour`
- Modify through tool: `.tours/reference-baseline.md`
- Modify through tool: `.tours/reference-baseline.sha256`
- Modify through tool: `.tours/learning/reference-snapshot.json`
- Generate: `.tours/learning/source-map.html`
- Generate: `.tours/learning/lessons/*.html`

**Interfaces:**
- Consumes: reviewed lesson templates, catalog references, actual current source, and `acceptReviewedSnapshot()`.
- Produces: zero stale lesson links, zero uncovered files, zero unclassified files, valid CodeTour anchors, and one accepted snapshot shared by every generated page.

- [x] **Step 1: Run the read-only impact report.** Run `node .tours/learning/scripts/build-catalog.mjs --check` and save its output for comparison. Expected: only the not-yet-repaired CodeTour/baseline/generated-output items remain after Tasks 1-5.
- [x] **Step 2: Repair existing CodeTour anchors.** Update every affected step reported by the command. Preserve the six tour purposes and add these changed-behavior destinations where the existing tour teaches that boundary:

```text
Tour 1: LobbySession convergence and ArenaEngine authority.
Tour 2: Judge factory -> Evaluation orchestration -> configured GameJudge.
Tour 3: Match deadline closure -> Reveal -> durable Match completion.
Tour 4: WorkerJudgeAdapter -> Judge worker HTTP/queue -> ContainerJudge isolation.
Tour 5: post-commit event publication -> authoritative reconnect snapshot.
Tour 6: deadline, invitation-only Lobby, post-commit event, and Judge worker parity gates.
```

- [x] **Step 3: Run all course tooling tests.** Run:

```sh
node --test .tours/learning/scripts/*.test.mjs
```

Expected: all tests pass before baseline acceptance.
- [x] **Step 4: Review every affected lesson ID.** Use the audit output to verify that Lessons 1-10 and 12-14 either changed semantically or were re-anchored after inspection. Lesson 11 remains omitted when its sources are unchanged.
- [x] **Step 5: Accept the reviewed snapshot exactly once.** Run:

```sh
node .tours/learning/scripts/build-catalog.mjs --accept-reviewed-snapshot --reviewed-lessons=0001-submit-journey,0002-reveal-cutoff,0003-rounds-and-final-score,0004-lobby-to-match,0005-problem-editor-run,0006-evaluation-retries,0007-judge-boundary,0008-persistence-recovery,0009-live-connection,0010-team-collaboration,0012-arena-screen,0013-running-the-project,0014-rewrite-with-tests
```

Expected: the command records the new content hashes, Git HEAD, worktree status, lesson review list, CodeTour checksums, and regenerates all current lesson pages from the same snapshot ID.
- [x] **Step 6: Run `node .tours/learning/scripts/build-catalog.mjs --check`.** Expected: exit 0 with zero stale, uncovered, unclassified, missing, or invalid items and no generated output drift.
- [x] **Step 7: Commit the reviewed reference.** Commit `docs(course): accept current implementation reference`.

### Task 7: Add catalog-owned batches and generate Course Home

**Files:**
- Create: `.tours/learning/templates/course-home.template.html`
- Create: `.tours/learning/index.html`
- Modify: `.tours/learning/coverage-map.json`
- Modify: `.tours/learning/scripts/build-catalog.mjs`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Modify: `.tours/learning/scripts/source-preview.test.mjs`
- Modify: `.tours/learning/assets/course.css`

**Interfaces:**
- Consumes: catalog schema version 2 and current lesson freshness.
- Produces: validated `batches`, `renderCourseHomeTemplate()`, and generated `.tours/learning/index.html`.

- [x] **Step 1: Add failing schema tests.** Cover duplicate batch ID/order, unknown lesson, duplicated lesson across batches, omitted lesson, and flattened batch order differing from lesson `order`.
- [x] **Step 2: Add a failing Course Home render test.** Use two batches and three lessons. Assert one primary link, four-state-independent lesson links, batch headings outside disclosure summaries, a quiet snapshot status, and an `Explore code` link to `source-map.html`.
- [x] **Step 3: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: FAIL because version 2 and Course Home rendering do not exist.
- [x] **Step 4: Implement schema version 2 validation.** Normalize batches only after all lessons are validated, then require every lesson exactly once and preserve the flattened order.
- [x] **Step 5: Implement `renderCourseHomeTemplate()`.** Render semantic `<section>` elements with `<h2>` batch headings and ordered lesson lists. Use a single primary anchor with `data-course-start`; JavaScript may change its text/href to Continue, but its authored fallback must start Lesson 1.
- [x] **Step 6: Add the Course Home template.** Include:

```html
<a class="skip-link" href="#course">Skip to the course</a>
<header class="course-header">
  <nav aria-label="Course"><a aria-current="page" href="index.html">Learn</a><a href="source-map.html">Explore code</a></nav>
</header>
<main class="page course-home" id="course" tabindex="-1">
  <p class="eyebrow">A guided route through this exact codebase</p>
  <h1>Understand the game, one behavior at a time.</h1>
  <a class="primary-button" data-course-start href="lessons/0001-follow-one-submit.html">Start Lesson 1</a>
  <p data-course-activity>Activity stays on this browser and is not a mastery score.</p>
  <!-- COURSE_BATCHES -->
</main>
```

- [x] **Step 7: Generate Course Home with the catalog outputs.** Make `renderCatalogOutputs()` return `index.html`, `source-map.html`, and every lesson page in one output map so `--check` detects home drift.
- [x] **Step 8: Style the page in the shared CSS.** Use the existing theme tokens, one reading column for descriptions, a responsive batch grid, visible focus, 44-pixel controls, and no headings inside `<summary>`.
- [x] **Step 9: Update the Playwright fixture and run tests.** Run `node --test .tours/learning/scripts/build-catalog.test.mjs .tours/learning/scripts/source-preview.test.mjs`. Expected: PASS, including local-file source previews.
- [x] **Step 10: Commit.** Commit `feat(course): add learner course home`.

### Task 8: Add safe activity and consistent generated lesson navigation

**Files:**
- Create: `.tours/learning/assets/course-activity.mjs`
- Create: `.tours/learning/scripts/course-activity.test.mjs`
- Modify: `.tours/learning/scripts/build-catalog.mjs`
- Modify: `.tours/learning/scripts/build-catalog.test.mjs`
- Modify: `.tours/learning/templates/0001-submit-journey.template.html` through `.tours/learning/templates/0014-rewrite-with-tests.template.html`
- Modify: `.tours/learning/assets/course.css`

**Interfaces:**
- Consumes: ordered lesson metadata and storage-like `{ getItem, setItem, removeItem }` objects.
- Produces: the activity functions in Shared Interfaces, generated previous/next navigation, and a Start/Continue action based on last opened lesson.

- [ ] **Step 1: Write failing pure state tests.** Test empty storage, a valid record, invalid JSON, a future schema version, invalid status strings, a removed lesson ID, `getItem` throwing, `setItem` throwing, started -> self-check-recorded monotonic promotion, and prevention of self-check -> started downgrade.
- [ ] **Step 2: Run `node --test .tours/learning/scripts/course-activity.test.mjs`.** Expected: FAIL because the module does not exist.
- [ ] **Step 3: Implement the pure functions.** Use the exact persisted shape from Shared Interfaces. Return a new object from `markLessonActivity()` and return `false` rather than throwing when `writeCourseActivity()` cannot persist.
- [ ] **Step 4: Add failing generator assertions.** Require every lesson output to include Course Home, Explore code, previous/next links computed from catalog order, `data-course-lesson`, one inlined activity runtime, and a visible storage-unavailable message target with `aria-live="polite"`.
- [ ] **Step 5: Implement runtime injection.** Read `assets/course-activity.mjs` once in `renderCatalogOutputs()` and inject it into Course Home and lesson placeholders as `<script type="module">`. Keep each generated page self-contained and usable from `file://`.
- [ ] **Step 6: Wire Course Home.** `installCourseActivity()` reads the valid ordered lesson IDs, rewrites the primary link to `Continue Lesson N` only for a valid `lastLessonId`, and adds text statuses `Not started`, `Started`, or `Self-check recorded` beside lessons.
- [ ] **Step 7: Wire lessons.** On page load, mark the current lesson `started` and `lastLessonId`. A `[data-course-self-check]` activation promotes it to `self-check-recorded`. Keep source previews, prediction controls, and navigation usable when storage is unavailable.
- [ ] **Step 8: Replace hand-maintained neighbor links.** Put `<!-- COURSE_LESSON_NAV -->` in each lesson template and have the generator render the previous/next links. Remove duplicated hard-coded nav rows after the generated navigation is covered by tests.
- [ ] **Step 9: Run unit and generator tests.** Run:

```sh
node --test .tours/learning/scripts/course-activity.test.mjs .tours/learning/scripts/build-catalog.test.mjs
```

Expected: PASS.
- [ ] **Step 10: Commit.** Commit `feat(course): add local activity and resume`.

### Task 9: Normalize Lesson 1 and validate one complete study session

**Files:**
- Modify: `.tours/learning/templates/0001-submit-journey.template.html`
- Modify: `.tours/learning/assets/course.css`
- Create: `.tours/learning/scripts/course-experience.test.mjs`
- Modify: `.tours/learning/NOTES.md`

**Interfaces:**
- Consumes: shared activity runtime and generated Course Home/lesson navigation.
- Produces: a non-blocking Lesson 1 pilot and a dated pilot record that determines whether last-lesson resume is enough.

- [ ] **Step 1: Write the browser test before changing Lesson 1.** Generate a small Course Home plus Lesson 1 fixture, serve it and open it through `file://`, then assert:

```text
Course Home starts at Lesson 1 with empty storage.
Opening Lesson 1 marks Started and returning home changes the action to Continue Lesson 1.
The trace is visible before any prediction answer.
Wrong and correct prediction choices update helpful feedback without hiding content.
Recording the self-check changes visible activity text without using mastery/completed/pass language.
Malformed or denied localStorage leaves Start Lesson 1 and every lesson link usable.
Tab order reaches Learn, Explore code, Start/Continue, lesson links, prediction controls, source links, and previous/next.
At 320 pixels the document has no horizontal page overflow and all main actions are at least 44 pixels high.
No console errors occur on Course Home or Lesson 1.
```

- [ ] **Step 2: Run `node --test .tours/learning/scripts/course-experience.test.mjs`.** Expected: FAIL because Lesson 1 still gates its trace and uses its private storage record.
- [ ] **Step 3: Normalize Lesson 1.** Keep its Submit teaching content and multiple-choice prediction, but render the trace, evidence, retrieval prompt, and rewrite-test prompt in the same visible order as Lessons 2-14. Remove `hidden` gating, private `0001-follow-one-submit` storage, and the extra course-rationale section that interrupts the lesson.
- [ ] **Step 4: Add shared self-check markup.** Put `data-course-self-check` on the retrieval action and keep the nearby text: `This records activity on this browser. It is not proof of mastery or rewrite parity.`
- [ ] **Step 5: Run the browser test in direct-file and local-server modes.** Expected: every assertion in Step 1 passes.
- [ ] **Step 6: Perform the author pilot after the concrete pages are generated.** Ask the course author to:

```text
1. Open Course Home and answer “What should I do next?”
2. Complete Lesson 1 without opening README or the source inventory first.
3. Close the tab, return through Course Home, and continue.
4. Explain who authorizes Submit.
5. Name the next thing they would inspect.
```

Record the date, route taken, any confusing label, whether resume worked, and the two teach-back answers in `NOTES.md`. If the author resumes the correct lesson and does not report losing the internal stage, retain last-lesson-only activity as specified. A reported stage-resume failure requires a separately reviewed follow-up plan rather than expanding this implementation silently.
- [ ] **Step 7: Commit.** Commit `feat(course): normalize the first learning session`.

### Task 10: Separate learner and maintainer documentation, then verify the release

**Files:**
- Create: `.tours/learning/MAINTAINING.md`
- Modify: `.tours/learning/README.md`
- Modify: `.tours/learning/MISSION.md`
- Modify: `.tours/learning/NOTES.md`
- Modify: `.tours/learning/RESOURCES.md`
- Modify: `.tours/learning/templates/source-map.template.html`
- Generate: `.tours/learning/index.html`
- Generate: `.tours/learning/source-map.html`
- Generate: `.tours/learning/lessons/*.html`
- Review: `prototype/game-ui/42-subject-compliance.md`

**Interfaces:**
- Consumes: the complete generator and reviewed source snapshot.
- Produces: one learner start route, one code exploration route, one maintainer workflow, and a fully verified generated course.

- [ ] **Step 1: Move maintenance workflow to `MAINTAINING.md`.** Include normal generation, tests, read-only check, impact review, required lesson review list, explicit acceptance, CodeTour baseline behavior, environment-dependent test reporting, and the instruction to review the 42 matrix after project changes.
- [ ] **Step 2: Shorten `README.md`.** Make the first link Course Home, then link Mission, Explore code, CodeTours, and Maintain the course. Keep the 14-lesson list generated or point to Course Home so lesson order has one authored owner.
- [ ] **Step 3: Update source-map labeling.** Title it `Explore the exact implementation`, add a `Back to Course Home` link, and keep coverage/freshness prominent for maintainers without presenting it as learner progress.
- [ ] **Step 4: Regenerate every page.** Run `node .tours/learning/scripts/build-catalog.mjs` only after the source snapshot is current. Generation must not change reference hashes.
- [ ] **Step 5: Run course verification.** Run:

```sh
node --test .tours/learning/scripts/*.test.mjs
node .tours/learning/scripts/build-catalog.mjs --check
```

Expected: all tests pass and the check reports zero stale, uncovered, unclassified, missing, invalid, or generated-drift items.
- [ ] **Step 6: Run project verification.** Run:

```sh
npm run lint
npm run typecheck
npm run build
npm test
git diff --check
```

Expected: lint, typecheck, build, course tests, and non-environment-gated project tests pass. Report Docker, Postgres, service-socket, or browser restrictions as explicit skips with their command and error; do not convert skips into passing evidence.
- [ ] **Step 7: Perform final browser checks.** In latest stable Chrome, verify Course Home and Lessons 1, 4, 7, 12, and 14 at desktop and 320-pixel widths; use keyboard-only navigation; open/close a source dialog; refresh; test malformed/blocked storage; confirm zero console warnings/errors.
- [ ] **Step 8: Review 42 compliance.** Compare the course changes with mandatory frontend clarity/responsiveness/accessibility and README honesty requirements in `ft_transcendence.pdf`. Review `prototype/game-ui/42-subject-compliance.md`; leave it unchanged when no game evidence/module status changed, or update it in this commit if the evidence actually changed.
- [ ] **Step 9: Inspect the final diff.** Confirm only course artifacts, generated outputs, CodeTours/reference files, and any necessary compliance update are present. Ensure `.trigger-tree/` and `.agents/skills/` remain unstaged.
- [ ] **Step 10: Commit.** Commit `docs(course): publish refreshed learning route`.

## Self-Review Record

- **Spec coverage:** Tasks 1-6 implement exact-source review, complete disposition, changed lesson content, CodeTour impact, evidence limits, and explicit snapshot acceptance. Tasks 7-10 implement the four-batch Course Home, Learn/Explore/Maintain split, non-blocking Lesson 1, local activity, accessibility, offline output, pilot, and final verification.
- **Scope discipline:** The plan adds no runtime game behavior, new framework, learner account, cloud state, analytics, mastery scoring, or module claim.
- **Type/interface consistency:** Catalog version 2 owns `batches`; `renderCatalogOutputs()` supplies the same ordered lessons to Course Home, lesson navigation, and activity runtime; activity state uses one versioned storage key and two statuses throughout.
- **Review focus coverage:** Deadline cases are in Task 2, Lobby convergence in Task 3, event durability/reconnect in Task 4, storage failure in Task 8, and navigation/browser/accessibility failure modes in Tasks 7-10.
- **Compliance:** The course continues to present source/test evidence as learning material and never as proof of 42 module completion. Final verification explicitly checks the authoritative PDF and the repository compliance matrix.
