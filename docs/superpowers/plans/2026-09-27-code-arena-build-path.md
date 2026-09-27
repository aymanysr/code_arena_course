# Code Arena Build Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [x]) syntax for tracking.

**Goal:** Give a beginner a clear starting point, dependency order, and file-level build guidance for recreating Code Arena behavior in a teammate's repository without copying implementation code.

**Architecture:** Keep coverage-map.json as the source of truth for the existing 14 trace lessons and their source references. Add one validated learning-path.json for build dependencies and generate an orientation page, a Course Home build map, and short build cards in the lessons from it. Keep generated HTML derived from authored templates and data.

**Tech Stack:** Node.js ESM, node:test, static HTML/CSS/JavaScript, the existing course generator, and Playwright with Chrome.

**Spec:** docs/refactor/refactor-learning-path-2026-09-27.md

## Global Constraints

- Keep the 14 existing trace lessons and their order; add orientation before Lesson 1 without calling it a fifteenth trace lesson.
- Keep the course static, local, offline-compatible, and dependency-free in the browser.
- Use the exact domain terms in CONTEXT.md: Match, Round, Problem, Run, Submission, Reveal, Judge, Lobby, and Readiness.
- Give example file paths from this repository, then tell the learner to locate the same responsibility in the teammate's repository before creating a directory or file.
- Teach observable behavior and equivalent tests; do not supply copy-ready game implementation.
- Activity means only not started, started, or self-check recorded. Never call it mastery, rewrite parity, or 42 module completion.
- Keep source snapshot hashes, dated test evidence, and CodeTour baselines separate. Do not accept a new snapshot merely to clear a stale check.
- Preserve the currently modified course files and unrelated .trigger-tree data. At execution, use a suitable clean worktree containing the intended course baseline, or stage only new hunks; never reset another person's edits.
- Follow AGENTS.md: review ft_transcendence.pdf and prototype/game-ui/42-subject-compliance.md after each project change, and update the matrix only when evidence, scope, module claims, assumptions, or status changes.
- Run npm run lint from the repository root before completing UI work. Use existing CSS theme variables and semantic HTML; keep focus visible, navigation keyboard-operable, controls at least 44 CSS pixels high, and layout usable at 320 CSS pixels.
- Generated pages and tests are course evidence. They do not prove a subject module is complete.

## Review Focus

1. A duplicate step ID, missing prerequisite, dependency cycle, unknown lesson, or unknown reference file must make the course command fail with a named error. Task 1 pins each case.
2. A new learner, malformed activity record, or denied localStorage must reach orientation; a learner with a saved lesson must still resume that lesson. Task 2 pins these cases.
3. Orientation and build-map links must work from both file:// and a local server, including source-map file queries. Tasks 2 and 3 pin the links.
4. At 320 CSS pixels, keyboard users must reach orientation, build steps, lesson links, and source links without horizontal overflow or browser warnings/errors. Lesson 1's trace and recall stay available before a prediction; Lesson 14's evidence table scrolls inside a keyboard-focusable region. Tasks 2 and 3 pin this.
5. A path field containing HTML characters must render as text, and a path with traversal or an unknown source must be rejected. Tasks 1 and 3 pin this.

---

## File Structure

- Create .tours/learning/learning-path.json: one authored build order, prerequisites, learner deliverables, file examples, tests, and reference links.
- Create .tours/learning/scripts/learning-path.mjs: validate that contract; no browser or filesystem side effects.
- Create .tours/learning/scripts/learning-path.test.mjs: contract and failure-case tests.
- Create .tours/learning/templates/0000-before-lesson-one.template.html: the authored beginner orientation and target-repo worksheet.
- Generate .tours/learning/lessons/0000-before-lesson-one.html from that template.
- Modify .tours/learning/scripts/build-catalog.mjs: load/validate the path, render the orientation, Course Home map, and per-lesson build cards.
- Modify .tours/learning/templates/course-home.template.html: make the build path and orientation visible before the trace-lesson batches.
- Modify .tours/learning/templates/0001-submit-journey.template.html: name the prerequisites above the Submit trace.
- Modify .tours/learning/templates/0014-rewrite-with-tests.template.html: link to the shared build path while keeping parity/evidence guidance.
- Modify .tours/learning/assets/course.css: reuse existing theme tokens for the new path, orientation, and cards.
- Modify .tours/learning/README.md, MISSION.md, and MAINTAINING.md: explain the two orders and maintenance source.
- Modify .tours/learning/scripts/build-catalog.test.mjs and course-experience.test.mjs: generated-output and browser tests.
- Regenerate .tours/learning/index.html and lessons/0001 through 0014. Do not hand-edit generated pages.

The course files are one subsystem. The teammate's actual repository is not available here, so the course must teach a placement rule and show conditional examples rather than claim its exact folder names.

### Task 1: Define and validate the build-path contract

**Files:**
- Create: .tours/learning/learning-path.json
- Create: .tours/learning/scripts/learning-path.mjs
- Create: .tours/learning/scripts/learning-path.test.mjs
- Modify: .tours/learning/scripts/build-catalog.mjs: imports, renderCatalogOutputs, main, and snapshot re-render

**Interfaces:**
- Consumes: coverage-map lesson objects with id and the catalog's scoped file objects with path.
- Produces: validateLearningPath(raw, lessons, scopedFiles) returning { version: 1, orientation: { output, title }, steps: ordered Step[] }. A Step has id, order, title, why, requires, lessonIds, deliverable, placement, pattern, check, sourcePath, and testPath. Later tasks read data.learningPath.

