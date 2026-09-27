# Exam Shell Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Replace selected Active Match Variant A with a readable, editable, two-role C-workstation prototype that evokes a 42 exam shell while making it unmistakable that evaluation is simulated and no submitted code is executed.

**Architecture:** Keep the existing standalone `04-live-match.html` spike and its A/B/C switcher. Variant A gets an `exam` state namespace, a native `<textarea>` editor, deterministic token-based simulated checks, role locks, submission gating, and a post-stage optional Role-swap intermission. Variants B and C continue to render from their existing legacy state. All behavior stays local, in-memory, dependency-free, and network-free.

**Tech Stack:** Semantic HTML, isolated CSS, vanilla JavaScript, native dialogs/forms, Playwright with the workspace-provided Chromium runtime.

**Spec:** [`docs/42-exam-game-direction-research.md`](../../42-exam-game-direction-research.md) for the approved prototype direction; [`.scratch/campus-puzzle-race/spec.md`](../../../.scratch/campus-puzzle-race/spec.md) remains the production design boundary.

## Global Constraints

- Treat this as a throwaway interaction prototype, not production implementation or module evidence.
- Label Variant A `42-INSPIRED SIMULATION · FAKE GRADER`; do not claim an official, current, or pixel-perfect 42 exam shell.
- Use only original subject content. Do not copy real exam subjects, solutions, hidden grading rules, or current exam wording.
- Never execute or compile editor contents. Do not add `eval`, `Function`, Web Workers, child processes, `fetch`, storage, third-party editor packages, or a backend.
- Preserve Variant B (`Focus workspace`) and Variant C (`Team board`) as historical alternatives, including arrow-key switching and the typing-focus guard.
- Keep the Journey link to `00-journey.html`, the fake-state inspector, Team chat, Hint dialog, Match clock, Finish delay, Failure trace, and Retry cooldown concepts.
- The new optional between-Stage Role swap is an exploratory prototype behavior. The production spec currently says Roles remain fixed during a Match; do not change that production rule until the Team explicitly approves it.
- The prototype may show Stage 02 as unlocked after success, but must state that Stage 02 content is not implemented in this spike.
- Meet existing prototype checks: latest stable Chrome, one `<h1>`, semantic controls and labels, visible keyboard focus, non-color state labels, at least 14px visible text, at least 44px targets, no document-level horizontal overflow at 1440×1000 or 390×844, and no console/page errors.
- Review `ft_transcendence.pdf` and `prototype/game-ui/42-subject-compliance.md` before completion. Update the matrix with honest prototype evidence and explicit non-evidence; never turn the fake grader into a production compliance claim.

## Locked Product Decisions

- Replace Variant A rather than adding a fourth variant.
- Use a strict, austere green-on-black Exam Shell visual; reserve amber for pending/cooldown/hints and red for failure, always paired with text.
- Use the Team Workstation layout: Subject at left, `solution.c` editor in the center, Role/Team station at right, evaluator across the bottom.
- Use two clear stations:
  - **Code Writer:** edits and locks `solution.c`.
  - **Test Operator:** selects and runs supplied simulated checks, reads the Failure trace, and locks the test report.
- Both players can read the complete subject and Team chat.
- Submit Stage 01 becomes attemptable once solution.c is locked and Retry cooldown is zero. A Submission passes only when all four simulated checks pass and the Test Operator has locked the test report; otherwise the explicit Submission fails with a simulated Failure trace and a 15-second Retry cooldown.
- After a passed Stage, either teammate may request a Role swap; the other teammate must confirm it. Otherwise, Roles remain unchanged.
- The Match duration is 15 minutes; the fake state starts at `09:42` remaining to match the existing prototype.
- Subject content:

  ```text
  loop_checksum
  Expected file: solution.c
  Function: int loop_checksum(const int *values, int size);
  Allowed functions: None
  Stage 01: Foundation
  Evaluator: 4 simulated checks

  Add each odd value once. Add each even value twice.
  Return the resulting checksum.

  Constraints:
  - 1 <= size <= 16
  - 0 <= values[i] <= 99
  - values is valid when size > 0
  - the result fits in a signed int

  Example: [1, 2, 3, 4] -> 16
  ```

