# Game service — local run, env, and known limitations

Scope: game-side only (1v1/2v2 Code Arena matches, lobby, judging, collab,
team chat). Auth is external — see `auth-game-contract.md`. Do not implement
login/JWT/OAuth here.

## Local run (host services + real judging)

```sh
cp .env.example .env            # create once; never commit real secrets
npm ci
npm run typecheck --workspaces --if-present
DATABASE_URL=postgres://postgres:postgres@localhost:5433/arena_test npm test --workspaces --if-present
```

Live browser (game on :3220, web on :4173):

```sh
# terminal 1 — needs Postgres at 5433 and Docker for judging
PORT=3220 DATABASE_URL=postgres://postgres:postgres@localhost:5433/arena_test \
  DEV_PRINCIPAL=true node services/game/dist/main.js
# terminal 2
VITE_GAME_URL=http://localhost:3220 npm run build --workspace arena-frontend
npm run preview --workspace arena-frontend -- --port 4173 --strictPort
# terminal 3
E2E_GAME_URL=http://localhost:3220 E2E_WEB_URL=http://localhost:4173 \
  npx playwright test   # from frontend/
```

## Production-like stack (Compose + Nginx + HTTPS/WSS)

```sh
npm run certs   # self-signed localhost certs (git-ignored); production mounts real ones
# Set JUDGE_WORKER_TOKEN in .env to a private random value before startup.
docker compose up --build
```

The single-host path has been exercised from a fresh Compose container start:
worker and Game readiness, HTTPS Run, two concurrent Submits, hidden evaluation,
and score reveal over WSS, twice in the live 1v1 browser scenario. Both players
used the Nginx HTTPS origin; the browser checked that hidden-marker values were
absent after reveal. Nginx has no judge-worker upstream or route, and a public
request to `/v1/run-visible` returns 404. This proof used the dev identity
fixture and a local self-signed certificate; it is not external-auth or
production-certificate evidence. HTTPS health, HTTP→HTTPS redirect, and the
Game `/collab`, `/chat`, and `/lobby` WSS namespaces are also routed through
Nginx. The standalone Chat service remains a deferred boot/readiness skeleton
and is not routed through Nginx in the first-release gameplay path.
`DATABASE_URL` for game is wired in `docker-compose.yml` from the
`GAME_DB_*` vars (least-privilege role per ADR-0002); without it game
silently falls back to in-memory stores.

## Required env

- `DATABASE_URL` (host runs) — Postgres connection for matches,
  submissions, reveals, lobby, collab docs.
- `VITE_GAME_URL` (frontend build time) — game base URL. No silent
  localhost fallback: `?live=1` without it renders a visible error
  (pinned by `frontend/test/live-config.test.ts`).
- `DEV_PRINCIPAL=true` (dev/test only) — enables the `x-dev-user-id`
  test seam and the dev-only `POST /matches` fixture. Production (real
  auth middleware, seam off) returns 401 without a principal and 404
  for the fixture.
- `RECONNECT_GRACE_MS` (default 90000, spec window 60–90s).
- Judge quotas come from `SPIKE_LIMITS` (see `spikes/judge-isolation/DECISION.md`).
- `JUDGE_WORKER_TOKEN` (Compose required) — private Game↔worker bearer secret;
  generate a random value and keep it out of source control. Compose gives it
  only to Game and the worker; other services do not inherit the `.env` file.
- `JUDGE_DOCKER_SOCKET` — host Docker socket path mounted only into the worker
  (default `/var/run/docker.sock`; set the Docker Desktop socket path if needed).
- `JUDGE_PYTHON_IMAGE` and `JUDGE_GCC_IMAGE` — runner images the worker checks
  before readiness and pulls if absent.