- [x] **Step 1: Write failing contract tests**

Add this complete test file. The invalid-input assertions are the Review Focus gate for cycles, missing IDs, unknown references, and traversal.

~~~js
import assert from "node:assert/strict";
import test from "node:test";
import { validateLearningPath } from "./learning-path.mjs";

const lessons = [{ id: "0001-submit-journey" }, { id: "0014-rewrite-with-tests" }];
const files = [{ path: "package.json" }, { path: "packages/arena-game/test/submit-path.test.ts" }];
const step = (id, order, requires = []) => ({
  id, order, title: "Find the rule", why: "A Match needs a Round.",
  requires, lessonIds: ["0001-submit-journey"],
  deliverable: "One Match rule", placement: "Use the existing game package.",
  pattern: "Pure rule with a fixed clock.",
  check: "A fixed-clock test passes.", sourcePath: "package.json",
  testPath: "packages/arena-game/test/submit-path.test.ts",
});
const path = () => ({
  version: 1,
  orientation: { output: "lessons/0000-before-lesson-one.html", title: "Before Lesson 1" },
  steps: [step("find-homes", 0), step("match-core", 1, ["find-homes"])],
});

test("accepts a dependency-ordered path", () => {
  assert.deepEqual(validateLearningPath(path(), lessons, files).steps.map((item) => item.id), ["find-homes", "match-core"]);
});

test("rejects duplicate, missing, cyclic, unknown-lesson, and unsafe path data", () => {
  const cases = [
    [() => { const data = path(); data.steps[1].id = "find-homes"; return data; }, /duplicate.*step/i],
    [() => { const data = path(); data.steps[1].requires = ["missing"]; return data; }, /unknown prerequisite.*missing/i],
    [() => { const data = path(); data.steps[0].requires = ["match-core"]; return data; }, /cycle/i],
    [() => { const data = path(); data.steps[0].lessonIds = ["removed"]; return data; }, /unknown lesson.*removed/i],
    [() => { const data = path(); data.steps[0].sourcePath = "../secret"; return data; }, /unsafe.*path/i],
    [() => { const data = path(); data.steps[0].sourcePath = "missing.ts"; return data; }, /unknown source.*missing.ts/i],
  ];
  for (const [makeInput, message] of cases) {
    assert.throws(() => validateLearningPath(makeInput(), lessons, files), message);
  }
});
~~~

- [x] **Step 2: Run the test and confirm the missing module failure**

Run: node --test .tours/learning/scripts/learning-path.test.mjs

Expected: FAIL because learning-path.mjs does not exist.

- [x] **Step 3: Add the validator**

Use this implementation in learning-path.mjs. It accepts only repository-relative reference paths and checks dependencies after all step IDs are known.

~~~js
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const requiredText = (value, label) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(label + " must be non-empty text");
  return value.trim();
};
const safePath = (value, label) => {
  const result = requiredText(value, label);
  if (result.startsWith("/") || result.includes("\\") || result.split("/").some((part) => part === "." || part === ".." || part === "")) {
    throw new Error("Unsafe path: " + result);
  }
  return result;
};

export function validateLearningPath(raw, lessons, scopedFiles) {
  if (!isRecord(raw) || raw.version !== 1) throw new Error("Learning path version must be 1");
  if (!isRecord(raw.orientation)) throw new Error("Learning path orientation is required");
  const orientation = {
    output: safePath(raw.orientation.output, "Orientation output"),
    title: requiredText(raw.orientation.title, "Orientation title"),
  };
  if (orientation.output !== "lessons/0000-before-lesson-one.html") throw new Error("Unexpected orientation output");
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new Error("Learning path steps are required");
  const knownLessons = new Set(lessons.map((item) => item.id));
  const knownFiles = new Set(scopedFiles.map((item) => item.path));
  const ids = new Set();
  const orders = new Set();
  const steps = raw.steps.map((item) => {
    if (!isRecord(item)) throw new Error("Learning path step must be an object");
    const id = requiredText(item.id, "Step ID");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Unsafe step ID: " + id);
    if (ids.has(id)) throw new Error("Duplicate step: " + id);
    ids.add(id);
    if (!Number.isInteger(item.order) || item.order < 0 || orders.has(item.order)) throw new Error("Invalid or duplicate step order: " + item.order);
    orders.add(item.order);
    if (!Array.isArray(item.requires) || !Array.isArray(item.lessonIds)) throw new Error("Step links must be arrays: " + id);
    const sourcePath = safePath(item.sourcePath, "Source path");
    const testPath = safePath(item.testPath, "Test path");
    if (!knownFiles.has(sourcePath)) throw new Error("Unknown source: " + sourcePath);
    if (!knownFiles.has(testPath)) throw new Error("Unknown test: " + testPath);
    for (const lessonId of item.lessonIds) {
      if (!knownLessons.has(lessonId)) throw new Error("Unknown lesson: " + lessonId);
    }
    return {
      id, order: item.order, title: requiredText(item.title, "Step title"),
      why: requiredText(item.why, "Step reason"), requires: item.requires,
      lessonIds: item.lessonIds, deliverable: requiredText(item.deliverable, "Deliverable"),
      placement: requiredText(item.placement, "Placement"),
      pattern: requiredText(item.pattern, "Pattern"), check: requiredText(item.check, "Check"),
      sourcePath, testPath,
    };
  }).sort((left, right) => left.order - right.order);
  if (steps.some((item, index) => item.order !== index)) throw new Error("Step orders must start at 0 and have no gaps");
  const byId = new Map(steps.map((item) => [item.id, item]));
  for (const item of steps) {
    for (const dependency of item.requires) {
      if (!byId.has(dependency)) throw new Error("Unknown prerequisite: " + dependency);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error("Learning path cycle at " + id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).requires) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const item of steps) visit(item.id);
  return { version: 1, orientation, steps };
}
~~~

