import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { GameModule } from "./game/game.module.js";

@Module({ imports: [GameModule], controllers: [HealthController] })
export class AppModule {}
