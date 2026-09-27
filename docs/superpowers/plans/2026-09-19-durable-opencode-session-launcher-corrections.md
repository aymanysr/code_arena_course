# Durable OpenCode Session Launcher — Runtime Corrections

## Purpose

Execute `docs/superpowers/plans/2026-09-19-durable-opencode-session-launcher.md`, with this document overriding it wherever the confirmed OpenCode Desktop 1.18.31 behavior differs from the original assumptions.

## Confirmed Root Cause

- OpenCode Desktop 1.18.31 receives `opencode://new-session?directory=...&prompt=...`; `main.log` records the complete URL.
- Both the full launcher prompt and a short diagnostic prompt open a blank composer.
- No durable-run directory or completion handoff was created, so the durable-session plan never executed.
- Therefore a successful `/usr/bin/open` exit proves only URL delivery, not prompt delivery or run start.

Do not retain `prompt=` as the Desktop delivery mechanism and do not report a run as started merely because Launch Services accepted a URL.

## Required Corrected Desktop Flow

1. Persist the complete request in the run's `request.md` as required by the base plan.
2. Build a compact instruction containing only the run ID, mode, repository-relative request path, and the command OpenCode must invoke to finalize the run.
3. Copy that compact instruction to the clipboard without printing it.
4. Open `opencode://new-session?directory=<encoded repository>` with no `prompt` parameter.
5. After activating OpenCode, use a narrowly targeted macOS accessibility action to paste into OpenCode's prompt control and press Enter exactly once.
6. Verify before pressing Enter that OpenCode is the frontmost application. Never send keystrokes to another application.
7. Bound readiness polling to 10 seconds using short condition checks, not a fixed long sleep.
8. If accessibility automation is unavailable or the prompt control cannot be confirmed, do not claim the run started. Leave the compact instruction on the clipboard, print `OpenCode is ready; press Cmd+V, then Enter`, keep the run recoverable, and exit with a distinct nonzero status.
9. Add `--manual-paste` to deliberately skip accessibility automation and use the same clipboard fallback.
10. Keep `--terminal` as the fully synchronous fallback.

The launcher must never place the complete implementation plan, review findings, or secrets in a URL, process argument, terminal output, or OpenCode application log.

## Review Findings That Must Be Resolved

- Preserve immutable per-run handoffs. Do not delete `.scratch/opencode-handoffs/latest.md` at launch; update it atomically only after successful finalization.
- Resolve the OpenCode CLI through `${OPENCODE_BIN}` when supplied, otherwise `command -v opencode`, then the known user-local path only as a final compatibility fallback.
- Make `--dry-run` side-effect-free: it must not create directories, locks, requests, or handoffs.
- Replace source-text assertions with observable fake executable seams and filesystem/output assertions.
- Generate and remove a dedicated launcher-plan fixture during tests instead of depending on an unrelated game plan.
- Desktop mode must verify the effective configured default model and Build variant when feasible. If verification fails, record `unverified`; never claim Muse/xhigh merely because they were requested.
- A Desktop delivery failure must preserve the previous compatibility handoff and provide exact recovery instructions.

## Durable Session Requirements

Implement the original plan completely:

- Build, Fix, and read-only Review modes.
- Stable run IDs and `.scratch/opencode-runs/<run-id>/` packages.
- One atomic active-run lock in the shared worktree.
- Fresh follow-up sessions with compact prior-run context.
- Baseline and final Git state sufficient to distinguish pre-existing dirty files.
- A finalizer that validates the structured handoff, captures final state, writes result metadata atomically, updates the compatibility handoff only after success, and releases the lock.
- Explicit stale-run inspection and `--close-stale RUN_ID` that never reverts or deletes product files.
- No automatic pruning.

## Regression Tests

Add failing tests before implementation, then verify at minimum:

- neither a short nor a very large/sensitive request appears in the Desktop URL or launcher output;
- default automated Desktop delivery calls the fake activate/paste/submit seam once with the compact instruction;
- wrong-frontmost-app, missing accessibility permission, and missing prompt-control simulations never submit and return the documented recovery status;
- `--manual-paste` copies the compact instruction, opens the directory-only URL, and never claims start;
- a failed Desktop delivery preserves the prior compatibility handoff and active run record;
- finalization alone updates `latest.md` and releases the lock;
- all Build/Fix/Review, lock, baseline, finalizer, model-reporting, terminal, file/text/clipboard, path-with-spaces, and dry-run requirements from the base plan pass;
- tests restore clipboard-visible state where feasible, all pre-existing handoffs, and all pre-existing locks;
- `zsh -n` passes for every shell file and `git diff --check` is clean.

## Scope and Completion

- Modify launcher infrastructure, tests, the narrow ignore rule, and directly required helper documentation/scripts only.
- Do not modify game behavior or claim new 42-subject evidence.
- Preserve all unrelated staged, tracked, and untracked changes.
- Do not stage or commit.
- Before completion, use the new finalizer to create this run's structured review package and compatibility handoff.
