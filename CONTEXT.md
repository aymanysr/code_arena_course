# Code Arena

A competitive coding game in which two players (1v1) or two two-player teams (2v2) solve the same sequence of programming problems under time pressure. Each round presents one problem; players check their code against visible examples, submit solutions to a sealed hidden judging suite, and per-round scores are revealed after evaluation. The side with the highest summed total across rounds wins the match; tied totals break by lower total scoring-submission time, then fewer total submissions, then a draw (per `.scratch/code-arena/spec.md`, deliberately deviating from the frozen reference's rounds-won display).

Authoritative interaction reference: `prototype/game-ui/09-arena.html` (frozen). Production re-implements its state model and UX behavior; it never ships prototype code.

Supersedes the 2026-09-17 campus puzzle-race glossary (room, stage, role, clue card, hint, finish delay, retry cooldown) following the 2026-09-23 pivot. Those terms are retired unless a future decision reintroduces them.

## Language

**Match**: One timed competition between two sides solving the same round sequence. Sides are two players (1v1) or two two-player teams (2v2).

**Round**: One problem within a match. A match has a fixed round count (three in the reference). Each round rotates to a new problem and resets code, visible tests, and readiness; only the match score carries over.

**Problem**: A coding task with a statement, examples, constraints, and starter code per language (C++, Python, C in the reference). Production problems come from a checked problem bank.

**Run**: A neutral check of the current code against visible examples only. It never touches the hidden suite and never changes the score.

**Submission**: An explicit solution sent for evaluation against the hidden suite. Allowed only during `CODING`; in 2v2 only when both teammates are Ready. It locks the solution for evaluation.

**Hidden suite**: The sealed competitive tests that decide the score. Never shown during play; the group breakdown is disclosed only at reveal.

**Reveal**: The per-round score disclosure (percentages plus hidden-group breakdown) shown after evaluation completes.

**Readiness**: The 2v2 submission gate. Each teammate marks Ready independently; the team's submit action enables only when both are Ready. Readiness resets every round.

**Presence**: Connectivity information (`online` / `offline`), modeled separately from gameplay status.

**Player status**: Gameplay state of one player. One of `coding`, `running`, `submitted`, `evaluating`, `locked in`, `disconnected`. It is the source of truth; presence never doubles as status.

**Match phase**: The authoritative match state. `ROUND_INTRO` → `CODING` → (`RUNNING_TESTS` → `CODING`)* → `SUBMITTED` → `EVALUATING` → `SCORE_REVEAL` → next round or match end. Only `CODING` permits Run and Submit.

**Match persistence**: The durable module for Match/Round records, Submissions, Reveals, shared team documents, and failure history. The Match authority decides whether a transition is valid; Match persistence decides how accepted state becomes durable. Presence, transport, Lobby queues, and judge execution remain outside this module. The first implementation preserves the current JSONB schema and uses Postgres and in-memory adapters behind the same interface.

**Match authority**: The module that guards trusted-principal membership, serializes short Match commands, stamps committed revisions, and exposes the current Round. It is the final authorization point for gameplay commands. It does not execute judge work, speak Socket.IO, or know database adapter details; those concerns enter through explicit seams.

**Round lifecycle**: The domain module behind `ArenaEngine` that owns Match/Round phase transitions, reveal preparation and publication state, round resets, Game-side verdict scoring, cumulative totals, and final-result tie-break calculation. It does not persist records, execute untrusted code, or emit transport events; the facade supplies those seams around its state decisions.

**Team collaboration**: The Game-owned 2v2 domain module behind `ArenaEngine` that owns Yjs document loading, authoritative source revisions, readiness invalidation, language resets, atomic document persistence/rollback, submission snapshots, and masked team views. It does not own Match locking or transport events; the facade supplies those seams around its document decisions.

**Arena transport**: The frontend interface for authoritative Match snapshots and commands. `SocketArenaTransport` is the production adapter for HTTP actions, Socket.IO events, reconnect, stale-revision handling, and submission/evaluation request identifiers; it retains one unconfirmed submit key for a safe retry. `MockArenaTransport` is a fixture adapter over `MockMatchAuthority`. `TransportSession` owns connection state and subscriber delivery. Arena UI modules depend on the interface, not on either adapter. Sticky sessions or shared pub/sub remain required before horizontal realtime scale-out.

**Socket authorization context**: The Game-owned module that parses the trusted Socket.IO handshake seam once, attaches a verified `SocketPrincipal`, and makes namespace handlers consume stored identity instead of raw client fields. Match-scoped namespaces still ask `GameService` for their own membership and capability decisions; the lobby authenticates the user before authorizing each private room.

**Match socket presence**: The Game-side module that counts live sockets per user and Match, applies the first-socket/last-socket policy, and delegates durable 1v1 side or 2v2 member presence to the Match authority. It does not know NestJS, Socket.IO gateways, or database details.

**Arena sidecar lifecycle**: The frontend module that creates, replaces, preserves, and disposes live collaboration and team-chat clients around an Arena transport scope. Collaboration is round-scoped; chat is Match-scoped. Arena UI components consume the resulting clients without owning factory cancellation or cleanup policy.

**Evaluation orchestration**: The Game workflow that accepts an immutable submission/evaluation request under the short Match lock, claims one pending evaluation through `MatchPersistence`, runs the judge outside that lock, and commits the verdict under a fresh lock on the claim owner's PostgreSQL session. A same-identity retry waits only after releasing the lock and receives the original success or judge error; a reused identifier with different submission data is rejected. PostgreSQL session advisory locks prevent two live Game processes from owning one pending evaluation concurrently; if a session dies after judge start, takeover may re-drive the row but the stale owner cannot commit. A separate claim pool preserves ordinary persistence capacity and lost claim sessions leave rows reclaimable, while broader cross-process Match mutation coordination remains a follow-up.

**Judge job**: A provider-side execution of one Evaluation. One Evaluation can have more than one Judge job after recovery, but only the durable Evaluation outcome affects Match state.

**Match revision conflict**: A stale ordinary Match snapshot attempted to save
after another Game process committed a newer revision. Persistence rejects the
write with a 409-shaped `MatchRevisionConflictError`; the frontend refreshes
authoritative state and does not replay the command automatically.

**Evaluation telemetry**: Process-local rollout evidence for provider name,
queue wait, execution duration, outcome, and infrastructure errors. It never
changes Match state and does not make scheduling decisions.

**Lobby**: The pre-match gathering where players assemble sides and ready up. Entry flow (invitation code and/or matchmaking) is still an open production decision; the reference starts at round intro.

_Avoid_: Using room, stage, role, or clue card (retired puzzle-race terms). Using run to mean grading. Exposing hidden tests or scores before the reveal.
