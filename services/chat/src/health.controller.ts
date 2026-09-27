import { Controller, Get } from "@nestjs/common";
import { ALL_ROUND_PHASES } from "arena-model";
import * as net from "node:net";

const SERVICE = process.env.SERVICE_NAME ?? "chat";

function tcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

@Controller()
export class HealthController {
  /** Liveness: the process is up and the shared model resolves at runtime. */
  @Get("health")
  health() {
    return { status: "ok", service: SERVICE, modelPhases: ALL_ROUND_PHASES.length };
  }

  /** Readiness: dependencies reachable over the compose network. No gameplay here. */
  @Get("ready")
  async ready() {
    const postgres = await tcp(process.env.POSTGRES_HOST ?? "postgres", 5432, 500);
    const redis = await tcp(process.env.REDIS_HOST ?? "redis", 6379, 500);
    return { ready: postgres && redis, checks: { postgres, redis } };
  }
}
