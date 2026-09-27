# 06. Judge contract + isolation spike (mechanism decision)

Status: ready-for-agent
Category: judge contract + isolation spike
Week 2: yes
Blocked by: 03

## Scope

Define the game↔judging contract (request: code + language + tests + CPU/time/memory/output/process limits; response: per-test verdicts + output + measurements; no durable state in judging) and run a throwaway spike proving the isolation from ADR-0003: escape attempts, fork bombs, network egress, oversized output, over-limit verdicts, concurrent-match load, and all three language toolchains. Select the mechanism (e.g. one-shot containers vs sandboxed worker pool) on spike evidence and record it. The spike stays throwaway; only the contract and mechanism decision carry forward.

## Acceptance criteria

- [ ] Contract documented with limit fields and verdict taxonomy (including timeout/out-of-memory/over-output as verdicts, never stalls).
- [ ] Spike demonstrates failed escape, failed egress, bounded fork bomb, truncated oversized output, and fair behavior under concurrent matches.
- [ ] Mechanism selected and recorded with reasons; infra attachment point from 01 confirmed without rework.
- [ ] Visible-run and hidden-evaluation calls are indistinguishable in isolation strength (separate inputs/responses only).

## Notes

Critical-path ticket: 07 and 08 build on this contract. Owner area: game service (Aimane).

## Comments

2026-09-23 (Wave 1 started): recon only, no spike yet. Host has Docker 29.7.2, Apple-clang g++ (arm64 macOS — NOT a Linux toolchain), gcc, Python 3.14.7, Node 26. Consequence: language toolchains must be proven inside Linux container images, never on host compilers. First work: throwaway spike images for C++/Python/C + attack matrix (escape, fork bomb, egress, oversized output, limits, concurrency, cleanup) + `evaluateHidden({evaluationId, submissionId, …})` idempotency semantics. `DEFAULT_LIMITS` stay placeholders until measured.

2026-09-23 (Spike complete): `spikes/judge-isolation/` (throwaway `spike.sh` + measured `results.md` + `DECISION.md`). Decision: one-shot Docker containers per execution (`python:3.12-slim` → Python 3.12.14, `gcc:14-bookworm` → GCC 14.3.0), `--network none`, 1 CPU, 256m mem+swap, pids-limit 64, read-only rootfs, tmpfs scratch only, user nobody, inner timeouts. Proven: TLE kills (124), OOM kills (137, <0.5s), fork capped (60–62 procs), egress/metadata/localhost refused, rootfs writes blocked, caps 0, 1MiB output truncation, 4/4 parallel in 466ms, 0 leftovers. Limits: compile bomb untriggered (Fib<30> in 345ms — bound kept, heavier case before freeze); image files readable by design (isolation = per-job containers, no mounts); `--rm` needs orchestrator-side reaping. Contract + quotas + verdict mapping in `DECISION.md`; `DEFAULT_LIMITS` still placeholders pending playtests.

2026-09-23 (06 closure): compile bound EXERCISED — generated 150k-function TU (~4MB) killed at the 150s inner bound (exit 124, no binary, 0 leftovers; `misc-compile-abuse` row in `results.md`). Finding: `Fib<38>` compiles in 2.27s (GCC memoizes), so Fibonacci recursion is not a valid bound test; generated-TU parse/codegen load is. Final compile quota: 150s bound for C++/C at -O2 (typical <1s measured). Ticket 06 COMPLETE.
