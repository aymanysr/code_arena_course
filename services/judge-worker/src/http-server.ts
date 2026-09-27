import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type {
  DriverKind,
  GameJudge,
  JudgeLimits,
  SealedEvaluationRequest,
  SupportedLanguage,
  VisibleTest,
} from "arena-game-engine";
import {
  BoundedJobQueue,
  QueueExecutionTimeoutError,
  QueueFullError,
  QueueWaitTimeoutError,
} from "./job-queue.js";
import type { JudgeReadinessProbe } from "./readiness.js";

export interface JudgeWorkerServerOptions {
  token: string;
  judge: GameJudge;
  queue: BoundedJobQueue;
  readiness: JudgeReadinessProbe;
  maxBodyBytes?: number;
}

class BodyTooLargeError extends Error {
  constructor() {
    super("request body too large");
    this.name = "BodyTooLargeError";
  }
}

class InvalidRequestError extends Error {
  constructor() {
    super("invalid judge request");
    this.name = "InvalidRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is SupportedLanguage {
  return value === "C" || value === "C++" || value === "Python";
}

function isDriver(value: unknown): value is DriverKind {
  return value === "snippet" || value === "stdio";
}

function isLimits(value: unknown): value is JudgeLimits {
  if (!isRecord(value)) return false;
  return [
    value.compileWallMs,
    value.runWallMs,
    value.runMemoryMb,
    value.runOutputBytes,
    value.runCpus,
    value.runPids,
  ].every((number) => typeof number === "number" && Number.isFinite(number) && number > 0);
}

function isStringField(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string";
}

function parseVisibleRequest(value: unknown): {
  language: SupportedLanguage;
  driver: DriverKind;
  source: string;
  tests: VisibleTest[];
  limits: JudgeLimits;
} {
  if (!isRecord(value) || !isLanguage(value.language) || !isDriver(value.driver)
    || !isStringField(value, "source") || !isLimits(value.limits) || !Array.isArray(value.tests)) {
    throw new InvalidRequestError();
  }
  const tests = value.tests.map((test) => {
    if (!isRecord(test) || !isStringField(test, "id") || !isStringField(test, "input") || !isStringField(test, "expected")) {
      throw new InvalidRequestError();
    }
    return { id: test.id as string, input: test.input as string, expected: test.expected as string };
  });
  return {
    language: value.language,
    driver: value.driver,
    source: value.source as string,
    tests,
    limits: value.limits,
  };
}

function parseSealedRequest(value: unknown): SealedEvaluationRequest {
  if (!isRecord(value) || !isStringField(value, "evaluationId") || !isStringField(value, "submissionId")
    || !isStringField(value, "problemVersionId") || !isStringField(value, "hiddenSuiteId")
    || !isLanguage(value.language) || !isDriver(value.driver) || !isStringField(value, "source")
    || !isLimits(value.limits) || !Array.isArray(value.groups)
    || (value.entrypoint !== undefined && typeof value.entrypoint !== "string")) {
    throw new InvalidRequestError();
  }
  const groups = value.groups.map((group) => {
    if (!isRecord(group) || !isStringField(group, "name") || typeof group.weight !== "number"
      || !Number.isFinite(group.weight) || group.weight < 0 || !Array.isArray(group.tests)) {
      throw new InvalidRequestError();
    }
    const tests = group.tests.map((test) => {
      if (!isRecord(test) || !isStringField(test, "id") || !isStringField(test, "input") || !isStringField(test, "expected")) {
        throw new InvalidRequestError();
      }
      return { id: test.id as string, input: test.input as string, expected: test.expected as string };
    });
    return { name: group.name as string, weight: group.weight, tests };
  });
  return {
    evaluationId: value.evaluationId as string,
    submissionId: value.submissionId as string,
    problemVersionId: value.problemVersionId as string,
    hiddenSuiteId: value.hiddenSuiteId as string,
    language: value.language,
    driver: value.driver,
    ...(typeof value.entrypoint === "string" ? { entrypoint: value.entrypoint } : {}),
    source: value.source as string,
    groups,
    limits: value.limits,
  };
}

async function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  let tooLarge = Number.isFinite(declaredLength) && declaredLength > maxBytes;
  let total = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > maxBytes) tooLarge = true;
    if (!tooLarge) chunks.push(buffer);
  }
  if (tooLarge) throw new BodyTooLargeError();
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new InvalidRequestError();
  }
}

