# Optional Judge0 execution backend

Judge0 is an optional execution adapter for Code Arena. The Game service still
owns Evaluation identity, claims, scoring, Match state, recovery, and what is
shown to players. Judge0 only compiles and runs one bounded case at a time.

## Default and rollout

`JUDGE_BACKEND=container` keeps the existing `ContainerJudge` as the default.
Set `JUDGE_BACKEND=judge0` only for a Game process that is intentionally being
benchmarked or rolled out against a self-hosted Judge0 deployment. Backend
selection happens once when the Game process starts; a failed Judge0 job never
silently falls back to ContainerJudge.

Required configuration when Judge0 is selected:

```dotenv
JUDGE_BACKEND=judge0
JUDGE0_URL=http://judge0-server:2358
JUDGE0_AUTH_TOKEN=
JUDGE0_C_LANGUAGE_ID=50
JUDGE0_CPP_LANGUAGE_ID=54
JUDGE0_PYTHON_LANGUAGE_ID=71
JUDGE0_POLL_INTERVAL_MS=250
JUDGE0_MAX_POLLS=120
```

The language IDs are configuration, not game state. Pin them to the language
catalogue installed on the chosen Judge0 version and test them before rollout.

## Deployment hardening

- Run Judge0 on a dedicated internal Linux execution host or isolated worker
  network. Do not expose its API directly to browsers or the public edge.
- Pin a maintained Judge0 release and its images. Do not deploy a floating
  `latest` tag.
- Set Judge0's global network policy so submissions cannot enable networking;
  the adapter also sends `enable_network: false` on every submission.
- Keep the Game-to-Judge0 endpoint private and protect it with the configured
  internal credential when the deployment requires one. Never send that
  credential to the browser or include it in Match records, receipts, logs, or
  errors.
- Keep the allowed language IDs and resource quotas small. The adapter sends
  CPU, wall-clock, memory, and output limits on every provider job.
- Restrict the Judge0 host's outbound access and monitor worker, Redis, and
  Postgres capacity separately from the Game service.

Judge0's own deployment can include privileged worker components. That is an
execution-host boundary, not permission for player code to reach the Game
network. Review the exact Judge0 release configuration before accepting any
security evidence.

## Recovery semantics

The durable game `evaluationId` is the source of truth. The adapter keeps
provider tokens and provider status IDs private. A Game process crash may
leave an orphaned provider job and recovery may create a new Judge0 job for the
same logical Evaluation. The old job cannot publish Match state because only
the live `EvaluationClaim` can commit the durable outcome.

One logical Evaluation may therefore have multiple provider-side Judge jobs,
but only one durable Submission outcome. No provider token is persisted in the
existing MatchRecord or SubmissionRecord schema.

## Verification before enabling

Run the adapter contract tests with the injected HTTP client, then compare the
same bank/problem corpus against ContainerJudge for accepted, compile,
runtime, timeout, memory, output, and process-limit outcomes. Enable Judge0
only after the equivalence and sandbox/conformance evidence is reviewed by the
team. Until then, keep `JUDGE_BACKEND=container`.

Reference API documentation: [Judge0 submissions API](https://github.com/judge0/judge0/blob/master/docs/api/submissions/submissions.md)

