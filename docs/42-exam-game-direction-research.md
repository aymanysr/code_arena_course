# 42-inspired game direction research

Date: 2026-09-18  
Status: Research input for team review; not an approved product decision or implementation claim

## Research boundary

This report asks what the public, legitimate 42 exam experience can teach the Campus Puzzle Race about interaction, pressure, progression, feedback, and visual direction. It does **not** reproduce exam subjects, answers, hidden grading rules, selection criteria, or bypass techniques.

The public official sources describe the learning model and exam conditions more reliably than the exact exam-shell interface. Where the evidence does not establish exact commands, editor choice, layout, colors, or copy, this report says so. The recommended product should be described as a **42-inspired cooperative exam simulation**, not an official or pixel-perfect replica.

## Source quality and limits

| Source | Authority | What it establishes | Important limit |
| --- | --- | --- | --- |
| [42 Paris: La Piscine](https://42.fr/admissions/42-piscine/) | Official 42 Paris | Weekly machine exams, increasingly difficult exercises, limited time, no help; C and learning by practice | No exam-shell screen or commands |
| [42 Nice: The Piscine](https://42nice.fr/en/admission/the-piscine/) | Official 42 campus | Four-hour weekly exams, eight-hour final exam, increasing difficulty, individual work without assistance | Piscine-specific; durations are not universal |
| [42 Abu Dhabi student handbook](https://42abudhabi.ae/student-handbook/42-DIGITAL-HANDBOOK_V8-1.pdf) | Official campus handbook | Time-limited computer exams without web or peer communication; typical three-hour Common Core exams; retry; automated Moulinette evaluation for projects; gated rank progression | Describes one campus and distinguishes projects from exams |
| [42: Innovative learning](https://42.fr/en/the-program/innovative-learning/) | Official 42 Paris | Practice, experimentation, failure/retry, peer learning, XP, levels, achievements, coalitions | Curriculum-wide, not a description of the exam UI |
| [42 Lausanne: La Piscine](https://42lausanne.ch/fr/la-piscine) | Official 42 campus | Linux, terminal use, C, problem solving, an intense practical environment | Does not say which exact tools are allowed in an exam |
| [42School Norminette](https://github.com/42School/norminette) | Official public repository | A real 42 command-line tool and terse file-oriented checking workflow | Does not prove Norminette is used in every exam |
| [42-Yerevan-Armenia Exam Rank 02 repository](https://github.com/42-Yerevan-Armenia/Exam_Rank_02) | **Community source** despite the organization name | Reports an exam-shell workflow based on a subject directory, a submission repository, pushing work, status, grading, and finishing | Unofficial, potentially dated, and includes material this project must not reuse |
| [terminal-42s practice shell](https://github.com/terminal-42s/42_examshell) | **Community source** | Shows that students recognize a terminal menu, a `rendu` workspace, and repeated test/submission flow as exam-like | A simulator, not evidence of the official current interface |

## Verified observations

### Interaction model

- Official sources consistently frame the exam as a **computer-based, individual, task-solving session**. 42 Paris says the machine exam presents exercises of increasing difficulty in limited time with no help. The Abu Dhabi handbook says formal computer exams are time-limited and deny web access and peer communication.
- Terminal use is part of the broader Piscine environment. 42 Lausanne explicitly lists Linux and terminal use among the skills encountered. The official Norminette repository also shows a familiar command-line check pattern for files and folders. These facts support a terminal-inspired interaction, but do not prove an exact official exam-shell layout.
- **Community evidence only:** public student repositories describe reading a subject from one location, writing into a dedicated submission tree, committing/pushing, then asking an exam shell to grade. They repeatedly mention a very small command vocabulary for status, grading, and finishing. This is useful directional evidence, not a specification to clone.

### Progression

- 42 Paris describes exam exercises as increasing in difficulty. This strongly supports a one-stage-at-a-time structure whose next stage unlocks only after success.
- The Abu Dhabi handbook describes curriculum progression through ranks and locked projects, including a graphical “Holy Graph.” That is evidence for a rank/map metaphor outside the active challenge. It is not evidence that the exam itself uses a radial map.
- Official 42 curriculum pages use XP, levels, achievements, and coalitions. These cues are authentic to the wider 42 experience, but should sit in the lobby, profile, or post-match layer rather than obscure the active reasoning task.

### Timing and pressure

- Public official durations differ. 42 Abu Dhabi says Common Core exams typically last about three hours; 42 Nice describes four-hour weekly Piscine exams and an eight-hour final. A first-person interview published by 42 Network also recalls four- and six-hour Piscine exams. Therefore, there is no responsible basis for calling one duration universally authentic.
- The stable pattern is more important than the number: a visible finite window, increasing difficulty, constrained help, and pressure to decide when a solution is ready.
- The Campus Puzzle Race should compress that pattern into its planned 15-minute match and label it as a game adaptation. A literal multi-hour session would be poor multiplayer design and unnecessary for resemblance.

### Feedback and retry

- Official sources distinguish automated checking from human peer review in the broader curriculum. 42 Paris describes automated correction plus peer evaluation for Piscine modules; the Abu Dhabi handbook describes Moulinette-style automated evaluation for projects.
- Official 42 pedagogy treats failure as part of progress: test, understand, correct, and try again. The Abu Dhabi handbook says project attempts are unrestricted and failed formal exams can be retaken.
- The official public material does not establish the exact wording, colors, delay, attempt penalties, or detail level of current exam feedback. Any failure trace in this game is a product design choice, not a copied rule.

### Visual cues and constraints

- Verified visual/interaction cues are limited to the broader use of computers, Linux, the terminal, project/rank graphs, and game-like progression. There is no trustworthy public official source here for the exact current exam-shell screen.
- The strongest legitimate visual direction is therefore **functional developer tooling**: monospaced text for code and diagnostics, strong hierarchy, a compact status line, unambiguous pass/fail states, and minimal distraction.
- The official exam constraint is individual isolation. The planned game, however, is intentionally collaborative. Its resemblance should come from task progression, time pressure, machine-like feedback, and terminal language - not from banning communication.

## Design implications for Campus Puzzle Race

| Evidence | Product implication | Confidence |
| --- | --- | --- |
| Increasingly difficult timed exercises | Keep three ordered stages; reveal only the current stage and show the next as locked | High - official |
| Computer/terminal-based practical work | Make the active surface resemble a focused terminal/editor workbench, not an arcade HUD | Medium-high - official environment, inferred UI |
| Automated checks and fail/retry pedagogy | Use an explicit `RUN CHECKS` or `SUBMIT` action, terse machine feedback, then allow correction | High for the loop; exact feedback is inferred |
| Limited assistance in real exams | Make hints scarce, explicit, and costly; do not flood players with tutorial copy during the round | High for the principle; game economy is inferred |
| Solo exam, but team-based 42 projects and peer learning | Split the exam workstation across complementary roles so collaboration is required without exposing every clue | Product adaptation |
| Rank graph and unlock progression | Use a compact three-node rank path in lobby/result screens; keep it secondary during play | Medium - official curriculum cue, inferred placement |
| Variable official exam durations | Keep server-configurable match length and describe 15 minutes as a compressed simulation | High |
| Exact exam UI is not publicly verified | Avoid “official replica” claims, official logos implying endorsement, or copied prompt text | High |

## Recommended game loop

### 1. Briefing and readiness

The lobby frames the match as a simulated machine exam. Players see the team, assigned role, three locked ranks, match duration, hint cost, and the rule that the server is authoritative. Each player confirms readiness.

### 2. Stage unlock

Only Stage 01 is open. The interface presents a short, precise prompt, the allowed operations, the expected output shape, and role-specific material. Later stages appear as locked nodes with no leaked content.

### 3. Inspect and construct

The main view behaves like a shared developer workstation:

- a read-only subject pane;
- a focused answer/work pane using structured controls rather than arbitrary code execution;
- a private role pane;
- a compact team communication rail;
- a persistent status line for stage, remaining time, connection, cooldown, and hint delay.

Players inspect code-like material, trace data, share selected clue cards, and assemble an answer. The role split should make each player necessary without forcing simultaneous physical input.

### 4. Run local checks

Before the authoritative submission, the team may run a small safe check that reports structural problems such as missing input, invalid shape, or contradictory selections. This evokes compile/test iteration without pretending to run arbitrary student code.

### 5. Submit to the evaluator

One teammate sends the assembled answer. The UI shifts briefly into an evaluation state with deterministic, low-drama copy such as `checking 4 assertions...`. The server validates role contributions, answer correctness, timing, and request identity.

### 6. Read the machine feedback

- On success: show `STAGE 01 PASSED`, the server timestamp, and unlock the next stage.
- On failure: show a short failure trace that identifies the failed property without revealing the solution or a teammate's private clue. Keep the planned escalating retry cooldown, while allowing players to keep reading, discussing, and editing.
- On a hint: require the existing second-player confirmation, reveal the hint to the team, and show the accumulated finish delay next to the match clock.

### 7. Progress or finish

Repeat with visibly increasing conceptual complexity. After the final successful check, show `ALL STAGES PASSED` but keep any finish delay explicit. The result screen explains the server-decided eligibility time, opponent outcome, hints, and retries. Post-match, invite discussion and rematch rather than exposing official exam content.

## Visual direction

### Active match: restrained exam workstation

- Use a dark charcoal or very deep navy canvas, warm off-white text, and a high-legibility monospaced face for code, paths, timestamps, and diagnostics.
- Reserve one cool cyan/blue accent for focus and active selection, green for verified success, amber for pending/cooldown/hint cost, and red for failure. Never encode state by color alone.
- Build the page around a rigid grid: subject at left, work surface at center, role/team rail at right, status strip at top or bottom. On small screens, preserve that hierarchy as tabs or stacked regions rather than shrinking code into unreadability.
- Keep the match clock continuously visible but visually quiet until thresholds are crossed. Pressure should come from truthful state, not constant pulsing, shaking, sirens, or simulated emergencies.
- Use terse system messages, file/path motifs, line numbers, check summaries, and a block cursor sparingly. These are design inferences from developer tooling, not claims about the official shell.
- Show `SIMULATION` or `42-INSPIRED` in the shell chrome. Do not present the product as an official 42 examination system.

### Outside the match: broader 42 progression language

- A three-node rank path can communicate Stage 01 -> Stage 02 -> Stage 03 and echo the curriculum's unlock graph.
- Profiles and results may use levels, achievements, team/coalition identity, and history, provided these mechanics are actually implemented and clearly explained.
- Keep these expressive elements outside the central work surface so the reasoning task remains dominant.

## What not to imitate

- **Do not use real exam questions, answer sets, grader internals, leaked subjects, or current exam wording.** Author original C-fundamentals puzzles and verify them independently.
- **Do not claim a pixel-perfect or official replica.** Public official sources do not establish the exact shell commands, editor, typography, colors, or current layout.
- **Do not copy the real exam's isolation rule into the core game.** The Campus Puzzle Race needs team chat, private roles, clue sharing, and three-or-more-player synchronization to satisfy its product and planned module goals.
- **Do not copy multi-hour durations.** Compress the pressure curve for a 15-minute match and make duration configurable.
- **Do not make failure opaque or humiliating.** Provide safe diagnostic feedback and unlimited correction opportunities within the match deadline; do not fabricate real 42 grading penalties.
- **Do not make the terminal aesthetic inaccessible.** Preserve semantic controls, visible focus, screen-reader labels, readable sizes, responsive layouts, and non-color status text.
- **Do not execute arbitrary player-submitted C code in the first release.** The current specification's structured-answer model avoids a large sandboxing/security expansion.
- **Do not award or advertise module credit from visual resemblance.** A prototype or theme is not evidence that a game, multiplayer, real-time, or other subject module is implemented.

## Open questions for team review

1. Should the work pane feel like an editor with cursor navigation, or keep the safer existing structured selections styled as code?
2. Is one optional pre-submit `RUN CHECKS` action useful, or does it reduce the importance of the authoritative submission too much?
3. How much failure detail helps learning without making brute-force guessing optimal?
4. Should Stage 01 always be a gentle confidence-builder, or should all three stages vary by seed within controlled difficulty bands?
5. Which information is private to each role, which may be shared as a clue card, and which becomes public to the team after a failed check?
6. Does team chat remain fully open during retry cooldowns? The current specification says yes; playtesting should confirm that the cooldown creates reflection rather than dead time.
7. Should the three-stage path be linear only, or should the post-launch roadmap explore a Holy-Graph-inspired branch without changing the first release?
8. Which label is clearest in the product: `42-inspired simulation`, `campus machine challenge`, or another phrase that avoids suggesting endorsement?
9. How should the interface communicate both the match countdown and hint-based finish delay without players confusing them?
10. What accessibility alternative should accompany command-like interactions for players unfamiliar with terminal syntax?

## Compatibility with `ft_transcendence.pdf`

The authoritative local subject is [`../ft_transcendence.pdf`](../ft_transcendence.pdf), version 21.2. The direction above remains compatible if implementation preserves the following boundaries:

- The subject allows any creative web application that meets the requirements and explicitly lists online games and real-time collaborative applications as examples. A C-fundamentals team puzzle game is therefore a valid concept; resemblance to an exam is theme and interaction design, not a separate compliance category.
- The mandatory product still needs a real frontend, backend, database, responsive and accessible UI, secure email/password accounts, frontend and backend validation, concurrent multi-user correctness, containerized one-command startup, HTTPS/WSS for external backend access, relevant policy pages, latest stable Chrome support, and clean browser console output.
- The planned complete-game claim requires live matches with clear rules and win/loss conditions. The recommended loop supplies clear stages and outcomes, but only production behavior can prove the module.
- Remote-player and multiplayer claims still require separate-computer play, latency/disconnection handling, reconnection, three-or-more-player fairness, and proper synchronization. A terminal look contributes no evidence toward these obligations.
- Real-time, user-interaction, user-management, framework, microservices, and OAuth claims retain their own complete demonstrations. None should be inferred from this research or from prototype screens.
- Original puzzle templates must avoid undefined or platform-dependent C behavior, validate generated solutions before play, and never expose another role's private data through feedback.
- The subject requires honest team contributions and documentation. This report is Aimane's research proposal for discussion and may be changed by the team; final decisions, owners, implementation, and evidence belong in the approved specification, tracker, README, and compliance matrix.

## Recommended immediate decision

Adopt the **restrained exam workstation** as the next prototype direction, while keeping the current game rules unchanged for the first playtest. Prototype one original stage with the loop `inspect -> collaborate -> run safe checks -> submit -> read trace -> retry/unlock`, then test it with a real 2v2 group. Use that session to decide the editor-versus-structured-control question before researching more visual polish.
