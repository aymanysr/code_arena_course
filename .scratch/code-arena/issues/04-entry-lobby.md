# 04. Arena entry and lobby (mode select, invite code, ready-up)

Status: closed (COMPLETE) (2026-09-24; PostgreSQL atomicity/race proofs and live 1v1/2v2 entry verified)
Category: 1v1 match lifecycle (entry)
Week 2: yes
Blocked by: 02, 03

## Scope

The one Arena entry point the reference lacks: mode selection (1v1/2v2), private invitation-code lobby creation/joining (code identifies the lobby, never authenticates), team/side assembly, readiness per player with change-clears-ready semantics, host start gate (full sides, all ready), and clear rejection of full/started joins. Emits the canonical model events from 03; every join/action authenticates separately.

## Acceptance criteria

- [x] Authenticated player creates a lobby, shares a code, others join; full/started joins rejected with clear feedback.
- [x] Mode select 1v1/2v2; start blocked until sides are full and all players ready; readiness changes broadcast live.
- [x] Lobby hands a started 1v1 match to the lifecycle (09) with correct sides and round-1 problem.
- [x] Concurrent joins/ready races cannot overfill a side or start twice.

## Notes

2v2 sides assemble here in week 3 (14 builds on this); week-2 scope is the 1v1 path working end-to-end.

## Comments

2026-09-24: Completed and verified after auditing the Antigravity handoff. Canonical private-room semantics are full sides + everyone ready + host start, overriding automatic start in the pasted brief. Auth remains external via the existing trusted-principal seam; Ticket 16 remains accepted COMPLETE.

Implemented persistent public FIFO and private rooms for 1v1/2v2, with atomic authoritative match creation and lobby linkage, exclusive admission, side/readiness race protection, membership-checked reads/subscriptions, departure revocation, and persisted recovery. Rebuilt the preview with an explicit game URL and corrected false-positive Arena heading assertions.

Evidence: 24/24 focused lobby tests (12 unit, 12 real PostgreSQL), 6/6 lobby service/socket tests, 7/7 lobby browser scenarios including 1v1 Run/Submit/reveal and 2v2 editing/chat isolation, plus 8/8 existing Arena browser regressions. Typecheck, UI lint, builds and diff checks pass. The workspace suite passes 296 tests; environment-gated lobby database tests run separately.

See [verification record](../ticket-04-verification.md) for exact commands, database schema, red/green defects, match IDs, changed-file manifest and limits. Local HTTP test evidence does not establish production HTTPS/WSS or complete any subject module. Ticket 17 owns the remaining deployment/security/load/compliance gate. No commit made.
