# Equal Coding Role Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the selected lobby and Exam Shell role flow with a deterministic 2v2/3v3 prototype in which every player owns a necessary coding component in one shared contract pipeline.

**Architecture:** Keep the existing standalone lobby and live-match HTML prototypes and their A/B/C switchers. Variant A in the lobby exposes blind-but-informed programming-style cards; Variant A in the live match maps those cards to subject-specific files for an original `packet_router` exercise, simulates owner-only editing, local checks, integration, hidden submission, cooldown, disconnect recovery, and success, while preserving historical Variants B and C.

**Tech Stack:** Semantic HTML, scoped CSS, vanilla JavaScript, native forms/dialogs, Node.js, and Playwright with the workspace-provided Chromium runtime.

**Spec:** [`docs/superpowers/specs/2026-09-19-equal-coding-role-system-design.md`](../specs/2026-09-19-equal-coding-role-system-design.md)

## Global Constraints

- Read `AGENTS.md`, the approved spec, `CONTEXT.md`, `docs/agents/domain.md`, `ft_transcendence.pdf`, and `prototype/game-ui/42-subject-compliance.md` before editing.
- Preserve every unrelated tracked, staged, and untracked user change. Never run `git add .`, `git reset`, `git checkout --`, `git clean`, or a destructive command.
- The launcher contract requires an uncommitted review diff. Do not create commits or change the existing index; end every task with tests plus `git diff --check` instead of a commit.
- OpenCode, launched through the repository launcher, is the implementation executor. Codex may review the resulting diff but must not implement the HTML, CSS, JavaScript, or browser-test changes itself.
- Replace selected Variant A behavior only. Preserve lobby and live-match Variants B/C as historical alternatives, including switcher buttons, arrow-key navigation, and the typing-focus guard.
- Treat this as a throwaway interaction prototype, not production implementation or module evidence.
- Keep the visible labels `42-INSPIRED SIMULATION`, `FAKE GRADER`, and `EXPLORATION ONLY — NOT PRODUCTION CODE EXECUTION` in live Variant A.
- Use only original subject content. Do not copy actual 42 exam subjects, solutions, grading output, or current exam wording.
- Never compile or execute editor contents. Do not add `eval`, `Function`, Web Workers, child processes, `fetch`, WebSockets, browser storage, third-party editors, a backend, or external assets.
- Submitted text stays in page memory only. The fake recognizer may inspect disclosed surface markers but must state that it does not prove C semantics.
- Keep the Journey link, one page-wide polite live region, Team chat, fake-state inspector, Match clock, Failure trace, Retry cooldown, and historical Hint behavior.
- Meet the current prototype accessibility floor: latest stable Chrome, one `<h1>`, semantic controls/labels, visible keyboard focus, non-color status labels, visible text at least 14px, interactive targets at least 44px, no document-level horizontal overflow at 1440x1000 or 390x844, and zero console/page errors.
- Write generated screenshots only under `/private/tmp/campus-equal-coding-role-screenshots/`; no PNG belongs in the repository.
- Review `prototype/game-ui/42-subject-compliance.md` after every task. Update it only when evidence, scope, assumptions, or status actually changes. Never promote simulated behavior to production evidence.

## Locked Product Decisions

- The lobby reveals programming style only; `packet_router`, function names, contracts, examples, and starter code remain absent until the live match starts.
- Lobby cards are:
  - `sequence`: **Sequence transformation** — “Decode and normalize ordered data.”
  - `search`: **Deterministic search** — “Explore candidates and resolve equal choices predictably.” Available only in 3v3.
  - `stateful`: **Stateful constraints** — “Track changing limits across ordered events.”
- In 2v2, the cards map at reveal to **Routing Interpreter** and **Queue Scheduler**.
- In 3v3, the cards map at reveal to **Packet Decoder**, **Route Planner**, and **Congestion Controller**.
- Both teams receive identical cards and mappings.
- Every lobby card must say that expected workload is equal; style describes the kind of coding work, not difficulty or team importance.
- Every component has one editable file, owner-only editing, teammate read-only visibility, generated contract stubs, local checks, and a direct contribution to integration.
- The live prototype uses one original subject, `packet_router`, with separately authored 2-player and 3-player decompositions.
- Local checks and integration are penalty-free. Only an explicit hidden submission may create a Failure trace and 15-second Retry cooldown.
- Ownership is locked during the subject. The prototype may state that voluntary swaps happen only between future subjects; it does not implement a second subject.

