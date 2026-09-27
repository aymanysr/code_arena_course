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
import { GameService } from "./game.service.js";
import { attachSocketPrincipal, principalFromHandshake, requireSocketPrincipal, socketPrincipal } from "./socket-auth.js";

/**
 * Collaboration transport (ticket 15): a SEPARATE Socket.IO namespace from the
 * Arena game socket, carrying only Yjs document traffic:
 *
 *   join -> "sync" baseline (authoritative state + revision + language)
 *   "update" (client Yjs frame) -> server applies to the authoritative Y.Doc
 *     -> accepted frame relayed to teammates ("remote-update")
 *   "cursor" -> ephemeral awareness relay ("peer-cursor"), never the engine
 *
 * Game authority (RoundPhase, readiness, submit, reveal, presence, forfeit)
 * never flows here — the game gateway owns it. The engine emits
 * readiness.changed on the GAME namespace when an accepted edit bumps the
 * application revision, so both transports stay consistent.
 *
 * Authorization runs BEFORE any document sync: the trusted-principal seam
 * (DEV_PRINCIPAL) supplies identity, then collabSync verifies membership +
 * 2v2 + resolves the caller's own side/round. Failures disconnect with zero
 * document bytes. Room identity is server-derived (match:round:side), never
 * a client-supplied string.
 */
@WebSocketGateway({ namespace: "/collab", cors: { origin: true } })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly game: GameService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = principalFromHandshake(client, { matchIdRequired: true });
      const { userId, matchId } = principal;
      // Throws for strangers, 1v1 participants, unknown matches: no sync, no leak.
      const sync = await this.game.collabSync(userId, matchId);
      attachSocketPrincipal(client, principal);
      client.data.room = sync.roomId;
      client.data.roundId = sync.roundId;
      await client.join(sync.roomId);
      client.emit("sync", sync);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Awareness is ephemeral: tell surviving teammates to drop the cursor.
    // Never touches game presence/forfeit (ticket 11 authority stays put).
    const room = client.data?.room;
    const principal = socketPrincipal(client, { matchIdRequired: true });
    if (typeof room === "string" && principal) {
      this.server?.to(room).emit("peer-left", { userId: principal.userId });
    }
  }

  @SubscribeMessage("update")
  async onUpdate(@ConnectedSocket() client: Socket, @MessageBody() body: { roundId: string; updateB64: string }) {
    try {
      const principal = requireSocketPrincipal(client, { matchIdRequired: true });
      const { userId, matchId } = principal;
      if (!body || typeof body.roundId !== "string" || typeof body.updateB64 !== "string") {
        throw new Error("malformed collab update");
      }
      if (body.updateB64.length > 262144 || body.roundId.length > 128) {
        throw new Error("collab update frame exceeds limit");
      }
      const res = await this.game.applyCollabUpdate(userId, matchId, { roundId: body.roundId, updateB64: body.updateB64 });
      // Round advanced since join: move the socket to the current room so
      // later frames broadcast to the right teammates.
      if (body.roundId !== client.data.roundId) {
        const sync = await this.game.collabSync(userId, matchId);
        await client.leave(client.data.room);
        client.data.room = sync.roomId;
        client.data.roundId = sync.roundId;
        await client.join(sync.roomId);
        client.emit("sync", sync);
      }
      client.to(client.data.room).emit("remote-update", { updateB64: body.updateB64, revision: res.revision, roundId: body.roundId });
      return { ok: true as const, revision: res.revision, changed: res.changed };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "update failed" };
    }
  }

  @SubscribeMessage("cursor")
  onCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { clientId?: number; anchor?: number; head?: number; displayName?: string; color?: string },
  ) {
    // ponytail: awareness relay only — no engine call, no revision, no auth
    // re-check beyond the join-time gate. Ceiling: a compromised teammate
    // could spoof cursor labels; upgrade path is server-signed presence.
    try {
      const room = client.data?.room;
      const principal = requireSocketPrincipal(client, { matchIdRequired: true });
      if (typeof room !== "string") throw new Error("unauthorized");
      client.to(room).emit("peer-cursor", {
        userId: principal.userId,
        clientId: typeof body?.clientId === "number" ? body.clientId : null,
        anchor: typeof body?.anchor === "number" ? body.anchor : null,
        head: typeof body?.head === "number" ? body.head : null,
        displayName: typeof body?.displayName === "string" ? body.displayName.slice(0, 40) : null,
        color: typeof body?.color === "string" ? body.color.slice(0, 16) : null,
      });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "cursor failed" };
    }
  }
}
