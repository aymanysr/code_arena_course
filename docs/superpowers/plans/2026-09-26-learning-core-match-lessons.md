# Core Match Learning Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the complete ordinary player path from Lobby and Problem setup through Run, Submission, Reveal, and Match completion.

**Architecture:** Add short authored lesson templates after the catalog/change-tracking foundation is accepted. Each lesson follows one player-visible behavior, cites current source and tests, and adds exact file/range references to the catalog. The existing Submit lesson remains the entry point.

**Tech Stack:** HTML/CSS lesson templates, generated offline HTML, existing MJS course builder, `node:test`, existing Arena Game Vitest suites.

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

- A verdict completed inside the grace window can count, while one after cutoff is recorded but not counted; verify both named cases in `scoring-reveal.test.ts` (Task 1).
- A published Reveal is an immutable snapshot; verify mutation and republish behavior in `scoring-reveal.test.ts` (Task 1).
- A failed resubmission can preserve the previous counted result; verify `3. failed resubmit preserves previous counted result` in `submit-path.test.ts` (Task 2).
- Run sees visible examples only and does not change score; Submission evaluates the sealed Hidden suite; verify `judge receives visible tests only, never hidden material` in `run-path.test.ts` and the reveal boundary in `sealing.test.ts` (Task 4).
- Lobby behavior can differ from intended design; compare `host start gate blocks until sides are full and all players ready` and related cases in `lobby.test.ts` with documented intent before teaching any discrepancy (Task 3).

---

## Tasks

### Task 1: Add the Reveal cutoff lesson

**Files:**
- Create: `.tours/learning/templates/0002-reveal-cutoff.template.html`
- Generate: `.tours/learning/lessons/0002-reveal-cutoff.html`
- Modify: `.tours/learning/coverage-map.json`
- Test: `.tours/learning/scripts/build-catalog.test.mjs`
- Source evidence: `packages/arena-game/src/engine.ts`, `packages/arena-game/src/round-lifecycle.ts`, `packages/arena-game/test/scoring-reveal.test.ts`

- [x] **Step 1: Add a failing template-render test** for a lesson whose local source links open the source preview at the requested file and line.
- [x] **Step 2: Run `node --test .tours/learning/scripts/build-catalog.test.mjs`.** Expected: FAIL because Lesson 2 is not in the catalog.
- [x] **Step 3: Read `ArenaEngine.publishReveal`, `RoundLifecycle.beginReveal/prepareReveal/createReveal/commitReveal`, and the four in-flight policy tests** before writing the explanation. Explain the grace window and cutoff as separate moments.
- [x] **Step 4: Write the Lesson 2 template** with one prediction about an in-flight Judge result, a short source trace, a test comparison, and a teach-back prompt. Include a hint that distinguishes “closing” from “published.”
- [x] **Step 5: Add exact line anchors and lesson metadata** for each cited source and test file. Resolve source freshness through the single frozen source snapshot; do not duplicate per-reference hashes in the catalog.
- [x] **Step 6: Generate the page and run the catalog tests and `--check`.** Expected: the lesson renders, all anchors resolve, and its freshness is current only when pinned source matches.

### Task 2: Teach Round scoring, advancement, and Match completion

**Files:**
- Create: `.tours/learning/templates/0003-rounds-and-final-score.template.html`
- Generate: `.tours/learning/lessons/0003-rounds-and-final-score.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `packages/arena-game/src/records.ts`, `packages/arena-game/src/round-lifecycle.ts`, `packages/arena-model/src/scoring.ts`, `packages/arena-model/src/transitions.ts`, `packages/arena-game/test/round-lifecycle.test.ts`, `packages/arena-game/test/scoring-reveal.test.ts`, `packages/arena-game/test/lifecycle-1v1.test.ts`

- [x] **Step 1: Read the Round/Match types, scoring and transition functions, and tests** for score sum, tie-break, draw, reset, and final completion.
- [x] **Step 2: Write the Lesson 3 template** around one question: what resets between Rounds and what score carries across the Match? Keep scoring arithmetic and final tie-breaks in distinct trace steps.
- [x] **Step 3: Add exact source/test anchors and lesson metadata** to the catalog.
- [x] **Step 4: Generate Lesson 3 and run course tests plus `--check`.** Expected: page and anchors are current; no claim extends beyond the cited cases.

### Task 3: Teach Lobby entry and Match start

**Files:**
- Create: `.tours/learning/templates/0004-lobby-to-match.template.html`
- Generate: `.tours/learning/lessons/0004-lobby-to-match.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `frontend/src/components/LobbyPage.tsx`, `frontend/src/arena/lobby.ts`, `packages/arena-game/src/lobby.ts`, `services/game/src/game/lobby.controller.ts`, `services/game/src/game/lobby.gateway.ts`, `services/game/src/game/lobby.test.ts`, `packages/arena-game/test/lobby.test.ts`, `frontend/e2e/live-lobby.spec.ts`

