# Exam Shell Review Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the current Exam Shell review findings without undoing the domain-correct, penalty-free check workflow, then leave a fully verified uncommitted diff for human review.

**Architecture:** Keep Variant A's current local in-memory state model and deterministic fake grader. Reconcile the original implementation plan with the authoritative domain rule that exploring controls is not a Submission, make two targeted copy/state fixes, retain the repo-local browser regression script while writing generated screenshots only to `/private/tmp`, and let the visible OpenCode launcher accept either a Markdown plan file or inline plan text while announcing completion clearly.

**Tech Stack:** Semantic HTML, scoped CSS, vanilla JavaScript, zsh, Playwright with the workspace-provided Chromium runtime.

**Spec:** `CONTEXT.md`, `docs/agents/domain.md`, `docs/superpowers/plans/2026-09-18-exam-shell-prototype.md`, and the review findings summarized in this plan.

## Global Constraints

- Read `AGENTS.md`, `CONTEXT.md`, `docs/agents/domain.md`, `ft_transcendence.pdf`, the original Exam Shell plan, and `prototype/game-ui/42-subject-compliance.md` before editing.
- Preserve every unrelated tracked and untracked user change.
- Do not compile or execute editor contents and do not add `eval`, `Function`, Web Workers, child processes, `fetch`, storage, third-party editors, or a backend.
- Keep Variant A's domain-correct rule: running simulated checks is exploration and never creates a Failure trace or Retry cooldown; only an explicit incorrect Submission may do so.
- Keep the explicit Submission attempt available after `solution.c` is locked and cooldown is zero. A Stage pass still requires four passed checks and a locked test report.
- Preserve historical Variant B/C layout and interactions except for making their legacy immediate Hint acceptance copy truthful.
- Keep `prototype/game-ui/checks/exam-shell-check.js` as an explicitly accepted repo-local regression check. Generated screenshots belong in `/private/tmp/campus-exam-shell-screenshots`, not the repository.
- Do not make git commits. Leave the verified working tree for human review.
- After the change, update `prototype/game-ui/42-subject-compliance.md` with exact, honest results only. Planned or simulated behavior is never production evidence.

---

### Task 1: Reconcile the Approved Plan with the Domain Model

**Files:**
- Modify: `docs/superpowers/plans/2026-09-18-exam-shell-prototype.md`
- Read: `CONTEXT.md`
- Read: `docs/agents/domain.md`

**Interfaces:**
- Consumes: the domain definition that exploring controls is not a Submission and penalties follow an incorrect Submission.
- Produces: one internally consistent implementation plan that describes the already-approved interaction rule.

- [ ] **Step 1: Correct the locked Submission decision**

Replace the old claim that the Submit control is available only after every success gate with this exact rule:

```text
Submit Stage 01 becomes attemptable once solution.c is locked and Retry cooldown is zero. A Submission passes only when all four simulated checks pass and the Test Operator has locked the test report; otherwise the explicit Submission fails with a simulated Failure trace and a 15-second Retry cooldown.
```

- [ ] **Step 2: Correct the workflow sequence**

Update Task 3's workflow assertions so a failed simulated check produces diagnostics only, the explicit unready Submission produces the trace/cooldown, editing and checks remain available during cooldown, and only resubmission is blocked.

- [ ] **Step 3: Correct the action requirements**

Remove the zero-cooldown requirement from `run-selected-check` and `run-all-checks`. Replace the old “failed simulated run” state transition with the explicit incorrect-Submission transition. Keep `canSubmit(state)` as the pass predicate and document `canAttemptSubmit(state)` as the UI attempt predicate.

- [ ] **Step 4: Accept the durable regression check and temporary screenshots**

Update file references from `/private/tmp/campus-exam-shell-check.js` to `prototype/game-ui/checks/exam-shell-check.js`. Keep the six screenshot filenames, but place them under `/private/tmp/campus-exam-shell-screenshots/`. Do not change the two legacy `/private/tmp` regression-check paths.

- [ ] **Step 5: Scan the plan for contradictions**

Run:

```bash
rg -n "failed simulated run|failed check|zero cooldown|becomes available only|campus-exam-shell-check|screenshots" docs/superpowers/plans/2026-09-18-exam-shell-prototype.md
```

Expected: every remaining match agrees with the corrected rule and paths.

### Task 2: Pin and Fix the Remaining Exam Shell Behavior

**Files:**
- Modify: `prototype/game-ui/checks/exam-shell-check.js`
- Modify: `prototype/game-ui/04-live-match.html`
- Remove generated artifacts: `prototype/game-ui/checks/screenshots/*.png`

**Interfaces:**
- Consumes: `store.update(mutator, eventText)`, `exam.assignments`, `chargeHint(state)`, and the existing Playwright helpers.
- Produces: truthful post-swap announcements, truthful legacy Hint copy, and repository-clean screenshot generation.

