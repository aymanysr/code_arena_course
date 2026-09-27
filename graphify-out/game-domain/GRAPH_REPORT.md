# Graph Report - game-domain  (2026-09-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 279 nodes · 826 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- lobby.ts
- engine.ts
- ArenaEngine
- SideId
- MatchRecord
- CollabDocs
- ILobbyStore
- SubmissionRecord

## God Nodes (most connected - your core abstractions)
1. `MatchRecord` - 71 edges
2. `ArenaEngine` - 48 edges
3. `SideId` - 45 edges
4. `TeamCollaboration` - 28 edges
5. `IllegalStateError` - 26 edges
6. `AuthenticatedPrincipal` - 23 edges
7. `RoundState` - 22 edges
8. `InMemoryLobbyStore` - 20 edges
9. `DocumentRevision` - 20 edges
10. `LobbyStore` - 17 edges

## Surprising Connections (you probably didn't know these)
- `RoundAdvance` --references--> `SideId`  [EXTRACTED]
  packages/arena-game/src/round-lifecycle.ts → packages/arena-game/src/records.ts
- `EngineOptions` --references--> `MatchStore`  [EXTRACTED]
  packages/arena-game/src/engine.ts → packages/arena-game/src/store.ts
- `EngineOptions` --references--> `CollabPersist`  [EXTRACTED]
  packages/arena-game/src/engine.ts → packages/arena-game/src/collab.ts
- `EngineOptions` --references--> `MatchRecord`  [EXTRACTED]
  packages/arena-game/src/engine.ts → packages/arena-game/src/records.ts
- `EngineOptions` --references--> `SubmissionStore`  [EXTRACTED]
  packages/arena-game/src/engine.ts → packages/arena-game/src/store.ts

## Import Cycles
- None detected.

## Communities (8 total, 1 thin omitted)

### Community 0 - "lobby.ts"
Cohesion: 0.07
Nodes (19): capacityFor(), generateInviteCode(), InMemoryLobbyStore, LOBBY_SCHEMA, LobbyError, LobbySideId, LobbyStore, perSideCapacity() (+11 more)

### Community 1 - "engine.ts"
Cohesion: 0.07
Nodes (31): CollabRow, BankProblem, EngineOptions, ExpiredError, MATCH_DURATION_MS, ProblemBank, RateLimitedError, RatePolicy (+23 more)

### Community 2 - "ArenaEngine"
Cohesion: 0.15
Nodes (4): ArenaEngine, driverFor(), MatchLockOptions, AuthenticatedPrincipal

### Community 3 - "SideId"
Cohesion: 0.19
Nodes (14): collabRoomId(), DocumentRevision, MemberReadiness, Participant, RoundState, SideId, SubmissionDocument, TeamCollaboration (+6 more)

### Community 4 - "MatchRecord"
Cohesion: 0.12
Nodes (6): IllegalStateError, MatchAuthority, NotMemberError, MatchRecord, RoundLifecycle, TeamCollaborationPersistence

### Community 5 - "CollabDocs"
Cohesion: 0.11
Nodes (8): b64decode(), b64encode(), COLLAB_TEXT_KEY, CollabDocs, CollabPersist, InMemoryCollabPersist, TeamCollaborationOptions, ref_yjs

### Community 7 - "SubmissionRecord"
Cohesion: 0.24
Nodes (3): SubmissionRecord, InMemorySubmissionStore, SubmissionStore

## Knowledge Gaps
- **13 isolated node(s):** `LobbySideId`, `PrivateRoom`, `PrivateRoomMember`, `PrivateRoomStatus`, `QueueEntry` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 60 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MatchRecord` connect `MatchRecord` to `lobby.ts`, `engine.ts`, `ArenaEngine`, `SideId`, `ILobbyStore`?**
  _High betweenness centrality (0.354) - this node is a cross-community bridge._
- **Why does `ILobbyStore` connect `ILobbyStore` to `lobby.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `ArenaEngine` connect `ArenaEngine` to `engine.ts`, `SideId`, `MatchRecord`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `LobbySideId`, `PrivateRoom`, `PrivateRoomMember` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lobby.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06516290726817042 - nodes in this community are weakly interconnected._
- **Should `engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06938775510204082 - nodes in this community are weakly interconnected._
- **Should `ArenaEngine` be split into smaller, more focused modules?**
  _Cohesion score 0.14893617021276595 - nodes in this community are weakly interconnected._