## Subject Contract

Use this original, fully disclosed subject after match start:

```text
packet_router

Frames use four decimal digits SDPC:
- S: source node 0..3
- D: destination node 0..3
- P: priority 0..9, higher first
- C: checksum, valid when (S + D + P) % 10 == C

The network has four nodes. Routes minimize total link cost. Equal-cost routes
choose the lower next-hop node. During dispatch, higher-priority packets go
first; a link cannot exceed its per-tick capacity.

Public example:
frame 0314 is valid because (0 + 3 + 1) % 10 == 4
equal routes 0-1-3 and 0-2-3 choose 0-1-3
```

Use these component contracts:

```c
/* 2v2 */
int interpret_routes(const int *frames, int frame_count,
    const t_link *links, int link_count, t_request *requests);
int schedule_deliveries(const t_request *requests, int request_count,
    const int *capacity, t_delivery *deliveries);

/* 3v3 */
int decode_packets(const int *frames, int frame_count, t_packet *packets);
int plan_routes(const t_packet *packets, int packet_count,
    const t_link *links, int link_count, t_route *routes);
int control_congestion(const t_route *routes, int route_count,
    const int *capacity, t_delivery *deliveries);
```

Render these disclosed input/output responsibilities beside the signatures:

| Team size | Component | Input contract | Output contract |
|---|---|---|---|
| 2v2 | Routing Interpreter | Decimal frames plus four-node weighted links | Valid normalized requests carrying a deterministic next hop |
| 2v2 | Queue Scheduler | Interpreted requests plus per-tick link capacity | Deliveries ordered by priority without exceeding capacity |
| 3v3 | Packet Decoder | Decimal frames | Valid normalized packets; malformed frames are rejected |
| 3v3 | Route Planner | Decoded packets plus four-node weighted links | Minimum-cost routes using the lower next hop on ties |
| 3v3 | Congestion Controller | Planned routes plus per-tick link capacity | Priority-ordered deliveries, deferrals, or drops within capacity |

Every component panel must show why its output is required by the next stage or final team result. Use comparable-workload copy as a prototype hypothesis, not as a claim that balance has been proven without playtesting.

The UI must explain that types and upstream return values are provided by generated stubs during local work. The stubs are simulated contract fixtures, not compiled support code.

## State and Interface Contract

Variant A should preserve the existing shared top-level fields used by historical Variants B/C and expose this logical `exam` namespace through `window.__MATCH_STATE__()`. Property names are fixed so the check and implementation agree:

```js
{
  remainingSeconds: 582,
  cooldown: 0,
  trace: null,
  lastEvent: "Subject revealed. All component stations are active.",
  messages: [],
  exam: {
    phase: "active",
    teamSize: 2 | 3,
    activeRole: "sequence" | "search" | "stateful",
    selectedRole: "sequence" | "search" | "stateful",
    subjectVisible: true,
    opponent: { completedComponents: 0, totalComponents: 2 | 3, submitted: false },
    components: [
      {
        roleId: "sequence",
        id: "routing-interpreter",
        name: "Routing Interpreter",
        file: "routing_interpreter.c",
        owner: "Aimane",
        connected: true,
        code: STARTER_CODE_BY_COMPONENT["routing-interpreter"],
        revision: 1,
        compileStatus: "idle",
        localStatus: "idle",
        integrationStatus: "idle",
        diagnostics: []
      }
    ],
    integration: { status: "idle", detail: "Not run", revisionKey: "" },
    teamCases: [],
    submissions: []
  }
}
```

`window.__MATCH_STATE__()` must always return a structured clone. URL parameters are:

```text
03-lobby.html?variant=A
04-live-match.html?variant=A&teamSize=2&role=sequence
04-live-match.html?variant=A&teamSize=2&role=stateful
04-live-match.html?variant=A&teamSize=3&role=sequence
04-live-match.html?variant=A&teamSize=3&role=search
04-live-match.html?variant=A&teamSize=3&role=stateful
```

Invalid `teamSize` falls back to `2`; a role not available at that size falls back to the first component.