- `JUDGE_WORKER_CONCURRENCY` (2), `JUDGE_WORKER_MAX_QUEUE` (8),
  `JUDGE_WORKER_QUEUE_TIMEOUT_MS` (30000), and
  `JUDGE_WORKER_JOB_TIMEOUT_MS` (900000) — bounded worker capacity and limits.
- `JUDGE_WORKER_TIMEOUT_MS` (930000) — Game's HTTP deadline, slightly longer
  than the worker execution deadline.
- `DEV_PRINCIPAL=false` — test identity/direct-match fixture gate; enable only
  for local E2E, never for a shared or production deployment.

## Judge boundary and host requirements

Compose selects the authenticated `worker` backend explicitly. Game reaches it
over the private `judge-internal` network; it has no published port and Nginx
is not on that network. The worker alone mounts the host Docker socket. It has
no database credentials. The Docker daemon and runner images must be available
before the worker becomes ready; missing images are pulled during startup.
Compose reads `.env` for variable substitution but passes only declared values
to each container: Postgres gets its database bootstrap settings, Game gets
its Game database URL, and only Game and the worker get the judge token.

Each test case runs in a fresh player container. The trusted worker keeps the
expected answer and remaining hidden suite in memory, sends the container only
the source and current input, then compares the captured output itself. Player
containers receive no expected answer, other hidden input, worker token,
service credential, socket, host mount, or Compose network. The current test
input is observable to the program being executed. Containers use
`--network none`, a read-only root, `nobody`, dropped capabilities,
`no-new-privileges`, bounded tmpfs scratch, CPU/memory/pid limits, output
limits, and automatic removal.

The example worker runs two judge requests at once and queues at most eight;
queue saturation, execution timeout, Docker failure, or worker unavailability
is an infrastructure error. Game records the failure, does not count a
submission, and does not silently fall back to another judge. Existing recovery
retries use the same configured backend. Local development still defaults to
`JUDGE_BACKEND=container` and requires Docker plus the Python and GCC images;
Judge0 remains an explicit optional backend.

The host needs a running Docker Engine/Desktop daemon, socket access for the
worker, disk space for the application and runner images, and capacity for the
other Compose services. As an initial single-host allocation, use at least two
CPU cores and 4 GB RAM; two concurrent player containers can each use up to
256 MB and one CPU under the current limits. This is an operating baseline,
not a measured capacity guarantee. Horizontal judge scaling and a separate
judge host remain later work.

## Lobby flow

Public queue (`POST /lobby/queue`, FIFO per mode, per-user admission
serialization, concurrent matchers safe across instances via Postgres
locks) or private rooms (`POST /lobby/rooms` → 6-char invite code,
~30 bits, 20-minute life → join → request side → ready → host start
with full sides + everyone ready). Reconnect reads `/lobby/active`.

## 1v1 / 2v2

1v1: private editor, independent Run/Submit, auto-reveal when both
sides counted. 2v2: one shared Yjs document per team (server is the
authority; client payload ignored at submit), both-teammates-ready
gating bound to the current document revision, team chat + pings on
the `/chat` namespace, no chat in 1v1.

## Known limitations (first release)

- Single-instance realtime: socket fan-out, collab Y.Docs, Game-owned chat
  history (25/room), and rate limits are process-local. Cross-instance
  lobby matching and all HTTP game actions work against shared
  Postgres; live events need sticky sessions or shared pub/sub before
  horizontal scale-out.
- CORS/sockets are permissive (`origin: true`) for local dev behind
  same-origin nginx. AUTH OWNER: when credentialed auth lands, narrow
  to the exact HTTPS origin and require it on all four namespaces.
- 1v1 grace-expiry forfeit is implemented but the spec says no
  forfeits in the first release — TEAM RATIFICATION REQUIRED (behavior
  unchanged until the spec is amended).
- `tests.updated` visible-test status broadcasts to the whole match
  room; the UI only renders the caller's filtered snapshot, so no
  hidden data, source, or score leaks — narrowing delivery is optional
  hardening, not a leak fix.
