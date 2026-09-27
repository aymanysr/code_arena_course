# 11. Reconnect and recovery (reservation, grace window, resume)

Status: ready-for-agent
Category: reconnect/recovery
Week 2: no
Blocked by: 02, 09

## Scope

Disconnect tolerance for live matches: place reserved until match end with timers continuing; `reconnectGraceSeconds` (default 90, configurable 60–90) for seamless resume; beyond grace the player is marked disconnected while the reservation stands and the side may continue short-handed; no first-release forfeits. Reconnect re-authenticates (02) and restores the filtered snapshot (code/shared doc, visible tests, readiness, chat, penalties) without replaying unacknowledged actions. Covers refresh, expired auth mid-match, and realistic delay.

## Acceptance criteria

- [ ] Disconnect inside grace resumes seamlessly with identical filtered state; outside grace resumes marked-disconnected with reservation intact.
- [ ] Timer and match progress continue through disconnects; no action is double-applied on rejoin.
- [ ] Reconnect without valid re-authentication is rejected; opponents never observe private state in transit.
- [ ] 1v1 and (with 14/15) 2v2 resume paths tested.

## Notes

Week 3. 09 must not crash or stall on disconnects in week 2, but full grace/resume lives here.

## Comments

2026-09-24 (IMPLEMENTED per pasted Ticket-11 brief — needs team review on one scope point): presence owns connectivity (`Presence` online/offline per side, persisted on the match; socket loss never rewrites activity); `PlayerStatus.disconnected` REMOVED from the model/transitions/tests/frontend mirror (engine never set it; forfeit is a terminal match outcome, not a side status). Reconnect = join room first, then ONE authoritative socket snapshot baseline; every mutation bumps persisted `MatchRecord.revision` (derived in the match lock, never hand-placed) carried on snapshots + all event payloads; client drops stale revisions/older-round events and stale refresh responses. Snapshot covers matchId/mode/round/totals/problem/phase/clock/activities/presence/caller runTests/submission counts/pendingEvaluation flag/sealed reveal/terminal final — no opponent source, no hidden tests. Boot `recover()`: presence offline with fresh grace, transient repair (running/submitted→coding, evaluating kept only with a pending row), interrupted reveal flip finished from the persisted immutable reveal or unwound, pending submissions re-driven once under original ids (commit guarded terminal-aware so parallel recovery cannot double-count). Grace default 90s (spec 60–90 window, `RECONNECT_GRACE_MS` env-configurable); expiry → 1v1 `MATCH_COMPLETE` forfeit (earliest-offline side), leave → immediate forfeit; finalResult/snapshot.final carry the override. Multi-tab policy A (online until last socket drops). Frontend: connecting/connected/reconnecting/offline header states, actions disabled while down (editor stays editable), localStorage draft keyed by match/round/problem/language, manual socket re-handshake on browser `online` (socket.io does not self-heal after real outages — probed), Leave button with confirm, forfeit-aware MatchResult. SCOPE DEVIATION: the brief orders 1v1 grace-expiry forfeit, but spec §Reconnect + this ticket's scope both say "no forfeits in the first release" (marked-disconnected instead). Implemented per brief; spec amendment required to ratify. Auth untouched (DEV_PRINCIPAL seam). Tests: engine `test/reconnect.test.ts` 19 (injected clock), service `src/game/reconnect.test.ts` 10 (real WS + PG + SIGKILL + grace), Playwright `e2e/reconnect.spec.ts` A–D 4/4 + existing 1v1 suite 4/4 widths still green. No commit per instruction.
