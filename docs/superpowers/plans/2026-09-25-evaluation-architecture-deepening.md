# Evaluation Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deepen Code Arena evaluation orchestration, make ordinary Match writes revision-safe across Game processes, add Judge0 as an optional execution adapter, and capture enough execution telemetry to defer scheduling until load evidence requires it.

**Architecture:** `ArenaEngine` remains the compatibility facade for authorization, short Match locks, and event emission. A deep Evaluation orchestration module owns submission identity, in-flight retries, durable claims, Judge jobs, recovery, and verdict commit coordination. `MatchPersistence` owns optimistic revision enforcement. `ContainerJudge` remains the default adapter while a self-hosted Judge0 adapter stays optional and provider-specific.

**Tech Stack:** TypeScript, Vitest, PostgreSQL JSONB, Node `fetch`, Docker-backed `ContainerJudge`, optional Judge0 HTTP API, React/Vite transport tests.

**Spec:** `CONTEXT.md`, `docs/adr/0003-sandboxed-code-judging.md`, `docs/adr/0004-game-match-persistence-module.md`, `docs/adr/0007-round-lifecycle-module.md`, `docs/adr/0011-evaluation-idempotency-lock-boundary.md`, and `/private/tmp/architecture-review-20260925-judge-evaluation.html`.

## Global Constraints

- Preserve `MatchRecord`, `SubmissionRecord`, public receipts, and the existing PostgreSQL JSONB schema.
- Keep the 42 subject-module matrix honest; architecture deepening is not evidence for a new module point.
- `ContainerJudge` remains the default backend until Judge0 passes contract, security, and equivalence tests.
- Judge0 is self-hosted on a dedicated internal Linux execution host; network execution is explicitly disabled.
- One game Evaluation may produce more than one provider-side Judge job after recovery; stale provider results never publish Match state.
- Backend selection is per Game process; no automatic mid-Evaluation fallback between adapters.
- Do not add a scheduling module until load testing demonstrates queue delay, unfairness, or capacity failure.
- Run `npm run typecheck --workspaces --if-present`, `npm run build --workspaces --if-present`, the affected Vitest suites, `npm run lint --workspace arena-frontend` for frontend changes, and `git diff --check` before completion.
- Review `prototype/game-ui/42-subject-compliance.md` after every project change and update it in the same change if evidence, scope, assumptions, or compliance status changes.

## Review Focus

- Two Game processes submit the same `evaluationId`: one live owner judges; the other waits/replays, and a stale owner cannot commit.
- Two Game processes mutate one Match: stale revision writes fail with a conflict instead of overwriting a newer Match.
- Judge0 accepts a job and the Game process dies: recovery re-drives the Evaluation safely without exposing provider tokens or fabricating a terminal verdict.
- Hidden-suite execution returns provider output or statuses: the adapter normalizes results and never leaks hidden inputs, expected outputs, or raw provider payloads to the browser.
- Judge backend rollout changes execution behavior: configuration selects one backend per Game process, with no silent fallback and a tested local default.

### Task 1: Deepen Evaluation orchestration

**Files:**
- Create: `packages/arena-game/src/evaluation-orchestration.ts`
- Create: `packages/arena-game/test/evaluation-orchestration.test.ts`
- Modify: `packages/arena-game/src/engine.ts`
- Modify: `packages/arena-game/src/index.ts`
- Modify: `packages/arena-game/test/submit-path.test.ts`
- Modify: `packages/arena-game/test/reconnect.test.ts`

**Interfaces:**
- Consumes: `GameJudge`, `MatchPersistence`, `MatchAuthority`, `RoundLifecycle`, `MatchRecord`, `SubmissionRecord`, `EvaluationClaim`, and the existing short-lock callback.
- Produces: an internal Evaluation orchestration module used by `ArenaEngine`; it exposes the existing submit/recovery behavior without changing `ArenaEngine.submit`, `ArenaEngine.recover`, public receipts, or record schemas.

- [ ] **Step 1: Write characterization tests for the extracted workflow**

  Add tests that prove the current behavior through the existing `ArenaEngine` seam:

  ```ts
  it("shares one evaluation workflow between Submit and recovery", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const input = { code: SOLVED_PY, language: "Python", submissionId: "sub-in-flight", evaluationId: "eval-in-flight" };
    const first = engine.submit(left, matchId, input);
    await tick();
    const retry = engine.submit(left, matchId, input);
    judge.release(P100);
    await expect(Promise.all([first, retry])).resolves.toHaveLength(2);
    expect(judge.evalCalls).toBe(1);
  });

  it("leaves a pending row recoverable when verdict persistence fails", async () => {
    await expect(engine.recover()).rejects.toThrow("verdict persistence unavailable");
    expect((await submissions.getByEvaluationId(pending.evaluationId))?.status).toBe("pending");
  });
  ```

