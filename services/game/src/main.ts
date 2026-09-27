import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  // ponytail: permissive CORS for local/dev only — production serves the
  // frontend and API behind Nginx same-origin (compose), then this narrows.
  app.enableCors({ origin: true });
  await app.listen(Number(process.env.PORT ?? 3002), "0.0.0.0");
}

void bootstrap();
