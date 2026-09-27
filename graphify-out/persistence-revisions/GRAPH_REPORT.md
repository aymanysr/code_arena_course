# Graph Report - persistence-revisions  (2026-09-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 220 nodes · 481 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SubmissionRecord
- evaluation-orchestration.ts
- postgres-store.ts
- EvaluationOrchestrator
- collab.ts
- persistence.ts
- MatchRecord
- StoreBackedMatchPersistence
- EvaluationInFlightRegistry

## God Nodes (most connected - your core abstractions)
1. `SubmissionRecord` - 42 edges
2. `MatchRecord` - 33 edges
3. `MatchPersistence` - 24 edges
4. `StoreBackedMatchPersistence` - 21 edges
5. `EvaluationOrchestrator` - 15 edges
6. `PostgresStores` - 14 edges
7. `RevealSnapshot` - 14 edges
8. `SubmissionStore` - 13 edges
9. `MatchAuthority` - 13 edges
10. `PostgresSubmissionStore` - 10 edges

## Surprising Connections (you probably didn't know these)
- `EvaluationOrchestratorOptions` --references--> `MatchPersistence`  [EXTRACTED]
  packages/arena-game/src/evaluation-orchestration.ts → packages/arena-game/src/persistence.ts
- `PostgresStores` --references--> `MatchPersistence`  [EXTRACTED]
  packages/arena-game/src/postgres-store.ts → packages/arena-game/src/persistence.ts
- `MatchPersistenceAdapters` --references--> `SubmissionRecord`  [EXTRACTED]
  packages/arena-game/src/persistence.ts → packages/arena-game/src/records.ts
- `MatchPersistenceAdapters` --references--> `SubmissionStore`  [EXTRACTED]
  packages/arena-game/src/persistence.ts → packages/arena-game/src/store.ts
- `PostgresStores` --references--> `SubmissionStore`  [EXTRACTED]
  packages/arena-game/src/postgres-store.ts → packages/arena-game/src/store.ts

## Import Cycles
- None detected.

## Communities (9 total, 2 thin omitted)

### Community 0 - "SubmissionRecord"
Cohesion: 0.10
Nodes (5): MatchPersistence, PostgresSubmissionStore, SubmissionRecord, InMemorySubmissionStore, SubmissionStore

### Community 1 - "evaluation-orchestration.ts"
Cohesion: 0.09
Nodes (27): EvaluationCompletion, EvaluationIdentity, EvaluationOrchestratorOptions, EvaluationProblemBank, EvaluationRecoveryReport, EvaluationRunInput, InFlightEvaluation, EvaluationProviderTelemetry (+19 more)

### Community 2 - "postgres-store.ts"
Cohesion: 0.09
Nodes (11): EvaluationClaimLostError, GAME_SCHEMA, PostgresEvaluationClaim, PostgresMatchStore, PostgresStores, saveMatchTx(), InMemoryMatchStore, MatchRevisionConflictError (+3 more)

### Community 3 - "EvaluationOrchestrator"
Cohesion: 0.15
Nodes (5): EvaluationOrchestrationHost, EvaluationOrchestrator, IllegalStateError, EvaluationClaim, RoundState

### Community 4 - "collab.ts"
Cohesion: 0.09
Nodes (9): b64decode(), b64encode(), COLLAB_TEXT_KEY, CollabDocs, CollabPersist, InMemoryCollabPersist, MatchPersistenceAdapters, PostgresCollabStore (+1 more)

### Community 5 - "persistence.ts"
Cohesion: 0.14
Nodes (7): immutableSubmissionView(), isUniqueViolation(), PostgresRevealStore, RevealSnapshot, DuplicateError, InMemoryRevealStore, RevealStore

### Community 6 - "MatchRecord"
Cohesion: 0.24
Nodes (4): CollabRow, MatchAuthority, NotMemberError, MatchRecord

## Knowledge Gaps
- **13 isolated node(s):** `EvaluationCompletion`, `EvaluationRecoveryReport`, `EvaluationProviderTelemetry`, `EvaluationTelemetryObservation`, `EvaluationTelemetrySnapshot` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 62 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SubmissionRecord` connect `SubmissionRecord` to `evaluation-orchestration.ts`, `postgres-store.ts`, `EvaluationOrchestrator`, `collab.ts`, `persistence.ts`, `StoreBackedMatchPersistence`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `MatchRecord` connect `MatchRecord` to `SubmissionRecord`, `evaluation-orchestration.ts`, `postgres-store.ts`, `EvaluationOrchestrator`, `collab.ts`, `persistence.ts`, `StoreBackedMatchPersistence`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `MatchPersistence` connect `SubmissionRecord` to `evaluation-orchestration.ts`, `postgres-store.ts`, `persistence.ts`, `MatchRecord`, `StoreBackedMatchPersistence`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `EvaluationCompletion`, `EvaluationRecoveryReport`, `EvaluationProviderTelemetry` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SubmissionRecord` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `evaluation-orchestration.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._
- **Should `postgres-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08907563025210084 - nodes in this community are weakly interconnected._