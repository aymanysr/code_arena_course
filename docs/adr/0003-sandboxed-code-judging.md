# Isolated judging for untrusted player code

Accepted 2026-09-23 as part of the Code Arena pivot. Player-submitted code is executed for visible runs and hidden evaluations; that execution must be isolated by architecture, not by convention.

## Decision

- Player code executes **only** inside a dedicated judging component. It never executes in the game, core, or chat services, never in a browser as grading, and never with access to service credentials, databases, or the internal network.
- The game service owns verdicts (what counts, when phases change, what is revealed). The judging component owns execution (compile/run, time and memory limits, output capture). Game sends code, cases, and limits to the trusted judge; judging returns verdicts plus measured output. Judging holds no durable state.
- Both execution paths from the reference are preserved: **Run** evaluates visible examples only and returns per-example output; **Submit** evaluates the hidden suite and returns group scores only at reveal. Visible-run detail must be incapable of leaking hidden tests (separate inputs, separate responses).
- Every player execution is bounded: CPU, wall-clock timeout, memory limit, output-size limit, process-count limit, no network, and no persistent filesystem beyond scratch. Over-limit runs are verdicts (e.g. time-out), not errors that stall a match.
- C++, Python, and C are the first-release languages (matching the reference starter set). Adding a language is a deliberate change: new image/toolchain, new limits review, new verification.

## Consequences

- Compose runs judging in an internal worker on the same Docker host. Only the worker mounts the Docker socket; it is a privileged host boundary. The worker has no app database credentials, has no published port, and is not routed by Nginx.
- Each test case executes in a fresh player container. Only source and the current input cross into it; the expected output and other hidden cases remain in trusted worker memory. The worker compares output after the container exits and never trusts a runner-supplied pass bit.
- The worker has a bounded queue and readiness checks for Docker and required images. Compose configures two active jobs, eight waiting jobs, a 30-second queue timeout, and a 15-minute job timeout. Capacity and fairness beyond this single-host configuration remain measurement questions.
- Problem-bank content needs sourcing and license review; hidden tests are sealed data with the same access discipline as private match state.

## Remaining validation

Cross-host execution, horizontal scale-out, per-match fairness under sustained load, and production auth/certificate integration remain open. Image updates, per-language quotas, compile-vs-run error taxonomy shown to players, and Run rate limits require continued operational review.

## Amendment 2026-09-25 (optional Judge0 adapter)

`GameJudge` now has an optional Judge0-backed adapter for controlled rollout and
benchmarking. `ContainerJudge` remains the default/reference backend. The
adapter keeps provider tokens, polling, raw responses, and hidden expected
values private; it maps provider results to the existing execution taxonomy,
sets explicit resource limits, and always sends `enable_network: false`.

Judge0 is self-hosted on a dedicated internal execution host. Backend choice is
made once per Game process; a Judge0 failure raises `JudgeInfraError` and never
silently falls back to the container backend. See `docs/judge0-local.md` for
deployment and rollout requirements.

## Amendment 2026-09-26 (single-host Compose worker and per-case isolation)

`ContainerJudge` now starts one isolated player container per case. The source
and current input are the only case data passed into that container. The
trusted caller retains the expected output and the rest of the sealed suite,
then compares captured output after execution. The container receives no
Docker socket, Compose network, host mount, or service credential. C, C++, and
Python execution and the existing `GameJudge` result taxonomy are preserved.

Compose selects `WorkerJudgeAdapter` explicitly. Game and the worker share a
private internal network and a bearer token; the worker is not published or
routed through Nginx. The worker alone has Docker socket access and starts only
after Docker and the Python/GCC images are ready. It does not inherit the
service `.env` file. Queue saturation, timeout, and Docker failure map to
infrastructure errors; Game keeps submission, score, reveal, and retry
authority and never silently falls back.

Evidence: Docker-backed C/C++/Python verdict and isolation tests, adversarial
environment/scratch checks, forged-pass rejection, worker API/queue/readiness
tests, Compose topology checks, and two HTTPS/WSS browser runs through
Run→concurrent Submit→hidden evaluation→reveal. The browser path used a local
self-signed certificate and the dev identity seam; this does not establish
production identity or certificate readiness, and it does not promote a 42
subject module claim.

## Follow-up 2026-09-27 (Python result channel and Compose credentials)

The Python snippet runner no longer lets submitted code write runner JSON.
Python stdout carries only candidate comparison bytes; the shell writes one
runner record after the Python process and its `atexit` handlers exit. Captured
print output and comparison bytes count toward the output limit. The trusted
judge rejects malformed or appended runner records.

Compose no longer injects the full `.env` file into containers. Postgres gets
the database bootstrap settings it needs, Game gets its own database URL, and
the worker token is set only on Game and the judge worker.

The focused fake-runner and Compose topology regression tests pass. The new
real-container `atexit` regression and Docker-backed matrix still need a rerun
in an environment with Docker socket access; the current session was denied
access to that socket.
