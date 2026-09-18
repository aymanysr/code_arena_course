# Critical Player Journey Prototypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the critical Campus Puzzle Race player journey with throwaway, scenario-driven prototypes for match outcomes, connection recovery, and whole-app wayfinding.

**Architecture:** Keep every prototype as a standalone HTML/CSS/JavaScript file under `prototype/game-ui/`, with fake in-memory state and no network or persistence. Reuse the selected dark-green Operations Console visual language from active-match Variant A and lobby Variant A; scenario parameters explore state behavior without reopening the resolved visual-direction decision.

**Tech Stack:** Semantic HTML, modern CSS, vanilla JavaScript, native `<dialog>`, Playwright-based local verification.

**Spec:** `.scratch/campus-puzzle-race/spec.md`

## Global Constraints

- These files are throwaway primary sources, not production code.
- Active-match Variant A and lobby Variant A are the selected visual direction; keep B/C only as historical alternatives in their existing prototype files.
- Use the domain terms in `CONTEXT.md`: Match, Team, Room, Lobby, Role, Stage, Submission, Failure trace, Retry cooldown, Hint, and Finish delay.
- Keep all state in memory; make no HTTP, WebSocket, storage, authentication, or database calls.
- Do not modify `.scratch/campus-puzzle-race/spec.md`, `CONTEXT.md`, `docs/adr/`, or the deck files.
- After every task, review and update `prototype/game-ui/42-subject-compliance.md` when evidence, scope, assumptions, module claims, or compliance status changed.
- Clearly label every page `Prototype · fake state` and state which production authority would own the real transition.
- Use semantic landmarks and native controls, visible `:focus-visible`, one polite live region, text/icon backups for color, at least 14px text, and at least 44px interactive targets.
- Verify at 1440x1000 and 390x844 with no document-level horizontal overflow or JavaScript console errors.
- Playwright files under `/private/tmp` are disposable verification harnesses only; do not add a test suite or test files to the throwaway prototype directory.
- Preserve the current untracked worktree and add only files named by the active task.

---

### Task 1: Match Outcome and Finish-Delay Prototype

**Files:**
- Create: `prototype/game-ui/outcomes.html`
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Test: `/private/tmp/campus-outcomes-check.js`

**Interfaces:**
- Consumes: match rules from `.scratch/campus-puzzle-race/spec.md`, selected Operations Console visual language from `prototype/game-ui/index.html?variant=A`.
- Produces: `outcomes.html?scenario=win|loss|draw|delay`, `window.__OUTCOME_STATE__()` for browser verification, links to `lobby.html?variant=A` and `journey.html`.

- [ ] **Step 1: Write the browser check before the prototype**

Create `/private/tmp/campus-outcomes-check.js` with Playwright assertions that:

```js
for (const scenario of ["win", "loss", "draw", "delay"]) {
  await page.goto(`${source}?scenario=${scenario}`);
  const state = await page.evaluate(() => window.__OUTCOME_STATE__());
  assert(state.scenario === scenario, `${scenario} state mismatch`);
  assert(await page.getByRole("heading", { level: 1 }).isVisible(), `${scenario} heading missing`);
}
assert(win.result.status === "final" && win.result.winner === "blue", "win not final");
assert(loss.result.status === "final" && loss.result.winner === "coral", "loss not final");
assert(draw.result.status === "final" && draw.result.winner === null, "draw not final");
assert(delay.result.status === "pending" && delay.blue.finishDelayRemaining > 0, "delay not pending");
```

Also assert the delay scenario advances to a final result once, scenario buttons update the URL, the state dialog opens, all scenarios fit desktop/mobile without document overflow, interactive targets are at least 44px, and console/page errors are empty.

- [ ] **Step 2: Run the browser check and verify RED**

Run:

```bash
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-outcomes-check.js
```

Expected: FAIL because `prototype/game-ui/outcomes.html` and `window.__OUTCOME_STATE__` do not exist.

