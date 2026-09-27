import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { GameController } from "./game.controller.js";
import { LobbyController } from "./lobby.controller.js";
import { CollabGateway } from "./collab.gateway.js";
import { GameGateway } from "./game.gateway.js";
import { LobbyGateway } from "./lobby.gateway.js";
import { TeamChatGateway } from "./team-chat.gateway.js";
import { GameService } from "./game.service.js";
import { devPrincipalMiddleware } from "./principal.js";

@Module({
  controllers: [GameController, LobbyController],
  providers: [GameService, GameGateway, CollabGateway, TeamChatGateway, LobbyGateway],
})
export class GameModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(devPrincipalMiddleware)
      .forRoutes(
        { path: "matches", method: RequestMethod.ALL },
        { path: "matches/{*path}", method: RequestMethod.ALL },
        { path: "lobby", method: RequestMethod.ALL },
        { path: "lobby/{*path}", method: RequestMethod.ALL },
      );
  }
}
