# 06 — Judge isolation mechanism decision

Date: 2026-09-23. Evidence: `results.md` + `results-data/` (measured on linux/aarch64).
Toolchains pinned: `python:3.12-slim` (Python 3.12.14), `gcc:14-bookworm` (GCC 14.3.0, g++ and gcc).

## Selected mechanism

**One-shot Docker containers per execution** (`docker run --rm`, stock language images,
no custom image build, no host mounts, source via stdin, results via stdout).

Per-job flags proven in the spike: `--network none`, `--cpus 1`, `--memory 256m`
+ `--memory-swap 256m` (no swap), `--pids-limit 64`, `--read-only` rootfs,
`--tmpfs /scratch` + `--tmpfs /tmp` (job-only writable, `mode=1777`), `--user nobody`,
`--workdir /scratch`, inner GNU `timeout` bounding compile and run separately.

## Alternatives rejected

- **Host/subprocess execution** (no container): rejected — no memory/pid/network
  enforcement, shared filesystem, credentials and databases reachable.
- **Long-lived worker pool with reuse**: rejected for now — container start is
  ~400–860ms cold (measured), so one-shot cost is acceptable for Run/Submit
  cadence; reuse adds cross-job state-leak risk. Revisit only with latency data
  from real playtests.
- **Custom hardened images**: deferred — stock images plus runtime flags passed
  every attack case; custom images add build/maintenance cost without new evidence.

## Security properties (measured)

- Infinite loop → killed at the inner bound, exit 124 (py 8.2s, C++/C 5.2s).
- Memory hog → OOM-killed, exit 137, in 0.3–0.5s, host unaffected.
- Fork bomb → capped (py spawned 62, C/C++ spawned 60, then EAGAIN); suite wall
  unaffected; `pids-limit 64` is the enforcement.
- Oversized stdout → truncated at exactly 1MiB in <1s both languages; stderr likewise.
- Filesystem: rootfs writes blocked (`/pwned`, `/etc/pwned`); only job tmpfs writable.
  Image files (`/etc/passwd`, `/proc/self/environ`) remain readable — expected:
  player-data isolation comes from per-job containers with no mounts, not from
  hiding image files. No secrets are ever passed in (measured env has none).
- Network egress, metadata-IP and localhost attempts → all refused/failed.
- Identity `nobody` (65534), effective capabilities `0`.
- Malformed source → fast non-zero exit with diagnostics on stderr, never a hang.
- 4 parallel jobs: 4/4 ok in 466ms (≈ single-job cost); 0 containers left running.

## Known limitations

- Compile bound now EXERCISED (closure 2026-09-23): generated 150k-function TU
  (~4MB, defeats template memoization) killed at the 150s inner bound, container
  exit 124, no binary, 0 leftovers. Note: naive `Fib<38>` compiled in 2.27s —
  GCC memoizes template instantiations, so Fibonacci-style recursion is NOT a
  valid bound test; generated-TU (parse/codegen load) is.
- Image-file readability (above) must be re-asserted if images change.
- `--rm` cleans only self-exiting containers: production must enforce bounds
  inside the job (as here) and reap via orchestrator timeout + `rm -f`, never by
  killing the client side and assuming cleanup.
- Quotas below are spike-calibrated starting points, not frozen production values;
  `DEFAULT_LIMITS` in code remain placeholders until playtest data lands.

## Recommended initial quotas (spike-calibrated)

- Run/stage bound: visible-run exec 5s, hidden-exec 8s per test process; compile
  bound 150s for C++/C at -O2 (generated-150k-TU abuse case killed exactly at
  the bound; typical compiles measured <1s), none needed for Python; container
  wall bound 240s backstop.
- Memory 256m (+ equal swap), pids 64, CPUs 1 per job; output capture 64KB kept,
  verdict `output_limit_exceeded` beyond.
- Run rate limit + max concurrent runs per side: enforced in game (ticket 07),
  exact numbers from playtests.

## Failure → verdict mapping (production contract)

- exit 0 → `accepted` (score from hidden groups as usual).
- non-zero exit / signal (not OOM/timeout) → `runtime_error`.
- inner-timeout expiry (124) → `time_limit_exceeded`.
- OOM-kill (137) → `memory_limit_exceeded`.
- output past capture cap → `output_limit_exceeded` (truncated output kept).
- fork/EAGAIN containment → `process_limit_exceeded`.
- compile non-zero → `compile_error` (diagnostics visible on Run only; hidden
  Submit returns group scores, never source/tests).
- judge-side crash/timeout with no verdict → `internal_error`: recorded, counted
  result untouched, side returns to coding, no tiebreak penalty.

## Production contract recommendation

```ts
evaluateHidden({ evaluationId, submissionId, problemVersionId, hiddenSuiteId,
                 language, source, limitsProfile })
```

- Same `evaluationId` retried returns the stored outcome — never a second
  competitive evaluation (idempotency owned by game + judge store).
- Judge resolves the sealed hidden suite internally by `hiddenSuiteId`; game and
  browser never receive hidden inputs/expected values.
- Judge owns execution only (compile/run/limits/capture/measurements); game owns
  match state, counted results, and reveal. No durable match state in judge, no
  DB/credentials/network beyond the job/result path (internal-only endpoint or
  queue — game-service decision in ticket 08).
- `limitsProfile` names a quota set (above); compile vs run limits separated.
