import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";

const PORT = 3223;
const BASE = `http://localhost:${PORT}`;

function headers(user?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (user) h["x-dev-user-id"] = user;
  return h;
}

async function api(method: string, p: string, user?: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: headers(user),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function boot(): Promise<ChildProcess> {
  const child = spawn("node", ["dist/main.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, PORT: String(PORT), DEV_PRINCIPAL: "true" },
    stdio: "ignore",
  });
  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return child;
    } catch {
      // waiting for port
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("service did not boot");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe("Lobby and Matchmaking Service (HTTP + WebSocket)", () => {
  let server: ChildProcess;

  beforeAll(async () => {
    server = await boot();
  }, 25000);

  afterAll(async () => {
    if (server) {
      server.kill("SIGKILL");
      await new Promise((r) => setTimeout(r, 200));
    }
  });

  it("enforces authentication: missing principal returns 401", async () => {
    const q = await api("POST", "/lobby/queue", undefined, { mode: "1v1" });
    expect(q.status).toBe(401);

    const r = await api("POST", "/lobby/rooms", undefined, { mode: "1v1" });
    expect(r.status).toBe(401);
  });

  it("rejects room reads and subscriptions by non-members", async () => {
    const host = `secure-host-${Date.now()}`;
    const stranger = `secure-stranger-${Date.now()}`;
    const created = await api("POST", "/lobby/rooms", host, { mode: "1v1" });
    const roomId = created.json.room.id;
    const socket = io(`${BASE}/lobby`, { auth: { userId: stranger }, transports: ["websocket"] });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      const ack = await socket.timeout(2000).emitWithAck("lobby:join_room", { roomId });
      expect(ack.ok).toBe(false);
      expect((await api("GET", `/lobby/rooms/${roomId}`, stranger)).status).toBe(403);
      expect((await api("GET", `/lobby/rooms/${roomId}`, host)).status).toBe(200);
    } finally {
      socket.disconnect();
    }
  });

  it("stops private updates after a member leaves", async () => {
    const host = `owner-${Date.now()}`;
    const guest = `departing-${Date.now()}`;
    const created = await api("POST", "/lobby/rooms", host, { mode: "2v2" });
    const room = created.json.room;
    await api("POST", "/lobby/rooms/join", guest, { code: room.code });
    const socket = io(`${BASE}/lobby`, { auth: { userId: guest }, transports: ["websocket"] });
    try {
      await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
      expect((await socket.timeout(2000).emitWithAck("lobby:join_room", { roomId: room.id })).ok).toBe(true);
      await api("POST", `/lobby/rooms/${room.id}/leave`, guest);
      const updates: unknown[] = [];
      socket.on("lobby.roomUpdated", data => updates.push(data));
      await api("POST", `/lobby/rooms/${room.id}/ready`, host, { ready: true });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(updates).toHaveLength(0);
    } finally { socket.disconnect(); }
  });

  it("returns HTTP errors for invalid modes and unknown invite codes", async () => {
    expect((await api("POST", "/lobby/queue", "invalid-mode", { mode: "3v3" })).status).toBe(400);
    expect((await api("POST", "/lobby/rooms/join", "invalid-code", { code: "ZZZZZZ" })).status).toBe(404);
  });

  it("public queue: joins 1v1 queue, matches 2 players, and forms authoritative match", async () => {
    const u1 = `q-user-1-${Date.now()}`;
    const u2 = `q-user-2-${Date.now()}`;

    // u1 joins queue
    const j1 = await api("POST", "/lobby/queue", u1, { mode: "1v1" });
    expect(j1.status).toBe(201);
    expect(j1.json.ok).toBe(true);
    expect(j1.json.entry.status).toBe("waiting");

    // Status check
    const s1 = await api("GET", "/lobby/queue/status", u1);
    expect(s1.json.entry.status).toBe("waiting");

    // u2 joins queue -> triggers match formation
    const j2 = await api("POST", "/lobby/queue", u2, { mode: "1v1" });
    expect(j2.status).toBe(201);

    // Wait briefly for async matchmaking commit
    let matchedMatchId: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const s = await api("GET", "/lobby/queue/status", u1);
      if (s.json.entry?.status === "matched" && s.json.entry?.matchedMatchId) {
        matchedMatchId = s.json.entry.matchedMatchId;
        break;
      }
    }

    expect(matchedMatchId).not.toBeNull();

    // Verify formed match exists in engine and has MATCH_FOUND phase
    const snap = await api("GET", `/matches/${matchedMatchId}/snapshot`, u1);
    expect(snap.status).toBe(200);
    expect(snap.json.roundPhase).toBe("MATCH_FOUND");
    expect(snap.json.sides).toBeDefined();
  });

  it("private room: full flow with invite code, side selection, ready-up, and host start gate", async () => {
    const host = `host-${Date.now()}`;
    const guest = `guest-${Date.now()}`;

    // 1. Host creates 1v1 room
    const c = await api("POST", "/lobby/rooms", host, { mode: "1v1" });
    expect(c.status).toBe(201);
    expect(c.json.ok).toBe(true);
    const room = c.json.room;
    expect(room.code).toHaveLength(6);
    expect(c.json.members).toHaveLength(1);
    expect(c.json.members[0].sideId).toBe("left");
    expect(c.json.members[0].ready).toBe(false);

    // 2. Connect live socket for host
    const hostSocket: Socket = io(`${BASE}/lobby`, {
      auth: { userId: host },
      transports: ["websocket"],
    });

    const hostUpdates: any[] = [];
    let hostMatchFound: any = null;

    await new Promise<void>((resolve, reject) => {
      hostSocket.on("connect", () => resolve());
      hostSocket.on("connect_error", (err) => reject(err));
      hostSocket.on("lobby.roomUpdated", (data) => hostUpdates.push(data));
      hostSocket.on("lobby.matchFound", (data) => { hostMatchFound = data; });
    });

    hostSocket.emit("lobby:join_room", { roomId: room.id });
    await new Promise((r) => setTimeout(r, 100));

    // 3. Guest joins by code
    const j = await api("POST", "/lobby/rooms/join", guest, { code: room.code });
    expect(j.status).toBe(201);
    expect(j.json.members).toHaveLength(2);
    expect(j.json.members.find((m: any) => m.userId === guest)?.sideId).toBe("right");

    // Wait for live roomUpdated event on host socket
    await new Promise((r) => setTimeout(r, 150));
    expect(hostUpdates.length).toBeGreaterThan(0);

    // 4. Intruders cannot join full room
    const intruder = await api("POST", "/lobby/rooms/join", `intruder-${Date.now()}`, { code: room.code });
    expect(intruder.status).toBe(409);
    expect(intruder.json.error).toMatch(/full/i);

    // 5. Host cannot start before ready
    const earlyStart = await api("POST", `/lobby/rooms/${room.id}/start`, host);
    expect(earlyStart.status).toBe(400);
    expect(earlyStart.json.error).toMatch(/ready/i);

    // 6. Guest readies up
    const rGuest = await api("POST", `/lobby/rooms/${room.id}/ready`, guest, { ready: true });
    expect(rGuest.status).toBe(201);
    expect(rGuest.json.members.find((m: any) => m.userId === guest)?.ready).toBe(true);

    // 7. Non-host cannot start
    const guestStart = await api("POST", `/lobby/rooms/${room.id}/start`, guest);
    expect(guestStart.status).toBe(403);

    // 8. Host readies up
    const rHost = await api("POST", `/lobby/rooms/${room.id}/ready`, host, { ready: true });
    expect(rHost.status).toBe(201);

    // 9. Host starts room
    const startRes = await api("POST", `/lobby/rooms/${room.id}/start`, host);
    expect(startRes.status).toBe(201);
    expect(startRes.json.matchId).toBeDefined();
    const matchId = startRes.json.matchId;

    // Verify socket received lobby.matchFound
    await new Promise((r) => setTimeout(r, 200));
    expect(hostMatchFound).not.toBeNull();
    expect(hostMatchFound.matchId).toBe(matchId);

    // 10. Late joiners to started room are rejected
    const late = await api("POST", "/lobby/rooms/join", `late-${Date.now()}`, { code: room.code });
    expect(late.status).toBe(409);
    expect(late.json.error).toMatch(/already started/i);

    hostSocket.disconnect();
  });
});
