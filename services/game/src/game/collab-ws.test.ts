import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";

/**
 * Ticket 15 service proof: the collaboration namespace authorizes BEFORE any
 * document sync, relays real Yjs frames between teammates only, and keeps
 * awareness out of the revision. Boots the real NestJS service (no mocks).
 */

const PORT = 3220;
const BASE = `http://localhost:${PORT}`;

const A1 = "t15-a1";
const A2 = "t15-a2";
const B1 = "t15-b1";
const B2 = "t15-b2";
const STRANGER = "t15-stranger";

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
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("service did not boot");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function newTeamMatch(): Promise<string> {
  const res = await api("POST", "/matches", A1, {
    mode: "2v2",
    participants: [
      { userId: A1, sideId: "left" },
      { userId: A2, sideId: "left" },
      { userId: B1, sideId: "right" },
      { userId: B2, sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger"],
  });
  expect(res.status).toBe(201);
  const matchId = res.json.matchId as string;
  expect((await api("POST", `/matches/${matchId}/start`, A1)).status).toBe(201);
  expect((await api("POST", `/matches/${matchId}/begin`, A1)).status).toBe(201);
  return matchId;
}

interface CollabSync {
  roomId: string;
  roundId: string;
  side: string;
  stateB64: string;
  source: string;
  revision: number;
  language: string;
}

/** Connects to /collab; resolves with the sync baseline or rejects when refused. */
function connectCollab(userId: string, matchId: string): Promise<{ sock: Socket; sync: CollabSync }> {
  return new Promise((resolve, reject) => {
    const sock = io(`${BASE}/collab`, { auth: { userId, matchId } });
    const timer = setTimeout(() => {
      sock.disconnect();
      reject(new Error(`no collab sync for ${userId}`));
    }, 10000);
    sock.once("sync", (sync) => {
      clearTimeout(timer);
      resolve({ sock, sync: sync as CollabSync });
    });
    sock.once("connect_error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.once("disconnect", () => {
      clearTimeout(timer);
      reject(new Error(`refused collab room for ${userId}`));
    });
  });
}

function emitAck(sock: Socket, event: string, body: unknown): Promise<any> {
  return new Promise((resolve) => {
    sock.emit(event, body, (res: unknown) => resolve(res));
  });
}

async function ownRevision(userId: string, matchId: string): Promise<number | null> {
  const snap = await api("GET", `/matches/${matchId}/snapshot`, userId);
  expect(snap.status).toBe(200);
  const mySide = snap.json.mySide as string;
  const team = (snap.json.teams as Array<{ side: string; documentRevision: number | null }>).find((t) => t.side === mySide);
  return team?.documentRevision ?? null;
}

let child: ChildProcess | undefined;

beforeAll(async () => {
  child = await boot();
}, 30000);

afterAll(() => {
  child?.kill();
});

describe("collab namespace authorization (reject BEFORE sync)", () => {
  it("1. teammates join their own room; stranger gets nothing", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const a2 = await connectCollab(A2, matchId);
    expect(a1.sync.side).toBe("left");
    expect(a2.sync.side).toBe("left");
    expect(a1.sync.roomId).toBe(a2.sync.roomId);
    expect(a1.sync.revision).toBe(1);
    // Stranger: refused with zero document bytes.
    let strangerSync: unknown = null;
    try {
      const s = await connectCollab(STRANGER, matchId);
      strangerSync = s.sync;
      s.sock.disconnect();
    } catch {
      // expected refusal
    }
    expect(strangerSync).toBeNull();
    a1.sock.disconnect();
    a2.sock.disconnect();
  });

  it("2. Beta cannot enter Alpha's room (rooms are server-derived)", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const b1 = await connectCollab(B1, matchId);
    expect(b1.sync.side).toBe("right");
    expect(b1.sync.roomId).not.toBe(a1.sync.roomId);
    a1.sock.disconnect();
    b1.sock.disconnect();
  });

  it("3. 1v1 participant is refused the collab endpoint", async () => {
    const res = await api("POST", "/matches", "solo-left", {
      mode: "1v1",
      participants: [
        { userId: "solo-left", sideId: "left" },
        { userId: "solo-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    expect(res.status).toBe(201);
    const soloId = res.json.matchId as string;
    let sync: unknown = null;
    try {
      const s = await connectCollab("solo-left", soloId);
      sync = s.sync;
      s.sock.disconnect();
    } catch {
      // expected refusal
    }
    expect(sync).toBeNull();
  });
});

describe("real Yjs frames over the collab socket", () => {
  it("4. A1 edit reaches A2 and bumps the application revision once", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const a2 = await connectCollab(A2, matchId);
    const remote = new Promise<{ updateB64: string; revision: number }>((resolve) => {
      a2.sock.once("remote-update", (p) => resolve(p as { updateB64: string; revision: number }));
    });
    const client = new Y.Doc();
    if (a1.sync.stateB64) Y.applyUpdate(client, new Uint8Array(Buffer.from(a1.sync.stateB64, "base64")));
    client.getText("source").insert(client.getText("source").length, "\n# a1-live-edit");
    const updateB64 = Buffer.from(Y.encodeStateAsUpdate(client)).toString("base64");
    const ack = await emitAck(a1.sock, "update", { roundId: a1.sync.roundId, updateB64 });
    expect(ack.ok).toBe(true);
    expect(ack.revision).toBe(2);
    const got = await remote;
    expect(got.revision).toBe(2);
    // Teammate applies the relayed frame: converges to the same text.
    const peer = new Y.Doc();
    if (a2.sync.stateB64) Y.applyUpdate(peer, new Uint8Array(Buffer.from(a2.sync.stateB64, "base64")));
    Y.applyUpdate(peer, new Uint8Array(Buffer.from(got.updateB64, "base64")));
    expect(peer.getText("source").toString()).toContain("# a1-live-edit");
    expect(await ownRevision(A2, matchId)).toBe(2);
    a1.sock.disconnect();
    a2.sock.disconnect();
  });

  it("5. duplicate frame is acked without a second bump", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const client = new Y.Doc();
    if (a1.sync.stateB64) Y.applyUpdate(client, new Uint8Array(Buffer.from(a1.sync.stateB64, "base64")));
    client.getText("source").insert(0, "DUP");
    const updateB64 = Buffer.from(Y.encodeStateAsUpdate(client)).toString("base64");
    const first = await emitAck(a1.sock, "update", { roundId: a1.sync.roundId, updateB64 });
    const second = await emitAck(a1.sock, "update", { roundId: a1.sync.roundId, updateB64 });
    expect(first).toMatchObject({ ok: true, revision: 2, changed: true });
    expect(second).toMatchObject({ ok: true, revision: 2, changed: false });
    a1.sock.disconnect();
  });

  it("6. cursor awareness relays to teammates and never bumps the revision", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const a2 = await connectCollab(A2, matchId);
    const seen = new Promise<{ userId: string }>((resolve) => {
      a2.sock.once("peer-cursor", (p) => resolve(p as { userId: string }));
    });
    const ack = await emitAck(a1.sock, "cursor", { anchor: 3, head: 7, displayName: "A1", color: "#0f0" });
    expect(ack.ok).toBe(true);
    expect((await seen).userId).toBe(A1);
    expect(await ownRevision(A1, matchId)).toBe(1);
    a1.sock.disconnect();
    a2.sock.disconnect();
  });

  it("7. frames scoped to a non-current round are denied (late old-round writes die here)", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const client = new Y.Doc();
    if (a1.sync.stateB64) Y.applyUpdate(client, new Uint8Array(Buffer.from(a1.sync.stateB64, "base64")));
    client.getText("source").insert(0, "LATE");
    const updateB64 = Buffer.from(Y.encodeStateAsUpdate(client)).toString("base64");
    // Engine test 9 proves rejection after a REAL advance; here the socket
    // path proves any non-current roundId is denied before touching the doc.
    const stale = await emitAck(a1.sock, "update", { roundId: "round-that-never-was", updateB64 });
    expect(stale.ok).toBe(false);
    expect(await ownRevision(A1, matchId)).toBe(1);
    a1.sock.disconnect();
  });

  it("8. duplicate update after lost ack is idempotent and revision unchanged", async () => {
    const matchId = await newTeamMatch();
    const a1 = await connectCollab(A1, matchId);
    const client = new Y.Doc();
    if (a1.sync.stateB64) Y.applyUpdate(client, new Uint8Array(Buffer.from(a1.sync.stateB64, "base64")));
    client.getText("source").insert(0, "DUP");
    const updateB64 = Buffer.from(Y.encodeStateAsUpdate(client)).toString("base64");
    const first = await emitAck(a1.sock, "update", { roundId: a1.sync.roundId, updateB64 });
    expect(first).toMatchObject({ ok: true, revision: 2, changed: true });
    const second = await emitAck(a1.sock, "update", { roundId: a1.sync.roundId, updateB64 });
    expect(second).toMatchObject({ ok: true, revision: 2, changed: false });
    a1.sock.disconnect();
  });

  it("9. dev-only doc-changed seam removed", async () => {
    const matchId = await newTeamMatch();
    // Endpoint no longer exists (404).
    const res = await api("POST", `/matches/${matchId}/doc-changed`, A1, {});
    expect(res.status).toBe(404);
  });
});