---

### Task 1: Replace Private Lobby Roles with Blind Programming-Style Cards

**Files:**
- Modify: `prototype/game-ui/03-lobby.html:453-807`
- Modify: `prototype/game-ui/checks/exam-shell-check.js`
- Read: `docs/superpowers/specs/2026-09-19-equal-coding-role-system-design.md`

**Interfaces:**
- Consumes: existing lobby `roleCatalog`, `activeRoles`, readiness gate, Variant A/B/C renderers, and start transition.
- Produces: stable role IDs `sequence`, `search`, and `stateful`, plus a live-match URL carrying `teamSize` and the current player's chosen role.

- [ ] **Step 1: Add failing lobby secrecy and card assertions**

  Add a Playwright block that opens `03-lobby.html?variant=A`, fills the demo roster, and asserts:

  ```js
  const body = (await page.locator("body").innerText()) || "";
  for (const leaked of ["packet_router", "Packet Decoder", "Route Planner",
    "Congestion Controller", "decode_packets", "plan_routes", "control_congestion", "0314"]) {
    assert(!body.includes(leaked), `lobby leaked subject detail: ${leaked}`);
  }
  assert(body.includes("Sequence transformation"), "sequence style card missing");
  assert(body.includes("Stateful constraints"), "stateful style card missing");
  assert(!body.includes("Deterministic search"), "2v2 must show exactly two style cards");
  assert(body.includes("Equal expected workload"), "style cards must not imply a difficulty advantage");
  ```

  Switch to 3v3 and assert all three style cards appear once per assignment control. Assert the old selected-direction roles `Code reader`, `Input analyst`, and `Answer builder` do not appear in Variant A.

  Complete the role-selection and readiness flow once in 2v2 and once in 3v3. In each size, assert duplicate claims are rejected, changing a claimed role clears that player's ready state, both teams contain the same ordered role IDs, and Start remains disabled until every slot on both teams is filled and ready.

- [ ] **Step 2: Add a failing live-match handoff assertion**

  Fill both teams, select `sequence`, mark the current player ready, start the match, then assert the transition link has:

  ```js
  const href = await page.getByRole("link", { name: /open active-match prototype/i }).getAttribute("href");
  const target = new URL(href, page.url());
  assert(target.searchParams.get("teamSize") === "2", "lobby must hand off teamSize=2");
  assert(target.searchParams.get("role") === "sequence", "lobby must hand off the chosen role");
  ```

- [ ] **Step 3: Run the browser check and prove RED**

  Run:

  ```bash
  NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    prototype/game-ui/checks/exam-shell-check.js
  ```

  Expected: failure because the lobby still exposes Code reader/Input analyst/Answer builder and its transition does not carry the selected role.

- [ ] **Step 4: Replace the lobby catalogue and copy**

  Replace `roleCatalog` with:

  ```js
  const roleCatalog = [
    { id: "sequence", name: "Sequence transformation", short: "Decode and normalize ordered data." },
    { id: "search", name: "Deterministic search", short: "Explore candidates and resolve equal choices predictably.", threePlayerOnly: true },
    { id: "stateful", name: "Stateful constraints", short: "Track changing limits across ordered events." }
  ];

  function activeRoles(state) {
    return state.matchSize === 2
      ? roleCatalog.filter((role) => !role.threePlayerOnly)
      : roleCatalog;
  }
  ```

  Update the seeded roster and demo assignment to use those IDs. Change “Private assignment” to “Programming style,” and add visible copy stating that the subject, exact component, function contract, examples, and starter code remain hidden until the match starts. Keep unique-role enforcement, role-change readiness clearing, random open-role assignment, and reservation behavior.

  Render the same style-card IDs for both teams and label every card `Equal expected workload`. A player may choose a preferred style, but the copy must not suggest that one style is easier, more important, or more powerful.

- [ ] **Step 5: Pass the selected role into the live match**

  In `startedMarkup`, compute the current player and build this exact query contract:

  ```js
  const current = findCurrentPlayer(state);
  const matchHref = `04-live-match.html?variant=A&teamSize=${state.matchSize}&role=${encodeURIComponent(current.member.role)}`;
  ```

  Preserve the reset action and Journey route. Do not insert subject-specific strings anywhere in the lobby file.

