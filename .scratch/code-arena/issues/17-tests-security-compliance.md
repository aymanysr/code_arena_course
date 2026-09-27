# 17. Cross-cutting tests, security, and compliance

Status: TECHNICALLY COMPLETE — AWAITING TEAM SIGN-OFF (2026-09-25; evidence below, no commit per instruction)
Category: tests/security/compliance
Week 2: yes (1v1-scope verification; continues as final gate)
Blocked by: none

## Scope

Transversal verification that runs alongside every wave and gates the freeze: reference-parity browser checks, judging leak/payload assertions, state-machine and concurrency tests (simultaneous submits, readiness races, concurrent matches, exactly-once results), access tests (opponent code, hidden tests, private endpoints, forged sockets), multi-client play tests, delivery checks (one-command startup, persistence, HTTPS/WSS, Chrome console, responsive/keyboard/policy pages), and the compliance-matrix + README trail per AGENTS.md (update the matrix in the same change whenever evidence, scope, claims, assumptions, or status change; never present planned behavior as implemented evidence).

## Acceptance criteria

- [ ] Week-2 gate: 1v1-slice verification green (parity set, judging isolation, state/concurrency/access tests for the slice, clean startup, zero console errors).
- [ ] Final gate: full spec section 8 (verification and acceptance) green, every claimed module demonstrated, README and policy pages complete.
- [ ] Compliance matrix current with this work; evaluation rehearsal performed.

## Notes

Starts in wave 0 (scaffolding, parity harness) and never closes until freeze. Defense rehearsal included.

## Comments

2026-09-23 (Wave 0): harness skeleton implemented as `packages/arena-harness/` — `JudgePort` seam (+ `DEFAULT_LIMITS`), `FakeJudge` (fixture-only verdict heuristic + injected failures, documented for replacement by 06), `MockGame` (in-memory 1v1 lifecycle on arena-model transitions/scoring), fixtures (real `even-ledger` bank record as round 1 + two boring micro-problems + scripted shutout opponent), and 8 vitest tests green: mocked full 1v1 proof path (300–0 final), idle/run/reset test states, cataloged events, starter-code 0-score partial credit, submit-receipt sealing, run/submit failure capture back to `CODING`, and generic problem-bank validation (schema keys, starters, weights=100, provenance). TDD caught one real protocol bug during this work: submit-failure recovery needs the `SUBMITTED → CODING` unlock edge — now explicit recovery-only semantics in 03 with the no-verdict-no-lock rule pinned in 08.

2026-09-24 (Ticket 16 hardening carry-forward):
- Game `/chat` ephemeral history buffer and rate limiters are process-local; multi-instance behavior (multiple game pods) needs final review before horizontal scaling.
- `clientMessageId` exists on the chat message ingress but server-side lost-ack message idempotency has not been proven end-to-end; review and test in Ticket 17.


2026-09-24 (Ticket 04 completion carry-forward; see `../ticket-04-verification.md`):
- Lobby database correctness is tested: atomic match/queue/room commit, rollback injection, per-user admission serialization, concurrent matchers, cancel/start/ready/side/fill races. Final load/fairness testing remains; per-mode matcher serialization has not been capacity-benchmarked.
- Lobby notification fan-out and request limiters are process-local. Verify multi-instance Socket.IO delivery and shared limit enforcement before horizontal scaling.
- Private invite codes have 30 bits of entropy and a 20-minute lifetime. Per-principal mutation limiting is present; distributed brute-force/load testing remains.
- Direct HTTP local E2E is not production transport evidence. Current Nginx/frontend configuration still needs an end-to-end HTTPS/WSS and one-command deployment proof, including socket path/namespace routing.
- Review immutable bank-version enforcement and the existing development-only direct `POST /matches` fixture at the external-auth deployment boundary. Do not implement auth in this ticket.
- Keep Ticket 16 accepted COMPLETE. Its existing process-local history/rate-limit and lost-ack idempotency findings remain hardening notes only.

## Comments

2026-09-25 (Ticket 17 execution — full report in chat; files changed listed
there; no commit per instruction):

Prior-session state found on entry: an unfinished `cross-isolation` engine
test (did not typecheck), a stray `frontend/.env` breaking
`live-config.test.ts`, and no compose/HTTPS/WSS proof. Continued from there.

Baseline now green: typecheck 0 errors, lint 0 warnings, engine 163/163
(incl. Postgres lobby-atomic), harness 19, model 68, game service 45/45
(incl. 2 new tests), frontend 32/32, frontend + service builds clean,
`git diff --check` clean, Playwright 26/26 (1v1 4 widths, 2v2, collab +
reconnect matrices, lobby, team chat, reconnect A–D).

Defects found and fixed (3 + 1 deletion):
1. `ContainerJudge` synthesized fake graded verdicts when the docker binary
   was missing (ENOENT fell into the numeric-exit fallback) — a compose
   submit would have counted a phantom attempt. String-code launch failures
   now raise `JudgeInfraError` (no counted result, unlock to CODING).
   Pinned by a no-docker unit test.
2. Game Docker image omitted `packages/problem-bank/problems`, so every
   compose match formation 500d. Image now ships the JSON data.
3. `POST /matches` direct creation reachable with any principal. Now 404s
   unless `DEV_PRINCIPAL=true` (lobby mints internally; E2E unaffected).
   Pinned by unit tests.
4. Deleted stray `frontend/.env` (ambient localhost URL poisoning unit
   tests; E2E/preview builds pass `VITE_GAME_URL` explicitly).
Flake fixes (no production change): fork-bomb TLE allowlist; 2v2
auto-reveal poll like the 1v1 suite. Added: chat lost-ack idempotency test
(implementation already deduped; now proven).

Deployment proven: clean `docker compose up --build`, HTTPS health +
HTTP→HTTPS redirect + WSS (game/collab/chat/lobby, auth-closed
handshakes) through nginx, public-queue 1v1 start→run through the proxy,
in-container judge failure path (500 safe error, CODING preserved, no
reveal/count), clean `docker compose down`. New `docs/game-local-run.md`
holds run/env/judge/lobby/limitation notes + auth-owner handoff
(CORS narrowing, socket-mount decision).

Multi-instance (2 services, 1 PG): cross-instance matching + all HTTP
actions SUPPORTED; socket fan-out/collab/chat-history/rate-limits
LIMITED (process-local). Load: 30 joins → 15 exact matches, no
dupes/500s. Yjs 3000-edit probe acceptable (3.45× state, 9 ms re-apply).

Team decisions still required: forfeit/spec conflict (spec: no
first-release forfeits; 1v1 grace-expiry forfeit implemented), production
auth integration, judging-in-Compose socket mount, README and policy pages
(root `README.md` absent; no production Code Arena policy pages yet), and
module sign-off (compliance rows intentionally NOT flipped). The compliance
matrix (`prototype/game-ui/42-subject-compliance.md`) is canonical for the
remaining-gap list.
