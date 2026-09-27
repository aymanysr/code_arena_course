# Graph Report - realtime-collab-chat  (2026-09-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 354 nodes · 735 edges · 12 communities (10 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- GameService
- team-collaboration.ts
- sidecars.ts
- ArenaTransport
- socket-auth.ts
- SocketArenaTransport
- CollabClient
- CollabDocs
- TeamChatGateway
- MatchSocketPresence
- game/principal.ts
- src/principal.ts

## God Nodes (most connected - your core abstractions)
1. `GameService` - 51 edges
2. `SocketArenaTransport` - 34 edges
3. `TeamCollaboration` - 25 edges
4. `MatchRecord` - 24 edges
5. `SideId` - 20 edges
6. `ArenaTransport` - 18 edges
7. `CollabClient` - 18 edges
8. `TeamChatClient` - 17 edges
9. `DocumentRevision` - 14 edges
10. `CollabDocs` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GameService` --references--> `MatchSocketPresence`  [EXTRACTED]
  services/game/src/game/game.service.ts → services/game/src/game/match-socket-presence.ts
- `SubmissionDocument` --references--> `DocumentRevision`  [EXTRACTED]
  packages/arena-game/src/team-collaboration.ts → packages/arena-game/src/records.ts
- `TeamMemberSnapshot` --references--> `DocumentRevision`  [EXTRACTED]
  packages/arena-game/src/team-collaboration.ts → packages/arena-game/src/records.ts
- `TeamCollaboration` --references--> `CollabDocs`  [EXTRACTED]
  packages/arena-game/src/team-collaboration.ts → packages/arena-game/src/collab.ts
- `SidecarState` --references--> `CollabClient`  [EXTRACTED]
  frontend/src/arena/sidecars.ts → frontend/src/arena/collab.ts

## Import Cycles
- None detected.

## Communities (12 total, 2 thin omitted)

### Community 0 - "GameService"
Cohesion: 0.07
Nodes (9): Injectable, GameGateway, roomFor(), ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer (+1 more)

### Community 1 - "team-collaboration.ts"
Cohesion: 0.13
Nodes (26): collabRoomId(), CollabRow, CountedResult, DocumentRevision, ForfeitRecord, GroupResult, MatchRecord, MemberReadiness (+18 more)

### Community 2 - "sidecars.ts"
Cohesion: 0.07
Nodes (28): TeamChatClient, TeamChatClientOptions, TeamChatStatus, ArenaSidecarLifecycle, configKey(), createArenaSidecarLifecycle(), cancelChatPending(), cancelCollabPending() (+20 more)

### Community 3 - "ArenaTransport"
Cohesion: 0.06
Nodes (15): adapt(), adaptFinal(), adaptReveal(), ServerReveal, ServerSnapshot, shouldApplyUpdate(), SocketTransportOptions, StaleCommandError (+7 more)

### Community 4 - "socket-auth.ts"
Cohesion: 0.10
Nodes (23): Catch, ref_arena_game_engine, ref_arena_model, ref_nestjs_common, ref_nestjs_websockets, ref_node_crypto, ref_socket_io, CollabGateway (+15 more)

### Community 6 - "CollabClient"
Cohesion: 0.14
Nodes (10): b64ToBytes(), bytesToB64(), COLLAB_TEXT_KEY, CollabClient, CollabConnection, CollabSyncPayload, colorForUser(), encodeRemoteCursor() (+2 more)

### Community 7 - "CollabDocs"
Cohesion: 0.11
Nodes (8): b64decode(), b64encode(), COLLAB_TEXT_KEY, CollabDocs, CollabPersist, InMemoryCollabPersist, TeamCollaborationOptions, ref_yjs

### Community 8 - "TeamChatGateway"
Cohesion: 0.23
Nodes (6): TeamChatGateway, ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 9 - "MatchSocketPresence"
Cohesion: 0.25
Nodes (4): MatchSocketPresence, MatchSocketPresenceMode, MatchSocketPresenceState, MatchSocketPresenceTarget

### Community 10 - "game/principal.ts"
Cohesion: 0.29
Nodes (4): ref_express, express-serve-static-core, Request, RequestPrincipal

## Knowledge Gaps
- **30 isolated node(s):** `CountedResult`, `ForfeitRecord`, `GroupResult`, `RevealSnapshot`, `SubmissionRecord` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 115 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameService` connect `GameService` to `TeamChatGateway`, `MatchSocketPresence`, `socket-auth.ts`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `SocketArenaTransport` connect `SocketArenaTransport` to `ArenaTransport`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `ArenaTransport` connect `ArenaTransport` to `SocketArenaTransport`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `CountedResult`, `ForfeitRecord`, `GroupResult` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `GameService` be split into smaller, more focused modules?**
  _Cohesion score 0.06848357791754019 - nodes in this community are weakly interconnected._
- **Should `team-collaboration.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1278825995807128 - nodes in this community are weakly interconnected._
- **Should `sidecars.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06560283687943262 - nodes in this community are weakly interconnected._