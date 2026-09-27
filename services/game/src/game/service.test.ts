import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io } from "socket.io-client";

const PORT = 3217;
const BASE = `http://localhost:${PORT}`;
const PG_URL = process.env.TEST_PG_URL ?? "postgres://postgres:postgres@localhost:5433/arena_test";

const SOLVED_PY = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;
const STARTER_PY = `def ledger_sum(nums):
    return 0
`;

function headers(user?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (user) h["x-dev-user-id"] = user;
  return h;
}

async function api(method: string, path: string, user?: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(user),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function boot(extraEnv: Record<string, string> = {}, timeoutMs = 20000): Promise<ChildProcess> {
  const child = spawn("node", ["dist/main.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, PORT: String(PORT), DEV_PRINCIPAL: "true", ...extraEnv },
    stdio: "ignore",
  });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return child;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("service did not boot");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe("game service integration (real HTTP + sockets + containers)", () => {
  let server: ChildProcess;

  beforeAll(async () => {
    server = await boot();
  }, 30000);

  afterAll(() => {
    server?.kill();
  });

  async function newMatch(): Promise<string> {
    const res = await api("POST", "/matches", "user-a", {
      mode: "1v1",
      participants: [
        { userId: "user-a", sideId: "left" },
        { userId: "user-b", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });
    expect(res.status).toBe(201);
    return (res.json as { matchId: string }).matchId;
  }

  it("auth: missing principal 401, stranger 403", async () => {
    const matchId = await newMatch();
    expect((await api("GET", `/matches/${matchId}/snapshot`)).status).toBe(401);
    expect((await api("GET", `/matches/${matchId}/snapshot`, "user-stranger")).status).toBe(403);
    expect((await api("POST", `/matches/${matchId}/submit`, "user-stranger", { code: "x", language: "Python" })).status).toBe(403);
  });

  it("HTTP 1v1 real E2E: run, submit, auto-reveal x3, final", async () => {
    const matchId = await newMatch();
    await api("POST", `/matches/${matchId}/start`, "user-a", {});
    await api("POST", `/matches/${matchId}/begin`, "user-a", {});
        for (let round = 0; round < 3; round++) {
      const run = await api("POST", `/matches/${matchId}/run`, "user-a", { code: SOLVED_PY, language: "Python" });
      expect(run.status).toBe(201);
      expect((run.json as { tests: Array<{ passed: boolean }> }).tests.every((t) => t.passed)).toBe(true);
      expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(201);
      expect((await api("POST", `/matches/${matchId}/submit`, "user-b", { code: STARTER_PY, language: "Python" })).status).toBe(201);
      let snap: unknown = null;
      for (let i = 0; i < 40; i++) {
        const s = await api("GET", `/matches/${matchId}/snapshot`, "user-a");
        snap = s.json;
        if ((snap as { roundPhase: string }).roundPhase === "SCORE_REVEAL") break;
        await new Promise((r) => setTimeout(r, 250));
      }
      expect((snap as { roundPhase: string }).roundPhase).toBe("SCORE_REVEAL");
      expect((snap as { reveal: { scores: unknown } }).reveal.scores).toEqual({ left: 100, right: 28 });
      expect((snap as { reveal: { groups: unknown } }).reveal.groups).toBeDefined();
      await api("POST", `/matches/${matchId}/advance`, "user-a", {});
      if (round < 2) await api("POST", `/matches/${matchId}/begin`, "user-a", {});
    }
    const fin = await api("GET", `/matches/${matchId}/final`, "user-a");
    expect((fin.json as { scores: unknown }).scores).toEqual({ left: 300, right: 84 });
    expect((fin.json as { winner: unknown }).winner).toBe("left");
  }, 180000);

  it("sockets: snapshot on connect, actions by ack, shared reveal broadcast", async () => {
    const matchId = await newMatch();
    await api("POST", `/matches/${matchId}/start`, "user-a", {});
    await api("POST", `/matches/${matchId}/begin`, "user-a", {});
    const sockA = io(BASE, { auth: { userId: "user-a", matchId } });
    const sockB = io(BASE, { auth: { userId: "user-b", matchId } });
    const snapA = await new Promise<unknown>((resolve) => sockA.once("snapshot", resolve));
    expect((snapA as { roundPhase: string }).roundPhase).toBe("CODING");
    const runAck = await sockA.emitWithAck("run", { code: SOLVED_PY, language: "Python" });
    expect(runAck.ok).toBe(true);
    const reveals: unknown[] = [];
    sockA.on("reveal.published", (p) => reveals.push(["a", p]));
    sockB.on("reveal.published", (p) => reveals.push(["b", p]));
    expect(((await sockA.emitWithAck("submit", { code: SOLVED_PY, language: "Python" })) as { ok: boolean }).ok).toBe(true);
    expect(((await sockB.emitWithAck("submit", { code: STARTER_PY, language: "Python" })) as { ok: boolean }).ok).toBe(true);
    const deadline = Date.now() + 15000;
    while (reveals.length < 2 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    expect(reveals.length).toBe(2);
    sockA.disconnect();
    sockB.disconnect();
  }, 60000);

  it("restart with Postgres keeps counted result and reveal", async () => {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    server = await boot({ DATABASE_URL: PG_URL });
    const matchId = await newMatch();
    await api("POST", `/matches/${matchId}/start`, "user-a", {});
    await api("POST", `/matches/${matchId}/begin`, "user-a", {});
    expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(201);
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    server = await boot({ DATABASE_URL: PG_URL }, 60000);
    const snap = await api("GET", `/matches/${matchId}/snapshot`, "user-a");
    expect((snap.json as { sides: { left: { submissions: number } } }).sides.left.submissions).toBe(1);
  }, 120000);
});