- [x] **Step 4: Author the complete eight-step path**

Save this data as learning-path.json. These source/test paths exist in the current inventory; the placement strings are conditional examples for the teammate's repo.

~~~json
{
  "version": 1,
  "orientation": { "output": "lessons/0000-before-lesson-one.html", "title": "Before Lesson 1" },
  "steps": [
    {
      "id": "find-homes", "order": 0, "title": "Find the homes",
      "why": "You need to know where this teammate repo keeps rules and tests before creating files.",
      "requires": [], "lessonIds": ["0013-running-the-project"],
      "deliverable": "Record the game package, test folder, frontend app, service route, storage module, and run commands.",
      "placement": "Write your chosen paths in the teammate repo's existing project notes. If it mirrors this repo, inspect packages/, services/, and frontend/ first.",
      "pattern": "Put each rule, route, test, and data file beside its existing owner.",
      "check": "You can name one test command and the folder where a Match rule test belongs.",
      "sourcePath": "package.json", "testPath": "packages/arena-game/test/round-lifecycle.test.ts"
    },
    {
      "id": "match-core", "order": 1, "title": "Make a small Match core",
      "why": "Submit needs a Match, an active Round, a player, a phase, and a clock.",
      "requires": ["find-homes"], "lessonIds": ["0003-rounds-and-final-score"],
      "deliverable": "Create Match and Round state, legal phase changes, score rules, a fixed clock, and a fake Judge test helper.",
      "placement": "Use the existing game-rules package. In a matching layout, create packages/arena-game/src/match-rules.ts and packages/arena-game/test/match-rules.test.ts.",
      "pattern": "Keep phase and score decisions in a pure rule module; inject time and Judge outcomes in tests.",
      "check": "A fixed-clock test starts a Match, opens a Round, and rejects an action in the wrong phase.",
      "sourcePath": "packages/arena-game/src/round-lifecycle.ts", "testPath": "packages/arena-game/test/round-lifecycle.test.ts"
    },
    {
      "id": "player-problem-run", "order": 2, "title": "Give a player a Problem and Run",
      "why": "A legal player and visible Problem are needed before code can be checked or submitted.",
      "requires": ["match-core"], "lessonIds": ["0004-lobby-to-match", "0005-problem-editor-run"],
      "deliverable": "Add minimal Match admission, one checked Problem, and a Run that reports visible-example feedback without scoring.",
      "placement": "In a matching layout, put admission beside packages/arena-game/src/lobby.ts and tests beside packages/arena-game/test/lobby.test.ts; put Problem data under packages/problem-bank/problems/.",
      "pattern": "Keep Problem data separate from Match authority; Run returns visible feedback and never changes score.",
      "check": "An admitted player can Run visible examples; an outsider is rejected and no score changes.",
      "sourcePath": "packages/arena-game/src/lobby.ts", "testPath": "packages/arena-game/test/lobby.test.ts"
    },
    {
      "id": "submit-reveal", "order": 3, "title": "Add Submission and Reveal",
      "why": "The core can now decide whether code may enter hidden evaluation and when its score can be shown.",
      "requires": ["player-problem-run"], "lessonIds": ["0001-submit-journey", "0002-reveal-cutoff", "0006-evaluation-retries", "0007-judge-boundary"],
      "deliverable": "Add the Submit command, pending receipt, retry identity, fake-Judge verdict, deadline cutoff, score, and Reveal.",
      "placement": "In a matching layout, extend packages/arena-game/src/engine.ts and test under packages/arena-game/test/submit-path.test.ts; use the repo's existing Judge contract.",
      "pattern": "Authority checks legality, persistence records acceptance, and a Judge interface runs code; retry by immutable request identity.",
      "check": "A legal Submit is evaluated once; a closed-Round Submit is rejected; hidden results appear only at Reveal.",
      "sourcePath": "packages/arena-game/src/engine.ts", "testPath": "packages/arena-game/test/submit-path.test.ts"
    },
    {
      "id": "persistence", "order": 4, "title": "Save accepted Match state",
      "why": "Reconnect and restart must recover committed Submissions and Reveals.",
      "requires": ["submit-reveal"], "lessonIds": ["0008-persistence-recovery"],
      "deliverable": "Add one Match persistence contract, an in-memory implementation, then the database adapter and restart tests.",
      "placement": "In a matching layout, extend packages/arena-game/src/persistence.ts and packages/arena-game/test/persistence.test.ts, then the existing database adapter.",
      "pattern": "Test the same durable-state contract against memory and the real database; reject stale revisions.",
      "check": "A restarted service reads the same accepted Submission and Reveal; stale writes do not overwrite newer state.",
      "sourcePath": "packages/arena-game/src/persistence.ts", "testPath": "packages/arena-game/test/persistence.test.ts"
    },
    {
      "id": "connect-players", "order": 5, "title": "Connect players to the rules",
      "why": "A screen should send commands and render the server-owned Match snapshot.",
      "requires": ["persistence"], "lessonIds": ["0009-live-connection", "0012-arena-screen"],
      "deliverable": "Add a service route, transport contract, basic Arena view, and reconnect snapshot behavior.",
      "placement": "In a matching layout, put the route under services/game/src/game/, transport under frontend/src/arena/transport.ts, and screen under frontend/src/components/; test each at its boundary.",
      "pattern": "The UI sends commands and renders authoritative snapshots; transport owns delivery and reconnect.",
      "check": "Two browser clients see the same committed Match; reconnect fetches the current snapshot.",
      "sourcePath": "frontend/src/arena/transport.ts", "testPath": "frontend/test/mock-transport.test.ts"
    },
    {
      "id": "team-play", "order": 6, "title": "Add two-player teams",
      "why": "Shared editing and Ready approval depend on Match rules, persistence, and live transport.",
      "requires": ["connect-players"], "lessonIds": ["0010-team-collaboration", "0011-team-chat"],
      "deliverable": "Add 2v2 membership, shared revision, Ready reset on edits, team-only chat, and reconnect tests.",
      "placement": "In a matching layout, extend packages/arena-game/src/team-collaboration.ts and its test, with clients in frontend/src/arena/collab.ts and chat.ts.",
      "pattern": "Game rules own readiness and revision; collaboration and chat clients deliver team-scoped changes.",
      "check": "Four users stay isolated by team; an edit invalidates both Ready approvals.",
      "sourcePath": "packages/arena-game/src/team-collaboration.ts", "testPath": "packages/arena-game/test/team-collaboration.test.ts"
    },
    {
      "id": "real-boundaries", "order": 7, "title": "Verify real boundaries",
      "why": "Fake tests do not prove PostgreSQL, Docker isolation, or real browser behavior.",
      "requires": ["team-play"], "lessonIds": ["0014-rewrite-with-tests"],
      "deliverable": "Run equivalent database, Judge security, and two-client browser checks in the teammate repo; record skipped checks separately.",
      "placement": "Use the teammate repo's existing database, Judge, and browser test folders; in a matching layout inspect packages/arena-game/test/judge-security.test.ts and frontend/e2e/.",
      "pattern": "Keep fake, database, Docker, and real-browser evidence separate; record the command and result for each.",
      "check": "Each parity gate says PASS only when its equivalent test actually ran against the teammate repo.",
      "sourcePath": "packages/arena-game/src/container-judge.ts", "testPath": "packages/arena-game/test/judge-security.test.ts"
    }
  ]
}
~~~

