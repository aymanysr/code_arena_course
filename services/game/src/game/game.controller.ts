import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseFilters } from "@nestjs/common";
import type { Request } from "express";
import { EngineErrorFilter } from "./errors.js";
import { GameService } from "./game.service.js";
import { requirePrincipal } from "./principal.js";

/**
 * HTTP adapter: parsing, principal extraction, DTO validation, error mapping.
 * No domain logic here — everything delegates to GameService/ArenaEngine.
 * There is deliberately NO endpoint for setting phase/score/side/reveal/timer.
 */
@Controller("matches")
@UseFilters(EngineErrorFilter)
export class GameController {
  constructor(private readonly game: GameService) {}

  @Post()
  create(@Req() req: Request, @Body() body: { mode: "1v1" | "2v2"; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }) {
    requirePrincipal(req);
    // ponytail: direct match creation is a dev/E2E fixture (lobby mints
    // matches internally via the engine). It must never mint arbitrary
    // participants/sides/problems in production, so it stays behind the
    // same DEV_PRINCIPAL seam as the test identity header.
    if (process.env.DEV_PRINCIPAL !== "true") {
      throw new NotFoundException("not found");
    }
    if (
      (body?.mode !== "1v1" && body?.mode !== "2v2") ||
      !Array.isArray(body.participants) ||
      !Array.isArray(body.problemVersionIds)
    ) {
      return { error: "invalid match request" };
    }
    return this.game.createMatch(body);
  }

  @Get(":id/snapshot")
  snapshot(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.snapshot(userId, id);
  }

  @Post(":id/start")
  start(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.startRound(userId, id);
  }

  @Post(":id/begin")
  begin(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.beginCoding(userId, id);
  }

  @Post(":id/run")
  run(@Req() req: Request, @Param("id") id: string, @Body() body: { code: string; language: string }) {
    const { userId } = requirePrincipal(req);
    if (typeof body?.code !== "string" || body.code.length > 65536) {
      throw new BadRequestException("code must be a string up to 64KB");
    }
    if (typeof body?.language !== "string" || body.language.length > 32) {
      throw new BadRequestException("invalid language");
    }
    return this.game.run(userId, id, body);
  }

  @Post(":id/ready")
  ready(@Req() req: Request, @Param("id") id: string, @Body() body: { ready: boolean; documentRevision?: number }) {
    const { userId } = requirePrincipal(req);
    if (typeof body?.ready !== "boolean") return { error: "ready must be a boolean" };
    return this.game.setReady(userId, id, { ready: body.ready, documentRevision: body.documentRevision });
  }

  @Post(":id/language")
  language(@Req() req: Request, @Param("id") id: string, @Body() body: { language: string }) {
    const { userId } = requirePrincipal(req);
    if (typeof body?.language !== "string" || !body.language || body.language.length > 32) {
      throw new BadRequestException("language is required and must be <= 32 chars");
    }
    return this.game.setTeamLanguage(userId, id, body.language);
  }

  @Post(":id/submit")
  submit(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { code: string; language: string; submissionId?: string; evaluationId?: string; documentRevision?: number },
  ) {
    const { userId } = requirePrincipal(req);
    if (typeof body?.code !== "string" || body.code.length > 65536) {
      throw new BadRequestException("code must be a string up to 64KB");
    }
    if (typeof body?.language !== "string" || body.language.length > 32) {
      throw new BadRequestException("invalid language");
    }
    return this.game.submit(userId, id, body);
  }

  @Post(":id/advance")
  advance(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.advance(userId, id);
  }

  @Post(":id/leave")
  leave(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.leave(userId, id);
  }

  @Get(":id/final")
  final(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.final(userId, id);
  }

  @Get(":id/team-chat-auth")
  teamChatAuth(@Req() req: Request, @Param("id") id: string) {
    const { userId } = requirePrincipal(req);
    return this.game.resolveTeamChatContext(userId, id);
  }
}
