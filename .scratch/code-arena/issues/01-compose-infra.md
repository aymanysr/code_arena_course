# 01. Compose infrastructure (frontend, services, Postgres, Redis, Nginx, HTTPS)

Status: ready-for-agent
Category: foundation
Week 2: yes
Blocked by: none

## Scope

One-command local production stack per the spec components table: React/Vite/TS/Tailwind frontend build, Core and Game as first-release NestJS runtime services plus the deferred Chat skeleton, one PostgreSQL container hosting the service database boundaries with separate credentials (ADR-0002), Redis for expiring presence/session-revocation data, and Nginx as the only public entry terminating HTTPS/WSS and proxying APIs and sockets. Game owns the first-release `/chat` namespace. Secrets in a Git-ignored local env file plus a clean `.env.example`. Internal backend traffic stays on the private network.

## Acceptance criteria

- [ ] `docker compose up --build` starts the full stack from a clean checkout after documented configuration.
- [ ] Only Nginx is publicly exposed; HTTPS/WSS verified for browser and API traffic.
- [ ] Each service reaches only its own database with its own credentials (negative check included).
- [ ] No secrets committed; `.env.example` boots without credentials.
- [ ] Data persists across container recreation where durable data exists.

## Notes

Follows the carried-over stack decision. Judging-component hosting is stubbed here and decided in 06 (contract must not require infra rework — leave a documented attachment point).

## Comments

2026-09-23 (Wave 0): Implemented. npm workspaces (`packages/*`, `services/*`); `arena-model` builds to `dist` and resolves in every service. Minimal NestJS skeletons (core/game/chat) expose only `/health` (liveness + `modelPhases: 9` proving shared-package runtime resolution) and `/ready` (TCP dials to postgres/redis). Compose: postgres:17 (init-db.sh creates 3 DBs + least-privilege roles), redis:7, nginx (443 only public, self-signed dev certs via `npm run certs`, `/api/*` proxying). Verified from clean checkout: `docker compose up --build` → all healthy; HTTPS through nginx for all three `/health`; `/ready` true; `core_db/game_db/chat_db` + roles present. Boot: `cp .env.example .env && npm run certs && docker compose up --build`. No gameplay logic anywhere in the stack. CI lane added (install/typecheck/test). Frontend (12) and judging (06) attach later at documented points.