- [x] **Step 5: Load the path through the existing generator**

Add this import and integration to build-catalog.mjs. Keep the optional input for isolated generator fixtures; the production CLI always reads the path file.

~~~js
import { validateLearningPath } from "./learning-path.mjs";

// In renderCatalogOutputs, immediately after buildCatalogData:
data.learningPath = options.learningPath === undefined
  ? null
  : validateLearningPath(options.learningPath, data.lessons, data.files);

// In main, before constructing options:
const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
const options = { referenceSnapshot, referenceBaseline, tours, learningPath };

// Replace main's accept-reviewed-snapshot re-render call:
const refreshed = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, {
  referenceSnapshot: acceptedSnapshot,
  referenceBaseline: accepted.referenceBaseline,
  tours,
  learningPath,
});
~~~

- [x] **Step 6: Run the contract tests and course check**

Run: node --test .tours/learning/scripts/learning-path.test.mjs

Expected: PASS.

Run: node .tours/learning/scripts/build-catalog.mjs --check

Expected: it validates the path. Existing generated-page drift may still be reported because unrelated course edits are present; record that separately from path validation.

- [x] **Step 7: Commit only this task's files and hunks**

~~~sh
git add .tours/learning/learning-path.json .tours/learning/scripts/learning-path.mjs .tours/learning/scripts/learning-path.test.mjs
git add -p .tours/learning/scripts/build-catalog.mjs
git diff --cached --check
git commit -m "feat(course): define validated build path"
~~~

### Task 2: Put orientation and the dependency map before Lesson 1

**Files:**
- Create: .tours/learning/templates/0000-before-lesson-one.template.html
- Generate: .tours/learning/lessons/0000-before-lesson-one.html and index.html
- Modify: .tours/learning/templates/course-home.template.html
- Modify: .tours/learning/scripts/build-catalog.mjs: home and orientation rendering
- Modify: .tours/learning/assets/course.css
- Test: .tours/learning/scripts/build-catalog.test.mjs and course-experience.test.mjs

**Interfaces:**
- Consumes: data.learningPath from Task 1, renderCatalogOutputs, the existing course activity runtime, and the existing 14 lesson records.
- Produces: index.html with a visible build map and a Start link to lessons/0000-before-lesson-one.html; an orientation page at that output path. Saved activity may still change Start to Continue Lesson N.

- [x] **Step 1: Write a failing generated-output test**

Add a test in build-catalog.test.mjs using the real learning directory. It checks the public files returned by the generator, not renderer internals.

~~~js
test("renders orientation before the fourteen trace lessons", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
  const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath });
  const home = rendered.files.get(path.join(learningDir, "index.html"));
  const orientation = rendered.files.get(path.join(learningDir, "lessons/0000-before-lesson-one.html"));
  assert.match(home, /data-course-start href="lessons\/0000-before-lesson-one.html">Start with the map/);
  assert.match(home, /id="build-path"/);
  assert.equal((home.match(/data-build-step=/g) ?? []).length, 8);
  assert.equal((home.match(/data-lesson-link=/g) ?? []).length, 14);
  assert.match(orientation, /Find the homes/);
  assert.match(orientation, /packages\/arena-game\/src/);
  assert.match(orientation, /fixed clock/);
});
~~~

