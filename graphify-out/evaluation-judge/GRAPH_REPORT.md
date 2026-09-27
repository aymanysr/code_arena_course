# Graph Report - evaluation-judge  (2026-09-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 270 nodes · 617 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- container-judge.ts
- evaluation-orchestration.ts
- SubmissionRecord
- postgres-store.ts
- EvaluationOrchestrator
- PostgresStores
- StoreBackedMatchPersistence
- MatchRecord
- FetchJudge0HttpClient

## God Nodes (most connected - your core abstractions)
1. `SubmissionRecord` - 43 edges
2. `MatchRecord` - 33 edges
3. `MatchPersistence` - 24 edges
4. `StoreBackedMatchPersistence` - 21 edges
5. `Judge0Adapter` - 19 edges
6. `SupportedLanguage` - 16 edges
7. `EvaluationOrchestrator` - 15 edges
8. `RevealSnapshot` - 14 edges
9. `DriverKind` - 13 edges
10. `SubmissionStore` - 13 edges

## Surprising Connections (you probably didn't know these)
- `BatchVerdict` --references--> `ExecutionStatus`  [EXTRACTED]
  packages/arena-game/src/container-judge.ts → packages/arena-game/src/judge.ts
- `ContainerJudgeOptions` --references--> `SupportedLanguage`  [EXTRACTED]
  packages/arena-game/src/container-judge.ts → packages/arena-game/src/judge.ts
- `Judge0AdapterOptions` --references--> `SupportedLanguage`  [EXTRACTED]
  packages/arena-game/src/judge0.ts → packages/arena-game/src/judge.ts
- `NormalizedCase` --references--> `ExecutionStatus`  [EXTRACTED]
  packages/arena-game/src/judge0.ts → packages/arena-game/src/judge.ts
- `EvaluationRunInput` --references--> `DriverKind`  [EXTRACTED]
  packages/arena-game/src/evaluation-orchestration.ts → packages/arena-game/src/judge.ts

## Import Cycles
- None detected.

## Communities (9 total, 2 thin omitted)

### Community 0 - "container-judge.ts"
Cohesion: 0.08
Nodes (35): b64(), b64Lines(), BatchCase, BatchVerdict, ContainerJudge, ContainerJudgeOptions, DEFAULT_IMAGES, parseVerdictLine() (+27 more)

### Community 1 - "evaluation-orchestration.ts"
Cohesion: 0.07
Nodes (28): EvaluationCompletion, EvaluationIdentity, EvaluationInFlightRegistry, EvaluationOrchestratorOptions, EvaluationRecoveryReport, EvaluationRunInput, InFlightEvaluation, EvaluationProviderTelemetry (+20 more)

### Community 2 - "SubmissionRecord"
Cohesion: 0.09
Nodes (5): MatchPersistence, PostgresSubmissionStore, SubmissionRecord, InMemorySubmissionStore, SubmissionStore

### Community 3 - "postgres-store.ts"
Cohesion: 0.10
Nodes (14): immutableSubmissionView(), isUniqueViolation(), MatchPersistenceAdapters, GAME_SCHEMA, PostgresRevealStore, RevealSnapshot, DuplicateError, InMemoryMatchStore (+6 more)

### Community 4 - "EvaluationOrchestrator"
Cohesion: 0.14
Nodes (6): EvaluationOrchestrationHost, EvaluationOrchestrator, EvaluationProblemBank, IllegalStateError, EvaluationClaim, RoundState

### Community 5 - "PostgresStores"
Cohesion: 0.12
Nodes (6): EvaluationClaimLostError, PostgresCollabStore, PostgresEvaluationClaim, PostgresMatchStore, PostgresStores, saveMatchTx()

### Community 7 - "MatchRecord"
Cohesion: 0.27
Nodes (3): MatchAuthority, NotMemberError, MatchRecord

## Knowledge Gaps
- **23 isolated node(s):** `BatchCase`, `CaseInput`, `Judge0SubmissionRequest`, `Judge0SubmissionResponse`, `SnippetOutput` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 74 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SubmissionRecord` connect `SubmissionRecord` to `container-judge.ts`, `evaluation-orchestration.ts`, `postgres-store.ts`, `EvaluationOrchestrator`, `PostgresStores`, `StoreBackedMatchPersistence`?**
  _High betweenness centrality (0.217) - this node is a cross-community bridge._
- **Why does `MatchRecord` connect `MatchRecord` to `evaluation-orchestration.ts`, `SubmissionRecord`, `postgres-store.ts`, `EvaluationOrchestrator`, `PostgresStores`, `StoreBackedMatchPersistence`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `MatchPersistence` connect `SubmissionRecord` to `evaluation-orchestration.ts`, `postgres-store.ts`, `PostgresStores`, `StoreBackedMatchPersistence`, `MatchRecord`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `BatchCase`, `CaseInput`, `Judge0SubmissionRequest` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `container-judge.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07615018508725542 - nodes in this community are weakly interconnected._
- **Should `evaluation-orchestration.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07422402159244265 - nodes in this community are weakly interconnected._
- **Should `SubmissionRecord` be split into smaller, more focused modules?**
  _Cohesion score 0.09206349206349207 - nodes in this community are weakly interconnected._