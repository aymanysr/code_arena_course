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
import { attachSocketPrincipal, principalFromHandshake, requireSocketPrincipal } from "./socket-auth.js";

function userChannel(userId: string): string {
  return `user:${userId}`;
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

@WebSocketGateway({ namespace: "/lobby", cors: { origin: true } })
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly game: GameService) {
    this.game.onLobbyEvent((event, payload) => {
      if (event === "lobby.roomUpdated") {
        const p = payload as { roomId: string; room: unknown; members: Array<{ userId: string }> };
        if (p?.roomId) {
          this.server?.to(p.members.map((member) => userChannel(member.userId))).emit("lobby.roomUpdated", p);
        }
      } else if (event === "lobby.matchFound") {
        const p = payload as { roomId: string; matchId: string; userIds: string[] };
        if (p?.roomId) {
          this.server?.to(p.userIds.map(userChannel)).emit("lobby.matchFound", { roomId: p.roomId, matchId: p.matchId });
        }
      } else if (event === "lobby.queueMatched") {
        const p = payload as { matchId: string; userIds: string[] };
        if (p?.userIds && Array.isArray(p.userIds)) {
          for (const uid of p.userIds) {
            this.server?.to(userChannel(uid)).emit("lobby.queueMatched", { matchId: p.matchId });
          }
        }
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = principalFromHandshake(client);
      const { userId } = principal;
      attachSocketPrincipal(client, principal);
      await client.join(userChannel(userId));
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    // Rooms are automatically cleaned up by Socket.io on disconnect
  }

  @SubscribeMessage("lobby:join_room")
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const { userId } = requireSocketPrincipal(client);
      if (!body?.roomId) return { ok: false, error: "roomId is required" };
      await this.game.roomForMember(userId, body.roomId);
      await client.join(roomChannel(body.roomId));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "failed to join room" };
    }
  }

  @SubscribeMessage("lobby:leave_room")
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ ok: boolean }> {
    try {
      requireSocketPrincipal(client);
      if (body?.roomId) {
        await client.leave(roomChannel(body.roomId));
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}
