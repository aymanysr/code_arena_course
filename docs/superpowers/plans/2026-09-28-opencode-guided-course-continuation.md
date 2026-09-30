# Continue the guided Code Arena learning course in OpenCode

This handoff supplements the approved implementation plan:
`docs/superpowers/plans/2026-09-28-guided-code-arena-build-course.md`

The approved design is:
`docs/superpowers/specs/2026-09-28-guided-code-arena-build-course-design.md`

## User's current direction

Continue the course work in OpenCode, from the current implementation. The learner now wants the remaining course authored without waiting to try the first 11 lessons first. This updates the earlier stop-before-mass-authoring instruction. Record that the foundation walkthrough is still **pending**. Do not say the learner completed a lesson, understood a concept, or verified target code until they report that result. Keep working through the remaining plan while that evidence is pending.

The goal is a useful, complete 68-lesson learning path that guides a programmer comfortable with C, but new to TypeScript and web development, to build their own Code Arena implementation. The course must explain what to do, why now, what it depends on, the exact files and folders, how to check each step, and how to recover from common errors. The learner writes the game code; the course does not give them the finished game to copy.

## Start here

1. Read `AGENTS.md`, `CONTEXT.md`, the approved design, and the original implementation plan in full.
2. Read the task ledger at `.superpowers/sdd/2026-09-28-guided-code-arena-build-course/progress.md`.
3. Inspect the current branch, `git status`, recent commits, current M00–M02 lessons, generated pages, course evidence, and `prototype/game-ui/42-subject-compliance.md`.
4. Treat commit `2c63ae0` and the current checkout as the starting point. The first 11 lessons are authored. The next 57 are not. Some course checks already exist; rerun them when needed.
5. An untracked root `node_modules` symlink is a shared dependency link. Do not stage, replace, remove, or install through it. Do not touch unrelated files.

## Work to complete

Continue the remaining tasks in the approved plan in order (finish Task 7 authoring/review records, then Tasks 8–14). Use its lesson tables, file roles, checks, dependencies, quality rules, and stop conditions as the detailed requirements. Do not replace that plan with a shorter invented syllabus.

- Author all remaining M03–M13 lesson content and complete the learning path. Make every ready lesson clear and usable; do not leave placeholder content marked ready.
- Keep the order: state and rules; Problem and visible Run; Submit, evaluation, score and Reveal; HTTP and browser screen; persistence and recovery; isolated Judge execution; invitation Lobby and live play; 2v2 collaboration; team chat; destination mapping and integration. Explain each dependency in easy English.
- For every coding step, give the learner one small change at a time, exact relative path and action, owner/purpose, required prerequisite check IDs, command and working directory, expected result, four escalating clues, and useful recovery guidance. The course may show small examples, but must not ship the complete game solution.
- Teach reference-game patterns and contracts without pretending the learner's project has identical folders. Clearly label reference paths, practice paths, and future team paths. A missing teammate repository must not block practice content. Never invent target mappings or claim target checks ran.
- Verify each behavior against the real reference source and tests before describing it. Keep Mock Judge examples separate from real Judge checks. Respect `CONTEXT.md` vocabulary and `ft_transcendence.pdf`. Keep reference, author rehearsal, learner report, and target evidence separate.
- Complete the file dispositions and behavior coverage audit in Task 14. Resolve stale source references through reviewed edits; never refresh hashes just to hide drift. Update the compliance matrix whenever evidence, scope, module claims, assumptions, or status changes.
- Update the course README, mission, notes, resources, maintenance guide, evidence, and generated pages as required by the approved plan.
- Keep the course local and offline. Do not publish, message others, stage, commit, push, deploy, or edit the original checkout. Leave a reviewable uncommitted diff for the learner.

## Verification

Run the checks required by each task and by `AGENTS.md`. At minimum, finish with the course generator and drift check, all `.tours/learning/scripts/*.test.mjs` tests, root `npm run lint`, `git diff --check`, and feasible root typecheck/build/test checks. Report exact failures and environment limits. Do not say all checks pass if any fail or are skipped.

Use a browser to inspect the course from the home page through representative late lessons, at desktop and narrow widths, in dusk and light themes. Check every ready lesson link, the workspace mapping flow, saved progress behavior, and offline reading. Keep test output and screenshot claims factual.

## Completion report

Before stopping, leave a concise handoff in the OpenCode run folder as requested by the launcher. State how many lessons are fully authored, how many are still planned (target: zero planned), the walkthrough status (pending), destination repository status (not supplied unless one appears), exact checks and failures, changed files, and any decisions or blockers. Never report learner or target completion without direct evidence.
