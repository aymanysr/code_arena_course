# 10 — M06 HTTP and M07 browser screen

Plan Task: 10 (approved plan Task 10 — Author M06 HTTP and M07 browser UI).

Status: needs-triage

Blocked by: 09 (reconciled as needs-triage; sufficient to start 10, review pending in parallel)

**What to build:** Ten ready lessons that expose local game behavior over HTTP with validated identity and render it in a browser with transport, editor, Run, Submit and Reveal panels plus a local 1v1 journey. Every lesson cites validated reference spans.

- [x] Author `m06-http`, `m06-controller`, `m06-validation`, `m06-identity` in `M06.json`; practice `src/server/` and `src/client/` introduced only here
- [x] Author `m07-browser-basics`, `m07-react-state`, `m07-transport`, `m07-editor-run`, `m07-submit-reveal`, `m07-local-journey` in `M07.json`; one JSX concept at a time
- [x] Rehearse Nest route delegation, validation and identity boundaries; run React UI checks and a real browser-to-Nest/Vite proxy smoke
- [ ] Rehearse the full final Arena 1v1 composition and its Run/Submit/Reveal path; the new browser smoke covers one member request and 400 only
- [x] Add `service`/`browser` check kinds, scripts, learning-path, evidence and generated outputs; reconcile compliance and run course tests uncommitted
- [ ] Fresh isolated install of the React/Vite plugin toolchain remains unverified; offline package metadata was unavailable
- [ ] Effect-subscription cleanup is taught as a named rule (explained when the first subscription enters) but not executed against a live subscription in rehearsal; 409 conflict is proven at state level, not over sockets (sockets arrive in M10)

## Comments

Approved plan Task 10. References L01/L09/L12/L13, manifests, controller/service/bootstrap, components, transport/session plus tests. Isolated `/practice-decision` validation exercise stays separate from game Submit.

### Reconciliation 2026-09-28 (implementation)

M06.json (4 lessons) + M07.json (6 lessons) authored uncommitted; 37/68 lessons ready. Rehearsal in a disposable dir: typecheck clean; `test:service` 5 passed (round trip, delegation, 400s, 401/403/lying-body); `test:ui` 9 passed (React render, stale discard, hidden-free panels, conflict flow); `test:browser` passed (served page over real HTTP: verdict, 400 diagnostic, keyboard Enter, 390px, zero console errors). 10 evidence rows appended (service/browser kinds labeled). Reference versions: practice uses lockfile-pinned TypeScript/Vitest plus rehearsal-added React 19 for the UI lesson; Nest/Vite CLIs are described as explicit steps, not silently assumed. Rehearsal server carries rehearsal-only permissive CORS for the setContent journey (production path stays same-origin per M13). `--check` exit 0 with source drift 0 after reviewed snapshot accept. Walkthrough still pending.

### Reconciliation 2026-09-28 (Codex continuation)

Fresh setup testing found and fixed four content defects: Vite root made Vitest search in `src/client`; Nest constructor injection metadata was absent in Vitest source transforms; Nest POST defaulted to 201 despite the documented 200 contract; and Vite proxied only `/practice-decision`, not `/game-decision`. M06 validation/identity now edit the Nest controller rather than `main.ts`; M07 teaches a separate `vitest.config.ts` and proxies both routes. Regression tests were run red then green.

In `/private/tmp/arena-course-task10-20260928-dohaf5gl`, TypeScript build passed; `test:service` passed 3 tests; `test:ui` passed 9 tests on React 19.3.0/Vitest 4.1.11; Chrome passed the proxy/member/400/keyboard/wide+390px smoke with no unexpected errors. A full Arena 1v1 composition was not run. The original CORS/setContent browser evidence is historical, not current proxy evidence. Offline install could not fetch registry metadata; exact package versions were checked statically, and the React Vite plugin was not loaded. Walkthrough remains pending; no team repo was available. No stage or commit performed.
