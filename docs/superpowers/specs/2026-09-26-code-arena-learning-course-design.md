# Code Arena complete learning course

Status: approved course design; implementation is tracked in the reviewed plans below.

## Purpose

Build a beginner-friendly course that helps the learner understand the exact Code Arena implementation in this repository and later rebuild it with behavior parity. The course must make source changes visible, use current code and tests as evidence, and avoid claiming mastery or 42-subject module completion.

The learner has asked the teacher to choose the lesson order. This design keeps lessons short and concrete, starts from player actions, and uses the project's vocabulary in `CONTEXT.md`.

## Baseline when this design was approved

The design-time source-map scan identified 178 in-scope files: 12 had current Lesson 1 references, 166 were not yet linked to a lesson, and none were stale, missing, invalid, or unclassified. Its snapshot ID was `6c5eb54f66ac725d`. Those counts describe the earlier audit, not the live course state.

The approved design called for a complete working-tree source snapshot and a separate CodeTour checksum list covering 60 direct inputs. Git `HEAD` alone is not an exact implementation reference when the tree is dirty. The live source of truth is now `.tours/learning/reference-snapshot.json` plus `.tours/learning/coverage-map.json`; generated `source-map.html` and `node .tours/learning/scripts/build-catalog.mjs --check` show current coverage and drift without duplicating volatile counts here.

## Design principles

- Teach one behavior or rule at a time. Use a short sequence: predict, trace a small path in the code, inspect the relevant test, then explain the behavior from memory.
- Start with real player actions and follow their actual UI, Arena transport, Game service, game rules, persistence, or Judge boundaries as needed.
- Use tests as evidence for the cases they exercise. A passing test does not prove untested behavior, security against every attack, or parity in a separate rewrite.
- Use `CONTEXT.md` terms consistently: Match, Round, Problem, Run, Submission, Hidden suite, Reveal, Readiness, Presence, Player status, and Match phase.
- Preserve the distinction between current implementation, test evidence, design documents, prototypes, and planned behavior.
- Never mark exposure, a correct click, or a local self-check as mastery.
- Do not change game behavior, database schema, module claims, or team sign-off as part of this learning-course work.

## Scope and completeness

The authoritative initial inventory is `.tours/learning/coverage-map.json`. Its 178 files span the frontend, Game/domain packages, services, problem bank, infrastructure, scripts, Judge isolation spike, and named root configuration/context files. Keep the existing scope and exclusions unless a later reviewed course change explicitly revises them.

Before authoring the full lesson set, classify every inventoried path as either:

1. taught by one or more lessons, with a source/test anchor and a clear reason it belongs there; or
2. supporting reference, with a short reason why it needs to be known but does not need a behavior lesson.

The final course is complete only when every in-scope file has one of these explicit dispositions, every source-like file outside scope is classified or explicitly excluded with a reason, and no lesson anchor is missing or invalid. Store supporting references and explicit scope exclusions in the catalog so the check can verify both. “Linked” means assigned and current; it does not mean every line is explained or the learner has mastered it.

The Judge isolation spike must always be labeled as an experiment, not runtime behavior. Prototype and planning material remains separate from implementation evidence. In-scope tests must be taught as evidence, not treated as implementation code.

## Curriculum shape and teaching order

Use one sequenced course with short lessons grouped into these batches. Keep the current “Follow one Submit” lesson as the entry point and preserve its useful content. Determine the exact number and titles of later lessons by mapping every inventoried file before writing them; do not force one lesson per file.

### Batch 1: Follow one Match

- Keep Lesson 1: follow a Submission from the editor to the Judge.
- Follow an Evaluation result through scoring, the closing cutoff, the immutable Reveal, and the next Round.
- Explain Round and Match state, phase transitions, cumulative scores, and final tie-breaks using focused examples and tests.
- Trace the Lobby and show how the current game creates or joins a Match.
- Trace a Problem from the checked problem bank to the editor, then distinguish Run against visible examples from Submission against the Hidden suite.

### Batch 2: Understand the boundaries

- Explain the shared `arena-model`, `ArenaEngine`/Match authority, Game service, Arena transport, and frontend responsibilities through small calls and events.
- Follow request identity, retries, evaluation claims, and concurrency only after the learner understands the normal Submission path.
- Explain the `GameJudge` seam, the current default `ContainerJudge`, optional Judge0, hidden-data sealing, and the limits of the available security evidence.
- Explain the persistence interface, Postgres implementation, schema constraints, and recovery of pending work.

### Batch 3: Follow live multiplayer behavior

- Trace socket identity, Match membership, presence, disconnect, reconnect, revisions, and stale snapshots.
- Explain 2v2 team membership, shared-document revisions, readiness invalidation, and which code is submitted.
- Explain that team chat is separate from editor and Match state, and teach its current process-local history limitation.
- Trace frontend sidecar lifetimes and the UI states that display these behaviors.

### Batch 4: Operate and rebuild the exact reference

- Cover service startup, the three backend service roles, Docker Compose, Nginx/Postgres setup, environment files, package/workspace configuration, and developer scripts.
- Explain which unit, service, Postgres, Docker, and Playwright tests provide evidence, and which checks are skipped or environment-dependent.
- Keep a final rewrite path that asks the learner to create equivalent tests in the new implementation. Tests in this repository are reference examples, not proof that the rewrite matches.

