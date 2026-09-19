# Equal Coding Role System Design

Date: 2026-09-19  
Status: Approved design for a throwaway prototype; not production behavior or compliance evidence

## Purpose

Replace the asymmetric Code Writer, Test Operator, and Debug Operator model with a cooperative system in which every player owns a necessary piece of code. The result should retain the tension and clarity of a 42-inspired Exam Shell while giving every participant comparable creative responsibility.

This design covers both 2v2 and 3v3 matches. It defines the gameplay model to test in the next local prototype; it does not define a secure code-execution service.

## Design principles

- Every player writes meaningful solution code.
- No role exists only to test, debug, approve, format, or advise another player's work.
- The complete program depends on every component.
- Everyone sees the complete subject after the match begins.
- Subject details remain hidden before the match begins.
- The two opposing teams receive identical subjects, decompositions, starter code, and time limits.
- The prototype must distinguish simulated behavior from production evidence.

## Rejected role model

The previous hybrid placed the main solution editor with one player while other players owned test and debug consoles. That structure made the solution owner the primary creator and reduced the other roles to reactive helpers. Additional controls or stronger labels would not remove that hierarchy, so the prototype must not preserve it as the selected direction.

## Contract-pipeline approach

Each subject is decomposed into a pipeline of required coding components:

```text
2 players: Component A -> Component B
3 players: Component A -> Component B -> Component C
```

Every component has an explicit input contract, output contract, editable source file, generated stub dependencies, local examples, and integration behavior. Generated stubs let all players begin immediately; nobody must wait for an upstream teammate to finish.

A two-player match receives a separately authored two-component decomposition. It must not reuse the three-player decomposition by assigning two components to one person.

## Match opening

The lobby does not reveal the subject. It offers one broad programming-style card per player slot. Cards may describe styles such as sequence transformation, state management, or constraint logic, but they do not reveal:

- subject text;
- subject-specific component or function names;
- contracts or data flow;
- examples or hidden cases;
- starter code; or
- a difficulty advantage.

Players freely claim one card each and may swap cards until everyone confirms readiness. The two teams see the same cards.

When the match starts, the Exam Shell appears and the shared timer begins. The complete subject is revealed, and every broad card resolves into its subject-specific coding component. All players can then begin simultaneously.

## Subject-specific roles

Roles are not permanent job identities. A subject supplies its own component names and responsibilities while preserving the selected lobby card's broad coding style.

For example, a three-player `packet_router` subject could contain:

- **Packet Decoder:** frame decoding, malformed-input handling, and packet normalization;
- **Route Planner:** weighted route selection and deterministic tie-breaking; and
- **Congestion Controller:** capacity tracking, rerouting, and drop decisions.

The pipeline would be:

```text
decoded packets -> planned routes -> congestion decisions
```

These names are an illustrative subject, not a permanent role catalogue.

## Balance rules

Every authored component must:

- contain meaningful algorithms and decisions rather than glue work;
- be independently developable against generated contract stubs;
- contribute directly to the combined program and shared result;
- have local checks that exercise its own behavior;
- expose integration failures at its contracts;
- target a comparable reasoning and completion-time band; and
- be validated through playtesting rather than line-count targets.

A completed player may inspect teammates' files and offer advice but cannot edit or take over their components. The interface reports a shared team result and must not publicly blame an individual for a failed submission.

## Ownership and visibility

During a subject, every player owns exactly one component:

- the owner can edit that component's source file;
- teammates can read the file live but cannot edit it;
- all players can see the complete subject and pipeline contract; and
- ownership remains locked until the subject ends.

An optional voluntary swap may occur only between subjects. Mid-subject takeovers are excluded because they allow the strongest coder to absorb other players' work.

The selected design has no private role-information panel. Private clues are not part of the core role system.

## Exam Shell gameplay loop

The shared loop is:

```text
subject -> code locally -> run public checks -> integrate -> submit -> result
```

The simulated shell exposes these conceptual actions:

- `subject` shows the complete exercise and assigned components;
- local build and run actions compile one component against stubs and run visible examples or team-authored inputs;
- `integrate` builds the combined pipeline and runs only visible examples and team-authored tests; and
- `submit` performs the consequential hidden evaluation for the whole team.

