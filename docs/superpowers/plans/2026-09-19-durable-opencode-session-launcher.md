# Durable OpenCode Coding-Session Launcher Implementation Plan

## Goal

Upgrade the launcher from a prompt forwarder into a lightweight session manager:

- Permit one active coding run at a time in the shared worktree.
- Support three guarded modes: **Build**, **Fix**, and **Review**.
- Give every run a stable ID and isolated review package.
- Start follow-ups as fresh OpenCode sessions with the previous compact handoff injected.
- Keep the user-triggered `finished` message; do not add background Codex monitoring or token consumption.
- Preserve OpenCode Desktop as the default, Muse Spark 1.3 Contributor Free with `xhigh`, and terminal mode as a fallback.

## Public Interface

Extend `Run plan in OpenCode.command` with:

```text
Run plan in OpenCode.command plan.md
Run plan in OpenCode.command --mode build --text "..."
Run plan in OpenCode.command --mode fix --from RUN_ID --text "..."
Run plan in OpenCode.command --mode review --from RUN_ID
Run plan in OpenCode.command --terminal ...
Run plan in OpenCode.command --status
Run plan in OpenCode.command --close-stale RUN_ID
```

Double-clicking opens a chooser with:

1. Build from Markdown plan
2. Fix a completed run
3. Review a completed run
4. Use clipboard text

`--close-stale` only releases a run marked active after an interrupted Desktop session. It must never revert or delete code.

## Run Records and Locking

Create one directory per run:

```text
.scratch/opencode-runs/<timestamp>-<short-id>/
├── request.md
├── metadata.json
├── baseline.txt
├── handoff.md
├── result.json
└── final-state.txt
```

- Add only `.scratch/opencode-runs/` to `.gitignore`; preserve existing `.scratch` documents.
- `metadata.json` records schema version, run ID, mode, timestamps, source plan, requested model/variant, repository path, HEAD, and prior run ID.
- `baseline.txt` records pre-run Git status and hashes for already modified or untracked files so Codex can distinguish OpenCode work from pre-existing changes.
- Use an atomic active-run lock. Reject a second launch with the active run ID and recovery instructions.
- Never delete old runs automatically.

## Safer Desktop Handoff

- Save the complete generated instruction in `request.md`.
- Put only a compact instruction in the `opencode://new-session` link: repository path, run ID, mode, and relative request path.
- Ensure pasted plan contents and secret sentinels never appear in the URL or launcher output.
- Continue requiring one Enter press because the official Desktop link pre-fills but does not submit the prompt.

## Mode Contracts

- **Build:** read the selected plan and implement it completely; edits and tests are allowed; commits and staging remain prohibited.
- **Fix:** read the prior `handoff.md`, the original plan/request, and current Codex findings supplied through file, text, or clipboard; change only what resolves those findings.
- **Review:** make no repository edits; inspect the selected run against its plan and write findings to the new run's handoff.
- Every mode must preserve AGENTS.md, safety, compliance, unrelated-change, and no-commit constraints.
- Follow-ups always start a fresh OpenCode session with compact prior-run context, never the full transcript.

## Completion and Review Package

Add a small finalization helper invoked by OpenCode for every completed, blocked, or failed run. It must:

- capture final Git status and affected-file hashes;
- write structured result status;
- validate that `handoff.md` exists and contains the required sections;
- release the active-run lock;
- update backward-compatible `.scratch/opencode-handoffs/latest.md`;
- never modify, stage, commit, or revert product files.

The compact handoff retains:

- actual model/variant or `unverified`;
- changed files;
- exact tests and outcomes;
- deviations and unresolved decisions;
- risks and reviewer scope.

When the user tells Codex `finished`, Codex reads the run ID, handoff, baseline, and final state before reviewing the actual diff.

## Required Tests

Expand `scripts/check-run-opencode-plan-launcher.sh` and use test-first changes to verify:

- Build, Fix, and Review generate distinct guarded prompts.
- The Desktop URL contains no full plan, secret sentinel, spaces, or newlines.
- A large plan does not materially enlarge the deep link.
- Only one active run can exist.
- A finalized run releases the lock and permits the next run.
- A stale run blocks new work until explicitly closed.
- Fix mode includes the selected prior handoff and starts a fresh session.
- Review mode explicitly prohibits writes and commits.
- Baseline metadata distinguishes pre-existing dirty files from newly changed files.
- Missing or malformed handoffs make finalization fail without releasing the active lock or overwriting the compatibility handoff.
- Model remains Muse Spark 1.3 Contributor Free with `xhigh`, without falsely claiming the actual session selection was verified.
- File, direct text, clipboard, Desktop, terminal, dry-run, paths containing spaces, and existing safety validation continue to work.
- Launcher tests restore any pre-existing handoff and active-run state and leave the product worktree unchanged.
- `zsh -n` passes for every new or modified zsh script and `git diff --check` is clean.

## Implementation Boundaries

- Sessions remain sequential in the current shared worktree; do not create managed Git worktrees.
- Run records stay local, contain no secrets or full transcripts, and are never automatically deleted.
- The launcher manages coding workflow only; it does not broaden OpenCode authority beyond the selected plan or findings.
- Preserve the corrected Desktop-default behavior and explicit `--terminal` fallback.
- Modify only launcher infrastructure, its tests, the narrow ignore rule, and any directly required launcher documentation/helper script.
- Do not modify game prototype behavior or claim new 42-subject implementation evidence.
- Preserve all unrelated staged, tracked, and untracked changes.
- Do not stage or commit anything; leave a verified uncommitted diff for Codex review.

## Completion Handoff

Before exiting, create and finalize this run's structured review package. The handoff must name every changed launcher file, exact test commands and results, any deviation from this plan, unresolved risks, the actual model/variant if verifiable, and the precise recommended Codex review scope.