- [ ] **Step 2: Run the focused tests before extraction**

  Run `npm test --workspace arena-game-engine -- --run packages/arena-game/test/submit-path.test.ts packages/arena-game/test/reconnect.test.ts`.

  Expected: the existing tests pass; the new characterization tests fail only because their fixtures are not yet wired.

- [ ] **Step 3: Move Evaluation-only state and workflow into one implementation**

  Move `EvaluationCompletion`, `InFlightEvaluation`, claim acquisition/release, stored-verdict evaluation, failure persistence, commit persistence, and pending recovery from `engine.ts` into `evaluation-orchestration.ts`. Keep these rules together:

  ```ts
  export interface EvaluationRunInput {
    matchId: string;
    roundId: string;
    sideId: SideId;
    submissionId: string;
    evaluationId: string;
    problemVersionId: string;
    hiddenSuiteId: string;
    language: SupportedLanguage;
    source: string;
    documentRevision: DocumentRevision | null;
  }

  export interface EvaluationRecoveryReport {
    retried: number;
    failed: number;
  }
  ```

  `ArenaEngine` supplies authorization, short Match-lock entry, event emission, and the already-created submission context. The new module owns identity checks, in-flight promises, durable claims, Judge invocation, recovery classification, and claim-session commit coordination. `RoundLifecycle` remains the scorer and phase-rule module.

- [ ] **Step 4: Replace duplicate Submit/recovery paths with the extracted module**

  Delete the moved private helpers from `engine.ts`, keep `submit()` and `recover()` as compatibility facade methods, and route both through the new implementation. Preserve the existing `skipFinalSave` claim-commit rule and the `Judge job` crash semantics.

- [ ] **Step 5: Run the focused and full engine suites**

  Run `npm test --workspace arena-game-engine` and `npm run typecheck --workspace arena-game-engine`.

  Expected: all existing engine tests and the new orchestration tests pass with no public receipt changes.

### Task 2: Make ordinary Match mutations revision-safe

**Files:**
- Create: `packages/arena-game/test/match-revision.test.ts`
- Modify: `packages/arena-game/src/store.ts`
- Modify: `packages/arena-game/src/persistence.ts`
- Modify: `packages/arena-game/src/postgres-store.ts`
- Modify: `packages/arena-game/src/match-authority.ts`
- Modify: `packages/arena-game/src/engine.ts`
- Modify: `packages/arena-game/test/concurrency.test.ts`
- Modify: `packages/arena-game/test/postgres.test.ts`
- Modify: `services/game/src/game/errors.ts`
- Modify: `frontend/src/arena/socket.ts`
- Modify: `frontend/src/arena/socket.test.ts`

**Interfaces:**
- Consumes: current `MatchAuthority.withLock` and `MatchPersistence.saveMatch` calls.
- Produces: `MatchRevisionConflictError` with code `409`; a persistence-level compare-and-save path using the existing `MatchRecord.revision`; no new table, column, or public receipt field.

- [ ] **Step 1: Write failing in-memory and Postgres race tests**

  Pin both conflict behavior and unchanged winner behavior:

  ```ts
  it("rejects a stale second Match write", async () => {
    const first = await persistence.loadMatch(matchId);
    const second = await persistence.loadMatch(matchId);
    first!.presence.left = "online";
    await persistence.saveMatch(first!, 0);
    second!.presence.right = "online";
    await expect(persistence.saveMatch(second!, 0)).rejects.toBeInstanceOf(MatchRevisionConflictError);
  });
  ```

  Add the same race against two `PostgresStores`/two `ArenaEngine` instances when the local PostgreSQL test container is available.

- [ ] **Step 2: Run the new tests to verify the conflict path fails**

  Run `npm test --workspace arena-game-engine -- --run packages/arena-game/test/match-revision.test.ts packages/arena-game/test/concurrency.test.ts`.

  Expected: the tests fail because persistence currently accepts ordinary stale writes.

- [ ] **Step 3: Add compare-and-save to the persistence seam**

  Add an optional expected revision to the internal store/persistence save path:

  ```ts
  saveMatch(match: MatchRecord, expectedRevision?: number): Promise<void>;
  ```

  In memory, compare the stored revision before replacing the record. In PostgreSQL, update the existing JSONB row with a revision predicate and throw `MatchRevisionConflictError` when no row matches. Keep unguarded creation writes valid for new Match records.