- [x] **Step 2: Run the test to confirm the missing orientation failure**

Run: node --test .tours/learning/scripts/build-catalog.test.mjs

Expected: FAIL because the generator has no orientation output or build map.

- [x] **Step 3: Author the orientation template and home markers**

Create 0000-before-lesson-one.template.html with this complete first page. The worksheet asks for paths in the teammate repo; it does not pretend the reference folders are universal.

~~~html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Code Arena · Before Lesson 1</title>
  <!-- INLINE_COURSE_STYLES -->
</head>
<body>
  <a class="skip-link" href="#orientation">Skip to orientation</a>
  <main class="page" id="orientation" tabindex="-1">
    <p class="eyebrow"><a href="../index.html">Course Home</a> / Before Lesson 1</p>
    <h1>Find your starting point</h1>
    <p class="section-intro">First, look at the game. Then find where your teammate's repo keeps rules and tests. You will reproduce behavior in your own code.</p>
    <section class="section" aria-labelledby="story-title">
      <h2 id="story-title">One tiny game story</h2>
      <p>A Match has players and Rounds. One Round gives them a Problem. Run checks visible examples without a score. Submission asks the Game to judge hidden cases. The Game decides whether Submit is allowed; the Judge executes code. Reveal shows the score after evaluation.</p>
    </section>
    <section class="section" aria-labelledby="homes-title">
      <h2 id="homes-title">Find six homes in your teammate's repo</h2>
      <ol>
        <li>Find the existing game-rules folder and one rule test.</li>
        <li>Find the Problem data and visible-example tests.</li>
        <li>Find the backend route and its test.</li>
        <li>Find the frontend Arena and its browser test.</li>
        <li>Find persistence and its database test.</li>
        <li>Find the commands that run one test, lint, and the app.</li>
      </ol>
      <p>Write those six answers in the teammate repo's existing project notes. If its layout mirrors this reference, look for rules in packages/arena-game/src/, tests in packages/arena-game/test/, routes in services/game/src/game/, and the screen in frontend/src/. Create a new folder only when no current owner fits.</p>
    </section>
    <!-- ORIENTATION_FIRST_STEP -->
    <section class="section" aria-labelledby="first-action-title">
      <h2 id="first-action-title">Your first coding action</h2>
      <p>Write a failing test for a Match with one active Round and a fixed clock. Check that an allowed player action succeeds and an action in the wrong phase is rejected. Then implement only enough rule code to make that test pass.</p>
      <p><a class="primary-button" href="../index.html#build-path">See the build order</a> <a href="0001-follow-one-submit.html">Explore the Submit trace</a></p>
    </section>
  </main>
</body>
</html>
~~~

In course-home.template.html, add this section before the existing course-batches container:

~~~html
<section class="section" id="build-path" aria-labelledby="build-path-title">
  <h2 id="build-path-title">What to build, and why this order</h2>
  <p>Start by finding the right files in your teammate's repo. Each next step uses the result of an earlier one. The numbered lessons below trace the existing game for reference.</p>
  <!-- BUILD_PATH_STEPS -->
</section>
~~~

- [x] **Step 4: Render the map and orientation**

Add these functions beside renderCourseBatches in build-catalog.mjs. Use the existing html escape function. Replace FIRST_LESSON_URL/ACTION with orientation output and Start with the map when data.learningPath exists; retain the old first-lesson fallback only for isolated fixtures without a path. Add the orientation file to renderCatalogOutputs.

~~~js
function renderBuildPathSteps(pathModel, lessons) {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return '<ol class="build-path-list">' + pathModel.steps.map((step) => {
    const links = step.lessonIds.map((id) => {
      const lesson = byId.get(id);
      return '<a href="' + html(lesson.output) + '">Lesson ' + lesson.order + '</a>';
    }).join(" · ");
    const needs = step.requires.length
      ? step.requires.map((id) => pathModel.steps.find((item) => item.id === id).title).join(", ")
      : "No earlier build step";
    return '<li data-build-step="' + html(step.id) + '"><h3>' + html(step.title) +
      '</h3><p><strong>Why now:</strong> ' + html(step.why) +
      '</p><p><strong>Needs:</strong> ' + html(needs) +
      '</p><p><strong>Create:</strong> ' + html(step.deliverable) +
      '</p><p><strong>Place:</strong> ' + html(step.placement) +
      '</p><p><strong>Pattern:</strong> ' + html(step.pattern) +
      '</p><p><strong>Check:</strong> ' + html(step.check) +
      '</p><p>Read: ' + links + '</p></li>';
  }).join("") + "</ol>";
}

function renderOrientationTemplate(template, stylesheet, pathModel) {
  const first = pathModel.steps[0];
  const firstStep = '<aside class="concept-note"><h2>Step 0: ' + html(first.title) +
    '</h2><p>' + html(first.why) + '</p><p><strong>Place it:</strong> ' +
    html(first.placement) + '</p><p><strong>Check:</strong> ' + html(first.check) + '</p></aside>';
  return template
    .replace("<!-- INLINE_COURSE_STYLES -->", "<style>\n" + stylesheet + "\n</style>")
    .replace("<!-- ORIENTATION_FIRST_STEP -->", firstStep);
}

