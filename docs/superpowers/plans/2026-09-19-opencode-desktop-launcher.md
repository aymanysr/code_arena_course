# OpenCode Desktop Launcher Correction Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `Run plan in OpenCode.command` open a new session in OpenCode Desktop with the selected file, direct text, or clipboard plan prefilled, while keeping the current terminal runner as an explicit fallback.

**Architecture:** Preserve the launcher's existing validation and compact handoff prompt. The default path percent-encodes the repository directory and complete prompt into OpenCode's official `opencode://new-session` deep link, opens that URL with macOS Launch Services, and exits so implementation is watched in OpenCode Desktop. A `--terminal` option retains the current pinned CLI behavior. The Desktop deep link pre-fills but does not submit the prompt, so the launcher and README text must truthfully tell the user to press Enter once in OpenCode.

**Tech Stack:** zsh, macOS `open`, JavaScript for Automation through `osascript`, the existing OpenCode CLI fallback, and the repository's zsh behavioral check.

**Spec:** User-approved workflow: Codex writes plans and reviews; OpenCode performs code/test changes visibly through the launcher; Muse Spark 1.3 Contributor Free with `xhigh` remains the configured default.

## Global Constraints

- Read `AGENTS.md`, `Run plan in OpenCode.command`, and `scripts/check-run-opencode-plan-launcher.sh` in full before editing.
- Preserve unrelated staged, tracked, and untracked work. Do not commit, stage, reset, clean, or delete user files.
- Modify only `Run plan in OpenCode.command` and `scripts/check-run-opencode-plan-launcher.sh` unless a failing check proves another launcher-owned file is required.
- Keep all three plan inputs: Markdown file under `docs/superpowers/plans`, `--text`, and `--clipboard`.
- Keep the current fixed safety prompt, compliance reminder, no-commit rule, compact `.scratch/opencode-handoffs/latest.md` requirement, actual-model reporting, and stale-handoff clearing.
- Keep `opencode/muse-spark-1.3-contributor-free` and `xhigh` in the prompt and terminal fallback. Do not rewrite global OpenCode configuration.
- Do not use UI scripting to press Enter automatically. The official deep link pre-fills the session; the human submits it in OpenCode Desktop.
- Do not implement product/prototype behavior in this run. This is launcher infrastructure only, so it creates no new 42-subject implementation evidence.

---

### Task 1: Specify the Desktop and Terminal Launch Contracts in Tests

**Files:**
- Modify: `scripts/check-run-opencode-plan-launcher.sh`

**Interfaces:**
- Consumes: existing dry-run output, fake CLI seams, and the launcher's validated prompt.
- Produces: executable expectations for default Desktop mode and explicit `--terminal` fallback.

- [ ] **Step 1: Add failing default-mode dry-run assertions**

  Change the valid-plan dry run to require:

  ```text
  mode=desktop
  model=opencode/muse-spark-1.3-contributor-free
  variant=xhigh
  project=<absolute repository path>
  source=file:docs/superpowers/plans/2026-09-18-exam-shell-prototype.md
  deep_link=opencode://new-session?directory=<encoded>&prompt=<encoded>
  ```

  Retain the existing prompt assertions for `AGENTS.md`, no commits, compact handoff fields, actual-model verification, and the exact handoff path. Assert the raw deep link contains neither literal spaces nor literal newlines.

- [ ] **Step 2: Add a fake macOS-open behavioral seam**

  Create a temporary executable `fake-open` inside the existing temporary fake-runner directory. It writes its first argument to a temporary capture file and exits zero. Invoke:

  ```bash
  OPEN_BIN="$fake_dir/fake-open" "$launcher" "$valid_plan"
  ```

  Assert:

  - the launcher exits zero;
  - exactly one argument was captured;
  - it starts with `opencode://new-session?directory=`;
  - it contains `&prompt=`;
  - the prior handoff was removed before launch; and
  - output says `OpenCode Desktop opened` and `Press Enter once in OpenCode to start` without claiming implementation finished.

  Decode the captured `directory` and `prompt` values with the same JXA `decodeURIComponent` facility used for URL encoding. Assert the directory equals the repository root and the prompt contains the selected relative plan, requested Muse model, `xhigh`, and handoff contract.

- [ ] **Step 3: Move existing CLI lifecycle assertions behind `--terminal`**

  Keep the fake exit-zero-without-handoff, exit-seven, and exit-zero-with-handoff cases, but invoke each as:

  ```bash
  OPENCODE_BIN="$fake_runner" "$launcher" --terminal --text "Behavioral probe"
  ```

  Require `--dry-run --terminal` to report `mode=terminal`. Retain the exact exit-status and handoff-success assertions.

- [ ] **Step 4: Preserve input validation coverage**

  Keep tests for non-empty direct text, clipboard/text/file exclusivity, missing plans, and plans outside `docs/superpowers/plans`. Add an unknown-option assertion and ensure `--terminal` is accepted at most once without becoming an input mode.

