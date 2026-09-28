# A guided course for building Code Arena

Date: 2026-09-28

Status: written design awaiting learner review. The learning direction and the visual lesson sample were approved in conversation. This document specifies the complete course; it does not claim that the course or the learner's game has been implemented.

## 1. Purpose and agreed starting point

Help a programmer who is comfortable with C, but new to TypeScript and web development, understand the existing Code Arena game and write their own implementation in their teammate's repository. Stay with the learner through setup, small coding changes, tests, multiplayer behavior, and integration. Reading a source tour must never be the only preparation for an unexplained instruction such as “implement a Match.”

The learner asked for easy English, clear dependencies, reasons for the order, visual clues, precise directory/file guidance, and enough help to avoid getting lost. They approved a course that connects C knowledge to TypeScript, explains behavior visually, gives small worked examples, and gradually reduces help. They liked the latest visual companion and requested its softer dark theme.

The teammate has not created the destination repository. A separate practice folder lets learning begin now. A later guided transition maps responsibilities to the real repository. The existing coded game is the **reference**; the teammate's repository is the **destination**. Earlier research notes sometimes reversed those roles. This design corrects that ambiguity.

Success means the learner can explain a feature, implement it without copying the reference solution, check its behavior, investigate a failure, and connect it to the rest of the game. The course supplies guidance throughout; the learner writes the game.

### What “the whole game” includes

Cover the existing Code Arena game responsibilities: Match/Round rules, Problems, visible Run, Submit, judging, scoring/Reveal, deadline closure, persistence/recovery, server/API boundaries, the game screen/editor, invitation Lobby, live 1v1, 2v2 collaboration/readiness, team chat, and operation/integration checks.

Also teach the contracts needed to connect the game to team-owned identity, configuration, and application navigation. Do not present missing production authentication, account/profile features, policy content, or other teammates' modules as implemented by the reference game. The final integration checklist keeps those dependencies visible until the team supplies and verifies them.

Retained public-queue code, optional Judge0, experimental isolation spikes, and deferred service skeletons receive explicit reference dispositions. They are not silently added to the mandatory first-release build. Teaching complete reference coverage does not require reimplementing every optional adapter or using identical filenames.

## 2. Relationship to existing course work

This design supersedes the **teaching order and learner experience** in [the 2026-09-26 course design](2026-09-26-code-arena-learning-course-design.md). In particular, the existing Submit trace will become a reference lesson used when its prerequisites are understood; it will no longer be the beginner's first coding task.

Preserve the previous design's source snapshots, drift detection, authored explanations, explicit support/exclusion dispositions, and separation of tests from implementation claims. Preserve existing lesson IDs and URLs as reference destinations. The 14 existing lessons remain useful evidence and explanations, but their existence does not establish guided-build coverage.

The current main checkout contains uncommitted course work. Implementation must reconcile it with the earlier learning-build-path worktree before changing generators or adding another competing course catalog. This design change does not regenerate existing pages or accept new source hashes.

### Reference reviewed for this design

- Domain language: [CONTEXT.md](../../../CONTEXT.md).
- Authored inventory and source anchors: [coverage-map.json](../../../.tours/learning/coverage-map.json).
- Saved implementation baseline: [reference-snapshot.json](../../../.tours/learning/reference-snapshot.json).
- Read-only catalog check on 2026-09-28: snapshot `4edc506dd9158d21`; 201 in-scope files; 381 current lesson links; 16 support-only files; 21 explicit exclusions; zero stale links, source/CodeTour drift, invalid CodeTour anchors, uncovered files, or unclassified files.

These are **reference-catalog results**, not results for this proposed course or a learner implementation. The check was `node .tours/learning/scripts/build-catalog.mjs --check`; no game test suite was rerun for this documentation change.

## 3. Why the teaching sequence is structured this way