// In renderCourseHomeTemplate, after the existing replacements declaration:
Object.assign(replacements, {
  "{{FIRST_LESSON_URL}}": data.learningPath
    ? html(data.learningPath.orientation.output)
    : (firstLesson ? html(firstLesson.output) : "#course-batches"),
  "{{FIRST_LESSON_ACTION}}": data.learningPath
    ? "Start with the map"
    : (firstLesson ? "Start Lesson " + firstLesson.order : "Browse lessons"),
  "<!-- BUILD_PATH_STEPS -->": data.learningPath
    ? renderBuildPathSteps(data.learningPath, data.lessons)
    : "",
});

// In renderCatalogOutputs after generating index.html:
if (data.learningPath) {
  const orientationTemplate = await readFile(path.join(learningDir, "templates/0000-before-lesson-one.template.html"), "utf8");
  files.set(
    path.join(learningDir, data.learningPath.orientation.output),
    renderOrientationTemplate(orientationTemplate, stylesheet, data.learningPath),
  );
}
~~~

- [x] **Step 5: Style the new content using existing course tokens**

Add these rules inside the existing components layer in course.css, adapting only selectors already used by this task.

~~~css
.build-path-list {
  display: grid;
  gap: 0.75rem;
  padding-inline-start: 1.5rem;
  max-width: 72ch;
}
.build-path-list > li {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.55rem;
  background: var(--surface);
}
.build-path-list h3 { margin-block-end: 0.4rem; }
.build-path-list p + p { margin-block-start: 0.45rem; }
.build-path-list a,
#orientation .section a {
  display: inline-flex;
  min-block-size: 2.75rem;
  align-items: center;
  padding-inline: 0.65rem;
}
~~~

- [x] **Step 6: Update the browser session test for the new start**

In createRenderedFixture, load learning-path.json and pass it to renderCatalogOutputs. In the fresh, malformed, and blocked-storage scenarios, replace the old Start Lesson 1 assertion with Start with the map and check the orientation route before navigating directly to Lesson 1 for the existing quiz checks. Keep the saved-lesson Continue Lesson 1 assertion.

~~~js
const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath });

assert.equal(await readStartText(page), "Start with the map →");
assert.equal(await page.locator("[data-course-start]").getAttribute("href"), "lessons/0000-before-lesson-one.html");
await page.locator("[data-course-start]").click();
assert.ok(new URL(page.url()).pathname.endsWith("lessons/0000-before-lesson-one.html"));
assert.equal(await page.locator("#homes-title").isVisible(), true);
await page.goto(route(mode, lessonOutput));
~~~

Add orientation to the existing desktop/320-pixel browser loop; check keyboard reachability, 44-pixel links, no overflow, and the existing console-error collector. For the blocked-storage test, clicking Start must still reach orientation. For a saved lesson record, the existing Continue Lesson 1 link must still work.

~~~js
await page.goto(route(mode, "lessons/0000-before-lesson-one.html"));
assert.equal(await tabUntil(page, "a[href='../index.html#build-path']"), true);
const orientationLayout = await page.evaluate(() => ({
  viewport: document.documentElement.clientWidth,
  page: document.documentElement.scrollWidth,
  startHeight: Math.round(document.querySelector("a[href='../index.html#build-path']").getBoundingClientRect().height),
}));
assert.ok(orientationLayout.page <= orientationLayout.viewport);
assert.ok(orientationLayout.startHeight >= 44);
assert.deepEqual(browserErrors, []);

await page.goto(route(mode, "index.html"));
assert.equal(await tabUntil(page, "[data-build-step] a"), true);
const buildLinkHeights = await page.locator("[data-build-step] a").evaluateAll(
  (links) => links.map((link) => Math.round(link.getBoundingClientRect().height)),
);
assert.ok(buildLinkHeights.every((height) => height >= 44));

// In the malformed/blocked-storage test, which uses the local server:
await page.goto(route("server", "index.html"));
assert.equal(await readStartText(page), "Start with the map →");
await page.locator("[data-course-start]").click();
assert.ok(new URL(page.url()).pathname.endsWith("lessons/0000-before-lesson-one.html"));
await page.goto(route("server", lessonOutput));
~~~

- [x] **Step 7: Run focused tests and regenerate the public pages**

Run: node --test .tours/learning/scripts/build-catalog.test.mjs .tours/learning/scripts/course-experience.test.mjs

Expected: PASS, including file:// and served navigation. If browser startup or local socket binding is blocked by the environment, record the exact failure rather than calling the browser test passed.

Run: node .tours/learning/scripts/build-catalog.mjs

Expected: index.html and the orientation page are generated. The 14 trace lessons remain in their original order.

- [x] **Step 8: Commit the generated route and its tests**

~~~sh
git add .tours/learning/templates/0000-before-lesson-one.template.html .tours/learning/lessons/0000-before-lesson-one.html
git add -p .tours/learning/templates/course-home.template.html .tours/learning/scripts/build-catalog.mjs .tours/learning/assets/course.css .tours/learning/scripts/build-catalog.test.mjs .tours/learning/scripts/course-experience.test.mjs .tours/learning/index.html
git diff --cached --check
git commit -m "feat(course): start with orientation and build map"
~~~

### Task 3: Give every lesson a concrete build connection

