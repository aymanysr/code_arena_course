# 12. Frontend Arena port (shell, phases, toolbar discipline)

Status: ready-for-agent
Category: frontend Arena port
Week 2: yes
Blocked by: 03

## Scope

Port the frozen reference shell to React/Vite/TS/Tailwind without shipping prototype code: ArenaHeader, ProblemPanel, CodeWorkspace with the editor seam (textarea behind the seam for week 2; Monaco arrives in 13), EditorToolbar with the single-submit discipline and readiness helper text, the prominent overwrite warning (“Submitting again replaces your current scored result for this round.”) beside the submit control, TestPanel with idle/running/passed/failed plus text statuses, MatchPanel (1v1 duel; 2v2 structure ready), PhaseBanner, RoundScoreReveal with focus management, and event log. Build mock-first against the 03 event catalog, then integrate with the real lifecycle (09). Preserve reference behavior: skip link, keyboard operability, focus-visible styling, live announcements, text-plus-color statuses, readable disabled states, responsive collapse, contrast support.

## Acceptance criteria

- [ ] Reference acceptance set reproduced against mocks (intro gating, idle tests, run transitions, single submit, reveal focus, rotation reset, responsive overflow, zero console errors).
- [ ] Integrated 1v1 duel plays end-to-end against 09 with real judging; sum-of-scores totals shown (not the reference's rounds-won).
- [ ] Editor seam isolates rendering/input so 13 swaps implementations without touching arena logic.
- [ ] Latest stable Chrome, zero console warnings/errors, at 1440/1024/768/320px.

## Notes

Owner area: Amal. Start mock-first in wave 1; integration closes with 09 in wave 3.

## Comments

2026-09-23 (Wave 1 started): recon only, no code yet. No frontend scaffold exists (no `vite.config.*`, no frontend dir; workspaces = `packages/*` + `services/*`, services = chat/core/game). First work: scaffold React/Vite/TS/Tailwind app mock-first (ArenaTransport seam + MockArenaTransport), preserve overwrite warning + sealed-until-reveal, then viewports 1440/1024/768/320 with zero console errors.

2026-09-23 (Scaffold complete, mock-first): `frontend/` (React 19 + Vite 7 + TS + Tailwind v4, workspace-wired, `vite build` clean, preview serves 200). Consumes the CORRECTED model only (`RoundPhase` global + per-side `PlayerStatus`; old 9-phase machine not recreated). Components: ArenaPage/Header/PhaseBanner/Workspace/ProblemPanel/CodeWorkspace/EditorToolbar/EditorAdapter(textarea seam)/TestPanel/MatchPanel/DuelPanel/TeamPanel/ReadyState/TeamChat-stub/RoundScoreReveal(focus-managed)/MatchResult. `ArenaTransport` seam + `MockArenaTransport` (sealed submit, placeholder-based last-wins, explicit dev-only reveal, 2v2 readiness gate, single Submit Team Solution, prominent overwrite warning, skip link, aria-live, text+color statuses). 5 vitest tests green. Deferred to integration: real socket transport, 4-viewport/zero-console Playwright pass, Monaco (13), chat wiring (16).

2026-09-24 (Live integration green with 09): two-client duel plays end-to-end over `SocketArenaTransport` (HTTP actions + socket fan-out → snapshot refresh) with sum-of-scores totals (`you 300 · opponent 84`) and zero console/page errors at 1440/1024/768/320px (`frontend/e2e/live-1v1.spec.ts` 4/4). Transport changes: `adaptReveal()` converts the server `RevealSnapshot` to the viewer-side `RevealView` (was passed through, crashing reveal render); `ArenaPage.tsx` advances from the final-round reveal (`See final result` → `MATCH_COMPLETE` → `MatchResult`); `App.tsx` alerts instead of silently falling back to mock when `?live=1` lacks `VITE_GAME_URL`; `oxlint` clean (one pre-existing raw-color token fixed to the theme scale). Unit cover: `src/arena/socket.test.ts` (3 tests). Still deferred: Monaco behind `EditorAdapter` (13), team chat glue (16), 2v2/presence (14).
