# Pivot to Code Arena (code battles)

Recorded 2026-09-23 from the user's explicit decision. This record supersedes the 2026-09-17 campus puzzle-race direction everywhere the two conflict. It is a decision record, not an implementation specification.

## Decision

- The production game is **Code Arena**: competitive coding battles in **1v1** and **2v2** modes.
- `prototype/game-ui/09-arena.html` is the **approved interaction reference** for the production game: its state model (`MatchMode` / `MatchPhase` / `PlayerStatus`), phase-gated Run/Submit rules, single-toolbar submit with the 2v2 readiness gate, idle → running → passed/failed visible tests, sealed hidden suite with per-round reveal, and round rotation with readiness reset must be preserved in production behavior.
- The prototype file itself is **frozen**. Production re-implements its behavior in the real architecture; prototype code never ships.
- The campus puzzle-race direction (C-fundamentals escape room, roles, clue cards, stages, hints, cooldowns, structured answers, no code execution) is **superseded**. Its prototypes (`03-lobby.html` role lobby, `04-live-match.html` exam shell, `05-outcomes.html`, `06-recovery.html` as specified) and the `campus-puzzle-race/spec.md` draft become historical evidence, not the production path.

## What stays (no conflict)

- Stack: React, Vite, TypeScript, Tailwind frontend; NestJS for Core and Game plus a deferred Chat skeleton; PostgreSQL, Redis, Nginx, Docker Compose.
- Service shape: core (accounts/auth/profiles/friends/avatars), Game (match authority and first-release match chat), deferred Chat skeleton. Game-service responsibility details change (see below); the longer-term service boundary remains available.
- ADR-0002 (one PostgreSQL container, three separate databases/credentials, no cross-database access).
- Auth direction: email/password plus 42 OAuth with explicit linking; signed tokens verified locally by Game on the first-release path, with the deferred Chat boundary retained for later activation.
- Avatar validation/storage approach (core validates, persistent volume, Nginx serves).
- Reliability principles: authoritative server state, idempotent submissions via request identifiers, reconnection with reserved place and filtered snapshot, interrupted (never fabricated) results on game-service restart.
- 17-point module package and mandatory foundation (re-mapped to the arena game in the new spec).
- Team roles, with one ownership change: Aimane owns game rules, the problem bank, judging, and the game service (was: puzzles). Saad, Amal, and the supporting developer keep their areas.

## What changes

- Game service owns: problems/rounds, visible-run orchestration, hidden-suite judging orchestration, readiness, phase transitions, scoring, and results. Roles, clue cards, templates, traces-as-designed, and hint/cooldown mechanics are dropped.
- New required component: an **isolated judging component** for executing untrusted player code (visible runs and hidden evaluations). Constraints recorded in ADR-0003; mechanism selection is an implementation-plan decision.
- Chat scope shrinks to team text chat plus quick pings (no clue cards, no solution-adjacent sharing). First-release transport and authorization live in Game; the standalone Chat skeleton is deferred.
- Milestones are re-planned around the arena (see new spec); the week-2 "complete multiplayer puzzle" checkpoint becomes a complete playable duel.
- Lobby/entry flow is open again: invitation-code lobbies carry over as the default proposal, but the arena reference starts at round intro, so the entry UX needs design.

## Supersession map

| Artifact | Status after pivot |
| --- | --- |
| `decisions-2026-09-17.md` | Historical; superseded where conflicting, preserved for the decisions that stay |
| `.scratch/campus-puzzle-race/spec.md` | Superseded; replaced by `.scratch/code-arena/spec.md` |
| `CONTEXT.md` (puzzle glossary) | Replaced by the Code Arena glossary |
| `03-lobby.html`, `04-live-match.html` exam shell, `05-outcomes.html`, `06-recovery.html` | Frozen historical prototypes; reusable patterns only (shell layout, reservation policy, result-persistence rule) |
| `09-arena.html` | Frozen approved interaction reference |
| Wayfinder issues 01–07 | Puzzle-specific content superseded; open production questions move to code-arena tickets |
| ADR-0001/0002 | Stand, with the game-responsibility amendment noted in ADR-0001 |