## State Contract

Preserve the current top-level fields used by Variants B and C. Add an `exam` namespace for Variant A so the historical alternatives do not need to understand the new workflow:

```js
const initialState = {
  // Existing shared/legacy fields remain here for B/C.
  stage: 1,
  totalStages: 3,
  remainingSeconds: 582,
  hintsUsed: 0,
  finishDelay: 0,
  cooldown: 0,
  trace: null,
  lastEvent: "Stage 01 ready. Code Writer may edit solution.c.",
  messages: [/* existing local Team messages */],
  selectedAnswer: null,
  correctAnswer: "16",
  contributions: [/* existing B/C contribution records */],
  sharedClue: false,

  exam: {
    activeRole: "code-writer",
    assignments: {
      "code-writer": "Aimane",
      "test-operator": "Saad"
    },
    code: STARTER_CODE,
    codeRevision: 1,
    codeLocked: false,
    selectedTestCase: "sample",
    checkStatus: "idle",
    checkResults: TEST_CASES.map(({ id, label }) => ({
      id,
      label,
      status: "pending",
      detail: "Not run"
    })),
    testReportLocked: false,
    submissionStatus: "blocked",
    swap: { status: "idle", requestedBy: null },
    stageTwoNotice: false
  }
};
```

Expose a read-only test hook after creating the store:

```js
window.__MATCH_STATE__ = () => structuredClone(store.getState());
```

Use `?variant=A&role=writer` and `?variant=A&role=tester` as initial-view conveniences. Also include a visibly labelled prototype-only `View as` control so one browser can demonstrate both teammates without pretending that client authorization exists.

## Task 1: Pin the Exam Shell Contract with a Failing Browser Check

**Files:**

- Create: `prototype/game-ui/checks/exam-shell-check.js`
- Read: `prototype/game-ui/04-live-match.html`
- Read: `prototype/game-ui/42-subject-compliance.md`

