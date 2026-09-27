import { afterEach, describe, expect, it } from "vitest";
import { BoundedJobQueue } from "../src/job-queue.js";

const serverModulePath = "../src/http-server.js";
const TOKEN = "worker-test-token-32-bytes-long";
const limits = {
  compileWallMs: 1000,
  runWallMs: 1000,
  runMemoryMb: 64,
  runOutputBytes: 1024,
  runCpus: 1,
  runPids: 16,
};
const visibleRequest = {
  language: "Python",
  driver: "snippet",
  source: "def solve(value): return value\n",
  tests: [{ id: "visible-1", input: "value = 1", expected: "1" }],
  limits,
};

const servers: Array<{ close: (callback: (error?: Error) => void) => void }> = [];

async function loadServerModule(): Promise<any> {
  let loaded: any;
  try {
    loaded = await import(serverModulePath);
  } catch {
    loaded = null;
  }
  expect(loaded?.createJudgeWorkerServer).toBeTypeOf("function");
  return loaded;
}

async function startServer(options: Record<string, unknown> = {}) {
  const { createJudgeWorkerServer } = await loadServerModule();
  const server = createJudgeWorkerServer({
    token: TOKEN,
    judge: {
      provider: "fake",
      runVisible: async () => [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }],
      evaluateSealed: async (request: any) => ({
        groups: request.groups.map((group: any) => ({
          name: group.name,
          weight: group.weight,
          results: group.tests.map((test: any) => ({ id: test.id, passed: true, status: "accepted", runtimeMs: 1 })),
        })),
      }),
      ...((options.judge as object | undefined) ?? {}),
    },
    queue: options.queue ?? new BoundedJobQueue({
      concurrency: 1,
      maxQueueSize: 1,
      queueTimeoutMs: 100,
      executionTimeoutMs: 500,
    }),
    readiness: options.readiness ?? { check: async () => ({ ready: true, docker: true, images: { python: true, gcc: true } }) },
    maxBodyBytes: options.maxBodyBytes ?? 4096,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

function post(url: string, token?: string, body: unknown = visibleRequest): Promise<Response> {
  return fetch(`${url}/v1/run-visible`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function postSealed(url: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${url}/v1/evaluate-sealed`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("judge worker HTTP API", () => {
  it("requires bearer authentication before dispatching a judge call", async () => {
    let calls = 0;
    const url = await startServer({ judge: { runVisible: async () => {
      calls++;
      return [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }];
    } } });

    expect((await post(url)).status).toBe(401);
    expect((await post(url, "wrong-token")).status).toBe(401);
    const authorized = await post(url, TOKEN);
    expect(authorized.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("rejects oversized request bodies before judge dispatch", async () => {
    let calls = 0;
    const url = await startServer({
      maxBodyBytes: 256,
      judge: { runVisible: async () => { calls++; return []; } },
    });
    const response = await post(url, TOKEN, { ...visibleRequest, source: "x".repeat(1024) });

    expect(response.status).toBe(413);
    expect(calls).toBe(0);
  });

  it("implements the sealed GameJudge method without returning case inputs or expected answers", async () => {
    const url = await startServer();
    const response = await postSealed(url, TOKEN, {
      evaluationId: "evaluation",
      submissionId: "submission",
      problemVersionId: "problem-v1",
      hiddenSuiteId: "suite-v1",
      language: "Python",
      driver: "snippet",
      source: "def solve(value): return value",
      groups: [{ name: "hidden", weight: 1, tests: [{ id: "hidden-1", input: "value=1", expected: "1" }] }],
      limits,
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.groups[0].results).toEqual([
      { id: "hidden-1", passed: true, status: "accepted", runtimeMs: 1 },
    ]);
    expect(JSON.stringify(result)).not.toContain("value=1");
    expect(JSON.stringify(result)).not.toContain('"expected"');
  });

  it("reports Docker and image readiness failures and recovers without restarting Game", async () => {
    let available = false;
    let calls = 0;
    const url = await startServer({
      readiness: {
        check: async () => ({ ready: available, docker: available, images: { python: available, gcc: available } }),
      },
      judge: { runVisible: async () => { calls++; return []; } },
    });

    expect((await fetch(`${url}/ready`)).status).toBe(503);
    expect((await post(url, TOKEN)).status).toBe(503);
    expect(calls).toBe(0);

    available = true;
    expect((await fetch(`${url}/ready`)).status).toBe(200);
    expect((await post(url, TOKEN)).status).toBe(200);
    expect(calls).toBe(1);
  });

  it("maps queue saturation to 429 while the accepted job completes", async () => {
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const url = await startServer({
      queue: new BoundedJobQueue({ concurrency: 1, maxQueueSize: 0, queueTimeoutMs: 100, executionTimeoutMs: 500 }),
      judge: { runVisible: async () => {
        signalStarted();
        await new Promise((resolve) => setTimeout(resolve, 60));
        return [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }];
      } },
    });

    const active = post(url, TOKEN);
    await started;
    expect((await post(url, TOKEN)).status).toBe(429);
    expect((await active).status).toBe(200);
  });

  it("times out the HTTP job and serves new work after the timed-out execution settles", async () => {
    let calls = 0;
    const url = await startServer({
      queue: new BoundedJobQueue({ concurrency: 1, maxQueueSize: 1, queueTimeoutMs: 150, executionTimeoutMs: 20 }),
      judge: { runVisible: async () => {
        calls++;
        if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 60));
        return [{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 1 }];
      } },
    });

    expect((await post(url, TOKEN)).status).toBe(504);
    await new Promise((resolve) => setTimeout(resolve, 55));
    expect((await post(url, TOKEN)).status).toBe(200);
  });
});