- [ ] **Step 6: Re-run the focused check and checkpoint**

  Expected: all new lobby assertions pass; existing equality, readiness, disconnect reservation, switcher, and keyboard behavior still pass. Run `git diff --check` and do not stage or commit.

### Task 2: Introduce Separate 2-Player and 3-Player Coding Pipelines

**Files:**
- Modify: `prototype/game-ui/04-live-match.html:876-1311`
- Modify: `prototype/game-ui/checks/exam-shell-check.js`

**Interfaces:**
- Consumes: lobby URL parameters from Task 1 and existing Variant A renderer/store.
- Produces: `PIPELINES[2]`, `PIPELINES[3]`, `state.exam.components`, owner-only editor tabs, and the fixed `window.__MATCH_STATE__()` shape.

- [ ] **Step 1: Add failing reveal, mapping, and ownership assertions**

  For every live-match URL in the State and Interface Contract, assert:

  - `packet_router`, the full frame rules, public example, and `EXPLORATION ONLY — NOT PRODUCTION CODE EXECUTION` are visible.
  - 2v2 contains exactly Routing Interpreter and Queue Scheduler; Packet Decoder, Route Planner, and Congestion Controller are absent.
  - 3v3 contains exactly Packet Decoder, Route Planner, and Congestion Controller.
  - The active role's editor is editable.
  - Every teammate editor is visible through its component tab but disabled/read-only.
  - All player names and component states appear in the Team strip.
  - Both pipeline variants expose generated-stub copy.
  - The opponent strip shows only `Opponent components 0/N` and `Submission hidden`; it never exposes opponent code, player activity, diagnostics, or role ownership.
  - Both teams use the same ordered role IDs for the selected team size.
  - A reveal line explicitly connects the selected broad style to the resolved component, for example `Sequence transformation → Routing Interpreter`.

  Also read `03-lobby.html` as text and assert it contains none of the subject-specific tokens listed in Task 1.

- [ ] **Step 2: Add state-clone and invalid-URL assertions**

  Assert that mutating a returned state cannot modify the next snapshot:

  ```js
  const cloneSafe = await page.evaluate(() => {
    const first = window.__MATCH_STATE__();
    first.exam.components[0].code = "MUTATED";
    first.exam.submissions.push({ status: "fake" });
    const second = window.__MATCH_STATE__();
    return second.exam.components[0].code !== "MUTATED" && second.exam.submissions.length === 0;
  });
  assert(cloneSafe, "match state hook must return an isolated clone");
  ```

  Open `?variant=A&teamSize=9&role=search` and assert the state falls back to `exam.teamSize === 2` and `exam.activeRole === "sequence"`.

- [ ] **Step 3: Run the check and prove RED**

  Expected: failure because live Variant A still implements Code Writer/Test Operator and `loop_checksum`.

- [ ] **Step 4: Define the immutable pipeline catalogue**

  Add a `PIPELINES` object before `initialState`. Each pipeline must include the exact component names, role IDs, files, signatures, owners, and starter code from the locked decisions and Subject Contract. Use these assignments:

  ```js
  const TEAM_MEMBERS = {
    2: { sequence: "Aimane", stateful: "Saad" },
    3: { sequence: "Aimane", search: "Yasmine", stateful: "Saad" }
  };
  ```

  Starter code must contain the exact function signature and a valid return statement, plus a visible instructional comment. Do not include a completed solution or hidden-marker requirement.