**Files:**
- Modify: .tours/learning/scripts/build-catalog.mjs
- Modify: .tours/learning/templates/0001-submit-journey.template.html
- Modify: .tours/learning/templates/0014-rewrite-with-tests.template.html
- Modify: .tours/learning/assets/course.css
- Modify: .tours/learning/README.md, MISSION.md, MAINTAINING.md
- Generate: .tours/learning/lessons/0001 through 0014 and index.html
- Test: .tours/learning/scripts/build-catalog.test.mjs and course-experience.test.mjs

**Interfaces:**
- Consumes: data.learningPath and the existing COURSE_LESSON_NAV marker in each authored lesson template.
- Produces: each generated lesson gets cards for its linked build steps, with reason, prerequisites, example placement, observable check, and current-reference source/test links. The existing source-preview behavior and lesson navigation remain available.

- [x] **Step 1: Write failing public-output tests for build cards and escaping**

Add this test in build-catalog.test.mjs. It checks all 14 lesson outputs and makes the source/test links visible without claiming they pass.

~~~js
test("every trace lesson explains its build use without treating reference tests as parity", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
  const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath });
  for (const lesson of coverageMap.lessons) {
    const page = rendered.files.get(path.join(learningDir, lesson.output));
    assert.match(page, /data-build-card=/, lesson.id + " has build context");
    assert.match(page, /What must exist first/);
    assert.match(page, /Your teammate's repo/);
    assert.match(page, /Pattern:/);
    assert.match(page, /data-build-source/);
    assert.match(page, /data-build-test/);
  }
  const lessonOne = rendered.files.get(path.join(learningDir, "lessons/0001-follow-one-submit.html"));
  assert.match(lessonOne, /Before coding Submit/);
  assert.match(lessonOne, /0000-before-lesson-one.html/);
  const last = rendered.files.get(path.join(learningDir, "lessons/0014-rewrite-with-tests.html"));
  assert.match(last, /index.html#build-path/);
  assert.doesNotMatch(last, /<li><strong>Build the small domain core/);
  const unsafePath = structuredClone(learningPath);
  unsafePath.steps[0].why = "<script>alert(1)</script>";
  const escaped = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath: unsafePath });
  const lessonThirteen = escaped.files.get(path.join(learningDir, "lessons/0013-running-the-project.html"));
  assert.match(lessonThirteen, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(lessonThirteen, /<script>alert\(1\)<\/script>/);
});
~~~

- [x] **Step 2: Run the test and confirm missing build cards**

Run: node --test .tours/learning/scripts/build-catalog.test.mjs

Expected: FAIL because generated lessons have no data-build-card.

- [x] **Step 3: Render cards once at the shared lesson-navigation seam**

Add this helper beside renderLessonNavigation in build-catalog.mjs. Use the already validated path. The query URLs stay relative to each lesson, so local-file and served navigation use the same hrefs.

~~~js
function renderLessonBuildCards(pathModel, lesson) {
  if (!pathModel) return "";
  const cards = pathModel.steps.filter((step) => step.lessonIds.includes(lesson.id));
  return cards.map((step) => {
    const prerequisites = step.requires.length ? step.requires.map((id) => {
      const item = pathModel.steps.find((candidate) => candidate.id === id);
      return item.title;
    }).join(", ") : "Find the homes in your teammate's repo";
    const sourceUrl = "../source-map.html?file=" + encodeURIComponent(step.sourcePath);
    const testUrl = "../source-map.html?file=" + encodeURIComponent(step.testPath);
    return '<aside class="concept-note" data-build-card="' + html(step.id) +
      '"><h2>How this helps your build: ' + html(step.title) +
      '</h2><p><strong>Why now:</strong> ' + html(step.why) +
      '</p><p><strong>What must exist first:</strong> ' + html(prerequisites) +
      "</p><p><strong>Your teammate's repo:</strong> " + html(step.placement) +
      '</p><p><strong>Pattern:</strong> ' + html(step.pattern) +
      '</p><p><strong>Create:</strong> ' + html(step.deliverable) +
      '</p><p><strong>Test:</strong> ' + html(step.check) +
      '</p><p>Reference only: <a data-build-source href="' + html(sourceUrl) +
      '">source</a> · <a data-build-test href="' + html(testUrl) +
      '">test</a>. These files show current behavior; run an equivalent test in your own repo before claiming parity.</p></aside>';
  }).join("\n");
}

// In renderLessonTemplate, where COURSE_LESSON_NAV is replaced:
rendered = rendered.replaceAll(
  "<!-- COURSE_LESSON_NAV -->",
  renderLessonBuildCards(courseOptions.learningPath, metadata) + renderLessonNavigation(orderedLessons, metadata),
);

// In renderCatalogOutputs, replace the lesson call with:
const page = renderLessonTemplate(
  lessonTemplate,
  stylesheet,
  data.snapshotId,
  lessonFreshness(data, lesson.id),
  lesson,
  { files: data.files.filter((file) => (lesson.references ?? []).some((reference) => reference.path === file.path)) },
  repoRoot,
  { courseLessons: orderedLessons, activityRuntimeSource, learningPath: data.learningPath },
);
~~~

- [x] **Step 4: Make Lesson 1's prerequisites explicit and remove the duplicate recipe in Lesson 14**

Add this paragraph immediately below Lesson 1's hero-copy and keep the trace and recall prompt readable before a prediction. In Lesson 14, replace only its eight-item build-order list with the paragraph below; keep its parity rule, evidence table content, and test limitations unchanged, and let the evidence table scroll inside a keyboard-focusable region on narrow screens.