| Research-informed principle | Required behavior in the course | Limit of the evidence |
| --- | --- | --- |
| Worked examples followed by practice | Show the reasoning for a small example, let the learner complete or modify a part, then ask for a related independent implementation. | The IES practice guide supports examples/practice and graphics/explanations generally; it does not validate this course. |
| PRIMM: predict, run, investigate, modify, make | Let the learner inspect and discuss a working example before producing a solution from an empty file. A useful prediction concerns a concept already introduced. | The cited programming study concerns school learners; adapting it to a C programmer learning a web codebase needs evaluation. |
| Label the purpose of small steps | Use labels such as “read the input,” “check the deadline,” and “return the decision.” Explain why a file or function owns a job. | The 265-student subgoal study found better early quiz results and fewer failures/withdrawals, but no improvement in mean exam scores. |
| Put related explanations and visuals together | Place the explanation beside the exact value, code group, state, or connection it describes. Highlight changes and maintain consistent labels. | Attractive diagrams and more animation are not evidence of learning. |
| Make expert reasoning visible; gradually reduce support | Explain how a developer chooses a representation, file owner, and test case. Later tasks ask the learner to make those choices with optional help. | Support is adjusted through observed difficulty and learner feedback, not a claimed automatic ability score. |
| Retrieval and transfer | Revisit earlier ideas in later builds. Ask the learner to explain a decision or solve a changed case without the worked example visible. | Remembering a path or passing a multiple-choice question does not establish implementation parity. |

