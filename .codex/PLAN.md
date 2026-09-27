# Make judging work in the single-host Compose stack

Status: approved handoff; the stale learning-popup plan was replaced with the
user's supplied judging scope on 2026-09-26.

## Spec

Implement the user's 2026-09-26 request in this thread. Run judging through an
internal worker in Docker Compose. Game remains responsible for submissions,
scores, and recovery. A player process may see only the current test input;
expected answers and other hidden cases stay in trusted worker memory.

Required outcomes:

1. `ContainerJudge` runs one case per isolated container and compares output in
   the trusted process. Hidden expected answers and whole-batch data do not go
   in player-container environment variables or `/scratch`. Preserve C, C++,
   Python, resource limits, and the existing `GameJudge` result types.
2. Add a small authenticated internal HTTP worker implementing `GameJudge`, a
   bounded queue, and readiness checks for Docker and required language images.
   Only the worker receives Docker socket access. Player containers receive no
   socket, Compose network, service credentials, or host mounts.
3. Add a Game client adapter and select it in Compose. Keep the local runner for
   development tests. Worker failure must not silently fall back. Do not expose
   the worker through Nginx.
4. Update `docs/game-local-run.md`, the judging ADR, `.env.example`, and
   `prototype/game-ui/42-subject-compliance.md` using only results actually
   demonstrated.
5. Add adversarial tests proving submitted code cannot inspect expected answers
   or other hidden cases, and cannot forge a pass verdict. Run the existing
   Docker isolation matrix and C/C++/Python verdict tests. Test worker auth,
   queue limits, timeouts, Docker failure, and recovery without a counted
   phantom submission. From clean Compose startup, exercise Run → Submit →
   hidden evaluation → reveal through HTTPS/WSS, then repeat under concurrent
   submissions. Run workspace tests, typecheck, build, lint, and record
   environment-gated checks separately.

Assumptions: the target is one Docker host; the worker is a privileged host
boundary; separate-host execution and horizontal scale-out are later work.
Judge0 remains optional and is not the selected Compose route.

## Verified starting point

- `ContainerJudge` currently batches an evaluation into one container, sends
  base64 `IDS`, `INP`, and `EXP` values in environment variables, writes all
  cases into shared `/scratch`, and consumes the container's `passed` field.
- Game constructs `ContainerJudge` directly for its default backend and already
  supports optional `Judge0Adapter`; `JudgeInfraError` preserves non-counting
  infrastructure-failure and recovery semantics.
- Compose has no judge worker. Game has no Docker socket, and judging from the
  Compose stack is documented as unavailable. Nginx has no worker route.
- `GameJudge` is the existing application contract and supports visible runs
  and sealed evaluation. Existing Docker matrix tests cover C/C++/Python and
  sandbox limits.
- The compliance record explicitly identifies the batch-data confidentiality
  gap and says the exploit was not run. Do not claim the gap is closed until
  new adversarial tests and deployment checks have actually passed.
- The shared workspace is on `master` with extensive pre-existing staged,
  unstaged, and untracked work. Preserve all unrelated state; do not reset,
  stage, commit, or clean it. The user explicitly authorized implementation in
  this workspace when approving replacement of this handoff.

## Global constraints

- Follow root `AGENTS.md`, the authoritative `ft_transcendence.pdf`, and the
  existing `GameJudge` result/error contracts.
- Write each behavior test before its production implementation and observe its
  intended failure before proceeding.
- Keep local `JUDGE_BACKEND=container` and optional Judge0 behavior available.
  Compose explicitly selects `worker`; missing/unhealthy worker is an
  infrastructure failure, never a fallback.
- Only the worker has a Docker socket mount. Worker has no public port and is
  absent from Nginx. Game and worker communicate on a dedicated internal
  Compose network, and receives only its explicit worker configuration, not
  the full `.env` service credential set. Player containers use `--network
  none`, no bind mounts, no credentials, no socket, and only one case's input.
- After project changes, review `prototype/game-ui/42-subject-compliance.md`;
  update it in this change if evidence, assumptions, scope, or compliance
  status changed. Never promote a 42 module claim based on partial tests.
- Do not modify or reformat unrelated staged/user files.

## Task 1 — Per-case trusted verdicts

**Goal:** Replace batch execution with one container per case and host-side
output comparison while preserving verdicts and resource controls.

**Interfaces:** consumes `GameJudge`, `VisibleTest`,
`SealedEvaluationRequest`; produces unchanged `CaseResult` and sealed group
results.

**Steps (RED → GREEN):**

1. Add a Docker-independent fake-runner test that makes a container emit a
   forged `passed: true` result alongside incorrect output; assert host verdict
   is false. Add assertions that calls are per-case and no expected answer,
   case IDs for other tests, or other test inputs are supplied to a container.
2. Run that focused test and confirm the current implementation fails because
   it trusts container verdicts / batches case data.
3. Add Docker adversarial tests that inspect inherited environment and
   `/scratch` across a sealed suite with unique expected/input markers; current
   input may be visible, expected answers and all other cases must not be.
4. Rework `ContainerJudge` to execute each case in a fresh container; keep the
   case's expected output in the trusted caller and compute `passed` only by
   comparing captured contestant output after execution. Preserve compile,
   runtime, timeout, memory, output, and infrastructure classifications.
5. Run focused fake-runner tests, Python/C/C++ verdict tests, then the full
   existing Docker isolation matrix.

**Expected:** forged runner metadata cannot create a pass; each player process
has one input only; all prior supported verdicts and isolation limits remain.

## Task 2 — Worker queue and authenticated API