- [ ] **Step 5: Build the new Variant A initial state**

  Parse `teamSize` and `role` before store creation, derive components from `PIPELINES[teamSize]`, and replace only `initialState.exam` with the State and Interface Contract fields. Keep top-level legacy fields that Variants B/C still consume.

  Use a helper with this contract:

  ```js
  function createExamState(search = location.search) {
    const params = new URLSearchParams(search);
    const teamSize = params.get("teamSize") === "3" ? 3 : 2;
    const definitions = PIPELINES[teamSize];
    const requestedRole = params.get("role");
    const activeRole = definitions.some((item) => item.roleId === requestedRole)
      ? requestedRole
      : definitions[0].roleId;
    const components = definitions.map((definition) => ({
      roleId: definition.roleId,
      id: definition.id,
      name: definition.name,
      file: definition.file,
      signature: definition.signature,
      starterCode: definition.starterCode,
      publicMarkers: definition.publicMarkers,
      hiddenMarkers: definition.hiddenMarkers,
      owner: TEAM_MEMBERS[teamSize][definition.roleId],
      connected: true,
      code: definition.starterCode,
      revision: 1,
      compileStatus: "idle",
      localStatus: "idle",
      integrationStatus: "idle",
      diagnostics: []
    }));
    return {
      phase: "active",
      teamSize,
      activeRole,
      selectedRole: activeRole,
      subjectVisible: true,
      opponent: { completedComponents: 0, totalComponents: components.length, submitted: false },
      components,
      integration: { status: "idle", detail: "Not run", revisionKey: "" },
      teamCases: [],
      submissions: []
    };
  }
  ```

- [ ] **Step 6: Replace the selected Variant A layout**

  Render these regions in DOM reading order:

  ```html
  <div class="variant-a" data-exam-shell data-team-size="2">
    <header class="exam-status"><h1>Exam shell · packet_router</h1></header>
    <section class="exam-subject" aria-labelledby="subject-title"><h2 id="subject-title">packet_router</h2></section>
    <nav class="component-tabs" aria-label="Team coding stations"></nav>
    <section class="exam-editor" aria-labelledby="editor-title"><h2 id="editor-title">Component editor</h2></section>
    <aside class="exam-team" aria-labelledby="team-title"><h2 id="team-title">Team status</h2></aside>
    <section class="exam-local-terminal" aria-labelledby="local-title"><h2 id="local-title">Local terminal</h2></section>
    <section class="exam-integration-terminal" aria-labelledby="integration-title"><h2 id="integration-title">Integration terminal</h2></section>
  </div>
  ```

  A component tab selects which file is displayed. Selecting a teammate tab keeps its textarea disabled and labels it `Read-only teammate file`. A prototype-only `View as <component>` control changes `activeRole` and the `role` URL parameter, allowing one browser to demonstrate each player without claiming authorization.

  The status header must render only the limited opponent summary from `state.exam.opponent`: completed component count and whether the opponent submitted. Do not infer or display opponent source, identity, diagnostics, active editor, or ownership.

  Remove the selected Variant A private-role panel, Code Writer/Test Operator copy, test-report lock, and private control model. Preserve B/C markup and state consumers.

- [ ] **Step 7: Add restrained responsive styling**

  Keep the austere terminal direction. Use CSS Grid for desktop and DOM-order stacking below the existing breakpoint. Component tabs must scroll within their own container rather than causing document overflow. Pair every color with text, keep all interactive targets at least 44px, and retain visible `:focus-visible` outlines.

- [ ] **Step 8: Re-run static tests and checkpoint**

  Expected: all Task 2 assertions pass for six URLs, B/C switcher tests still pass, and `git diff --check` produces no output. Do not stage or commit.

### Task 3: Implement Owner-Only Editing, Local Checks, and Integration

**Files:**
- Modify: `prototype/game-ui/04-live-match.html`
- Modify: `prototype/game-ui/checks/exam-shell-check.js`

**Interfaces:**
- Consumes: `state.exam.components`, `state.exam.activeRole`, and component metadata from Task 2.
- Produces: `inspectComponent(component)`, `runLocalCheck(roleId)`, `addTeamCase(input)`, `runIntegration()`, edit invalidation, and deterministic terminal output.

- [ ] **Step 1: Add failing local-check permission tests**

  For each role in 2v2 and 3v3:

  - switch to that role through `View as`;
  - edit only its own textarea;
  - verify a teammate textarea is disabled;
  - run its local check;
  - verify the starter fails with a labelled simulated diagnostic;
  - fill a public-pass source and verify `compileStatus === "passed"` and `localStatus === "passed"` only for that component.

  Use these public marker families in the test sources:

  ```js
  const PUBLIC_MARKERS = {
    "routing-interpreter": ["for (", "checksum", "best_cost", "next_hop"],
    "queue-scheduler": ["for (", "priority", "capacity", "tick"],
    "packet-decoder": ["for (", "source", "destination", "checksum"],
    "route-planner": ["for (", "best_cost", "next_hop", "tie"],
    "congestion-controller": ["for (", "priority", "capacity", "tick"]
  };
  ```

  Test sources must retain their required function signature and include every public marker as executable-looking C identifiers or conditions; comments alone must not satisfy the recognizer.

