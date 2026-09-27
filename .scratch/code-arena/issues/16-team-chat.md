# 16. Game-owned team chat and quick pings

Status: COMPLETE — HARDENING OPEN (2026-09-25)
Category: team chat/pings
Week 2: no
Blocked by: none (original implementation dependencies 04, 09 are satisfied)
Primary owner: Amal
Contingency owner: Aimane if Amal misses the team's agreed delivery checkpoint

## Scope

Match-scoped 2v2 team chat plus quick pings in the Game service's `/chat` namespace: Game-verified conversation membership (fail closed), authenticated members only, message identifiers for idempotency, history on rejoin (feeds 11), and connection-state UI with retry that never marks messages delivered until acknowledged. No chat in 1v1. Ordinary text rendered as text, never executable HTML. The standalone `services/chat` app is deferred and is not part of this ticket's runtime path.

## Acceptance criteria

- [x] Team-only messages and pings send/receive live within a match; outsiders and opponents cannot read or post (direct-request and forged-socket tests).
- [x] Membership failures close the conversation rather than leaking; history restores on rejoin.
- [x] Human ownership confirmed: Amal is primary; Aimane is the contingency owner if the agreed delivery checkpoint is missed. No duplicate implementation is planned.

## Notes

Week 3. Game-owned transport and membership isolation are implemented and covered by the existing service/browser tests. Durable Game-owned history and cross-instance fan-out remain hardening work; the deferred Chat skeleton is not a substitute for that work.

## Comments

None yet.