## Open production questions at the 2026-09-23 snapshot

Judging mechanism and sandboxing depth; problem-bank sourcing and licensing; round count, timers, and tiebreaks; lobby vs matchmaking entry; realtime event protocol; scoring edge cases (forfeits, draws); fourth contributor identity. These go to the implementation plan and dependency-linked tickets, not into this record. Chat ownership was resolved by the follow-up amendment below.

## Resolved defaults (2026-09-23, user direction)

Checked against `ft_transcendence.pdf` v21.2 and the standing decisions above. No hard-constraint conflicts found. Recorded in `.scratch/code-arena/spec.md` (resolved defaults 1–12):

- One Arena entry point with mode selection (1v1/2v2); invitation-code lobbies carry over; no first-release matchmaking.
- Default match = 3 rounds; round score 0–100% from weighted hidden groups; **match result = sum of round scores** — a deliberate deviation from the frozen reference's rounds-won display (rationale in the spec deviation log; reference file unchanged).
- Tie-breaks: lower total scoring-submission time, then fewer submissions, then draw. Speed never reduces correctness.
- 2v2: one shared document, one team submission, one team hidden-test result, one team score.
- Run = visible/example/custom tests only; Submit = sealed hidden suite; scores and group breakdown hidden until `SCORE_REVEAL`.
- Reconnect: place reserved until match end (standing principle kept); 60–90s grace window (`reconnectGraceSeconds`, default 90, configurable) for seamless resume; no first-release forfeits.
- Problem bank curated/internal, never copied third-party content; languages C++, Python, C.
- OAuth/account-linking outside the critical Arena path (email/password only on the gameplay path; OAuth module still claimed, non-blocking for Week 2).
- Match-scoped team chat owned by the chat service per ADR-0001 (the then-current assumption; superseded by the 2026-09-25 follow-up amendment); human owner (Amal proposed) still to confirm at this snapshot.
- Judging mechanism stays an implementation-spike decision; the contract must require CPU/time/memory/output/process limits and isolation (ADR-0003 amended).
- Week 2 target: one complete playable 1v1 duel end-to-end before full 2v2 collaboration.

Genuinely blocking decisions remaining: **none**. Confirmations still wanted but non-blocking at this snapshot: fourth contributor identity (README only), 42 OAuth app registration timing (week-1 ops), `MATCH_DURATION` 30:00 proposal (spec review).

## Wave-0 greenlight clarifications (2026-09-23)

- `MATCH_DURATION` is one **match-wide** 30-minute clock shared across all three rounds (faster competitive feel), not per-round. A per-round timer would be named `ROUND_DURATION`; no such timer exists. Recorded in spec default 11.
- Tie-break 1 is the sum, across rounds, of the elapsed server time at which each side achieved its **final (counted) round score** — the timestamp of the submission that set the score standing at reveal. This works at 100%, 78%, or 42% alike because it keys off the counted score, not perfection. Fewer submissions stays second. Recorded in spec default 4.
- Sum-of-scores requires the normalization invariant: every round normalized 0–100 with equal match weight. Recorded in spec default 3.
- The Week-2 exit proof is the full loop: problem loaded → player codes → Run visible tests → Submit → isolated judge executes hidden suite → verdict/group scores returned → game service owns match state + reveal → next round → final result. 2v2 then extends this proven loop; it is not a second architecture.

## Follow-up amendment (2026-09-25)

The earlier open question about chat ownership is resolved. For the first-release Code Arena runtime, Game owns match-scoped team chat and quick pings through its `/chat` Socket.IO namespace, including membership authorization and team-room isolation. Amal is the primary implementer; if she misses the team's agreed delivery checkpoint, Aimane takes over the Game-owned path. This is a contingency handoff, not duplicate parallel work.

The standalone `services/chat` application remains a deferred boot/readiness skeleton. It is not part of the first-release gameplay path, and the existing process-local Game history is not durable-chat evidence. The authoritative follow-up is recorded in ADR-0001, ADR-0002, `.scratch/code-arena/spec.md`, and ticket 16.
