import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { GameService } from "./game.service.js";
import {
  attachSocketPrincipal,
  principalFromHandshake,
  requireSocketPrincipal,
  socketPrincipal,
  type MatchSocketPrincipal,
} from "./socket-auth.js";

function roomFor(matchId: string): string {
  return `match:${matchId}`;
}

/**
 * Real-time transport: game-owned event fan-out per match room.
 * Connection: trusted principal (DEV_PRINCIPAL seam) -> membership verified
 * against the match -> authorized room only -> authoritative snapshot ->
 * incremental events. Client payloads never carry identity: every action
 * re-resolves the side from the socket principal.
 */
@WebSocketGateway({ cors: { origin: true } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly game: GameService) {
    this.game.onEvent((event, matchId, payload) => {
      if (matchId) this.server?.to(roomFor(matchId)).emit(event, payload);
    });
  }

  /**
   * Authoritative reconnect attach (ticket 11 §2/§3, strategy C): verify
   * membership, register the socket (presence), join the room FIRST, then
   * take the snapshot and send it as the ONE baseline. Events emitted between
   * join and baseline still reach this socket (it is already in the room) and
   * each triggers a full authoritative refresh client-side, so nothing is
   * lost between snapshot and subscription. Revision ordering (§3) lets the
   * client drop stale/out-of-order updates after reconnect.
   */
  async handleConnection(client: Socket): Promise<void> {
    let opened = false;
    let principal: MatchSocketPrincipal | null = null;
    try {
      principal = principalFromHandshake(client, { matchIdRequired: true });
      const { userId, matchId } = principal;
      await this.game.snapshot(userId, matchId);
      await this.game.noteSocketOpen(userId, matchId, client.id);
      opened = true;
      attachSocketPrincipal(client, principal);
      await client.join(roomFor(matchId));
      client.emit("snapshot", await this.game.snapshot(userId, matchId));
    } catch {
      if (opened) {
        try {
          if (principal?.matchId) await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id);
        } catch {
          // Best effort only.
        }
      }
      client.disconnect(true);
    }
  }

  /**
   * Socket loss is NEVER a leave (ticket 11 §15): it only decrements the
   * per-user socket count, flipping the side offline at the last socket so
   * grace accounting starts. The match, clock, and evaluations continue.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const principal = socketPrincipal(client, { matchIdRequired: true });
    if (principal?.matchId) {
      await this.game.noteSocketClosed(principal.userId, principal.matchId, client.id);
    }
  }

  @SubscribeMessage("run")
  async onRun(@ConnectedSocket() client: Socket, @MessageBody() body: { code: string; language: string }) {
    try {
      const principal = requireSocketPrincipal(client, { matchIdRequired: true });
      const result = await this.game.run(principal.userId, principal.matchId, body);
      return { ok: true as const, result };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "run failed" };
    }
  }

  @SubscribeMessage("submit")
  async onSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string; language: string; submissionId?: string; evaluationId?: string },
  ) {
    try {
      const principal = requireSocketPrincipal(client, { matchIdRequired: true });
      const result = await this.game.submit(principal.userId, principal.matchId, body);
      return { ok: true as const, result };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "submit failed" };
    }
  }

  @SubscribeMessage("setReady")
  async onReady(@ConnectedSocket() client: Socket, @MessageBody() body: { value: boolean; documentRevision?: number }) {
    // 2v2: revision-bound per-player readiness (engine-enforced). 1v1 keeps
    // the legacy no-op ack — the engine returns without effect there.
    try {
      const principal = requireSocketPrincipal(client, { matchIdRequired: true });
      await this.game.setReady(principal.userId, principal.matchId, {
        ready: body?.value === true,
        documentRevision: body?.documentRevision,
      });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "setReady failed" };
    }
  }

  @SubscribeMessage("leave")
  async onLeave(@ConnectedSocket() client: Socket) {
    // Deliberate leave only: immediate forfeit (§15). Socket loss never lands
    // here — handleDisconnect owns that path and never forfeits.
    try {
      const principal = requireSocketPrincipal(client, { matchIdRequired: true });
      const result = await this.game.leave(principal.userId, principal.matchId);
      return { ok: true as const, result };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "leave failed" };
    }
  }
}