- [ ] **Step 2: Add failing integration and invalidation tests**

  Assert:

  - integration before all components compile reports `BLOCKED — compile every component` and carries no penalty;
  - integration after only one local pass reports a component-contract mismatch and carries no penalty;
  - integration after every public local pass reports `PASSED — pipeline contracts connected`;
  - adding the team-authored input `frames=0314,0325; capacity=1` stores it in `exam.teamCases`, displays it in the local and integration terminals, invalidates previous local/integration readiness, and leaves clocks and penalties unchanged;
  - rerunning each local check after adding the case reports that it inspected the public example plus one team case;
  - a green integration reports that it checked the disclosed public example plus every stored team-authored input;
  - editing any component after a green integration resets that component to idle, resets integration to idle, clears the Failure trace, and disables Submit;
  - a teammate edit attempt cannot change stored source.

- [ ] **Step 3: Run the check and prove RED**

  Expected: failure because component-local and pipeline actions do not yet exist.

- [ ] **Step 4: Implement the disclosed fake recognizer**

  Add component definitions containing required signature text and public marker regexes. Implement:

  ```js
  function inspectComponent(component) {
    const source = component.code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
    const compiled = source.includes(component.signature) && /return\s+[^;]+;/.test(source);
    const missing = component.publicMarkers
      .filter((marker) => !marker.pattern.test(source))
      .map((marker) => marker.label);
    return { compiled, passed: compiled && missing.length === 0, missing };
  }
  ```

  Every diagnostic must begin with `SIMULATED`. Visible boundary copy must say the recognizer strips comments, looks for disclosed surface markers, never compiles or executes C, and cannot prove correctness.

- [ ] **Step 5: Implement local-check transitions**

  `runLocalCheck(roleId)` may run only for the current `activeRole` while its owner is connected. It sets compile/local status and diagnostics for that component only. It never creates `trace`, `cooldown`, or a submission record.

  The local terminal reports that the disclosed public example and every current team-authored input were inspected. This remains string-based simulation; neither the public example nor team input is passed to C code.

  An input event may update source only when the displayed component's `roleId` equals `state.exam.activeRole` and its owner is connected. It increments revision and calls:

  ```js
  function invalidateAfterEdit(next, roleId) {
    const component = next.exam.components.find((item) => item.roleId === roleId);
    component.compileStatus = "idle";
    component.localStatus = "idle";
    component.integrationStatus = "idle";
    component.diagnostics = [];
    next.exam.integration = { status: "idle", detail: "Code changed; integrate again", revisionKey: "" };
    next.trace = null;
  }
  ```

  Implement `addTeamCase(input)` as an in-memory prototype action. Trim the value, reject an empty string with an inline validation message, and otherwise append `{ id, input }` to `state.exam.teamCases`. Adding a case resets every component's `localStatus` and `integrationStatus` to `idle`, clears their diagnostics, and resets the shared integration object; it does not change compile status, revisions, clocks, cooldown, trace, or submission history. The integration terminal must have a labelled text input and an `Add team case` button; both terminals render the stored case text. Do not parse or execute it.

- [ ] **Step 6: Implement integration transitions**

  `runIntegration()` is a shared, penalty-free action over the disclosed public example and the current `state.exam.teamCases`:

  - if any component has not compiled, set integration to `blocked` with `BLOCKED — compile every component`;
  - if all compile but any public local check is not passed, set integration to `failed` with `SIMULATED contract mismatch — inspect the named component contract`;
  - otherwise set integration to `passed`, record the joined revision key such as `sequence:2|stateful:3`, and announce `PASSED — pipeline contracts connected; public example plus N team cases inspected`.

  Mirror the outcome into each component's `integrationStatus`: `blocked` for not-yet-compiled components, `failed` only for the named mismatching contract, `passed` for components included in a green integration, and `idle` for components not evaluated in that attempt.

  A mismatch may name the component contract, but it must never name or blame the owning player.

  Do not create a cooldown or Failure trace from local checks or integration.