function authenticated(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization;
  if (typeof header !== "string") return false;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return false;
  const expectedDigest = createHash("sha256").update(expectedToken).digest();
  const providedDigest = createHash("sha256").update(match[1]!).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

function respond(serverResponse: import("node:http").ServerResponse, status: number, body: unknown): void {
  if (serverResponse.writableEnded || serverResponse.destroyed) return;
  const json = JSON.stringify(body);
  serverResponse.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  serverResponse.end(json);
}

function errorResponse(error: unknown): { status: number; body: { error: string } } {
  const name = error instanceof Error ? error.name : "";
  if (error instanceof BodyTooLargeError) return { status: 413, body: { error: "request body too large" } };
  if (error instanceof InvalidRequestError || name === "ValidationError") {
    return { status: 400, body: { error: "invalid judge request" } };
  }
  if (error instanceof QueueFullError) return { status: 429, body: { error: "judge queue is full" } };
  if (error instanceof QueueWaitTimeoutError) return { status: 503, body: { error: "judge queue timed out" } };
  if (error instanceof QueueExecutionTimeoutError) return { status: 504, body: { error: "judge job timed out" } };
  if (name === "JudgeInfraError") return { status: 503, body: { error: "judge unavailable" } };
  return { status: 500, body: { error: "judge request failed" } };
}

/** Internal-only HTTP transport for the existing GameJudge contract. */
export function createJudgeWorkerServer(options: JudgeWorkerServerOptions): Server {
  if (!options.token.trim()) throw new Error("JUDGE_WORKER_TOKEN is required");
  const maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) throw new Error("maxBodyBytes must be positive");

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      const result = errorResponse(error);
      respond(response, result.status, result.body);
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;

  async function handleRequest(request: IncomingMessage, response: import("node:http").ServerResponse): Promise<void> {
    const path = new URL(request.url ?? "/", "http://judge-worker.internal").pathname;
    if (request.method === "GET" && path === "/health") {
      respond(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && path === "/ready") {
      try {
        const checks = await options.readiness.check();
        respond(response, checks.ready ? 200 : 503, { ready: checks.ready, checks });
      } catch {
        respond(response, 503, { ready: false, checks: { docker: false } });
      }
      return;
    }

    const visible = request.method === "POST" && path === "/v1/run-visible";
    const sealed = request.method === "POST" && path === "/v1/evaluate-sealed";
    if (!visible && !sealed) {
      respond(response, path.startsWith("/v1/") ? 405 : 404, { error: path.startsWith("/v1/") ? "method not allowed" : "not found" });
      return;
    }
    if (!authenticated(request, options.token)) {
      respond(response, 401, { error: "unauthorized" });
      return;
    }

    let readiness;
    try {
      readiness = await options.readiness.check();
    } catch {
      respond(response, 503, { error: "judge unavailable" });
      return;
    }
    if (!readiness.ready) {
      respond(response, 503, { error: "judge unavailable" });
      return;
    }

    const body = await readJsonBody(request, maxBodyBytes);
    if (visible) {
      const input = parseVisibleRequest(body);
      const result = await options.queue.run(() => options.judge.runVisible(
        input.language, input.driver, input.source, input.tests, input.limits,
      ));
      respond(response, 200, result);
      return;
    }
    const input = parseSealedRequest(body);
    const result = await options.queue.run(() => options.judge.evaluateSealed(input));
    respond(response, 200, result);
  }

  return server;
}
