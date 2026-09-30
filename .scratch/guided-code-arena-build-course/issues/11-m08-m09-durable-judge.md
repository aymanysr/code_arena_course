# 11 — M08 persistence and M09 isolated Judge

Plan Task: 11 (approved plan Task 11 — Author M08 persistence and M09 real Judge).

Status: needs-triage

Blocked by: 10 (M06–M07 server and screen)

**What to build:** Eleven ready lessons that make Match state durable with Postgres revisions/claims/events/recovery and replace the fake Judge with an isolated provider behind a private worker boundary.

- [ ] Author `m08-store-port`, `m08-postgres`, `m08-transactions`, `m08-claims`, `m08-events`, `m08-recovery` with `src/store/`, `infra/schema.sql`, claim timelines; stale save rejected, publish-only-after-commit, reclaimable pending
- [ ] Author `m09-isolation`, `m09-provider`, `m09-case-runner`, `m09-worker`, `m09-replace-fake` with `src/judge/`, `src/worker/`, `infra/judge.Dockerfile`; explicit provider choice, no silent fallback, bounded fixtures only
- [x] Checked real DB/Judge/worker readiness; Postgres returned no response and Docker socket access was denied, so those checks are recorded blocked, not passed; no secrets in commands or evidence.
- [ ] Add DB/Judge/worker check kinds and `test:db`/`test:judge` scripts; update learning-path, evidence, dispositions, compliance; run content/browser/generation/lint uncommitted

## Comments

Approved plan Task 11. Read ADRs 0003/0004/0011/0012/0013 and L06/L07/L08/L13/L14 plus persistence/Postgres/evaluation/provider/worker tests before writing claims.

### Task 11 reconciliation (2026-09-29)

Authored M08 (6) and M09 (5); the path now shows 48/68 ready. The content test enforces the 11 IDs, validated source spans, distinct database/Judge/worker gates, safe .env ignore behavior, script order, verdict statuses, and a fixture where a passed unit check does not clear a blocked database gate. build-path.mjs now accepts the distinct worker kind.

Disposable practice rehearsal: npm run typecheck passed with TypeScript 5.9.3; npm test passed 5 files / 8 tests with Vitest 4.1.11; environment-ignore and script-definition checks passed; exact Postgres package versions resolved. No install was performed through the worktree link. A fresh offline install could not resolve registry metadata and remains unverified.

Eight real-environment checks are blocked: five Postgres checks because port 5433 had no response; the real Judge, private worker and real Game-to-Judge checks because access to the Docker API socket was denied. No hostile source was executed. No reference disposition or 42 module row changed. The Task10 full 1v1 check remains open; learner walkthrough remains pending; no team repository is available; nothing staged or committed. Blocked by 10 remains.