- [ ] **Step 1: Add a failing Role-swap announcement assertion**

After the existing confirmed-swap station assertion, read `window.__MATCH_STATE__().lastEvent` and assert it reports the new owners:

```js
const swapEvent = await page.evaluate(() => window.__MATCH_STATE__().lastEvent);
assert(
  /Aimane now operates tests; Saad now writes code/.test(swapEvent),
  `workflow: swap announcement must name the new assignments: ${swapEvent}`
);
```

- [ ] **Step 2: Add a failing historical-Hint copy assertion**

Open Variant B, activate its Hint button, and assert that the dialog describes immediate legacy acceptance rather than promising a future teammate confirmation. Close the dialog without accepting it so this assertion does not alter later state.

```js
await page.goto(`${FILE}?variant=B`);
await page.getByRole("button", { name: /hint/i }).click();
const hintCopy = (await page.locator("#hint-how").textContent()) || "";
assert(/legacy simulation/i.test(hintCopy) && /immediately/i.test(hintCopy),
  `variant B: legacy immediate Hint behavior must be explicit: ${hintCopy}`);
await page.getByRole("button", { name: /cancel/i }).click();
```

- [ ] **Step 3: Run the focused check and prove RED**

Run the exam-shell check with the workspace Node and Playwright runtime. Expected: the new swap-announcement and legacy-Hint-copy assertions fail before implementation.

- [ ] **Step 4: Fix the swap announcement without reading stale state**

Build the new assignment message inside the swap mutator and assign `next.lastEvent` there, or compute the new values before `store.update`. Do not interpolate `store.getState()` into the `eventText` argument that is evaluated before the mutation.

- [ ] **Step 5: Make Variant B/C Hint behavior honest**

For historical B/C only, use copy equivalent to:

```text
Legacy simulation: accepting this immediately records a confirmed Hint and adds 30 seconds to the finish delay.
```

After acceptance, announce that the legacy Hint was accepted immediately. Do not say it is still waiting for Saad or another teammate. Do not change Variant A's two-person request/confirmation workflow.

- [ ] **Step 6: Move generated screenshots out of the repository**

In the check, import `fs`, set:

```js
const SHOT_DIR = "/private/tmp/campus-exam-shell-screenshots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
```

Delete only the six generated PNGs currently under `prototype/game-ui/checks/screenshots/`. Do not delete the check script or unrelated files.

- [ ] **Step 7: Re-run the focused check**

Expected: the exam-shell check passes, reports its exact assertion count, and writes all six screenshots to `/private/tmp/campus-exam-shell-screenshots/`.

### Task 3: Accept File or Text Plans and Give the Visible Launcher a Clear Finish Signal

**Files:**
- Modify: `Run plan in OpenCode.command`
- Modify: `scripts/check-run-opencode-plan-launcher.sh`

**Interfaces:**
- Consumes: the existing validated plan path, Muse Spark model, repository path, and handoff prompt.
- Produces: the same visible OpenCode session launched from a validated Markdown file, direct text, or clipboard text, plus an unambiguous success/failure message when OpenCode exits.

- [ ] **Step 1: Extend the launcher check first**

Keep all existing dry-run assertions. Add a direct-text dry run:

```bash
text_output=$("$launcher" --dry-run --text "Change only the Role-swap announcement and run its focused check.")
[[ "$text_output" == *"source=inline-text"* ]] || fail "direct text must identify its source"
[[ "$text_output" == *"Change only the Role-swap announcement"* ]] || fail "direct text must reach the OpenCode handoff"
```

Add rejection checks for empty `--text`, combining `--text` with a file path, and combining `--clipboard` with either other input mode. Also add static assertions that the launcher contains both completion labels:

```text
OpenCode finished successfully
OpenCode exited with status
```

- [ ] **Step 2: Run the launcher check and prove RED**

Run:

```bash
./scripts/check-run-opencode-plan-launcher.sh
```

Expected: failure because text-plan input and the completion labels do not exist yet.

- [ ] **Step 3: Add mutually exclusive plan-input modes**

Support these commands while preserving the existing file workflow:

```bash
./Run\ plan\ in\ OpenCode.command docs/superpowers/plans/example.md
./Run\ plan\ in\ OpenCode.command --text "The complete implementation plan text"
./Run\ plan\ in\ OpenCode.command --clipboard
```

Requirements:

- `--text` consumes exactly the following argument and rejects empty or whitespace-only content.
- `--clipboard` reads multiline text from `pbpaste` and rejects an empty or whitespace-only clipboard.
- A Markdown file path, `--text`, and `--clipboard` are mutually exclusive.
- File plans retain the existing restriction to `docs/superpowers/plans/*.md`.
- Inline and clipboard text are sent in the OpenCode `--prompt` argument and are never written to a repository or temporary plan file.
- `--dry-run` works with both file plans and `--text`. It prints `source=file:<relative-path>` or `source=inline-text`, plus the model, project, and resulting prompt.
- `usage` documents all three modes.

