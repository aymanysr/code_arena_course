Type: research
Status: resolved
Blocked by: none

## Question

Campus constraints + defense reality: single-command `docker compose up --build` cold-start races, 8-service (13–15 containers, 2.8–4.2GB idle, 6.5–8GB spike) vs 3-grouped-service (6–7 containers, ~550MB) vs monolith RAM/build-time tradeoff, TLS/WSS on 443, zero console errors, Ch. VIII live-code-change drill (4–8min rebuild = failure point)?

AFK — resolve via `/research` subagent, capture on `research/<name>` branch, link from here.

## Answer

- Single-command `docker compose up --build` rated NON-COMPLIANT high risk: NestJS crash-loop if PG/Redis/RabbitMQ not ready; fix is healthcheck + depends_on service_healthy. Agenda baseline already drops RabbitMQ/gRPC for single PG16 + Redis-only + Nginx.
- Tradeoff table: 8-svc 14–15 containers / 1.4GB idle (table) vs 2.8–4.2GB idle + 6.5–8GB spike (summary, contradiction) / 4–7min build / EXTREME defense risk; 3-grouped 6–7 / ~550MB / ~1.5min / VERY LOW (keeps 2pt microservices claim); monolith 3 / ~220MB / ~35s / NONE (0pts). Campus 8–16GB + cgroup quotas + OOM/freeze claim is uncited.
- TLS/WSS 443 COMPLIANT via Nginx self-signed + 80→443, must use wss://. Zero console errors AT RISK (hydration, WS reconnect spam, favicon 404, CORS). Ch. VIII drill: 14-container+gRPC rebuild 4–8min inside ~45min defense = fail; React+Vite HMR mitigates, Next SSR worsens.
- .env COMPLIANT conditional (.env.example + gitignore). Framework COMPLIANT conditional (custom Canvas/WebGL, no turnkey engine). Git balance OPERATIONAL RISK: 15–25%/member, 8-way siloing risk. Implicit: Privacy/ToS unauthenticated, ip_hash + Redis pub/sub + PG pooling (+redis-adapter if multi-replica).
- Team votes needed: arch (8 vs 3 vs mono), ratify PG16+Redis-only+healthcheck gates, media (volume vs MinIO +150–200MB), auth (stateless JWT vs RPC), frontend for drill (<2min live-edit), scope control (17pt + qa-service fate controls service count), ops gates (env/zero-error/privacy/concurrency/commit-balance/cold-start rehearsal on 8GB box).