- [ ] **Step 3: Build the four outcome scenarios**

Create `outcomes.html` with the shared state shape:

```js
{
  scenario: "win" | "loss" | "draw" | "delay",
  matchId: "MATCH-C42-014",
  room: "Campus lockdown",
  result: { status: "pending" | "final", winner: "blue" | "coral" | null, persisted: boolean },
  blue: { solvedAt: number | null, hintsUsed: number, finishDelayRemaining: number, eligibilityAt: number | null },
  coral: { solvedAt: number | null, hintsUsed: number, finishDelayRemaining: number, eligibilityAt: number | null },
  lastEvent: string
}
```

Render these exact meanings:

- `win`: Blue is final winner because its eligibility time is earlier and before the deadline.
- `loss`: Coral is final winner; Blue completed later.
- `draw`: exact equal eligibility times produce a final draw.
- `delay`: Blue solved all stages but has a visible 60-second finish delay; the result remains pending and another team can still win.

Include a server-decision explanation, team timelines, hint/finish-delay accounting, one `Advance finish delay` control for `delay`, a result-persisted-once indicator for final states, `Play again` and `Return to lobby` actions, a scenario switcher, a state inspector, and `window.__OUTCOME_STATE__ = () => structuredClone(state)`.

- [ ] **Step 4: Update the compliance matrix**

Add a `Match outcome prototype evidence` entry that records the four exercised scenarios and explicitly says this does not prove durable exactly-once result persistence, server clocks, or concurrency.

- [ ] **Step 5: Run the browser check and verify GREEN**

