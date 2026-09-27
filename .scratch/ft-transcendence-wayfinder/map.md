## Destination

PIVOT 2026-09-23: the production game is Code Arena (1v1/2v2 code battles, `09-arena.html` frozen as the interaction reference). The campus puzzle-race direction below is historical. Current decisions: [decisions-2026-09-23.md](decisions-2026-09-23.md). Current spec: [.scratch/code-arena/spec.md](../code-arena/spec.md). Puzzle-specific issues 01–07 are superseded; open production questions move to code-arena tickets.

Current context: [2026-09-17 design decisions](decisions-2026-09-17.md) records the approved campus puzzle-race direction and three-service architecture, with remaining questions. Read it before using the historical notes below; its v21.2 scoring corrections supersede the v14.1 research conclusions.

Team alignment locked for `ft_transcendence` — the 4-person team can vote yes/no on the 6 agenda decisions + theme twist. Spec writing (`/to-spec`) is explicitly out of this map.

## Notes

- Domain: 42 `ft_transcendence` Subject v21.2, challenged baseline in `docs/architecture_compliance_research.md` + `docs/team_decision_agenda.md`.
- Skills every session should consult: `/grilling`, `/domain-modeling`; `/research` for AFK tickets, `/prototype` if theme needs a concrete artifact.
- Standing preferences: re-open all 6 decisions + theme (no infra kept as fixed); 4 members with balanced commits (~15–25% each); single-command `docker compose up --build`; HTTPS/WSS; zero console errors.

## Decisions so far

- [08-subject-module-catalogue](issues/08-subject-module-catalogue.md) — agenda 17 scores ~13–14 under v14.1; OAuth/2FA/LiveChat are Majors, Tournament Minor + phantom modules invalid; need v21.2 PDF to close 19-cap.
- [09-campus-defense-constraints](issues/09-campus-defense-constraints.md) — 8-svc RAM/build numbers contradictory + uncited; team must vote arch, media, auth, frontend-for-drill, scope, ops gates.

## Not yet specified

- Tournament format details (bracket vs round-robin, matchmaking flow).
- AI opponent scope if Pong kept (difficulty, server-side bot fairness).
- Live chat + moderation scope (channels, DM, block, invite, filter).
- Stats dashboards + gamification depth.
- GDPR pages (privacy policy, terms, data export/delete UX).
- Commit-balance workflow across services (avoid siloing in microservices).
- Visual universe depth for theme twist (how far beyond skins?).

## Out of scope

- Implementation / code — this map produces decisions, not deliverables.
- Spec writing — `/to-spec` collapse happens after the map clears, not inside it.
- Anything past the 19pt cap (14 mandatory + 5 bonus max) — surplus points are deadweight.