Sources: [IES practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/1), [PRIMM research discussion](https://www.raspberrypi.org/blog/primm-talk-in-programming-lessons-research-seminar/), [subgoal-labeled programming instruction study](https://link.springer.com/article/10.1186/s40594-020-00222-7), [cognitive apprenticeship](https://www.aft.org/ae/winter1991/collins_brown_holum), and [Mayer/Fiorella on multimedia cues and nearby explanations](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E).

Research informs these design decisions. A learner walkthrough and independent transfer task must still test whether they work here.

## 4. The lesson experience

### One question and one meaningful change at a time

Every lesson uses this sequence, split across learner-controlled steps rather than displayed as a long wall of text:

1. **Orient:** say what the learner will make, why it is needed now, what it relies on, and what it enables next. Show a small whole-game map with the current responsibility highlighted.
2. **See:** demonstrate the behavior with labeled state, inputs, and outputs. Explain unfamiliar terms at first use. Let the learner change an input and predict what will change.
3. **Understand:** connect the behavior to a small code example and explain the decisions. Use C comparisons where useful, including where those comparisons stop being accurate.
4. **Try with help:** complete or modify a small part. Explain the result with the actual input, expected output, and observed output. Give progressively more specific hints.
5. **Build:** name the active workspace and exact file action; explain the local pattern; ask the learner to write a related implementation. State the command, working directory, expected result, and common failure branches.
6. **Check and connect:** record what was actually checked, ask for a short explanation or changed case, and show how the new piece connects to earlier work and the next step.

A correct answer must not lock away explanations; a wrong answer must not block navigation. Worked examples are small teaching examples, not complete project solutions to paste. The independent task changes a condition or context so that reading is followed by a meaningful coding decision.

### Exact file guidance

Every Build step must contain all of the following before it can be released:

- Workspace label: **reference**, **practice**, or **team**; the root path is always visible.
- Prerequisite behavior and the command/check that establishes it.
- The relative path and whether to read, create, or edit the file.
- Why that directory/module owns the responsibility; how to find an existing equivalent.
- The minimum code change described in plain English, including inputs and outputs.
- The local pattern being reused and a short explanation of imports, types, or tooling newly introduced by the task.
- The command to run, where to run it, and what the relevant output means.
- At least one meaningful failure explanation and a next diagnostic action.
- A completion check and the next unlocked responsibility.

Do not ask for an entire feature through a single card such as “add Submit, retries, deadlines, scoring, and Reveal.” Those are multiple lessons and coding steps.

### Visual behavior and appearance

Keep the approved warm charcoal/dusk theme as the default, with a light-mode toggle. Use semantic color tokens in the implemented course. Persist the preference when storage is available; if storage is unavailable, the toggle must still work for the current session.

At wide widths, use the space for a compact course route and a connected explanation/work area. C and TypeScript may appear side by side, with the explanation adjacent to the highlighted code. At narrow widths, stack the same ideas in reading order and keep a visible route control; do not make prerequisite context available only on desktop.

Visual cues have specific jobs:

- State diagrams show which transition happened and the condition that permits it.
- Input/code/output views highlight corresponding values and the current decision.
- C/TypeScript comparisons highlight the matching responsibility, not every syntax difference at once.
- Folder trees highlight the current file, distinguish read/create/edit with text labels, and explain its owner.
- Request diagrams distinguish browser, server, persistence, and Judge execution.
- Check feedback pairs expected and observed results and explains the discrepancy.

Use native buttons/disclosures, visible focus, keyboard navigation, sufficient contrast in both themes, and text equivalents. Do not rely on color alone. Advance traces explicitly; optional animation respects reduced motion. The course remains easy to read without animation.

The approved sample's `secondsLeft > 0` rule is a **simplified teaching model**. Production lessons must explain the Match-wide server deadline, accepted timestamps, and reveal grace. The sample must never imply that production creates an independent clock for each Round.

## 5. Learning order and dependency map

The rows below are milestones, not single lessons. Each row must be broken into the small teaching/build/check steps above. “Needs” names the minimum earlier milestone; the default route follows the listed order. Tests accompany every coding milestone.

| ID | Milestone and internal learning order | Needs | Visible outcome and checkpoint |
| --- | --- | --- | --- |
| M00 | **See the destination.** Play/watch one reference journey; identify Match, Round, Problem, Run, Submit, Reveal; locate browser, server, storage, and Judge on a simple map. Distinguish reference from practice and team workspaces. | None | Learner can explain what the game does and point to the responsibility they are about to build. No source hunt is required. |
| M01 | **Set up a practice workspace.** Explain root/current directory, editor, terminal, Git status, Node, package manager, package manifest, dependency install, TypeScript tools, and the first run command. Verify versions and each command before proceeding. | M00 | One tiny learner-authored function runs in the practice workspace; learner knows which files they created and what the command executed. |
| M02 | **Move from C to TypeScript and tests.** Functions/parameters/returns; annotations and type erasure; `number` versus C integer types; booleans/strings; objects and arrays; unions, missing values, imports/exports, and basic errors as needed. Explain a test as a function call plus an expected result. | M01 | Learner changes a small rule, writes a boundary test, sees a meaningful failure, fixes the rule, and explains the result. |
| M03 | **Represent the game and change its state.** Player/side IDs, Match/Round records, allowed phase transitions, membership, injected time, and the difference between a pure decision and a state change. Introduce interfaces as contracts when the first substitute is needed. | M02 | A local Match with one active Round accepts an allowed action and rejects a wrong player/phase/time. No network or real Judge is required. |
| M04 | **Give players a Problem and a visible Run.** Problem data and validation; statement/starter languages; separate visible and hidden data; a fake Judge; a Run request and result. Introduce promises/`async`/`await` and error paths around this concrete dependency. | M03 | Learner can Run visible examples, explain why Run does not change the score, and verify that public data does not expose hidden tests. |
| M05 | **Submit, evaluate, score, and reveal.** Acceptance and pending receipt; request identity and duplicate protection; fake-Judge success/failure; counted scores; normal Reveal; Round resets; summed Match scores and tie-breaks; Match deadline and bounded reveal grace. Teach these as separate slices. | M04 | A tested local 1v1 Match completes across Rounds. Boundary, failed-evaluation, and repeated-request cases have explicit checks. |
| M06 | **Expose a small server API.** Process/port; HTTP request/response; JSON; route/controller/service; runtime input validation; trusted identity seam; status/error responses. Explain the reference framework's modules and dependency injection only as the small route needs them. | M05 | A request calls the learner's existing rule; invalid shape and unauthorized gameplay requests fail for explained reasons. Development identity is visibly a temporary seam. |
| M07 | **Build the screen around working behavior.** HTML/CSS and browser events; then TypeScript components, props/state, rendering, effects/cleanup, forms, editor integration, and requests. Begin with one input/button/result; expand to Problem/editor/Run/Submit/Reveal/final result. Introduce a transport interface when separating the screen from the connection. | M06 | One browser can complete the local game flow through the server. Loading, rejection, error, keyboard, and narrow-screen states are explained and checked. |
| M08 | **Save and recover the game.** Memory store versus database; schema/relations and JSONB where used; persistence interface and Postgres adapter; transactions/revisions; durable evaluation ownership; work outside short locks; restart and failed-write recovery; publish events only after commit. | M05–M07 | Restart preserves accepted state; conflicting writes and duplicate work are checked with the real database. In-memory checks remain labeled separately. |
| M09 | **Run code through the real Judge boundary.** First explain why player programs need isolation. Connect explicit provider selection, worker API, per-case containers, languages, limits, sealed data, queue/readiness, and infrastructure failures. Compare real results with the fake-Judge contract. | M08 | Real C/C++/Python cases run through the configured boundary; required resource, secrecy, malformed-output, and failure checks have recorded results or visible blockers. |
| M10 | **Create a private Lobby and connect two players.** Invite code, side assignment, Ready and host Start; durable Match creation; HTTP versus socket events; trusted socket identity; membership, revisions, first/last-socket presence, stale replies, disconnect/reconnect, and authoritative refresh. | M07–M09 | Two clients enter by invitation and play the same Match. A disconnected client recovers the correct state. The public queue remains an explained retained capability, not the default entry. |
| M11 | **Make 2v2 safe and understandable.** Team membership; shared document and revisions; collaboration protocol; round-scoped clients; both-player readiness; readiness invalidation after edits; submission of the agreed document snapshot. | M10 | Four clients play with two isolated team documents. Edits, readiness, reconnect, Round changes, and accepted source have explicit checks. |
| M12 | **Add Game-owned team chat and client cleanup.** Match scope versus Round scope; chat membership and team isolation; messages/pings; history limits and errors; preservation/disposal of chat and collaboration clients. | M11 | Teammates communicate without cross-team leakage or stale clients. The learner can explain that the reference history is process-local, not durable storage. |
| M13 | **Integrate, operate, and prove the complete game.** Team-repo mapping; real identity/navigation/configuration contracts; Docker/Compose, environment examples, private worker, Nginx/TLS, service readiness, real multiplayer browser journeys, error recovery, README/contributions, and behavior-by-behavior comparison with the reference. | M00–M12; team repository and external contracts for final integration | The agreed game scope runs in the team app with recorded target-repo checks. Every incomplete dependency and environment-blocked check remains visible. |

Repository transition can happen between any two checked steps once the friend's repo exists; it is not postponed artificially until M13. M13 verifies the final integration. Until then, advanced practice may continue in the separate workspace with clearly stated assumptions.

Teach only the language/tool concepts needed by the next task. This is not a full C-to-TypeScript textbook placed before the game. Arrays enter when storing participants; promises enter when calling a delayed Judge; HTTP enters when exposing the already working behavior; UI effects enter when connecting and cleaning up a subscription.

## 6. Practice now; team repository later

### Practice workspace

Use a learner-selected parent directory containing `code-arena-practice/`, separate from the reference checkout. The course displays the resolved absolute root before commands. Never create or initialize a repository in an assumed location. This design itself creates no practice files.

The first setup sequence teaches the purpose of `package.json`, TypeScript configuration, dependencies, and each installed tool before using it. Tool versions and executable commands are chosen and verified during lesson implementation, using the existing reference tooling where suitable. Do not invent the friend's stack or publish untested generic commands as exact instructions.

Introduce the structure gradually:

```text
code-arena-practice/
  package.json       # introduced with package scripts
  tsconfig.json      # introduced with TypeScript checking/building
  src/
    submit-window.ts # first small teaching rule, not full Submit authorization
  test/
    submit-window.test.ts
  learning-notes.md  # learner's decisions, results, and questions
```

The learner writes functions and tests; a setup aid may create reviewed empty/configuration files but must not fill in the game solution. Later directories appear when a responsibility needs them. Do not begin by scaffolding the whole monorepo.

### Transition workflow

When the team repo becomes available:

1. Inspect its README, manifests, conventions, existing owners, test commands, and team contribution rules. Identify stack differences instead of assuming the reference layout.
2. Create a visible mapping: responsibility → reference path → practice path → team path → action (reuse/create/extend) → target check command → external dependency.
3. Resolve conflicts: reuse team implementations where appropriate; explain conceptual equivalents if the stack differs. Do not overwrite work, duplicate authentication, or introduce another framework solely to match the course.
4. Start with one learner-authored pure rule and one target-repo test. Explain the imports and configuration differences, port the learner's implementation deliberately, and verify it in the destination.
5. Continue feature by feature, updating file cards and commands to the team profile. Preserve the practice version as a reference until the learner chooses to archive it.

Practice success does not automatically mark team integration checked. If a team component is unavailable, label its dependency, provide the appropriate practice substitute, and retain the outstanding integration check. Required dependencies never disappear from the completion checklist.

## 7. Help, resuming, and honest progress

The default entry is one **Continue** action showing the current milestone, exact step, workspace, and last recorded check. The full route remains accessible with explanations of prerequisites. A learner may inspect later lessons; prerequisite warnings explain the likely gap without locking reading access.

Use separate progress fields for reading position, practice attempts, learner-reported command results, and target-repo verification. User actions such as viewing a page or answering a question never become an automatic mastery score.

Help increases gradually: restate the goal → point to the relevant value/concept → show a small analogous example → give a guided walkthrough. Error guidance distinguishes a code error from wrong working directory, missing dependencies, a stopped service, failed database connection, unavailable Docker, and an HTTP authorization failure. Include the smallest useful diagnostic action and what it tells the learner.

The browser course cannot see the editor, inspect another repository, or run arbitrary terminal commands. Commands are executed by the learner; the learner may record the result and paste a relevant non-secret error into the existing conversation for help. Automatic editor/terminal inspection or an embedded AI tutor is not required for this design.

Store a versioned progress record locally under stable milestone/lesson/step IDs and a workspace-profile ID. Include course/source revision, theme, last position, and explicit check status. Provide export/import and a clear reset confirmation so changing browsers or moving to the team repo does not silently lose the trail. If local storage is unavailable or corrupt, explain that saving is unavailable, preserve in-session navigation, and offer export. Never execute imported content or treat an imported “checked” label as fresh verification.

When a relevant reference lesson changes, keep notes and mark associated checks for review. Keep existing activity records as legacy activity; do not translate “read” into “built” or “verified.” A workspace change preserves learning history but requires destination checks to be rerun.

## 8. Course architecture and content flow

Retain the local generated-HTML approach and existing source-preview tools. A learning-platform rewrite into a new framework, account system, cloud service, or execution sandbox is unnecessary for the approved experience.

| Part | Responsibility and interface |
| --- | --- |
| Reference catalog and snapshot | Existing `coverage-map.json` and `reference-snapshot.json` remain the source inventory, exact reference, anchor, and freshness authorities. |
| Build-path catalog | Reconcile the earlier worktree's `learning-path.json` into one authored catalog. It stores milestone/lesson/step IDs, prerequisite IDs, outcomes, linked legacy references, and check definitions. Do not keep a second independent dependency graph. |
| Authored lesson content | Templates supply explanations, small examples, visual states, hints, file cards, expected results, and transfer tasks. Prose is reviewed by an author rather than generated from source inventory counts. |
| Shared lesson renderer | Generates the route, one-step view, local source links, visual trace controls, and workspace-specific file guidance. Existing URLs remain available; the build path becomes the beginner entry. |
| Workspace profiles | Separate practice paths/commands from mapped team paths/commands. Missing team mappings are explicit; no target command is presented as verified before it is checked. Profiles are data, never shell execution authority. |
| Activity and theme module | Handles navigation state, local progress, theme, export/import, and failure recovery. Extend the existing activity module after reviewing its data format. It does not determine source freshness or claim mastery. |
| Build/check tooling | Validates dependencies, required teaching fields, reference anchors, generated pages, and coverage dispositions. Preserve the existing explicit reviewed-snapshot acceptance workflow. |

Data flow: reviewed reference catalog + authored build path + lesson templates + selected workspace profile → generated local lesson → learner interaction/check report → local progress record. Reference changes produce a review signal; they do not rewrite lessons or clear failed checks automatically.

Stable step IDs keep resume/history intact when wording changes. Invalid imports, unknown step IDs, missing templates, cycles, broken anchors, and missing required file/check guidance must produce useful authoring errors. A missing team profile disables only team-specific instructions; it does not prevent practice learning.

Keep freshness and maintenance details available without making them compete with the current learning task. Separate the source inventory, a learner's progress, actual target test evidence, and 42-subject evidence in data and presentation.

## 9. Coverage checklist against the existing game

All checklist items below are **pending for the new guided course**. Existing reference sources/tests are starting evidence and must be rechecked during authoring. L01–L14 refer to current legacy lessons in `coverage-map.json`.

| Covered responsibility | New milestones | Existing reference anchors | Required learner demonstration |
| --- | --- | --- | --- |
| [ ] Basic rules, state, membership, timing | M02–M03 | L03; `packages/arena-model/src/model.ts`, `packages/arena-model/src/transitions.ts`, `packages/arena-game/src/match-authority.ts`; transition/lifecycle tests | Explain state and reject an action for the correct reason with an injected clock. |
| [ ] Problems, starter code, visible/hidden separation | M04 | L05/L07; `packages/problem-bank/schema.json`, `packages/arena-game/src/file-bank.ts`; compiled-bank and sealing tests | Render public Problem data and show that hidden inputs remain private. |
| [ ] Visible Run and failures | M04/M07/M09 | L05; `packages/arena-game/test/run-path.test.ts`, `frontend/src/components/TestPanel.tsx` | Run visible cases without changing score; explain compilation/runtime/infrastructure outcomes. |
| [ ] Submit ownership and acceptance | M05–M06 | L01; `packages/arena-game/src/engine.ts`, `services/game/src/game/game.controller.ts`; submit-path tests | An authorized valid action reaches evaluation; rejected actions do not. |
| [ ] Evaluation identity, concurrency, failures | M05/M08 | L06; `packages/arena-game/src/evaluation-orchestration.ts`; evaluation-orchestration and concurrency tests | Replay a same-identity request safely; reject conflicting reuse and avoid duplicate committed outcomes. |
| [ ] Score, Reveal, Round reset, final result | M05/M07 | L02/L03; `packages/arena-game/src/round-lifecycle.ts`, `packages/arena-model/src/scoring.ts`; scoring-reveal tests | Explain summed scores and tie-breaks; reveal only at the permitted time; reset the appropriate state. |
| [ ] Match deadline and bounded grace | M05/M08 | L02/L03; `packages/arena-game/test/deadline-closure.test.ts` | Reject at the exact Match deadline, handle accepted work within grace, and finish durably with unplayed Rounds contributing zero. |
| [ ] Persistence, revisions, restart | M08 | L08; `packages/arena-game/src/persistence.ts`, `packages/arena-game/src/postgres-store.ts`; persistence, postgres, and match-revision tests | Recover durable state and pending work; surface stale writes without silently replaying unsafe commands. |
| [ ] Post-commit events | M08/M10 | L08/L09; `packages/arena-game/test/post-commit-events.test.ts` | Failed writes do not publish success; reconnect can recover missed events from authoritative state. |
| [ ] Execution contract, isolation, provider selection | M09 | L07/L13; `packages/arena-game/src/judge.ts`, `packages/arena-game/src/container-judge.ts`, `packages/arena-game/src/worker-judge.ts`, `services/game/src/game/judge-factory.ts`; Judge/security/worker tests | Distinguish fake-Judge logic checks from real execution checks; validate limits and sealing without silently falling back between providers. |
| [ ] Worker capacity and readiness | M09/M13 | L13/L14; `services/judge-worker/src/job-queue.ts`, `services/judge-worker/src/readiness.ts`; worker HTTP/queue/readiness/topology tests | Explain and check bounded queue, timeout, readiness, and private deployment behavior. |
| [ ] Invitation Lobby and Match creation | M10 | L04; `packages/arena-game/src/lobby.ts`, `frontend/src/arena/lobby-session.ts`; lobby, lobby-atomic, and live-lobby tests | Verify host/full-side/Ready rules, concurrent joins/start, stale replies, and one Match handoff. |
| [ ] Live connection, authorization, presence | M10 | L09; `services/game/src/game/socket-auth.ts`, `services/game/src/game/match-socket-presence.ts`, `frontend/src/arena/socket.ts`; socket-auth, reconnect, and socket tests | Reject nonmembers, count multiple sockets correctly, and reconnect without stale-state corruption. |
| [ ] 2v2 documents and readiness | M11 | L10; `packages/arena-game/src/team-collaboration.ts`, `frontend/src/arena/collab.ts`; team-collaboration, team-2v2, collab-reconnect tests | Keep teams isolated, invalidate Ready after edits, and judge the agreed revision. |
| [ ] Team chat and pings | M12 | L11; `services/game/src/game/team-chat.gateway.ts`, `frontend/src/arena/chat.ts`; team-chat and live-team-chat tests | Enforce team membership and explain history limits without claiming durable chat. |
| [ ] Browser screen and client lifetimes | M07/M10–M12 | L12/L11; `frontend/src/components/ArenaPage.tsx`, `frontend/src/components/CodeWorkspace.tsx`, `frontend/src/arena/sidecars.ts`; component, sidecar, live-1v1/live-2v2 tests | Complete the player journey; show correct deadline-Reveal order; clean up Round-scoped collaboration while preserving Match-scoped chat. |
| [ ] Runtime/configuration/integration | M01/M06/M09/M13 | L13; `docker-compose.yml`, `infra/nginx/nginx.conf`, `infra/postgres/init-db.sh`, `scripts/gen-dev-certs.sh`, workspace manifests | Run the actual target setup with documented prerequisites, ignored secrets, correct identity contracts, and HTTPS/WSS checks. |
| [ ] Whole-game parity and failure journeys | M13 | L14; `frontend/e2e/`, `packages/arena-game/test/`, `services/game/src/game/` tests | Record target outcomes for complete 1v1/2v2, disconnect/reconnect, failures, and cross-team isolation. Explain meaningful differences. |
| [ ] Optional/deferred/reference-only code | Supporting reference | L04/L07/L13/L14; public queue, `packages/arena-game/src/judge0.ts`, harness/mock fixtures, isolation spike, Core/Chat skeletons, telemetry | Every item has a reasoned disposition. Optional experiments and service skeletons cannot be presented as production features or silently required builds. |

The catalog check already assigns the current 201 files to legacy lessons or supporting references. Before declaring the new course complete, add a build disposition for **each inventoried file**: guided build lesson(s), explicitly explained supporting reference, or reviewed exclusion. Every runtime behavior also needs a source/test-backed acceptance row. File links alone cannot prove that the behavior was taught.

Do not silently inherit the old support-only classification when a file now contains behavior the learner must build. New or changed source files require review, affected-lesson updates, and explicit snapshot acceptance. A stale reference blocks claims that the associated course content is current.

### Course completion gates

- [ ] All milestones have complete small lessons; no “build the rest yourself” ending.
- [ ] Every required Build step has the full file/command/result/help contract.
- [ ] All prerequisite IDs resolve and form an acyclic graph with a usable recommended route.
- [ ] Every in-scope file and behavior has a reviewed build/support/exclusion disposition.
- [ ] All required guided lessons and target checks are available; optional/deferred scope is labeled.
- [ ] A learner walkthrough covers foundations, a changed independent task, return/resume, and at least one complete feature build.
- [ ] Actual target integration evidence is distinct from practice evidence and reference tests.
- [ ] Required environment-dependent checks have real results; blocked/skipped checks remain outstanding.

## 10. Verification and evaluation of the course

During implementation, extend the existing catalog checks to detect dependency cycles, missing step fields, invalid workspace mappings, unassigned behavior coverage, and generated drift. Test progress migration/corruption/storage failure and ensure no legacy reading marker becomes a verified-build marker. Validate imports as data and render saved text safely.

Exercise meaningful interactions in the browser: input changes update the explanation, corresponding code is highlighted, wrong boundary choices receive specific feedback, hints increase in detail, back/next preserves the right position, and switching workspace does not carry over unverified target results. Check dark/light contrast, keyboard focus, reduced motion, narrow layouts, source navigation, and offline use. Run the repository's required `npm run lint` for implemented UI changes, plus relevant course tests and generation checks.

Run one actual beginner session before authoring the entire curriculum in the same format. Ask the learner to explain the C/TypeScript example, write a related rule, run its test in the practice workspace, and return later to resume. Observe where an unexplained term, file decision, or command blocks progress. Adjust the lesson granularity; do not interpret visual preference alone as proof of learning.

For the final game, keep unit, service, real Postgres, real Judge/container, and real multi-client browser evidence separate. A test file's presence, a mocked success, or a simulated comparison in the course is never reported as a real execution pass.

## 11. Requirements, boundaries, and decisions still dependent on the team

Reviewed [ft_transcendence.pdf](../../../ft_transcendence.pdf), especially printed pp.8–9 (PDF pp.9–10: frontend/backend/database, Git/team contributions, containers, responsive/accessibility, input validation, identity, secrets, HTTPS), printed pp.16–17 (PDF pp.17–18: complete game, remote players, 3+ players, dependent optional modules), and printed pp.27–29 (PDF pp.28–30: English README, prerequisites, architecture, module explanations, contributions, and AI-use disclosure).

A local static learning companion and practice fake identity are instructional tools, not production compliance evidence. The target application's authentication, HTTPS, policy pages, shared team work, and module sign-off remain required where the subject says so. No game module status changes through this design.

Follow the current ADRs: [Judge isolation](../../adr/0003-sandboxed-code-judging.md), [service responsibilities and Game-owned chat amendment](../../adr/0001-three-service-backend.md), [database ownership](../../adr/0002-separate-databases-shared-postgres.md), [evaluation/provider boundaries](../../adr/0012-evaluation-and-judge-adapter-deepening.md), and [Match deadline/Lobby/event behavior](../../adr/0013-match-deadline-lobby-and-event-convergence.md).

The visual sample's broad “matchmaking” label is narrowed here to the actual invitation-first release. Public queue behavior is retained reference scope unless the team explicitly changes the product decision. The sample's timing rule stays labeled as a teaching simplification. Game-owned chat history remains process-local. The reference's development identity seam, horizontal scaling limitations, and unverified environment-dependent checks must remain explicit in the relevant lessons.

The only external information required later is the team repository and its actual stack/conventions, contribution rules, and identity/deployment contracts. Foundation authoring and practice do not wait on that information. Team-specific instructions and final integration checks do.

## 12. Delivery boundaries and review

This is the master design for the learning experience. Implementation should be planned in reviewable units:

1. Shared lesson structure, build-path data, workspace distinction, theme, and progress foundation.
2. A fully authored M00–M02 foundation path with real practice setup and learner evaluation.
3. M03–M07 guided local-game, server, and screen lessons.
4. M08–M12 persistence, real judging, and multiplayer lessons.
5. Team-profile transition, M13 integration, and full build-coverage audit.

Each unit needs its own concrete implementation tasks and verification. The first unit does not permit reporting the complete course delivered. The first prototype does not establish that the lesson shell has been integrated into `.tours/learning/`.

Next gate: the learner reviews this written design. After approval, prepare the implementation plan and agree its execution method. No product implementation is authorized merely by this document's existence.
