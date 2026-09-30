# Frozen CodeTour reference baseline

This record identifies the direct reference files used by the six CodeTours. It is a **working-tree snapshot**, not a promise that the whole repository or every transitive dependency is frozen.

## Snapshot

- Recorded: 2026-09-30
- Git HEAD: `3480ced92a868b6158e44bbbf3b2e1d474a4ddaa`
- Git worktree: dirty; the recorded file hashes capture working-tree content independently of HEAD.
- Integrity list: [`reference-baseline.sha256`](reference-baseline.sha256), covering 60 direct inputs: all six tours, their anchored source files and named test/spec references, relevant package/test configuration, the Code Arena spec and relevant ADRs, and the 42-subject compliance matrix.
- Tour links checked: all 58 file-and-line anchors resolve in current files.
- Runtime used for the checks: Node.js `v26.9.0`, npm `11.19.1`, Vitest `3.2.7`.

Verify the recorded files from the repository root:

```sh
shasum -a 256 -c .tours/reference-baseline.sha256
```

If a file reports `FAILED`, the current file is not the reference described here. Review the change and tests before refreshing this baseline. The checksums do not cover every repository file, generated outputs, or this record itself.

## Course parity decisions

These choices describe the course's agreed first-release target and the existing behaviors it will teach. They do not amend the product specification:

1. Keep first-release Lobby entry invitation-only. Retain the public queue service/API as future-capability code, but do not expose automatic matchmaking in the release flow; keep its legacy tests separate from the invitation-room journey.
2. Match the current disconnect behavior: 1v1 forfeits after grace expiry; an expired offline 2v2 member does not forfeit the match.
3. Match the current process-local team-chat history: it can be restored on reconnect while the Game process runs, but is lost when that service restarts. Durable chat storage remains intended future work.

The detailed explanations and evidence links are in [Tour 6](6-rebuild-the-game.tour).

## Historical test evidence (not rerun by snapshot refresh)

These test results were captured on 2026-09-25. The reference baseline was refreshed on 2026-09-30; tests were not rerun during that refresh. The arena-game and Game-service runs had local Docker access; the frontend unit run did not need Docker.

| Command                                                          | Result                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test --workspace=packages/arena-game -- --reporter=dot` | 22 files passed, 1 skipped; 182 tests passed, 12 skipped. PostgreSQL-only proofs were skipped because their test database was unavailable. |
| `npm run test --workspace=services/game -- --reporter=dot`       | 9 files passed; 52 tests passed.                                                                                                           |
| `npm run test --workspace=frontend -- --reporter=dot`            | 8 files passed; 41 tests passed.                                                                                                           |

The frontend Playwright end-to-end suite was **not run**. A skipped test is not a pass, and these results verify the reference project only; they do not prove a separate rewrite matches it. The tour's Docker-backed judge/security tests did run and pass in the arena-game suite.

## Refresh rule

When the original game changes, compare the changed paths with the checksum list. If a referenced file changed, review the affected tour steps and tests, rerun the relevant commands, update the three parity decisions if behavior changed, and then replace this record and checksum list together. Keep skipped or unrun checks explicitly marked; do not relabel planned behavior as implemented evidence.
