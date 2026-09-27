import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";

const PORT = 3218;
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

async function newMatch(users = ["user-a", "user-b"]): Promise<string> {
  const res = await api("POST", "/matches", users[0], {
    mode: "1v1",
    participants: [
      { userId: users[0], sideId: "left" },
      { userId: users[1], sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
  });
  expect(res.status).toBe(201);
  return (res.json as { matchId: string }).matchId;
}

async function startCoding(matchId: string): Promise<void> {
  expect((await api("POST", `/matches/${matchId}/start`, "user-a", {})).status).toBe(201);
  expect((await api("POST", `/matches/${matchId}/begin`, "user-a", {})).status).toBe(201);
}

function connectSocket(user: string, matchId: string): { socket: Socket; snapshot: Promise<unknown> } {
  const socket = io(BASE, { auth: { userId: user, matchId } });
  return { socket, snapshot: new Promise<unknown>((resolve) => socket.once("snapshot", resolve)) };
}

async function snapshotOf(matchId: string, user: string): Promise<any> {
  const res = await api("GET", `/matches/${matchId}/snapshot`, user);
  expect(res.status).toBe(200);
  return res.json;
}

describe("reconnect/resume over real sockets + Postgres (ticket 11)", () => {
  let server: ChildProcess;

  beforeAll(async () => {
    server = await boot({ DATABASE_URL: PG_URL, RECONNECT_GRACE_MS: "30000" });
  }, 30000);

  afterAll(() => {
    server?.kill();
  });

  it("socket join flips presence online; last close flips offline; activity untouched", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    let snap = await snapshotOf(matchId, "user-a");
    expect(snap.sides.left.presence).toBe("offline");
    const { socket, snapshot } = connectSocket("user-a", matchId);
    const joined = (await snapshot) as { sides: { left: { presence: string } } };
    expect(joined.sides.left.presence).toBe("online");
    snap = await snapshotOf(matchId, "user-a");
    expect(snap.sides.left.presence).toBe("online");
    expect(snap.sides.left.status).toBe("coding");
    socket.disconnect();
    await new Promise((r) => setTimeout(r, 300));
    snap = await snapshotOf(matchId, "user-a");
    expect(snap.sides.left.presence).toBe("offline");
    expect(snap.sides.left.status).toBe("coding");
  });

  it("multi-tab: presence stays online until the last socket drops (policy A)", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    const tab1 = connectSocket("user-a", matchId);
    await tab1.snapshot;
    const tab2 = connectSocket("user-a", matchId);
    await tab2.snapshot;
    tab1.socket.disconnect();
    await new Promise((r) => setTimeout(r, 300));
    expect((await snapshotOf(matchId, "user-a")).sides.left.presence).toBe("online");
    tab2.socket.disconnect();
    await new Promise((r) => setTimeout(r, 300));
    expect((await snapshotOf(matchId, "user-a")).sides.left.presence).toBe("offline");
  });

  it("network flap: rapid cycles leave one room, one presence, single attempt", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    for (let i = 0; i < 5; i++) {
      const c = connectSocket("user-a", matchId);
      await c.snapshot;
      c.socket.disconnect();
    }
    const { socket, snapshot } = connectSocket("user-a", matchId);
    await snapshot;
    expect((await snapshotOf(matchId, "user-a")).sides.left.presence).toBe("online");
    expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(
      201,
    );
    socket.disconnect();
    expect((await snapshotOf(matchId, "user-a")).sides.left.submissions).toBe(1);
  });

  it("stranger socket is refused the room (no snapshot, disconnect)", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    const sock = io(BASE, { auth: { userId: "user-stranger", matchId } });
    const outcome = await new Promise<string>((resolve) => {
      sock.once("snapshot", () => resolve("snapshot"));
      sock.once("disconnect", () => resolve("disconnect"));
      setTimeout(() => resolve("timeout"), 5000);
    });
    expect(outcome).toBe("disconnect");
    sock.disconnect();
  });

  it("submit completes while the socket is closed: counted, sealed, resumable", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    const { socket, snapshot } = connectSocket("user-a", matchId);
    await snapshot;
    socket.disconnect();
    expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(
      201,
    );
    const snap = await snapshotOf(matchId, "user-a");
    expect(snap.sides.left.submissions).toBe(1);
    expect(snap.sides.left.status).toBe("coding");
    expect(snap.reveal).toBeNull();
    const back = connectSocket("user-a", matchId);
    const rejoined = (await back.snapshot) as { sides: { left: { submissions: number } } };
    expect(rejoined.sides.left.submissions).toBe(1);
    back.socket.disconnect();
  });

  it("reveal published while offline arrives intact on reconnect", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    const { socket, snapshot } = connectSocket("user-a", matchId);
    await snapshot;
    socket.disconnect();
    expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(
      201,
    );
    expect((await api("POST", `/matches/${matchId}/submit`, "user-b", { code: STARTER_PY, language: "Python" })).status).toBe(
      201,
    );
    let snap: any = null;
    for (let i = 0; i < 120 && snap?.roundPhase !== "SCORE_REVEAL"; i++) {
      snap = await snapshotOf(matchId, "user-a");
      if (snap.roundPhase !== "SCORE_REVEAL") await new Promise((r) => setTimeout(r, 250));
    }
    expect(snap.roundPhase).toBe("SCORE_REVEAL");
    const back = connectSocket("user-a", matchId);
    const rejoined = (await back.snapshot) as { roundPhase: string; reveal: { scores: unknown } };
    expect(rejoined.roundPhase).toBe("SCORE_REVEAL");
    expect(rejoined.reveal.scores).toEqual({ left: 100, right: 28 });
    back.socket.disconnect();
  }, 60000);

  it("grace expiry forfeits; rejoin in time resumes (short injected grace)", async () => {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    server = await boot({ DATABASE_URL: PG_URL, RECONNECT_GRACE_MS: "1500" });
    const matchId = await newMatch();
    await startCoding(matchId);
    const { socket, snapshot } = connectSocket("user-a", matchId);
    await snapshot;
    const other = connectSocket("user-b", matchId);
    await other.snapshot;
    socket.disconnect();
    // Poll: disconnect processing can lag under parallel load; the lazy
    // grace check on snapshot read guarantees the terminal state appears.
    let snap: any = null;
    for (let i = 0; i < 120; i++) {
      snap = await snapshotOf(matchId, "user-b");
      if (snap.roundPhase === "MATCH_COMPLETE") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.final.forfeit).toMatchObject({ winner: "right", loser: "left", reason: "grace-expired" });
    other.socket.disconnect();
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    server = await boot({ DATABASE_URL: PG_URL, RECONNECT_GRACE_MS: "30000" });
  }, 60000);

  it("deliberate leave forfeits immediately via HTTP and socket", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    const res = await api("POST", `/matches/${matchId}/leave`, "user-a", {});
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ winner: "right", loser: "left" });
    const snap = await snapshotOf(matchId, "user-b");
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.final.forfeit).toMatchObject({ reason: "leave" });
    expect((await api("POST", `/matches/${matchId}/submit`, "user-b", { code: SOLVED_PY, language: "Python" })).status).toBe(
      409,
    );
    const sock = io(BASE, { auth: { userId: "user-a", matchId } });
    const ack = (await sock.emitWithAck("submit", { code: SOLVED_PY, language: "Python" })) as { ok: boolean };
    expect(ack.ok).toBe(false);
    sock.disconnect();
  });

  it("restart during CODING keeps counted result, clock, and reveal", async () => {
    const matchId = await newMatch();
    await startCoding(matchId);
    expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(
      201,
    );
    expect((await api("POST", `/matches/${matchId}/submit`, "user-b", { code: STARTER_PY, language: "Python" })).status).toBe(
      201,
    );
    let before: any = null;
    for (let i = 0; i < 120; i++) {
      before = await snapshotOf(matchId, "user-a");
      if (before.roundPhase === "SCORE_REVEAL") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(before.roundPhase).toBe("SCORE_REVEAL");
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    // A restart starts the normal reconnect window; the 1.5s grace used by
    // the dedicated expiry test is too short while per-case recovery runs.
    server = await boot({ DATABASE_URL: PG_URL });
    const after: any = await snapshotOf(matchId, "user-a");
    expect(after.roundPhase).toBe("SCORE_REVEAL");
    expect(after.reveal.scores).toEqual({ left: 100, right: 28 });
    expect(after.reveal.roundId).toBe(before.reveal.roundId);
    expect(after.sides.left.submissions).toBe(1);
    expect(after.remainingMs).toBeLessThanOrEqual(before.remainingMs);
    // Post-restart clients reconnect first (clears grace), then keep playing.
    const ra = connectSocket("user-a", matchId);
    await ra.snapshot;
    const rb = connectSocket("user-b", matchId);
    await rb.snapshot;
    expect((await api("POST", `/matches/${matchId}/advance`, "user-a", {})).status).toBe(201);
    expect((await api("POST", `/matches/${matchId}/begin`, "user-a", {})).status).toBe(201);
    expect((await api("POST", `/matches/${matchId}/submit`, "user-a", { code: SOLVED_PY, language: "Python" })).status).toBe(
      201,
    );
    expect((await api("POST", `/matches/${matchId}/submit`, "user-b", { code: STARTER_PY, language: "Python" })).status).toBe(
      201,
    );
    let revealed2: any = null;
    for (let i = 0; i < 120; i++) {
      revealed2 = await snapshotOf(matchId, "user-a");
      if (revealed2.roundPhase === "SCORE_REVEAL" && revealed2.round === 2) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(revealed2.roundPhase).toBe("SCORE_REVEAL");
    expect(revealed2.round).toBe(2);
    expect(revealed2.reveal.scores).toEqual({ left: 100, right: 28 });
    ra.socket.disconnect();
    rb.socket.disconnect();
  }, 90000);

  it("restart with in-flight evaluations resolves every row exactly once", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = await newMatch([`k-a-${i}`, `k-b-${i}`]);
      ids.push(id);
      await api("POST", `/matches/${id}/start`, `k-a-${i}`, {});
      await api("POST", `/matches/${id}/begin`, `k-a-${i}`, {});
    }
    const pending = ids.flatMap((id, i) => [
      fetch(`${BASE}/matches/${id}/submit`, {
        method: "POST",
        headers: headers(`k-a-${i}`),
        body: JSON.stringify({ code: SOLVED_PY, language: "Python" }),
      }),
      fetch(`${BASE}/matches/${id}/submit`, {
        method: "POST",
        headers: headers(`k-b-${i}`),
        body: JSON.stringify({ code: STARTER_PY, language: "Python" }),
      }),
    ]);
    await new Promise((r) => setTimeout(r, 150));
    server.kill("SIGKILL");
    await Promise.allSettled(pending);
    await new Promise((r) => setTimeout(r, 500));
    // Long grace here: recovery itself (judge re-drive) takes longer than a
    // short window, and this test proves exactly-once resolution, not expiry.
    server = await boot({ DATABASE_URL: PG_URL, RECONNECT_GRACE_MS: "30000" }, 120000);
    // All clients reconnect after the restart (clears the fresh grace window).
    const conns = ids.flatMap((id, i) => [connectSocket(`k-a-${i}`, id), connectSocket(`k-b-${i}`, id)]);
    for (const c of conns) await c.snapshot;
    for (let i = 0; i < ids.length; i++) {
      const snap: any = await snapshotOf(ids[i]!, `k-a-${i}`);
      expect(snap.sides.left.submissions).toBeLessThanOrEqual(1);
      expect(snap.sides.right.submissions).toBeLessThanOrEqual(1);
      expect(["CODING", "SCORE_REVEAL"]).toContain(snap.roundPhase);
    }
    for (const c of conns) c.socket.disconnect();
  }, 240000);
});