## Course artifacts and responsibilities

- `coverage-map.json` remains the authored course catalog: ordered lesson metadata, learning goal, template path, generated output path, source/test anchors, explicit supporting-file dispositions, and explicit out-of-scope exclusions with reasons.
- Lesson templates in `.tours/learning/templates/` contain teacher-written explanations, questions, hints, links, retrieval checks, and rewrite prompts. The builder must not generate instructional prose from source code.
- `.tours/learning/scripts/build-catalog.mjs` becomes data-driven: it renders every catalog lesson, the searchable source map, course navigation, freshness state, and a shared snapshot ID.
- Generated lesson pages stay under `.tours/learning/lessons/`. They remain self-contained and usable offline. Source links continue to open the local syntax-colored source preview and offer VS Code navigation.
- `README.md`, `MISSION.md`, and `NOTES.md` explain the learner's start point, scope, update workflow, and limits without duplicating lesson content.
- Existing CodeTours remain a navigation aid. Keep their direct source anchors and `.tours/reference-baseline.md` test/parity evidence connected to the new change-impact report.

Each lesson must state its learning goal, key terms, relevant source and test references, what the test demonstrates, and what it does not demonstrate. It should have a prediction question, a small trace, a retrieval check with a useful hint, and a prompt to describe what an equivalent rewrite test should assert. Typical lesson length should remain short (about 7–12 minutes); split a lesson if it begins teaching unrelated rules.

## Source-change and refresh workflow

Use a complete, saved reference manifest for the in-scope implementation inventory, including paths and content hashes. Keep enough metadata to identify the reviewed repository `HEAD`, the working-tree snapshot ID, and the date; the content manifest, not `HEAD` alone, is authoritative when the worktree is dirty.

The review command must compare the current files with the frozen manifest and the existing CodeTour reference list. It must report added, changed, and deleted files, plus all affected lesson IDs, lesson anchors, CodeTour steps, and relevant baseline/evidence records. It must also report new unclassified files, files with no lesson/support disposition, and source-like out-of-scope files with no explicit exclusion reason.

Never refresh hashes automatically. A changed file leaves affected lessons and tours marked for review, and the normal check must fail while any affected item is stale. The teacher must:

1. inspect the actual source diff and relevant tests;
2. update every affected lesson, CodeTour, and evidence/parity record;
3. rerun the relevant project checks and record skipped/environment-dependent checks honestly;
4. explicitly accept the reviewed snapshot; and
5. regenerate the source map and every lesson page from that same snapshot.

Generated pages must show the shared snapshot ID and per-lesson freshness. A source change must never appear current just because a page was regenerated. If behavior or requirement evidence changes, review `prototype/game-ui/42-subject-compliance.md` and update it in the same project change when its evidence, assumptions, scope, module claims, or status changed. Course coverage and passing tests never promote a module claim.

## Errors and verification

The normal course check must fail and explain the affected paths when it finds stale hashes, missing or invalid line anchors, uncovered/unclassified files, missing templates or outputs, or generated pages that differ from their templates. A review/refresh command must not modify baselines unless the teacher explicitly requests an accepted snapshot after review.

Test the builder with fixtures that include multiple lessons, shared source files, changed/added/deleted source files, broken anchors, support-only files, and generated-output drift. Verify that a source change lists every linked lesson and CodeTour step, and that refreshing one file does not mark unrelated stale files current.

Before each lesson batch is complete, run the learning-script tests and generated-page check, validate source links, inspect the 42-subject matrix, and run relevant game tests when their environment is available. Report Docker, Postgres, and Playwright skips as skips. Do not change game tests or runtime code to make the course pass.

## Non-goals

- A lesson for every file regardless of teaching value.
- An automated system that writes or silently updates lesson explanations.
- A promise that an inventory check proves semantic completeness, learner mastery, production security, or module compliance.
- Changes to the game, its MatchRecord JSONB schema, team-chat persistence, or the 42-subject module status.
- A presentation diagram or an unbounded repository graph.

## Delivery decomposition

Implement the course in separately verifiable stages:

1. **Catalog and change tracking:** multi-lesson generation, complete file dispositions, source manifest, CodeTour impact reporting, and tests for stale/change handling.
2. **Core Match lessons:** finish the player journey from Lobby/problem/Run/Submission through Judge result, Reveal, and match completion.
3. **Backend reliability lessons:** service boundaries, evaluation retries, Judge security, persistence, Postgres, and recovery.
4. **Live multiplayer lessons:** transport, socket authorization, presence/reconnect, 2v2 collaboration/readiness, chat, and frontend lifetimes.
5. **Project/rewrite lessons and final audit:** app/runtime/configuration, test evidence, behavior-parity gates, and explicit disposition of every inventoried file.

Do not report the course as complete until stage 5 passes the completeness checks and every generated lesson is checked against the current frozen reference.

## Relevant requirements

The authoritative requirements are in [`ft_transcendence.pdf`](../../../ft_transcendence.pdf); the current status and evidence are in [`42-subject-compliance.md`](../../../prototype/game-ui/42-subject-compliance.md). This learning course documents implementation and test evidence only. It does not claim that a subject module is complete or signed off.