Run the Step 2 command. Expected output must report 4/4 scenarios on desktop and mobile, zero overflow failures, zero undersized targets, and zero console/page errors.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add prototype/game-ui/outcomes.html prototype/game-ui/42-subject-compliance.md
git commit -m "prototype: explore match outcome states"
```

---

### Task 2: Disconnect, Reconnect, and Interrupted-Match Prototype

**Files:**
- Create: `prototype/game-ui/recovery.html`
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Test: `/private/tmp/campus-recovery-check.js`

**Interfaces:**
- Consumes: active-match terminology and the selected Operations Console structure; result-state ownership from Task 1.
- Produces: `recovery.html?scenario=disconnected|reconnecting|restored|interrupted`, `window.__RECOVERY_STATE__()` for browser verification, links to active match, outcomes, and journey map.

- [ ] **Step 1: Write the browser check before the prototype**

Create `/private/tmp/campus-recovery-check.js` with assertions for this exact progression:

```js
assert(disconnected.player.roleReserved === true, "role must remain reserved");
assert(disconnected.matchClock.running === true, "match clock must continue");
assert(disconnected.privateControls.available === false, "private controls must be unavailable while disconnected");
assert(reconnecting.snapshot.authenticationRequired === true, "reconnect must authenticate again");
assert(reconnecting.snapshot.replayUnacknowledgedActions === false, "actions must not be replayed as new");
assert(restored.privateControls.available === true && restored.snapshot.filteredForRole === true, "role snapshot not restored safely");
assert(interrupted.result.awardsWinOrLoss === false, "interruption fabricated a result");
```

Also assert URL scenario switching, `Continue recovery` transitions, state inspector behavior, desktop/mobile overflow, 44px targets, and zero console/page errors.

- [ ] **Step 2: Run the browser check and verify RED**

Run:

```bash
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-recovery-check.js
```

Expected: FAIL because `prototype/game-ui/recovery.html` and `window.__RECOVERY_STATE__` do not exist.

- [ ] **Step 3: Build the four recovery scenarios**

Use this state contract:

```js
{
  scenario: "disconnected" | "reconnecting" | "restored" | "interrupted",
  player: { name: "Saad", role: "Answer builder", connected: boolean, roleReserved: true },
  matchClock: { running: boolean, remainingSeconds: number },
  retryCooldown: { running: boolean, remainingSeconds: number },
  privateControls: { available: boolean, owner: "Saad" },
  snapshot: { authenticationRequired: boolean, filteredForRole: boolean, replayUnacknowledgedActions: false },
  result: { status: "active" | "interrupted", awardsWinOrLoss: false },
  lastEvent: string
}
```

The UI must keep the match clock and cooldown visible, label Saad's place as reserved, explain that teammates do not inherit private clues or controls, distinguish reconnect authentication from snapshot restoration, and present interruption as `No result recorded · Create a new match`. `Continue recovery` moves disconnected → reconnecting → restored. The interrupted scenario is a separate unrecoverable game-service restart path.

- [ ] **Step 4: Update the compliance matrix**

Record the four recovery states as prototype evidence for the intended UX, while leaving network latency, WebSocket behavior, authentication, snapshot filtering, persistence, and restart behavior marked as production evidence still required.

- [ ] **Step 5: Run the browser check and verify GREEN**

Run the Step 2 command. Expected: 4/4 scenarios on desktop and mobile, every progression assertion passing, zero overflow failures, zero undersized targets, and zero console/page errors.

- [ ] **Step 6: Commit only Task 2 files**

```bash
git add prototype/game-ui/recovery.html prototype/game-ui/42-subject-compliance.md
git commit -m "prototype: explore recovery and interruption states"
```

---

### Task 3: Whole-App Critical Journey Map

**Files:**
- Create: `prototype/game-ui/journey.html`
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Test: `/private/tmp/campus-journey-check.js`

**Interfaces:**
- Consumes: `lobby.html?variant=A`, `index.html?variant=A`, `outcomes.html`, `recovery.html`, and mandatory/claimed-module rows from the compliance matrix.
- Produces: one responsive map that distinguishes built prototypes from planned production surfaces and links every existing prototype.

- [ ] **Step 1: Write the browser check before the map**

Create `/private/tmp/campus-journey-check.js` asserting:

```js
const expectedSteps = ["Account access", "Home", "Lobby", "Live match", "Result", "Profile & friends", "Policies"];
for (const step of expectedSteps) {
  assert(await page.getByRole("heading", { name: step }).isVisible(), `${step} missing`);
}
for (const href of ["lobby.html?variant=A", "index.html?variant=A", "outcomes.html", "recovery.html"]) {
  assert(await page.locator(`a[href="${href}"]`).count() > 0, `${href} link missing`);
}
```

Also assert the map exposes text labels for `Prototype available`, `Production planned`, and `Mandatory delivery`, supports keyboard focus, fits desktop/mobile, has no target under 44px, and emits no console/page errors.

- [ ] **Step 2: Run the browser check and verify RED**

Run:

```bash
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-journey-check.js
```

Expected: FAIL because `prototype/game-ui/journey.html` does not exist.

- [ ] **Step 3: Build the journey map**

Create a non-production navigation map with these nodes and statuses:

```js
[
  { id: "account", title: "Account access", status: "Production planned", requirements: ["Email/password", "42 OAuth linking"] },
  { id: "home", title: "Home", status: "Production planned", requirements: ["Create/join lobby", "Online friends"] },
  { id: "lobby", title: "Lobby", status: "Prototype available", href: "lobby.html?variant=A" },
  { id: "match", title: "Live match", status: "Prototype available", href: "index.html?variant=A" },
  { id: "result", title: "Result", status: "Prototype available", href: "outcomes.html" },
  { id: "social", title: "Profile & friends", status: "Production planned", requirements: ["Profile", "Avatar", "Friends", "Online status"] },
  { id: "policies", title: "Policies", status: "Mandatory delivery", requirements: ["Privacy Policy", "Terms of Service"] }
]
```

Show the primary sequence `Account access → Home → Lobby → Live match → Result`, the recovery branch from Live match to `recovery.html`, and the secondary Profile/Friends and Policies surfaces. Include a legend, a 42 evidence rail naming the mandatory foundation and 17-point module plan without claiming implementation, and a concise `What we know / What remains` section.

- [ ] **Step 4: Update the compliance matrix**

Add the journey map as navigation/design evidence and record that account, home, profile/friends, policy, and production service surfaces remain unimplemented.

- [ ] **Step 5: Run the browser check and verify GREEN**

Run the Step 2 command. Expected: seven nodes and all four prototype links present, desktop/mobile checks passing, zero overflow failures, zero undersized targets, and zero console/page errors.

- [ ] **Step 6: Commit only Task 3 files**

```bash
git add prototype/game-ui/journey.html prototype/game-ui/42-subject-compliance.md
git commit -m "prototype: map the critical player journey"
```

---

### Task 4: Capture the A Decisions and Verify the Prototype Set

**Files:**
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Modify: `prototype/game-ui/lobby.html`
- Modify: `prototype/game-ui/index.html`
- Test: `/private/tmp/campus-critical-journey-check.js`

**Interfaces:**
- Consumes: all prototype files produced by Tasks 1-3.
- Produces: explicit selected-direction labels, cross-links between the prototypes, and one final verification report covering the critical journey.

- [ ] **Step 1: Write the final browser check**

Create `/private/tmp/campus-critical-journey-check.js` that opens these exact URLs at 1440x1000 and 390x844:

```js
[
  "journey.html",
  "lobby.html?variant=A",
  "index.html?variant=A",
  "outcomes.html?scenario=delay",
  "recovery.html?scenario=disconnected"
]
```

For each URL, assert one `<h1>`, the `Prototype` flag, a visible route back to `journey.html` except on the journey page itself, no document overflow, no visible interactive target below 44px, and no console/page errors.

- [ ] **Step 2: Add decision labels and cross-links**

In `lobby.html`, label A as `Selected direction · Team bays` while retaining B/C in the prototype switcher. In `index.html`, label A as `Selected direction · Operations console` while retaining B/C. Add a visible `Journey map` link to both selected A screens without changing their fake game behavior.

- [ ] **Step 3: Capture the validated decisions in the matrix**

Add a `Validated prototype decisions` section with:

- Active match: Variant A, Operations Console.
- Lobby: Variant A, Team Bays.
- Outcomes: one Operations Console shell with scenario-driven server-result states.
- Recovery: reserved roles and continuing clocks, with a separate interrupted-match state.
- Whole-app scope: the seven-node journey map; only Lobby, Live match, Result, and Recovery have prototype evidence.

State that B/C remain historical alternatives and production UI must be rebuilt with tests rather than promoting prototype code directly.

- [ ] **Step 4: Run all focused and final checks**

Run:

```bash
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-game-ui-check.js
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-lobby-check.js
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-outcomes-check.js
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-recovery-check.js
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-journey-check.js
NODE_PATH=/Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/ayousr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/campus-critical-journey-check.js
```

Expected: every command exits 0; each reports zero overflow and console/page errors.

- [ ] **Step 5: Visually inspect final screenshots**

Inspect one desktop and one mobile screenshot for each selected screen. Confirm no clipping, collision with the prototype switcher, unreadable text, misleading production claims, or hidden primary action.

- [ ] **Step 6: Commit only Task 4 files**

```bash
git add prototype/game-ui/index.html prototype/game-ui/lobby.html prototype/game-ui/42-subject-compliance.md
git commit -m "prototype: connect the selected player journey"
```

## Plan self-review

- Spec coverage: Match outcomes, finish delay, ties, disconnect/reconnect, interruption, selected lobby/match directions, subject-facing gaps, and whole-app wayfinding each map to a task.
- Placeholder scan: no deferred implementation markers or unspecified test steps remain.
- Interface consistency: Task 3 and Task 4 use the exact filenames and URL parameters produced by Tasks 1 and 2.
- Scope boundary: no production implementation, backend behavior, approved spec, ADR, or deck change is included.
