import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const nginxConfig = readFileSync(resolve(repositoryRoot, "infra/nginx/nginx.conf"), "utf8");

function composeConfig(): any {
  try {
    const rendered = execFileSync(
      "docker",
      ["compose", "--env-file", ".env.example", "config", "--format", "json"],
      { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    return JSON.parse(rendered);
  } catch {
    throw new Error("Docker Compose configuration could not be rendered");
  }
}

function volumeTargets(service: any): string[] {
  return (service.volumes ?? []).map((volume: any) => typeof volume === "string" ? volume : volume.target);
}

describe("single-host judge Compose boundary", () => {
  it("gives the socket only to the private worker and keeps Game/Nginx off its network path", () => {
    const config = composeConfig();
    const worker = config.services["judge-worker"];
    const game = config.services.game;
    const nginx = config.services.nginx;

    expect(worker).toBeDefined();
    expect(worker.ports ?? []).toEqual([]);
    expect(Object.keys(worker.networks ?? {})).toEqual(["judge-internal"]);
    expect(volumeTargets(worker)).toContain("/var/run/docker.sock");
    expect(volumeTargets(game)).not.toContain("/var/run/docker.sock");
    expect(worker.environment).not.toHaveProperty("POSTGRES_PASSWORD");
    expect(worker.environment).not.toHaveProperty("GAME_DB_PASSWORD");
    const socketServices = Object.entries(config.services)
      .filter(([, service]: [string, any]) => volumeTargets(service).includes("/var/run/docker.sock"))
      .map(([name]) => name);
    expect(socketServices).toEqual(["judge-worker"]);
    expect(Object.keys(game.networks ?? {})).toEqual(expect.arrayContaining(["default", "judge-internal"]));
    expect(config.networks["judge-internal"].internal).toBe(true);
    expect(nginx.depends_on?.["judge-worker"]).toBeUndefined();
    expect(nginx.ports).toBeDefined();
    expect(nginxConfig).not.toContain("judge-worker");
    expect(nginxConfig).toMatch(/location\s+~\s+\^\/\(matches\|lobby\)/);
    expect(nginxConfig).toMatch(/location\s+\/socket\.io\//);
  });

  it("selects the worker explicitly and waits for its readiness before Game serves", () => {
    const config = composeConfig();
    const worker = config.services["judge-worker"];
    const game = config.services.game;

    expect(game.environment.JUDGE_BACKEND).toBe("worker");
    expect(game.environment.JUDGE_WORKER_URL).toBe("http://judge-worker:3010");
    expect(game.depends_on["judge-worker"].condition).toBe("service_healthy");
    expect(worker.healthcheck).toBeDefined();
  });

  it("keeps shared .env credentials out of services that do not need them", () => {
    const config = composeConfig();
    const postgres = config.services.postgres;
    const core = config.services.core;
    const chat = config.services.chat;
    const game = config.services.game;
    const worker = config.services["judge-worker"];

    expect(Object.keys(postgres.environment).sort()).toEqual([
      "CHAT_DB_NAME", "CHAT_DB_PASSWORD", "CHAT_DB_USER",
      "CORE_DB_NAME", "CORE_DB_PASSWORD", "CORE_DB_USER",
      "GAME_DB_NAME", "GAME_DB_PASSWORD", "GAME_DB_USER",
      "POSTGRES_PASSWORD", "POSTGRES_USER",
    ]);
    expect(Object.keys(core.environment).sort()).toEqual(["PORT", "SERVICE_NAME"]);
    expect(Object.keys(chat.environment).sort()).toEqual(["PORT", "SERVICE_NAME"]);
    expect(game.environment).toHaveProperty("JUDGE_WORKER_TOKEN");
    expect(game.environment).not.toHaveProperty("CORE_DB_PASSWORD");
    expect(game.environment).not.toHaveProperty("CHAT_DB_PASSWORD");
    expect(worker.environment).toHaveProperty("JUDGE_WORKER_TOKEN");
  });
});