- [x] **Step 1: Trace one current lobby path** from the UI request to authoritative membership/readiness and Match creation. Include public queue only where the cited tests prove it.
- [x] **Step 2: Write the lesson** to distinguish Lobby state from Match state, using a prediction about who can start and what a joining player can observe.
- [x] **Step 3: Add source/test references and generate the page.** Label any spec disagreement as a reference-course choice, not a code change.
- [x] **Step 4: Run course tests, `--check`, and the relevant lobby unit tests when the required environment is available.** Report database-gated tests as skipped if they do not run.

### Task 4: Teach the Problem, editor, and Run path

**Files:**
- Create: `.tours/learning/templates/0005-problem-editor-run.template.html`
- Generate: `.tours/learning/lessons/0005-problem-editor-run.html`
- Modify: `.tours/learning/coverage-map.json`
- Source evidence: `packages/problem-bank/schema.json`, `packages/problem-bank/problems/even-ledger.json`, `packages/problem-bank/problems/double-it.json`, `packages/arena-game/src/file-bank.ts`, `frontend/src/components/ProblemPanel.tsx`, `frontend/src/components/CodeWorkspace.tsx`, `frontend/src/components/EditorAdapter.tsx`, `frontend/src/components/EditorToolbar.tsx`, `packages/arena-game/test/run-path.test.ts`, `packages/arena-game/test/compiled-bank.test.ts`

- [x] **Step 1: Read the checked problem format and trace how a Problem and starter code reach the editor.** Separate the current data from the frozen UI prototype.
- [x] **Step 2: Read Run’s visible-test contract and write one concrete comparison** between Run and Submission.
- [x] **Step 3: Write the lesson, add exact source/test anchors, and generate its output.** Do not imply Run touches the Hidden suite or changes a score.
- [x] **Step 4: Run course tests, `--check`, and the relevant Run/problem-bank tests.** Report any unavailable integration environment.

### Task 5: Verify the core lesson batch

**Files:**
- Modify: `.tours/learning/README.md`
- Modify: `.tours/learning/coverage-map.json`
- Review: `.tours/learning/source-map.html`

- [x] **Step 1: Confirm navigation order** is Lesson 1 → Reveal cutoff → score/next Round → Lobby → Problem/editor/Run, with any prerequisite label needed for a beginner.
- [x] **Step 2: Check each file disposition** in the core path; leave files for later batches explicitly uncovered rather than adding false lesson links.
- [x] **Step 3: Run `node --test .tours/learning/scripts/*.test.mjs` and `node .tours/learning/scripts/build-catalog.mjs --check`.** Expected: all generated pages current and only genuinely unfinished files remain open.
- [x] **Step 4: Review `prototype/game-ui/42-subject-compliance.md`.** Update it only if this batch changes requirement evidence, assumptions, scope, or compliance status; do not promote any module row.

Core batch verification: Lesson navigation is ordered and links through Lesson 5; README provides the same order. The first five lessons account for 40 distinct current source files; `package-lock.json` remains the only explicitly support-only file; the other 137 scoped files remain uncovered for the approved later batches. Generated pages report zero stale references and zero invalid anchors. Course tests pass 27/27; root lint, focused test suites recorded per lesson, and `git diff --check` pass. `--check` exits 1 only for the 137 expected uncovered files; source snapshot, CodeTours, and checksum baseline have no drift. The 42-subject matrix was reviewed and left unchanged because this batch changes no game behavior, evidence, scope, or module claim.