- [ ] **Step 7: Re-run workflow tests and checkpoint**

  Expected: Task 3 tests pass in both team sizes; the single polite live region announces state changes; `git diff --check` is clean. Do not stage or commit.

### Task 4: Implement Hidden Submission, Cooldown, and Reserved Ownership Recovery

**Files:**
- Modify: `prototype/game-ui/04-live-match.html`
- Modify: `prototype/game-ui/checks/exam-shell-check.js`

**Interfaces:**
- Consumes: green integration state and component revisions from Task 3.
- Produces: `canSubmit(state)`, deterministic fake hidden evaluation, team-wide cooldown, submission history, disconnect reservation, restoration, and completion.

- [ ] **Step 1: Add failing submission tests**

  After all public checks and integration pass, assert Submit enables. Submit the public-pass sources and expect:

  - one submission entry with status `failed`;
  - a generic `SIMULATED hidden evaluation` Failure trace that does not reveal missing markers;
  - a 15-second cooldown;
  - editing, local checks, integration, and Team chat remain available;
  - only resubmission is blocked.

  Advance the cooldown and assert the Match clock loses exactly 15 seconds.

- [ ] **Step 2: Add failing accepted-submission tests**

  Amend each public-pass source with its hidden edge behavior, rerun affected local checks and integration, and submit again. Use these hidden marker families:

  ```js
  const HIDDEN_MARKERS = {
    "routing-interpreter": ["frame < 0", "source == destination"],
    "queue-scheduler": ["capacity == 0", "request_count == 0"],
    "packet-decoder": ["frame < 0", "packet_count == 0"],
    "route-planner": ["source == destination", "link_count == 0"],
    "congestion-controller": ["capacity == 0", "route_count == 0"]
  };
  ```

  Assert the second submission is `passed`, `exam.phase === "finished"`, the completion heading receives focus, and the UI says a future subject—not implemented here—could offer a voluntary role swap.

- [ ] **Step 3: Add failing disconnect and restoration tests**

  Use a prototype-only `Toggle <owner> connection` control in the Team strip. Assert:

  - disconnect marks the component `RESERVED · OFFLINE`;
  - its editor becomes disabled even while viewing as its owner;
  - ownership and source remain unchanged;
  - the Match clock/cooldown state remains unchanged;
  - local checks for the offline owner are rejected;
  - reconnect restores edit access and the same component state;
  - no teammate inherits edit permission.

- [ ] **Step 4: Run the check and prove RED**

  Expected: failure because hidden evaluation and active-match recovery do not exist.

- [ ] **Step 5: Implement submission gating and evaluation**

  Use:

  ```js
  function canSubmit(state) {
    if (state.exam.phase !== "active" || state.cooldown > 0) return false;
    if (state.exam.integration.status !== "passed") return false;
    const currentKey = state.exam.components.map((item) => `${item.roleId}:${item.revision}`).join("|");
    return currentKey === state.exam.integration.revisionKey;
  }
  ```

  Hidden evaluation reuses comment-stripped source and checks the component's hidden marker regexes. It is deliberately disclosed fake logic in page source. On failure, append `{ attempt: state.exam.submissions.length + 1, status: "failed", category: "wrong output" }`, set cooldown to 15, and show only a generic divergence trace. On success, append the same shape with `status: "passed"`, set `state.exam.phase` to `finished`, clear the trace, and focus the completion heading.

- [ ] **Step 6: Implement cooldown and recovery transitions**

  `advanceCooldown` subtracts the full remaining cooldown from `remainingSeconds`, clamps at zero, and clears cooldown. It does not reset code, local results, or integration.

  `toggleConnection(roleId)` flips only that component's `connected` flag and announces reservation/restoration. Owner checks and edits require `connected === true`; read-only visibility, chat, integration output, submission history, and clocks remain available.

- [ ] **Step 7: Re-run workflow tests and checkpoint**

  Expected: failure/cooldown/recovery/pass journeys succeed for both 2v2 and 3v3, with zero console/page errors. Run `git diff --check`; do not stage or commit.

### Task 5: Complete Responsive, Regression, and Compliance Verification

**Files:**
- Modify: `prototype/game-ui/checks/exam-shell-check.js`
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Verify: `prototype/game-ui/03-lobby.html`
- Verify: `prototype/game-ui/04-live-match.html`
- Read: `ft_transcendence.pdf`