- [ ] **Step 5: Run the check and prove RED**

  Run:

  ```bash
  ./scripts/check-run-opencode-plan-launcher.sh
  ```

  Expected: failure because the launcher still defaults to `opencode run --interactive` and emits no Desktop deep link.

### Task 2: Implement the OpenCode Desktop Default

**Files:**
- Modify: `Run plan in OpenCode.command`

**Interfaces:**
- Consumes: validated `handoff`, repository directory, input source, and optional `OPEN_BIN` test seam.
- Produces: a percent-encoded `opencode://new-session` URL and one Launch Services invocation.

- [ ] **Step 1: Add launch mode and usage text**

  Initialize:

  ```zsh
  launch_mode="desktop"
  open_bin="${OPEN_BIN:-/usr/bin/open}"
  ```

  Accept `--terminal` as an orthogonal option that sets `launch_mode="terminal"`. Update usage to show file, `--text`, and `--clipboard` in default Desktop mode plus the optional `--terminal` fallback. State: `Desktop opens with the prompt prefilled; press Enter once to start.`

- [ ] **Step 2: Add one UTF-8-safe encoder**

  Add this helper and use it for both query values:

  ```zsh
  urlencode() {
    /usr/bin/osascript -l JavaScript -e \
      'function run(argv) { return encodeURIComponent(argv[0]); }' -- "$1"
  }
  ```

  Treat encoder failure or empty encoded output as a launcher error. Do not interpolate unencoded repository paths or prompt text into the URL.

- [ ] **Step 3: Build the official new-session deep link**

  After the complete handoff prompt is assembled, build:

  ```zsh
  encoded_directory=$(urlencode "$repo_dir") || fail "Could not encode the repository path."
  encoded_prompt=$(urlencode "$handoff") || fail "Could not encode the OpenCode prompt."
  deep_link="opencode://new-session?directory=$encoded_directory&prompt=$encoded_prompt"
  ```

  In dry-run mode, print `mode`, model, variant, project, source, optional relative plan, raw prompt, and deep link, then exit without opening anything or clearing the current handoff.

- [ ] **Step 4: Open Desktop by default**

  For `launch_mode == desktop`:

  - require `open_bin` to be executable;
  - remove only the exact current handoff file before opening, preserving the existing clear-or-fail behavior;
  - call `"$open_bin" "$deep_link"` exactly once;
  - fail with a clear message if Launch Services rejects the URL;
  - print `OpenCode Desktop opened with the implementation prompt prefilled.`;
  - print `Press Enter once in OpenCode to start. When it finishes, return to Codex and say finished.`; and
  - exit zero without checking for the handoff, because the Desktop session is asynchronous.

  Do not print `OpenCode finished successfully` from this branch.

- [ ] **Step 5: Preserve the terminal fallback**

  For `launch_mode == terminal`, retain the current executable check, active-`opencode run` guard, pinned command:

  ```zsh
  "$opencode_bin" run --interactive --model "$model" --variant "$variant" "$handoff"
  ```

  Retain the existing synchronous exit status, missing-handoff distinction, and success/failure messages unchanged.

- [ ] **Step 6: Run the focused check and checkpoint**

  Run:

  ```bash
  ./scripts/check-run-opencode-plan-launcher.sh
  git diff --check -- 'Run plan in OpenCode.command' scripts/check-run-opencode-plan-launcher.sh
  ```

  Expected: all launcher assertions pass and the diff check emits no output. Do not stage or commit.

### Task 3: Verify the Real Desktop Handoff Without Implementing Product Code

**Files:**
- Verify: `Run plan in OpenCode.command`
- Verify: `scripts/check-run-opencode-plan-launcher.sh`

**Interfaces:**
- Consumes: the corrected launcher and this bootstrap plan.
- Produces: a review-ready launcher diff and compact OpenCode handoff.

- [ ] **Step 1: Run final static verification**

  Run:

  ```bash
  ./scripts/check-run-opencode-plan-launcher.sh
  zsh -n 'Run plan in OpenCode.command'
  git diff --check
  git status --short
  ```

  Record exact results. Confirm no product HTML, CSS, JavaScript, or product browser check changed.

- [ ] **Step 2: Check the configured model without changing it**

  Run the existing OpenCode configuration inspection command available in this environment and record whether the effective default is `opencode/muse-spark-1.3-contributor-free` with Build variant `xhigh`. If it cannot be verified, say so; do not claim success and do not rewrite global configuration.

- [ ] **Step 3: Write the required compact handoff**

  Write `.scratch/opencode-handoffs/latest.md` with Status, input plan, actual model/variant if verifiable, changed files, exact tests/results, deviations, risks, and reviewer scope. Explicitly state that the official Desktop deep link pre-fills the prompt and still requires one Enter press.

## Completion Boundary

Stop after the launcher and its check pass. Do not run the equal-coding-role prototype plan in the same session. Codex will review this bootstrap diff first, then the user will launch `docs/superpowers/plans/2026-09-19-equal-coding-role-prototype.md` through the corrected Desktop launcher.
