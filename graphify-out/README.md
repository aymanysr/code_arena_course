# Current Graphify map — ft_transcendence Code Arena

**Last refreshed:** 25 September 2026

This folder is the single shareable Graphify set for the current Code Arena
architecture. Start with [`index.html`](./index.html), use the readable
[architecture overview](./architecture-overview.html) for a team presentation,
then open one focused explorer at a time.

The full-repository hairball and the older focused snapshot are not part of the
current map. They were removed because they mixed implementation,
tooling, tests, and historical context into one difficult-to-read view.

## Current truth

- Code Arena is the production direction: 1v1 and 2v2 code battles.
- `ArenaEngine` remains the game-domain authority and compatibility facade.
- `ContainerJudge` is the default execution path; Judge0 is an optional adapter,
  not a second game authority.
- Game owns first-release match-scoped team chat through its `/chat` namespace;
  the Chat service remains deferred.
- These graphs describe architecture and source relationships. They do not
  promote any 42 subject module from `Designed` to complete.

## Focused explorers

| View | Scope | Size |
| --- | --- | ---: |
| [Game domain](./game-domain/graph.html) | Match state, rounds, lobby, authority, collaboration, and domain persistence seams | 279 nodes · 826 edges · 8 communities |
| [Evaluation & judging](./evaluation-judge/graph.html) | Submission identity, orchestration, judge adapters, verdicts, stores, and telemetry | 270 nodes · 617 edges · 9 communities |
| [Realtime, collaboration & chat](./realtime-collab-chat/graph.html) | Browser transport, sockets, Yjs collaboration, presence, sidecars, and Game-owned chat | 354 nodes · 735 edges · 12 communities |
| [Persistence & revisions](./persistence-revisions/graph.html) | Match stores, Postgres transactions, claims, snapshots, and optimistic revisions | 220 nodes · 481 edges · 9 communities |

The totals above are per-view counts. They are not a deduplicated system total;
some shared abstractions intentionally appear in more than one conversation.

## Source scope

The explorers are deliberately code-only AST extracts. Their selected source
paths are:

- **Game domain:** `packages/arena-game/src/{engine,records,match-authority,round-lifecycle,lobby,team-collaboration,principal,collab,store}.ts`
- **Evaluation & judging:** `packages/arena-game/src/{evaluation-orchestration,evaluation-telemetry,judge,container-judge,judge0,persistence,store,records,postgres-store,match-authority}.ts`
- **Realtime, collaboration & chat:** `frontend/src/arena/{transport,socket,collab,chat,sidecars}.ts`, the Game service gateways and service boundary, plus the collaboration records and principals
- **Persistence & revisions:** `packages/arena-game/src/{persistence,postgres-store,store,records,match-authority,evaluation-orchestration,evaluation-telemetry,collab}.ts`

Tests, tooling, generated output, and unrelated prototype files stay outside
the first view so the graph answers one architectural question at a time.

## Supporting evidence

- [Architecture decision records](../docs/adr/0001-three-service-backend.md) — service ownership, judging, transport, collaboration, chat, persistence, and concurrency decisions
- [Code Arena specification](../.scratch/code-arena/spec.md) — current product rules and resolved defaults
- [42 subject compliance matrix](../prototype/game-ui/42-subject-compliance.md) — implementation evidence versus module sign-off

Graphify reports and raw data live beside each explorer as `GRAPH_REPORT.md` and
`graph.json`. The HTML pages are the best format for presenting; the Markdown
and JSON files are there for review or sharing with teammates who need
source-level detail.