- [ ] **Step 4: Route locked Match commits through the compare-and-save path**

  Make `MatchAuthority.withLock` retain the revision observed at lock entry and pass it to the final durable Match commit. Audit nested `saveMatch` calls in `ArenaEngine`; convert them to in-memory mutations followed by the authority-owned final commit or pass the current lock revision explicitly so no ordinary production write bypasses the compare-and-save rule.

- [ ] **Step 5: Surface conflicts without silent retries**

  Preserve HTTP 409 mapping through `EngineErrorFilter`. Update `SocketArenaTransport` so a 409 refreshes the authoritative snapshot and then rethrows the stale-command error; it must not replay a non-idempotent command automatically. Add a frontend test for refresh-on-conflict.

- [ ] **Step 6: Run persistence, concurrency, service, and frontend verification**

  Run `npm test --workspace arena-game-engine`, `npm test --workspace arena-game`, `npm test --workspace arena-frontend -- --run`, `npm run lint --workspace arena-frontend`, and `npm run typecheck --workspaces --if-present`.

### Task 3: Add an optional Judge0 adapter

**Files:**
- Create: `packages/arena-game/src/judge0.ts`
- Create: `packages/arena-game/test/judge0.test.ts`
- Modify: `packages/arena-game/src/index.ts`
- Modify: `packages/arena-game/src/judge.ts`
- Modify: `services/game/src/game/game.service.ts`
- Modify: `.env.example`
- Create: `docs/judge0-local.md`

**Interfaces:**
- Consumes: existing `GameJudge`, `SealedEvaluationRequest`, `JudgeLimits`, `ExecutionStatus`, and the new Evaluation `Judge job` terminology.
- Produces: `Judge0Adapter implements GameJudge`; injected HTTP client and clock seams for deterministic tests; configuration-selected backend with `ContainerJudge` as the default.

- [ ] **Step 1: Write failing adapter contract tests with an injected fake HTTP client**

  Cover token creation, polling, timeout, status normalization, hidden-result sealing, grouped-result aggregation, and provider failure:

  ```ts
  it("maps one logical hidden Evaluation into grouped sealed results", async () => {
    const judge = new Judge0Adapter({ http: scriptedJudge0Http([{ status: "Accepted", stdout: "" }]) });
    await expect(judge.evaluateSealed(request)).resolves.toEqual({ groups: expectedGroups });
  });

  it("turns provider timeout into JudgeInfraError without leaking the provider token", async () => {
    await expect(judge.evaluateSealed(request)).rejects.toBeInstanceOf(JudgeInfraError);
  });
  ```

- [ ] **Step 2: Run the adapter tests to verify they fail**

  Run `npm test --workspace arena-game-engine -- --run packages/arena-game/test/judge0.test.ts`.

  Expected: fail because the adapter and injected client do not exist.

- [ ] **Step 3: Implement the provider-specific adapter**

  Use Node `fetch` through an injected HTTP client. Submit bounded adapter-owned execution work, keep Judge0 tokens/statuses private, poll or consume callbacks inside the adapter, and return only `CaseResult[]`/grouped `SealedGroupResult[]` through `GameJudge`. Map accepted, compile, runtime, time, memory, output, process, and provider-internal states into the existing `ExecutionStatus` taxonomy.

  The adapter must set explicit limits, an allowlisted language mapping, `enable_network: false`, and bounded polling. It must never expose hidden inputs, expected outputs, raw provider responses, or tokens to `ArenaEngine`, the browser, or public receipts.

- [ ] **Step 4: Add process-level backend selection without fallback**

  Add `JUDGE_BACKEND=container|judge0`, `JUDGE0_URL`, and the private credential/configuration fields to `.env.example`. `GameService` chooses exactly one backend at startup; absent configuration continues to construct `ContainerJudge`. A Judge0 failure becomes `JudgeInfraError`; it does not silently invoke the other adapter.

- [ ] **Step 5: Add conformance and rollout tests**

  Reuse the existing `GameJudge` behavior tests against the fake Judge0 adapter and `ContainerJudge` where Docker is available. Add an integration-gated test that proves two retries use the game `evaluationId` and that a stale Judge job cannot publish a result after claim loss.