~~~html
<p class="concept-note">Before coding Submit, <a href="0000-before-lesson-one.html">find your starting point</a>. Your own Match, active Round, player membership, fixed clock, and fake Judge need to exist before a Submit test has a meaningful starting state. You can still read this trace now to see where you are going.</p>
~~~

~~~html
<p>The <a href="../index.html#build-path">build path on Course Home</a> gives the dependency order and the first file decision. Use each lesson's build card for a small deliverable and an observable test. Compare your result with the reference behavior, then record parity only after your own equivalent test ran and passed.</p>
~~~

- [x] **Step 5: Update learner and maintainer guidance**

In README.md and MISSION.md, use this exact concise route description. In MAINTAINING.md, name learning-path.json as a generator input and require validation when adding a step or linking a lesson.

~~~md
Start at [Before Lesson 1](lessons/0000-before-lesson-one.html) to find the right folders and test commands in your teammate's repo. [Course Home](index.html#build-path) shows what to build and why each step depends on the last one. The 14 numbered lessons trace the reference game; use them to inspect behavior and tests, then write your own code.
~~~

~~~md
The build order lives in learning-path.json. Keep its prerequisite IDs, lesson IDs, and reference source/test paths valid when editing the course. The generator validates them and renders the orientation, Course Home path, and lesson build cards. Keep generated HTML out of hand edits.
~~~

In course.css, make the lesson navigation and card source/test links large enough to use by keyboard or touch. Use the existing theme colors and focus outline.

~~~css
[data-build-card] [data-build-source],
[data-build-card] [data-build-test] {
  display: inline-flex;
  min-block-size: 2.75rem;
  align-items: center;
  padding-inline: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.45rem;
}
~~~

- [x] **Step 6: Extend browser checks and run full course verification**

In course-experience.test.mjs, after opening Lesson 1 and Lesson 14, assert the build card appears, its source and test links point to source-map.html?file=, and the source-map route works under both file:// and the local server. Reuse the existing 320-pixel overflow, keyboard Tab, 44-pixel target, and console-error helpers for the card links.

~~~js
assert.ok(await page.locator("[data-build-card]").count() > 0);
assert.match(await page.locator("[data-build-source]").first().getAttribute("href"), /^\.\.\/source-map\.html\?file=/);
assert.equal(await tabUntil(page, "[data-build-source]"), true);
assert.equal(await tabUntil(page, "[data-build-test]"), true);
const cardLinks = await page.locator("[data-build-source], [data-build-test]").evaluateAll(
  (links) => links.map((link) => Math.round(link.getBoundingClientRect().height)),
);
assert.ok(cardLinks.every((height) => height >= 44));
await page.locator("[data-build-source]").first().click();
await page.waitForURL(/source-map\.html/);
await page.waitForFunction(() => document.querySelector("#source-dialog")?.open);
assert.equal(await page.locator("#source-dialog").evaluate((dialog) => dialog.open), true);
~~~

Run: node .tours/learning/scripts/build-catalog.mjs

Run: node --test .tours/learning/scripts/*.test.mjs

Run: node .tours/learning/scripts/build-catalog.mjs --check

Run: npm run lint

Run: git diff --check

Expected: course tests, lint, and diff checks pass. `--check` must show no source drift, stale links, coverage gaps, anchor errors, or generated-page drift. A matrix-only CodeTour/evidence checksum drift may remain when the required scope note changes; review the matrix against the PDF and keep the frozen CodeTour baseline unchanged unless a dedicated review calls for a refresh. Do not accept a source snapshot just to silence that report. If Chrome, local sockets, Docker, or PostgreSQL is unavailable, record the exact command and blocker as skipped.

- [x] **Step 7: Review the 42 subject matrix and commit this task**

Read ft_transcendence.pdf's mandatory frontend, Chrome, console, and multi-user requirements and its gaming/remote-player requirements. Review prototype/game-ui/42-subject-compliance.md after the course change. Record the added learning-path scope there while keeping subject-module evidence and status rows unchanged because the course changes do not add game behavior.

~~~sh
git add -p .tours/learning/scripts/build-catalog.mjs .tours/learning/templates/0001-submit-journey.template.html .tours/learning/templates/0014-rewrite-with-tests.template.html
git add -p .tours/learning/assets/course.css .tours/learning/README.md .tours/learning/MISSION.md .tours/learning/MAINTAINING.md
git add -p .tours/learning/scripts/build-catalog.test.mjs .tours/learning/scripts/course-experience.test.mjs
git add -p .tours/learning/lessons .tours/learning/index.html
git diff --cached --check
git commit -m "feat(course): connect lessons to the build path"
~~~

## Self-Review Record

- Spec coverage: Task 1 owns one validated build contract and eight-step dependency map. Task 2 owns first-time orientation, the teammate-repo worksheet, Course Home map, resume, and offline/browser behavior. Task 3 owns per-lesson file guidance, source/test links, the Lesson 14 deduplication, maintenance notes, and final verification.
- Interface consistency: Task 1 produces data.learningPath; Tasks 2 and 3 consume that same value. The orientation output path is fixed to lessons/0000-before-lesson-one.html and is never added to coverage-map.lessons.
- Review Focus mapping: malformed path data is Task 1; storage and start/continue behavior is Task 2; file/served links, keyboard, 320-pixel layout, and console behavior are Tasks 2 and 3; HTML escaping and source-link safety are Tasks 1 and 3.
- No separate game behavior or claimed 42 module is implemented by this plan. Teammate-repo paths remain conditional until the learner completes Step 0 there.