Submission is unavailable until every component compiles and the declared pipeline contracts connect. Failed submission reports a category such as compile failure, contract mismatch, timeout, or wrong output without revealing a hidden answer. Failure triggers a short team-wide retry cooldown. Passing unlocks the next subject or completes the match.

The match view keeps the shared timer, submission history, team status, and limited opponent progress visible. Opponent source code and detailed failures remain hidden.

## Interface structure

The prototype uses one Exam Shell workspace rather than separate private-role surfaces:

- **Header:** shared timer, current subject, submission cooldown, team progress, and limited opponent progress.
- **Subject panel:** complete exercise text and pipeline contract after reveal.
- **Coding stations:** one tab per component; the assigned tab is editable and teammate tabs are read-only.
- **Local terminal:** build output and visible checks for the selected component.
- **Integration terminal:** combined build, team-authored inputs, contract errors, and submission history.
- **Team strip:** player, component, connection, compile, and local-check states.
- **Submit control:** one shared action with explicit readiness and cooldown states.

At match start, the broad lobby cards visibly transform into their subject-specific component identities. The reveal must be understandable without a separate explanation panel.

## Prototype state model

The local simulation uses this state sequence:

```text
role selection -> ready -> subject reveal -> active
-> integration -> submission cooldown or pass -> finished
```

Each component tracks its owner, edit permission, source text, compile result, local-check result, and integration status. Match-level state tracks subject visibility, timer, shared submission history, cooldown, opponent progress, and final result.

All output is deterministic fake state. Submitted text remains local to the page and is never compiled, executed, persisted, or sent over a network.

## Error and recovery behavior

- Duplicate role claims are rejected before readiness.
- Changing a role clears that player's ready state.
- The match cannot start until both teams are complete and ready.
- A local build failure affects only local readiness and carries no submission penalty.
- An integration failure identifies the broken contract without assigning personal blame.
- A failed hidden submission creates one team-wide failure record and one retry cooldown.
- Editing after a successful local or integration result invalidates the affected readiness state.
- Simulated disconnect state reserves ownership and blocks edits until restoration; it does not transfer the component.

## Prototype scope and security boundary

The next prototype exists to evaluate comprehension, balance, collaboration, and enjoyment. It will:

- provide editable code-like workspaces for 2v2 and 3v3;
- implement one example subject with separately balanced two- and three-component decompositions;
- simulate builds, checks, integration, hidden evaluation, cooldown, and success;
- demonstrate role claiming, reveal, concurrent progress, failure, recovery, and completion; and
- run as a self-contained local artifact with no backend, accounts, network calls, dependencies, or arbitrary code execution.

A real code runner would require a separately approved design for process isolation, filesystem isolation, resource limits, language restrictions, abuse controls, and authoritative evaluation. It is outside this prototype.

## Verification requirements

Automated checks must cover:

- complete 2v2 and 3v3 role selection;
- absence of subject, contract, function, example, and starter-code leakage before match start;
- correct subject and component reveal when the shared timer begins;
- owner-only editing and teammate read-only visibility;
- independent work against generated stubs;
- separation of local checks, integration, and hidden submission;
- readiness invalidation after edits;
- integration failure, submission failure, cooldown, recovery, pass, and final result;
- keyboard operation, visible focus, readable terminal output, responsive containment, and minimum control sizes;
- deterministic state isolation and zero browser console errors;
- absence of external dependencies, network APIs, dynamic code execution, or browser persistence; and
- visible exploration-only, simulated-grader, and non-compliance-evidence labels.

Any screenshots produced during verification must remain outside the repository.

## 42 subject compliance boundary

This role-system prototype may provide design evidence for a clear multiplayer game and for the planned more-than-two-player experience. It cannot prove a complete web game, remote players, real-time synchronization, concurrency correctness, backend validation, persistence, security, or any completed module in `ft_transcendence.pdf`.

The authoritative subject overrides this design if a conflict is found. `prototype/game-ui/42-subject-compliance.md` must be reviewed after implementation and updated only with truthful prototype evidence.

## Implementation workflow

After this specification is reviewed, Codex will write the implementation plan. OpenCode will execute every code and test change through the corrected launcher. Codex will review the resulting diff and handoff; it will not implement the prototype code directly.