**Interfaces:**
- Consumes: the completed lobby/live prototype and every focused assertion above.
- Produces: one repeatable browser check, temporary screenshots, exact evidence, and a review-ready uncommitted diff.

- [ ] **Step 1: Expand the viewport matrix**

  Render at 1440x1000 and 390x844:

  ```text
  Lobby A 2v2
  Lobby A 3v3
  Live A 2v2 sequence
  Live A 2v2 stateful
  Live A 3v3 sequence
  Live A 3v3 search
  Live A 3v3 stateful
  Lobby B and C
  Live B and C
  ```

  For every case assert no document overflow, no interactive target below 44px, no visible text below 14px, visible keyboard focus, exactly one `<h1>`, and zero console/page errors. Capture one lobby desktop/mobile pair plus one 2v2 and one 3v3 live desktop/mobile pair under `/private/tmp/campus-equal-coding-role-screenshots/`.

- [ ] **Step 2: Retain historical regression coverage**

  Keep B/C switching and keyboard guards. Update only stale Variant A assumptions. Historical B/C may retain old role concepts, but their switcher labels must say `Historical alternative`; no test may present them as the selected direction.

- [ ] **Step 3: Run static security scans**

  Run:

  ```bash
  rg -n "eval\\(|new Function|fetch\\(|Worker\\(|WebSocket\\(|localStorage|sessionStorage|<script[^>]+src=|<link[^>]+href=" \
    prototype/game-ui/03-lobby.html prototype/game-ui/04-live-match.html
  ```

  Expected: no prohibited primitive or external dependency match. Inspect any benign HTML link hit rather than weakening the scan.

- [ ] **Step 4: Run the complete browser check**

  Run:

  ```bash
  NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    prototype/game-ui/checks/exam-shell-check.js
  ```

  Record the exact assertion count and screenshot directory. If Chromium is blocked by the environment, report that exact blocker and do not claim a browser pass.

- [ ] **Step 5: Run broader regressions when present**

  If these existing temporary checks still exist, run them unchanged first:

  ```bash
  test ! -f /private/tmp/campus-critical-journey-check.js || \
    NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    /private/tmp/campus-critical-journey-check.js

  test ! -f /private/tmp/campus-game-ui-check.js || \
    NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
    /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
    /private/tmp/campus-game-ui-check.js
  ```

  If either fails only because selected-direction text or role expectations are stale, update the temporary script outside the repository and rerun it. Do not weaken overflow, target-size, error, or navigation assertions.

- [ ] **Step 6: Update the compliance matrix honestly**

  Replace the stale selected Variant A evidence with the exact new browser results. Explicitly distinguish:

  - implemented prototype evidence: blind lobby style cards, identical team mappings, separate 2v2/3v3 component pipelines, owner-only simulated editors, local checks, integration, submission failure/cooldown/pass, and reserved ownership recovery;
  - deliberate simulation: marker inspection and fake hidden evaluation;
  - non-evidence: real compiler, code sandbox, backend, database, authorization, persistence, WebSockets, concurrency, secure grading, remote players, and completed modules.

  Preserve unrelated compliance evidence and prior verification records.

- [ ] **Step 7: Final review checkpoint**

  Run:

  ```bash
  git diff --check
  git status --short
  git diff -- prototype/game-ui/03-lobby.html \
    prototype/game-ui/04-live-match.html \
    prototype/game-ui/checks/exam-shell-check.js \
    prototype/game-ui/42-subject-compliance.md
  ```

  Confirm that only intended files changed in this run, no screenshot entered the repository, and all unrelated staged/untracked work remains untouched. Do not stage or commit.

## OpenCode Completion Handoff

Before exiting, OpenCode must write `.scratch/opencode-handoffs/latest.md` under the launcher's existing compact handoff contract. In addition to exact tests and results, it must state:

- whether the actual model and variant were verifiable;
- the tested 2v2 and 3v3 URLs;
- the final browser assertion count;
- the screenshot directory outside the repository;
- whether any broader temporary regression script was absent or updated;
- the precise compliance-matrix sections changed; and
- any difference between this plan and the resulting prototype.