Build the inline handoff as:

```text
Read AGENTS.md in full, then execute the implementation plan pasted below completely in this repository.

--- BEGIN IMPLEMENTATION PLAN ---
<exact supplied text>
--- END IMPLEMENTATION PLAN ---

Preserve all unrelated existing and untracked user changes. Do not make git commits; leave the verified diff for human review. Follow the plan's safety and compliance boundaries, run every feasible verification check, and update prototype/game-ui/42-subject-compliance.md whenever AGENTS.md requires it. Stop and ask the user before any new product decision, sensitive permission, destructive action, or scope expansion. Do not stop after summarizing the plan. Finish with changed files, exact test results, remaining risks, and decisions still needed.
```

- [ ] **Step 4: Add a double-click choice for multiline text**

When launched with no arguments, use AppleScript to offer exactly two choices:

```text
Choose Markdown plan
Use implementation plan from clipboard
```

The first choice keeps the existing file picker. The second reads the current clipboard with `pbpaste`, which allows the user to copy and send a multiline implementation plan without creating a file. Cancellation must exit with the existing clear “No plan was selected” failure.

- [ ] **Step 5: Replace `exec` with status-aware execution**

Run the same OpenCode command without `exec`, capture its exit status despite `set -e`, then print exactly one of:

```text
OpenCode finished successfully. Review the uncommitted changes in Codex.
OpenCode exited with status N. Review the terminal output before retrying.
```

Exit with OpenCode's original status. Do not change the model, plan validation, headless-session guard, project path, or handoff safety text.

- [ ] **Step 6: Re-run the launcher check**

Expected:

```text
PASS: launcher validates and builds the visible OpenCode handoff
```

### Task 4: Run Complete Verification and Record Exact Evidence

**Files:**
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Test: `prototype/game-ui/checks/exam-shell-check.js`
- Test: `/private/tmp/campus-critical-journey-check.js`
- Test: `/private/tmp/campus-game-ui-check.js`
- Read: `ft_transcendence.pdf`

**Interfaces:**
- Consumes: the corrected implementation, all three browser checks, static scans, and generated screenshots.
- Produces: an honest verification record and a final uncommitted diff.

- [ ] **Step 1: Run the exam-shell check**

Use:

```bash
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  prototype/game-ui/checks/exam-shell-check.js
```

Record the exact passing summary. If it fails, fix the implementation or test without weakening the approved behavior.

- [ ] **Step 2: Run both legacy regressions**

Run:

```bash
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /private/tmp/campus-critical-journey-check.js

NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /private/tmp/campus-game-ui-check.js
```

If a regression expects the retired `Operations Console` or old puzzle wording, update only that stale expected text in the disposable `/private/tmp` script. Do not weaken behavioral assertions.

- [ ] **Step 3: Inspect all six screenshots**

Inspect `/private/tmp/campus-exam-shell-screenshots/*.png` at full resolution. Confirm subject readability, centered editor hierarchy, obvious Role permissions, visible fake-grader labeling, non-color status meaning, no switcher collision, and no document overflow.

- [ ] **Step 4: Run static verification**

Run:

```bash
./scripts/check-run-opencode-plan-launcher.sh
rg -n "eval\(|new Function|fetch\(|Worker\(|WebSocket\(|localStorage|sessionStorage" prototype/game-ui/04-live-match.html
rg -n "TODO|TBD|placeholder|official replica|pixel-perfect|production-ready|secure grader" prototype/game-ui/04-live-match.html prototype/game-ui/42-subject-compliance.md
git diff --check
```

Expected: launcher PASS; forbidden-primitive scan has no matches; scope-scan matches are only inspected benign occurrences; `git diff --check` has no output.

- [ ] **Step 5: Update the compliance record honestly**

Replace the prior statement that legacy regression checks were not run with their exact results. Record the new exam-shell assertion count, `/private/tmp` screenshot location, corrected swap announcement, truthful B/C legacy Hint copy, and launcher result. Do not claim screenshot inspection unless it was actually performed.

- [ ] **Step 6: Review final scope**

Run:

```bash
git status --short
git diff -- docs/superpowers/plans/2026-09-18-exam-shell-prototype.md prototype/game-ui/04-live-match.html prototype/game-ui/checks/exam-shell-check.js prototype/game-ui/42-subject-compliance.md "Run plan in OpenCode.command" scripts/check-run-opencode-plan-launcher.sh
```

Confirm that no unrelated user work was changed, no generated PNG remains under `prototype/game-ui/checks/`, and no commit was created. Finish by reporting changed files, exact command results, remaining risks, and any decision still needed.