**Goal:** Add `services/judge-worker` with an internal authenticated HTTP API,
bounded queue, request/body limits, operation timeout behavior, and Docker/image
readiness checks.

**Interfaces:** request payloads use existing `GameJudge` method arguments and
return types; only the worker invokes `ContainerJudge`.

**Steps (RED → GREEN):**

1. Add queue tests for concurrency cap, queue-full rejection, queue timeout,
   execution timeout, and slot recovery after success/failure.
2. Run the queue tests and confirm missing queue behavior causes the intended
   failures.
3. Add API tests for missing/wrong/correct bearer token, bounded requests,
   timeout/error mapping, and Docker/image readiness failure then recovery.
4. Implement queue, HTTP handlers, constant-time token comparison, payload
   validation/body cap, readiness probe, and worker startup. Never log judge
   request bodies or return hidden tests in error messages.
5. Run focused worker tests and worker typecheck/build.

**Expected:** only authenticated Game requests can use judge methods; overload
and infrastructure failures are explicit and recoverable; no queue path
fabricates a competitive result.

## Task 3 — Game worker adapter and failure semantics

**Goal:** Add a `GameJudge` HTTP adapter and backend selection while retaining
the local runner and optional Judge0.

**Interfaces:** adapter implements the existing `GameJudge` contract; Game
selection returns `GameJudge`.

**Steps (RED → GREEN):**

1. Add adapter tests for auth header, visible/sealed round trips, HTTP errors,
   timeout, and `JudgeInfraError` mapping; add a Game selection test for
   explicit worker configuration and fail-closed missing config.
2. Run the new tests and observe failures before implementation.
3. Implement `WorkerJudgeAdapter` and select it only when
   `JUDGE_BACKEND=worker`; local default remains `container`; unsupported or
   missing worker configuration fails startup. Do not retry via another
   provider.
4. Test that a failed worker request uses existing recovery/failure semantics
   and leaves the submission uncounted; verify recovery retries through the
   same configured worker with no phantom score.
5. Run focused engine, adapter, and Game service suites/typecheck.

**Expected:** worker outages/timeouts remain `JudgeInfraError`; Game never
falls back and does not count an infrastructure failure as a submission.

## Task 4 — Compose topology, image startup, and health

**Goal:** Run a private worker in Compose with exclusive Docker socket access,
preloaded required images, readiness healthcheck, and an internal-only network.

**Interfaces:** Compose supplies worker URL/token to Game and token/image/queue
configuration to the worker.

**Steps (RED → GREEN):**

1. Add a topology/config validation check for worker-only socket mount, no
   published ports, Game+worker internal network, Game's worker backend, and
   healthy dependency. Run it against current Compose and observe failure.
2. Add worker Dockerfile/startup checks that wait for Docker and pull missing
   fixed language images through the worker's socket; add `/ready` healthcheck
   requiring Docker and both images.
3. Configure Compose with Game on default+internal networks, worker on the
  internal network only, and no Nginx route. Ensure no socket/host mount is
  inherited by player containers. Route the existing `/matches` and `/lobby`
  frontend API paths through Nginx to Game so the same HTTPS origin can carry
  the established WSS Socket.IO path; keep the worker unrouted.
4. Validate rendered Compose configuration and service builds.

**Expected:** clean startup waits for Docker/images before Game becomes
available; worker is reachable only by Game over the internal network.

## Task 5 — Evidence and deployment docs

**Goal:** Update the local run guide, judging ADR, environment example, and
42-subject compliance record to match tested behavior.

**Steps:**

1. Re-read relevant mandatory subject requirements and the current compliance
   record before editing.
2. Document single-host trust boundaries, socket privilege, network/mount/env
   isolation, queue capacity, per-container CPU/memory/pid quotas, image and
   host resource needs, startup, token setup, and failure behavior.
3. Amend the judging ADR with per-case trust boundary, Compose worker decision,
   queue/readiness, and retained Judge0/local alternatives.
4. Update compliance evidence only for tests and deployment flows actually
   demonstrated; leave all 42 module statuses unchanged.
5. Review `git diff --check` and the complete affected compliance section.

**Expected:** docs no longer claim Compose judging is unavailable or that
hidden data is visible, but any unexecuted check remains explicitly
environment-gated.

## Task 6 — End-to-end and workspace verification

**Goal:** Verify the complete requested workflow and report any environment
gate separately.

**Steps:**

1. Run focused Docker security matrix and C/C++/Python verdict tests.
2. Start a clean Compose stack and verify worker remains unexposed and
   authenticated; play Run → Submit → hidden evaluation → reveal through
   HTTPS/WSS, then repeat with concurrent submissions.
3. Run workspace test, typecheck, build, lint, Compose config validation, and
   `git diff --check`.
4. Re-read this plan, root instructions, affected ADR/docs, and
   `prototype/game-ui/42-subject-compliance.md`; record exact passed and
   environment-gated evidence.

**Expected:** all executable checks pass; any blocked Docker/Compose check is
reported without being represented as a pass.

## Review focus

- Can any submitted process recover expected answers, another hidden input,
  worker credentials, Docker API access, Compose DNS/network access, or host
  files by inspecting env, argv, `/proc`, `/scratch`, `/tmp`, or mounts?
- Can any runner-controlled `passed` or status field override trusted
  comparison? Can protocol text from contestant stdout be parsed as control?
- Can queue overload, timeout, worker restart, or Docker failure count a
  phantom submission or silently fall back?
- Is the worker reachable through Nginx or another public service?
- Do docs/compliance distinguish tests run here from tests still gated by the
  host's Docker/HTTPS setup?