- [ ] **Step 1: Write the initial contract check**

  Create a Playwright script that opens the local file with the workspace Chromium runtime. Capture both `pageerror` and console `error` messages. Add helpers for a desktop page and a mobile page.

  The first assertions should describe the approved screen rather than the current Operations Console:

  ```js
  const { chromium } = require("playwright");
  const path = require("path");

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  const file = `file://${path.resolve("prototype/game-ui/04-live-match.html")}`;

  // At ?variant=A&role=writer assert:
  // - .variant-a and [data-exam-shell] are visible
  // - title and switcher say "Exam shell"
  // - visible label says "42-INSPIRED SIMULATION" and "FAKE GRADER"
  // - exactly one h1 is visible
  // - subject contains loop_checksum, solution.c, the signature, and Allowed functions: None
  // - textarea labelled "solution.c editor" is editable
  // - Code Writer station is current and Test Operator is named
  // - Submit Stage 01 is disabled
  ```

- [ ] **Step 2: Add Test Operator and security-boundary assertions**

  Open `?variant=A&role=tester` in a fresh page and assert:

  ```js
  assert(await page.getByRole("textbox", { name: "solution.c editor" }).isDisabled(),
    "Test Operator must not edit solution.c");
  assert(await page.getByText(/simulated checks only/i).isVisible(),
    "fake evaluator boundary is missing");

  const html = await page.content();
  for (const forbidden of ["eval(", "new Function", "fetch(", "Worker("]) {
    assert(!html.includes(forbidden), `forbidden execution primitive found: ${forbidden}`);
  }
  ```

- [ ] **Step 3: Add B/C regression, accessibility, and viewport assertions**

  In the same script, verify:

  - Variant switch buttons still move A → B → C and update the URL.
  - Arrow keys still switch variants when focus is not in an input.
  - Arrow keys do not switch variants while the editor or Team chat input has focus.
  - All A/B/C variants have at most one pixel of horizontal overflow at 1440×1000 and 390×844.
  - Visible buttons, inputs, selects, summaries, and textareas have a minimum 44px hit dimension.
  - Visible text does not render below 14px.
  - Variant A has a Journey link, one polite live region, and no console/page errors.

- [ ] **Step 4: Run the check and prove RED**

  Run:

  ```bash
  NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    prototype/game-ui/checks/exam-shell-check.js
  ```

  Expected: failure because Variant A still identifies itself as `Operations console` and does not contain the subject, editable `solution.c`, or Role stations. Keep this failing output as the red-phase evidence; do not weaken the assertions to fit the old screen.

## Task 2: Build the Static Exam Workstation and Preserve Historical Variants

**Files:**

- Modify: `prototype/game-ui/04-live-match.html`
- Test: `prototype/game-ui/checks/exam-shell-check.js`

- [ ] **Step 1: Add the exam constants and namespaced state**

  Add immutable `STARTER_CODE` and `TEST_CASES` data before `initialState`:

  ```js
  const STARTER_CODE = `int loop_checksum(const int *values, int size)
  {
      int checksum = 0;

      /* TODO: update checksum for every value */
      return checksum;
  }`;

  const TEST_CASES = [
    { id: "sample", label: "Sample", input: "[1, 2, 3, 4]", expected: "16" },
    { id: "odd", label: "Odd values", input: "[1, 3, 5]", expected: "9" },
    { id: "even", label: "Even values", input: "[2, 4]", expected: "12" },
    { id: "single", label: "Single value", input: "[0]", expected: "0" }
  ];
  ```

  Add `initialState.exam` exactly as described in the State Contract. Do not remove or rename the legacy fields consumed by B/C.

- [ ] **Step 2: Give Variant A a focused identity without changing B/C**

  Change only Variant A's metadata:

  ```js
  const variants = [
    { key: "A", name: "Exam shell" },
    { key: "B", name: "Focus workspace" },
    { key: "C", name: "Team board" }
  ];
  ```

  Update the prototype flag and selected-direction line only when Variant A is active. The selected direction should read `Selected direction · Exam shell`; B/C should retain `Historical alternative · Use ← → when not typing`.

- [ ] **Step 3: Replace `renderVariantA()` with four semantic regions**

  Render this landmark order so the mobile reading order matches the visual hierarchy:

  ```html
  <div class="variant-a" data-exam-shell>
    <header class="exam-status">...</header>
    <ol aria-label="Stage progress">...</ol>
    <div class="exam-grid">
      <section class="exam-subject" aria-labelledby="subject-title">...</section>
      <section class="exam-editor" aria-labelledby="editor-title">...</section>
      <aside class="exam-station" aria-labelledby="station-title">...</aside>
      <section class="exam-evaluator" aria-labelledby="evaluator-title">...</section>
    </div>
  </div>
  ```

  Requirements for those regions:

  - Header: one page `<h1>`, `42-INSPIRED SIMULATION · FAKE GRADER`, Room, Match clock, Stage `01 / 03`, Finish delay, Retry status, and Journey link.
  - Subject: exact approved metadata, statement, constraints, example, and terse flow `READ SUBJECT → WRITE CODE → RUN CHECKS → LOCK ROLES → SUBMIT`.
  - Editor: a real labelled native `<textarea id="solution-code">` with `spellcheck="false"`, `autocomplete="off"`, `autocapitalize="off"`, and Code Writer-only editability.
  - Station: both player/Role assignments, clear current Role explanation, prototype-only `View as Code Writer` / `View as Test Operator` buttons, Team chat, Role lock state, and no vague `Private Role` label.
  - Evaluator: four check rows, selected test control, machine output, Failure trace, Retry cooldown, Hint, report lock, and submission actions.

- [ ] **Step 4: Add strict Exam Shell CSS**

  Scope all new styles beneath `.variant-a`. Use functional monospace throughout A, deep black/charcoal surfaces, thin green rules, square or nearly square controls, and no decorative gradients or glowing arcade effects.

  Desktop grid:

  ```css
  .variant-a .exam-grid {
    display: grid;
    grid-template-columns: minmax(18rem, 0.9fr) minmax(28rem, 1.6fr) minmax(18rem, 0.85fr);
    grid-template-areas:
      "subject editor station"
      "evaluator evaluator evaluator";
  }
  ```

  At the existing mobile breakpoint, change to one column in this order: Subject, Editor, Role station, Evaluator. Use `min-width: 0`, wrapping metadata, and scroll only inside the textarea/evaluator output rather than on the document.

  Every status needs visible text such as `PENDING`, `PASSED`, `FAILED`, `LOCKED`, or `READY`; color is secondary.

- [ ] **Step 5: Keep editor input stable**

  Do not re-render the whole page on every keystroke because that would reset selection and cursor position. Add a silent state path for editor input:

  ```js
  updateSilently(mutator) {
    const next = structuredClone(state);
    mutator(next);
    state = next;
  }
  ```

  On the editor `input` event, update `exam.code`, increment `codeRevision` only once per edit session if desired, and invalidate derived evaluator artifacts:

  ```js
  function invalidateExamResults(exam) {
    exam.codeLocked = false;
    exam.checkStatus = "idle";
    exam.checkResults.forEach((result) => {
      result.status = "pending";
      result.detail = "Code changed; run again";
    });
    exam.testReportLocked = false;
    exam.submissionStatus = "blocked";
  }
  ```

  Patch the small status elements and Submit disabled state in place during typing, or re-render on an explicit action; never destroy the textarea on each input event.

- [ ] **Step 6: Run the static contract check**

  Run the Task 1 command. Expected: the shell identity, subject, Role views, editor permissions, B/C regression, and viewport assertions pass. Interaction assertions added in Task 3 may still fail.

- [ ] **Step 7: Commit the static shell**

  ```bash
  git add prototype/game-ui/04-live-match.html
  git commit -m "prototype: frame exam shell stage"
  ```

  If the workspace contains unrelated changes, stage only this file and do not alter or discard other work.

## Task 3: Implement the Simulated Evaluation and Two-Role Gate

**Files:**

- Modify: `prototype/game-ui/04-live-match.html`
- Modify: `prototype/game-ui/checks/exam-shell-check.js`

- [ ] **Step 1: Add the full failing workflow assertions**

  Extend the browser check with this sequence:

  1. Code Writer changes starter code and confirms that all prior locks/results clear.
  2. Code Writer locks `solution.c`.
  3. Switch to Test Operator; editor is read-only.
  4. Run a check with incomplete code; it returns `FAILED` row diagnostics only, with no Failure trace and no Retry cooldown (exploring controls is not a Submission).
  5. Submit explicitly while unready; the Submission fails with a simulated Failure trace and a 15-second Retry cooldown. Confirm editing and checks remain available during cooldown and only resubmission is blocked.
  6. Advance the prototype cooldown and verify the Match clock loses 15 seconds.
  7. Enter the known accepted sample implementation, lock it, run all four supplied checks, and see four `PASSED` labels.
  8. Lock the test report and verify `Submit Stage 01` stays attemptable and the Submission now passes.
  9. Submit and verify `STAGE 01 PASSED`, Stage 02 `UNLOCKED · NOT IMPLEMENTED`, and a Role-swap intermission.
  10. Request a Role swap, confirm it as the other simulated teammate, and verify Aimane/Saad assignments exchange.

  Use this known sample only as prototype test input:

  ```c
  int loop_checksum(const int *values, int size)
  {
      int checksum = 0;
      int i = 0;

      while (i < size)
      {
          if (values[i] % 2 == 0)
              checksum += values[i] * 2;
          else
              checksum += values[i];
          i++;
      }
      return checksum;
  }
  ```

  Run the check. Expected: RED because the interactions are not implemented yet.

- [ ] **Step 2: Add explicit Role permissions**

  Implement small guards that read like the UI rules:

  ```js
  function isCodeWriter(state) {
    return state.exam.activeRole === "code-writer";
  }

  function isTestOperator(state) {
    return state.exam.activeRole === "test-operator";
  }

  function allChecksPassed(exam) {
    return exam.checkResults.every((result) => result.status === "passed");
  }

  function canSubmit(state) {
    return state.exam.codeLocked
      && allChecksPassed(state.exam)
      && state.exam.testReportLocked
      && state.cooldown === 0
      && state.stage === 1;
  }

  function canAttemptSubmit(state) {
    return state.exam.codeLocked
      && state.cooldown === 0
      && state.stage === 1;
  }
  ```

  `canSubmit(state)` is the pass predicate (Submission succeeds only when it holds). `canAttemptSubmit(state)` is the UI attempt predicate (the Submit control enables as soon as it holds).

  Reject a disallowed action in the event handler as well as disabling its button. The rejection should update the polite status with a useful reason.

- [ ] **Step 3: Implement a disclosed recognizer, not a C evaluator**

  Normalize whitespace and recognize only the prototype pattern needed for the original example:

  ```js
  function inspectPrototypeCode(code) {
    const compact = code.replace(/\s+/g, " ");
    return {
      hasIteration: /\b(for|while)\s*\(/.test(compact),
      readsValues: /values\s*\[/.test(compact),
      doublesEven: /values\s*\[[^\]]+\]\s*\*\s*2/.test(compact),
      addsOdd: /checksum\s*\+=\s*values\s*\[/.test(compact),
      returnsChecksum: /return\s+checksum\s*;/.test(compact)
    };
  }
  ```

  `simulateCheck(code, testCase)` should map missing markers to a short, authored diagnostic and map the complete recognized pattern to the selected test's expected display. It must not claim to parse, compile, run, or prove arbitrary C semantics. Every evaluator result should include `SIMULATED` in visible copy.

- [ ] **Step 4: Wire Code Writer actions**

  Add actions:

  - `select-role`: change `exam.activeRole`, update `role=` in the query string while preserving `variant=`, and re-render.
  - `lock-code`: Code Writer only; set `codeLocked = true`, increment the displayed revision, and announce `solution.c locked for checks`.
  - Editor input: Code Writer only; use the silent path and `invalidateExamResults()`.

  A later edit must clear both Role locks and all prior check results. This prevents stale checks from enabling a new Submission.

- [ ] **Step 5: Wire Test Operator actions**

  Add actions:

  - `select-test`: store the selected supplied test case.
  - `run-selected-check`: require locked code; update only that check row.
  - `run-all-checks`: require locked code; update all four rows in one simulated evaluation.
  - `lock-test-report`: require all four rows to pass; set `testReportLocked = true`.

  A failed simulated check reports row diagnostics only and never penalizes: no Failure trace, no Retry cooldown.

  On an explicit incorrect Submission (attemptable via `canAttemptSubmit(state)` but `canSubmit(state)` is false):

  ```js
  state.cooldown = 15;
  state.trace = authoredDiagnostic;
  state.exam.submissionStatus = "blocked";
  ```

  During the resulting cooldown, editing and checks remain available; only resubmission is blocked.

  Keep the existing prototype-only `Advance cooldown` action. It subtracts the cooldown from `remainingSeconds`, clears cooldown, and announces that the Match clock kept running.

- [ ] **Step 6: Wire Hint and Submission behavior**

  Keep the existing native Hint dialog and teammate-confirmation wording. A confirmed prototype Hint increments `hintsUsed` and adds 30 seconds to `finishDelay`; it never auto-passes a check.

  `Submit Stage 01` must first require `canAttemptSubmit(state)` (locked `solution.c`, zero cooldown, Stage 01) and then call `canSubmit(state)` as the pass predicate inside the handler. An attempt that fails the pass predicate is an explicit incorrect Submission: it produces the Failure trace and 15-second Retry cooldown above. On success:

  ```js
  state.stage = 2;
  state.trace = null;
  state.exam.submissionStatus = "accepted";
  state.exam.stageTwoNotice = true;
  state.exam.swap = { status: "idle", requestedBy: null };
  ```

  Show `STAGE 01 PASSED` and `STAGE 02 UNLOCKED · NOT IMPLEMENTED IN THIS PROTOTYPE`. Do not render fabricated Stage 02 subject content.

- [ ] **Step 7: Implement optional between-Stage Role swap**

  The intermission supports:

  - `request-swap`: records the requesting assigned player and shows `WAITING FOR TEAMMATE CONFIRMATION`.
  - `confirm-swap`: swaps the two values in `exam.assignments`, resets the swap state to `confirmed`, and announces the new assignments.
  - `keep-roles`: leaves assignments unchanged and records that the Team continued without swapping.

  Do not allow swapping during active Stage 01. Explain beside the control that the production rule is still under Team review.

- [ ] **Step 8: Make focus transitions deliberate**

  After a check, focus the evaluator result heading. After failure, focus the Failure trace heading. After accepted Submission, focus the Stage 02/intermission heading. Use `tabindex="-1"` only on those programmatic destinations. Keep the Match clock out of the live region so it is not announced continuously.

- [ ] **Step 9: Run the full workflow check**

  Run the Task 1 command. Expected output should report the two Role permissions, failed-check/cooldown path, four-pass path, gated Submission, Stage unlock, confirmed Role swap, Variant B/C regression, both viewports, and zero errors.

- [ ] **Step 10: Commit the interaction loop**

  ```bash
  git add prototype/game-ui/04-live-match.html
  git commit -m "prototype: simulate exam shell evaluation"
  ```

## Task 4: Verify Responsive, Accessible, and Regression Behavior

**Files:**

- Modify: `prototype/game-ui/04-live-match.html` only if checks reveal a defect
- Modify: `prototype/game-ui/checks/exam-shell-check.js`
- Read/Test: `/private/tmp/campus-critical-journey-check.js`
- Read/Test: `/private/tmp/campus-game-ui-check.js`

- [ ] **Step 1: Add screenshots and state-hook checks**

  Save these artifacts from the exam-shell check:

  ```text
  /private/tmp/campus-exam-shell-screenshots/exam-shell-writer-desktop.png
  /private/tmp/campus-exam-shell-screenshots/exam-shell-tester-desktop.png
  /private/tmp/campus-exam-shell-screenshots/exam-shell-failure-desktop.png
  /private/tmp/campus-exam-shell-screenshots/exam-shell-passed-desktop.png
  /private/tmp/campus-exam-shell-screenshots/exam-shell-writer-mobile.png
  /private/tmp/campus-exam-shell-screenshots/exam-shell-tester-mobile.png
  ```

  Assert `window.__MATCH_STATE__()` returns a clone: mutating the returned object must not mutate a second read.

- [ ] **Step 2: Inspect screenshots at full resolution**

  Check that:

  - Subject metadata and flow are scannable.
  - The editor remains the visual center on desktop and readable on mobile.
  - Code Writer and Test Operator permissions are obvious without reading long prose.
  - The fake-grader label is visible before interaction.
  - Failure, cooldown, pass, lock, and disabled states remain understandable without relying on color.
  - The switcher does not cover the header, and the bottom evaluator does not create document overflow.

- [ ] **Step 3: Run the critical-journey regression check**

  First update only stale expected text in the disposable local checks if they still expect `Operations Console` or `What value leaves the loop?`; do not weaken behavioral assertions.

  ```bash
  NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    /private/tmp/campus-critical-journey-check.js
  ```

  Then run the updated Active Match regression:

  ```bash
  NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    /private/tmp/campus-game-ui-check.js
  ```

  Expected: selected Active Match Variant A is now `Exam shell`; B/C, Team chat, Hint cost, cooldown timing, Journey route, responsive bounds, keyboard guard, and error capture continue to pass.

- [ ] **Step 4: Run a static security-boundary scan**

  ```bash
  rg -n "eval\(|new Function|fetch\(|Worker\(|WebSocket\(|localStorage|sessionStorage" \
    prototype/game-ui/04-live-match.html
  ```

  Expected: no matches. If a harmless copy string contains one of these tokens, inspect it manually; do not add an execution primitive to make the check pass.

- [ ] **Step 5: Re-run all three browser checks after any visual fix**

  Do not declare the screen complete from screenshots alone. All workflow, regression, viewport, focus, target-size, and error assertions must still pass after the last CSS or copy change.

## Task 5: Record Honest Prototype Evidence and Close the Plan

**Files:**

- Modify: `prototype/game-ui/42-subject-compliance.md`
- Read: `ft_transcendence.pdf`
- Read: `.scratch/campus-puzzle-race/spec.md`
- Read: `docs/42-exam-game-direction-research.md`
- Test: `prototype/game-ui/checks/exam-shell-check.js`

- [ ] **Step 1: Recheck authoritative 42 subject boundaries**

  Confirm the changed prototype still supports, without claiming to implement:

  - a clear responsive and accessible frontend direction;
  - a complete web-game design with clear rules, progress, and outcomes;
  - three-or-more-player and remote-player plans that still require real synchronized clients;
  - no claim that terminal appearance, editable code, or simulated checks earn module points.

- [ ] **Step 2: Update the compliance matrix**

  Change the validated Active Match decision to `Variant A, Exam shell`. Add a concise `Exam Shell prototype evidence` subsection recording only what the browser check proves:

  - original `loop_checksum` subject format;
  - native editable C surface for the Code Writer;
  - read-only Test Operator view;
  - deterministic simulated checks and explicit fake-grader label;
  - stale-result invalidation, two Role locks, Submission gate, Failure trace, 15-second cooldown, Hint delay, Stage unlock notice, and optional between-Stage swap experiment;
  - desktop/mobile, keyboard, target-size, overflow, and browser-error results.

  Immediately follow it with explicit non-evidence:

  - no compiler, sandbox, arbitrary-code execution, backend, database, authorization, persistence, WebSocket synchronization, concurrent-player enforcement, or secure server grader;
  - Role swapping differs from the currently approved fixed-Role production spec and remains a prototype hypothesis pending Team approval;
  - Stage 02/03 code subjects are not implemented;
  - no module status changes from `Designed` to complete.

- [ ] **Step 3: Run placeholder and scope scans**

  ```bash
  rg -n "TODO|TBD|placeholder|official replica|pixel-perfect|production-ready|secure grader" \
    prototype/game-ui/04-live-match.html \
    prototype/game-ui/42-subject-compliance.md
  ```

  Expected: the intentional `TODO` inside starter code is acceptable and explained by the subject; no unfinished product copy or inflated claim remains.

- [ ] **Step 4: Run final verification**

  ```bash
  NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    prototype/game-ui/checks/exam-shell-check.js
  ```

  Re-run both regression commands from Task 4. Record their exact passing summaries in the compliance matrix verification record; do not record a check that was not actually run.

- [ ] **Step 5: Review the final diff**

  ```bash
  git diff --check
  git diff -- prototype/game-ui/04-live-match.html prototype/game-ui/42-subject-compliance.md
  ```

  Confirm the diff changes only the selected Variant A, shared helpers needed by A, truthful selected-direction metadata, and the compliance record. Confirm B/C markup and behavior are otherwise preserved.

- [ ] **Step 6: Commit verified prototype evidence**

  ```bash
  git add prototype/game-ui/04-live-match.html prototype/game-ui/42-subject-compliance.md
  git commit -m "prototype: verify exam shell direction"
  ```

  If earlier task commits were intentionally skipped because the working tree is shared or dirty, make one scoped final commit instead. Never stage unrelated user changes.

## Final Acceptance Checklist

- [ ] Variant A is visibly and textually an Exam Shell simulation, not an official 42 product.
- [ ] The subject is original, complete, and readable.
- [ ] Code Writer can edit and lock `solution.c`; Test Operator cannot edit it.
- [ ] Editing invalidates locks, prior checks, report readiness, and Submission readiness.
- [ ] The evaluator visibly says it is simulated and uses no code-execution primitive.
- [ ] All four checks must pass and both Role contributions must lock before Submission.
- [ ] Failure produces a safe trace and 15-second cooldown while editing/chat remain available.
- [ ] Hint confirmation adds 30 seconds of Finish delay.
- [ ] Success unlocks only a Stage 02 notice; it does not invent unimplemented content.
- [ ] Optional Role swap requires request plus teammate confirmation and is labelled as under Team review.
- [ ] B/C remain usable historical alternatives.
- [ ] Desktop/mobile, keyboard, focus, target-size, overflow, state-clone, and console checks pass.
- [ ] Compliance text distinguishes prototype evidence from production/module evidence.

