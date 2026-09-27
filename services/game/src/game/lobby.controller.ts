import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseFilters } from "@nestjs/common";
import type { Request } from "express";
import { EngineErrorFilter } from "./errors.js";
import { GameService } from "./game.service.js";
import { requirePrincipal } from "./principal.js";
import type { MatchMode } from "arena-model";
import type { LobbySideId } from "arena-game-engine";

@Controller("lobby")
@UseFilters(EngineErrorFilter)
export class LobbyController {
  constructor(private readonly game: GameService) {}

  @Post("queue")
  async joinQueue(@Req() req: Request, @Body() body: { mode: MatchMode }) {
    const { userId } = requirePrincipal(req);
    if (body?.mode !== "1v1" && body?.mode !== "2v2") {
      throw new BadRequestException("invalid match mode");
    }
    const entry = await this.game.joinQueue(userId, body.mode);
    return { ok: true, entry };
  }

  @Post("queue/cancel")
  async cancelQueue(@Req() req: Request) {
    const { userId } = requirePrincipal(req);
    const result = await this.game.cancelQueue(userId);
    return { ok: true, ...result };
  }

  @Get("queue/status")
  async queueStatus(@Req() req: Request) {
    const { userId } = requirePrincipal(req);
    const entry = await this.game.queueStatus(userId);
    return { ok: true, entry };
  }

  @Post("rooms")
  async createRoom(@Req() req: Request, @Body() body: { mode: MatchMode }) {
    const { userId } = requirePrincipal(req);
    if (body?.mode !== "1v1" && body?.mode !== "2v2") {
      throw new BadRequestException("invalid match mode");
    }
    const result = await this.game.createPrivateRoom(userId, body.mode);
    return { ok: true, ...result };
  }

  @Post("rooms/join")
  async joinRoom(@Req() req: Request, @Body() body: { code: string }) {
    const { userId } = requirePrincipal(req);
    if (typeof body?.code !== "string" || !body.code.trim()) {
      throw new BadRequestException("invite code is required");
    }
    if (body.code.trim().length > 32) {
      throw new BadRequestException("invalid invite code format");
    }
    const result = await this.game.joinPrivateRoom(userId, body.code);
    return { ok: true, ...result };
  }

  @Get("rooms/:id")
  async getRoom(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    const result = await this.game.roomForMember(userId, id);
    return { ok: true, ...result };
  }

  @Post("rooms/:id/side")
  async setSide(@Req() req: Request, @Param("id") id: string, @Body() body: { sideId: LobbySideId }) {
    const { userId } = requirePrincipal(req);
    if (body?.sideId !== "left" && body?.sideId !== "right") {
      throw new BadRequestException("invalid sideId");
    }
    const result = await this.game.setRoomMemberSide(userId, id, body.sideId);
    return { ok: true, ...result };
  }

  @Post("rooms/:id/ready")
  async setReady(@Req() req: Request, @Param("id") id: string, @Body() body: { ready: boolean }) {
    const { userId } = requirePrincipal(req);
    if (typeof body?.ready !== "boolean") {
      throw new BadRequestException("ready must be a boolean");
    }
    const result = await this.game.setRoomMemberReady(userId, id, body.ready);
    return { ok: true, ...result };
  }

  @Post("rooms/:id/leave")
  async leaveRoom(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    const result = await this.game.leavePrivateRoom(userId, id);
    return { ok: true, ...result };
  }

  @Post("rooms/:id/start")
  async startRoom(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    const result = await this.game.startPrivateRoom(userId, id);
    return { ok: true, ...result };
  }

  @Get("active")
  async active(@Req() req: Request) {
    const { userId } = requirePrincipal(req);
    const queue = await this.game.queueStatus(userId);
    const room = await this.game.userActiveRoom(userId);
    return { ok: true, queue, room };
  }
}
