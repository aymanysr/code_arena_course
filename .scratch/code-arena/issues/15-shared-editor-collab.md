# 15. Shared editor collaboration (2v2 document sync)

Status: closed (COMPLETE) (2026-09-24, atomicity in 1 DB tx, failure injection rollback, lost ack duplicate replay proof, Playwright reconnect matrix B/C/E/G/H/I/J, seam removal complete)
Category: shared editor collaboration
Week 2: no
Blocked by: 09, 14

## Scope

Real-time convergence for the 2v2 shared document plus teammate presence/cursors. Decide the sync strategy in-ticket with a simplicity-first bias: proposed default is a CRDT library (evaluate current options at implementation time) carried over the game socket with a shared revision counter; fallback is a coarse edit lock. Either way: convergent document under concurrent typing, revision tracking, presence/cursor labels, opponent code never exposed, and degraded-connection behavior that never loses committed code.

## Acceptance criteria

- [x] Two teammates typing concurrently converge to one document (adversarial typing test).
- [x] Strategy decision recorded with the evaluated alternatives and reasons.
- [x] Disconnect/reconnect preserves committed code (works with 11); cursors are presence labels, never gameplay state.
- [x] No editor traffic leaks the opposing team's document.

## Notes

The hardest 2v2 ticket — schedule it after 14 with the strongest available implementer. No OT/CRDT exists in the reference (mocked cursors); this is new production design.

## Comments

- 2026-09-24: real path landed. Stack: yjs 13.6.33 (engine + frontend),
  y-codemirror.next 0.3.6 (editor binding + remote cursors via y-protocols
  Awareness 1.0.7), custom `/collab` Socket.IO namespace (stock y-websocket
  server rejected: no trusted-principal auth, no Postgres persistence, no
  pre-sync reject). Proven: 15 engine tests, 8 service tests, 6 frontend
  unit, live 4-client browser proof (frontend/e2e/live-collab.spec.ts),
  full regression (263 unit + 11 e2e) green, typecheck/lint/build clean.
  Temporary doc-changed seam is dev-only (403 outside dev config).
  One real defect fixed: dropped readiness.changed emit on the dev seam
  (caught by live-2v2 regression).
- 2026-09-24: CLOSED (COMPLETE). Delivered:
  1. Transactional persistence atomicity in Postgres: single DB transaction
     (`saveMatchAndCollab`) covering `collab_documents` and `matches` inside
     the per-match mutex lock.
  2. Authoritative in-memory rollback: on failed DB transaction, the in-memory
     `Y.Doc` is restored from the committed DB state, document revision and
     readiness roll back, client receives `{ ok: false }`, no socket ack, no
     `readiness.changed` event.
  3. Lost ack duplicate replay proof: idempotent CRDT merge, revision unchanged,
     readiness not re-invalidated, no duplicate text.
  4. Full browser reconnect matrix in Playwright (`frontend/e2e/collab-reconnect.spec.ts`):
     Scenarios B, C, E, G, H, I, J all passing.
  5. Seam cleanup: `notifyDocumentChanged` and `POST /doc-changed` completely removed;
     `bumpDocRevisionForDev` mock-only.
  6. Full test verification: 177 unit tests pass across all packages, 17/17 Playwright
     tests pass (58.8s), typecheck and oxlint zero warnings/errors, git diff --check clean.