- [ ] **Step 6: Document the deployment hardening**

  In `docs/judge0-local.md`, document dedicated-host deployment, internal-only access, explicit network disablement, version pinning, allowed languages, resource limits, queue monitoring, and the fact that Judge0 is execution-only while the Game owns Match truth.

### Task 4: Add execution telemetry without a scheduler

**Files:**
- Create: `packages/arena-game/src/evaluation-telemetry.ts`
- Create: `packages/arena-game/test/evaluation-telemetry.test.ts`
- Modify: `packages/arena-game/src/evaluation-orchestration.ts`
- Modify: `packages/arena-game/src/engine.ts`
- Modify: `services/game/src/game/game.service.ts`

**Interfaces:**
- Consumes: Evaluation start/completion events and provider measurements from either Judge adapter.
- Produces: an in-process telemetry module that records provider, queue wait, execution duration, outcome, and infrastructure error counts without changing Match records or adding scheduling decisions.

- [ ] **Step 1: Write failing telemetry tests**

  ```ts
  it("records provider, wait, execution, and terminal outcome", () => {
    const telemetry = new EvaluationTelemetry();
    telemetry.record({ provider: "container", queuedMs: 12, executionMs: 81, outcome: "accepted" });
    expect(telemetry.snapshot()).toEqual({ accepted: 1, queuedMs: 12, executionMs: 81, providers: { container: 1 } });
  });
  ```

- [ ] **Step 2: Implement telemetry as an internal observation seam**

  Keep metrics side-effect-free for Match state. The orchestration module emits one observation after a completed verdict or infrastructure failure; adapters report measured provider timing, while scheduling remains absent.

- [ ] **Step 3: Expose safe diagnostics for local operation**

  Log or expose only aggregate counts and durations through the existing Game process diagnostics. Never include source, hidden tests, expected outputs, provider credentials, or Judge0 tokens.

- [ ] **Step 4: Run telemetry and full verification**

  Run the focused telemetry/orchestration suites, all workspace typechecks/builds, the frontend lint/tests, the Game-service suite, and `git diff --check`.

### Task 5: Record architecture evidence and compliance

**Files:**
- Create: `docs/adr/0012-evaluation-and-judge-adapter-deepening.md`
- Modify: `CONTEXT.md`
- Modify: `prototype/game-ui/42-subject-compliance.md`
- Modify: `docs/adr/0003-sandboxed-code-judging.md`
- Modify: `docs/adr/0004-game-match-persistence-module.md`
- Modify: `docs/adr/0011-evaluation-idempotency-lock-boundary.md`
- Modify: `.scratch/code-arena/issues/25-evaluation-idempotency-lock-boundary.md`
- Modify: `.scratch/code-arena/spec.md`

- [ ] **Step 1: Add the ADR after implementation evidence exists**

  Record the selected trade-offs: Evaluation versus Judge job, self-hosted optional Judge0 adapter, static backend selection, no automatic fallback, optimistic revision conflicts, crash takeover re-drive, and scheduling deferred until measured load pressure.

- [ ] **Step 2: Update existing ADRs and issue evidence without re-litigating settled decisions**

  Keep ADR-0003’s isolation contract provider-independent; keep ADR-0004/0011’s schema and crash semantics accurate; mark broader scheduling as open rather than implemented.

- [ ] **Step 3: Review and update the 42 compliance matrix**

  Record architecture/test evidence only. State explicitly that no 42 subject-module row is promoted, the existing schema and public contracts remain unchanged, and Judge0 optionality is not production deployment evidence.

- [ ] **Step 4: Run the final verification set**

  Run `npm test --workspace arena-game-engine`, `npm test --workspace arena-game`, `npm test --workspace arena-frontend -- --run`, `npm run typecheck --workspaces --if-present`, `npm run build --workspaces --if-present`, `npm run lint --workspace arena-frontend`, and `git diff --check`. If the local Graphify executable is available, refresh and diagnose `graphify-out/` after the final code/doc state.

## Self-review

- Spec coverage: all four selected architecture candidates are covered; scheduling is deliberately limited to telemetry until a load trigger occurs.
- Schema coverage: no MatchRecord, SubmissionRecord, public receipt, table, or column change is planned.
- Failure coverage: duplicate live ownership, stale Match revision, orphaned provider job, hidden-suite leakage, provider timeout, and backend rollout are each pinned to tests.
- Compatibility coverage: `ArenaEngine` methods, `GameJudge`, `ContainerJudge`, existing in-memory fixtures, and frontend receipts remain usable.
- No final implementation claims are made until the affected suites and compliance review pass.
