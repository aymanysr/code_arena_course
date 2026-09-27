import { randomUUID } from "node:crypto";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import {
  isTeamPing,
  type TeamChatEntry,
  type TeamChatMessage,
  type TeamChatPing,
} from "arena-model";
import { GameService } from "./game.service.js";
import { attachSocketPrincipal, principalFromHandshake, socketPrincipal } from "./socket-auth.js";

const MAX_HISTORY_PER_ROOM = 25;
const MAX_TEXT_LENGTH = 500;
const MSG_RATE_WINDOW_MS = 2000;
const MSG_RATE_LIMIT = 5;
const PING_RATE_WINDOW_MS = 3000;
const PING_RATE_LIMIT = 3;

/**
 * Team chat & contextual pings transport (ticket 16):
 * Authoritative 2v2 team-room isolation on the /chat namespace.
 *
 * Protocols separated:
 *   - / (default): Arena game authority (readiness, submit, reveal, clock)
 *   - /collab: Yjs document synchronization and awareness
 *   - /chat: Team chat messages and contextual quick pings
 *
 * Chat and pings NEVER mutate ArenaEngine state, NEVER touch Y.Doc or Yjs awareness,
 * NEVER increment DocumentRevision, and NEVER toggle game readiness.
 */
@WebSocketGateway({ namespace: "/chat", cors: { origin: true } })
export class TeamChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  /** Ephemeral in-memory session history per team room (not durable DB storage). */
  private readonly history = new Map<string, TeamChatEntry[]>();
  /** Client message ID idempotency cache per room:user (lost-ack retry deduplication). */
  private readonly clientMsgAcks = new Map<string, { id: string; timestamp: number }>();
  /** Spam prevention / rate limit timestamps per socket ID. */
  private readonly msgTimestamps = new Map<string, number[]>();
  private readonly pingTimestamps = new Map<string, number[]>();

  constructor(private readonly game: GameService) {}

  private checkRateLimit(map: Map<string, number[]>, id: string, windowMs: number, maxAllowed: number): boolean {
    const now = Date.now();
    const timestamps = map.get(id) ?? [];
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length >= maxAllowed) return false;
    valid.push(now);
    map.set(id, valid);
    return true;
  }

  private recordHistory(roomId: string, entry: TeamChatEntry): void {
    let list = this.history.get(roomId);
    if (!list) {
      list = [];
      this.history.set(roomId, list);
    }
    list.push(entry);
    if (list.length > MAX_HISTORY_PER_ROOM) {
      list.shift();
    }
  }

  getRecentHistory(roomId: string): TeamChatEntry[] {
    return this.history.get(roomId) ?? [];
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = principalFromHandshake(client, { matchIdRequired: true });
      const { userId, matchId } = principal;
      // Authoritative game resolution: strangers (NotMemberError) and 1v1 (IllegalStateError) fail closed
      const context = await this.game.resolveTeamChatContext(userId, matchId);

      attachSocketPrincipal(client, principal);
      client.data.sideId = context.sideId;
      client.data.roomId = context.roomId;

      await client.join(context.roomId);
      client.emit("authorized", context);

      const recent = this.getRecentHistory(context.roomId);
      if (recent.length > 0) {
        client.emit("history", recent);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.msgTimestamps.delete(client.id);
    this.pingTimestamps.delete(client.id);
  }

  @SubscribeMessage("message")
  async onMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { text: unknown; clientMessageId?: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string }> {
    const sideId = client.data?.sideId as string | undefined;
    const roomId = client.data?.roomId as string | undefined;
    const principal = socketPrincipal(client, { matchIdRequired: true });

    if (!principal || !sideId || !roomId) {
      return { ok: false, error: "unauthorized" };
    }
    const { userId, matchId } = principal;

    const rawClientMsgId = body?.clientMessageId;
    const clientMessageId = typeof rawClientMsgId === "string" ? rawClientMsgId.trim().slice(0, 64) : undefined;
    if (clientMessageId) {
      const ackKey = `${roomId}:${userId}:${clientMessageId}`;
      const existing = this.clientMsgAcks.get(ackKey);
      if (existing) {
        return { ok: true, id: existing.id };
      }
    }

    if (!this.checkRateLimit(this.msgTimestamps, client.id, MSG_RATE_WINDOW_MS, MSG_RATE_LIMIT)) {
      return { ok: false, error: "rate limit exceeded: too many messages" };
    }

    // Verify match lifecycle: reject new messages once MATCH_COMPLETE
    try {
      const context = await this.game.resolveTeamChatContext(userId, matchId);
      if (!context.active) {
        return { ok: false, error: "chat is disabled after match complete" };
      }
    } catch {
      return { ok: false, error: "match unavailable" };
    }

    if (!body || typeof body.text !== "string") {
      return { ok: false, error: "invalid message payload" };
    }

    const trimmed = body.text.trim();
    if (!trimmed) {
      return { ok: false, error: "empty message" };
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      return { ok: false, error: `message exceeds ${MAX_TEXT_LENGTH} characters` };
    }

    // Sender identity and side are authoritatively derived from the socket session, never trusted from client
    const msg: TeamChatMessage = {
      id: randomUUID(),
      matchId,
      sideId,
      senderUserId: userId,
      text: trimmed,
      timestamp: Date.now(),
      type: "text",
    };

    if (clientMessageId) {
      const ackKey = `${roomId}:${userId}:${clientMessageId}`;
      this.clientMsgAcks.set(ackKey, { id: msg.id, timestamp: msg.timestamp });
      if (this.clientMsgAcks.size > 200) {
        const oldest = this.clientMsgAcks.keys().next().value;
        if (oldest) this.clientMsgAcks.delete(oldest);
      }
    }

    this.recordHistory(roomId, msg);
    this.server?.to(roomId).emit("message", msg);
    return { ok: true, id: msg.id };
  }

  @SubscribeMessage("ping")
  async onPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ping: unknown },
  ): Promise<{ ok: boolean; id?: string; error?: string }> {
    const sideId = client.data?.sideId as string | undefined;
    const roomId = client.data?.roomId as string | undefined;
    const principal = socketPrincipal(client, { matchIdRequired: true });

    if (!principal || !sideId || !roomId) {
      return { ok: false, error: "unauthorized" };
    }
    const { userId, matchId } = principal;

    if (!this.checkRateLimit(this.pingTimestamps, client.id, PING_RATE_WINDOW_MS, PING_RATE_LIMIT)) {
      return { ok: false, error: "rate limit exceeded: too many pings" };
    }

    try {
      const context = await this.game.resolveTeamChatContext(userId, matchId);
      if (!context.active) {
        return { ok: false, error: "match is complete; pings disabled" };
      }
    } catch {
      return { ok: false, error: "match unavailable" };
    }

    if (!body || !isTeamPing(body.ping)) {
      return { ok: false, error: "invalid ping type" };
    }

    // Ping payload contains only safe, necessary context; NO test suites, NO scores
    const pingMsg: TeamChatPing = {
      id: randomUUID(),
      matchId,
      sideId,
      senderUserId: userId,
      ping: body.ping,
      timestamp: Date.now(),
      type: "ping",
    };

    this.recordHistory(roomId, pingMsg);
    this.server?.to(roomId).emit("ping", pingMsg);
    return { ok: true, id: pingMsg.id };
  }
}
