import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";

const PORT = 3219;
const BASE = `http://localhost:${PORT}`;

const A1 = "t14-a1";
const A2 = "t14-a2";
const B1 = "t14-b1";
const B2 = "t14-b2";

const SOLVED_PY = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;

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

async function boot(extraEnv: Record<string, string> = {}): Promise<ChildProcess> {
  const child = spawn("node", ["dist/main.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, PORT: String(PORT), DEV_PRINCIPAL: "true", ...extraEnv },
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
  return res.json.matchId as string;
}

async function startCoding(matchId: string): Promise<void> {
  expect((await api("POST", `/matches/${matchId}/start`, A1)).status).toBe(201);
  expect((await api("POST", `/matches/${matchId}/begin`, A1)).status).toBe(201);
}

function connect(userId: string, matchId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = io(BASE, { auth: { userId, matchId } });
    const timer = setTimeout(() => {
      sock.disconnect();
      reject(new Error(`no baseline for ${userId}`));
    }, 10000);
    sock.once("snapshot", () => {
      clearTimeout(timer);
      resolve(sock);
    });
    sock.once("connect_error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    // Unauthorized room: the gateway disconnects without a baseline.
    sock.once("disconnect", () => {
      clearTimeout(timer);
      reject(new Error(`refused room for ${userId}`));
    });
  });
}

function once(sock: Socket, event: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event}`)), timeoutMs);
    sock.once(event, (p) => {
      clearTimeout(timer);
      resolve(p);
    });
  });
}

/**
 * Ticket 15: drives REAL collaborative text — replaces the whole team source
 * through the /collab socket (one Yjs frame, one application revision).
 * Returns the new revision for revision-bound readiness calls.
 */
async function pushSource(userId: string, matchId: string, text: string): Promise<number> {
  const sock = io(`${BASE}/collab`, { auth: { userId, matchId } });
  try {
    const sync = await once(sock, "sync");
    const doc = new Y.Doc();
    if (sync.stateB64) Y.applyUpdate(doc, Buffer.from(sync.stateB64, "base64"));
    const t = doc.getText("source");
    t.delete(0, t.length);
    t.insert(0, text);
    const updateB64 = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
    const ack = await new Promise<any>((resolve) => sock.emit("update", { roundId: sync.roundId, updateB64 }, resolve));
    if (!ack?.ok) throw new Error(`pushSource failed: ${ack?.error}`);
    return ack.revision as number;
  } finally {
    sock.disconnect();
  }
}

describe("2v2 service integration (real HTTP + sockets + Postgres)", () => {
  let server: ChildProcess;
  beforeAll(async () => {
    server = await boot();
  }, 30000);
  afterAll(() => {
    server?.kill();
  });

  it("1/5. four principals join; stranger denied everywhere", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    for (const u of [A1, A2, B1, B2]) {
      const snap = await api("GET", `/matches/${matchId}/snapshot`, u);
      expect(snap.status).toBe(200);
      expect(snap.json.mode).toBe("2v2");
    }
    expect((await api("GET", `/matches/${matchId}/snapshot`, "stranger")).status).toBe(403);
    expect((await api("POST", `/matches/${matchId}/ready`, "stranger", { ready: true, documentRevision: 1 })).status).toBe(403);
    // Stranger socket never joins the room.
    await expect(connect("stranger", matchId)).rejects.toThrow();
  });

  it("2/3. each member sees their team state; opponent approvals masked", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    const snap = await api("GET", `/matches/${matchId}/snapshot`, A1);
    expect(snap.json.teams).toHaveLength(2);
    const alpha = snap.json.teams.find((t: any) => t.side === "left");
    const beta = snap.json.teams.find((t: any) => t.side === "right");
    expect(alpha.members.map((m: any) => m.userId).sort()).toEqual([A1, A2]);
    expect(beta.members.map((m: any) => m.userId).sort()).toEqual([B1, B2]);
    expect(alpha.documentRevision).toBe(1);
    expect(alpha.language).toBe("Python");
    expect(beta.documentRevision).toBeNull();
    expect(beta.language).toBeNull();
    expect(snap.json.reveal).toBeNull();
    const html = JSON.stringify(snap.json);
    expect(html).not.toContain("1000000000");
  });

  it("4. Alpha competitive acts never touch Beta", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    await api("POST", `/matches/${matchId}/ready`, A1, { ready: true, documentRevision: 1 });
    const betaView = await api("GET", `/matches/${matchId}/snapshot`, B1);
    const beta = betaView.json.teams.find((t: any) => t.side === "right");
    expect(beta.members.every((m: any) => m.ready === false)).toBe(true);
  });

  it("6/7. readiness event reaches the teammate; opponent cannot forge it", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    const a1 = await connect(A1, matchId);
    const a2 = await connect(A2, matchId);
    try {
      const seen = once(a2, "readiness.changed");
      expect((await api("POST", `/matches/${matchId}/ready`, A1, { ready: true, documentRevision: 1 })).status).toBe(201);
      const evt = await seen;
      expect(evt.side).toBe("left");
      // Opponent readiness leaves Alpha approvals alone.
      await api("POST", `/matches/${matchId}/ready`, B1, { ready: true, documentRevision: 1 });
      const snap = await api("GET", `/matches/${matchId}/snapshot`, A1);
      const alpha = snap.json.teams.find((t: any) => t.side === "left");
      expect(alpha.members.find((m: any) => m.userId === A1).ready).toBe(true);
      expect(alpha.members.find((m: any) => m.userId === A2).ready).toBe(false);
    } finally {
      a1.disconnect();
      a2.disconnect();
    }
  });

  it("8/9. shared edit invalidates readiness; stale submit rejected server-side", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    await api("POST", `/matches/${matchId}/ready`, A1, { ready: true, documentRevision: 1 });
    await api("POST", `/matches/${matchId}/ready`, A2, { ready: true, documentRevision: 1 });
    // Ungated submit (no readiness at all) fails; then a REAL shared-document
    // edit invalidates and stale fails.
    const fresh = await newTeamMatch();
    await startCoding(fresh);
    expect((await api("POST", `/matches/${fresh}/submit`, A1, { code: SOLVED_PY, language: "Python", documentRevision: 1 })).status).toBe(409);
    const revision = await pushSource(A1, matchId, `${SOLVED_PY}\n# teammate edit`);
    expect(revision).toBe(2);
    const snap = await api("GET", `/matches/${matchId}/snapshot`, A1);
    const alpha = snap.json.teams.find((t: any) => t.side === "left");
    expect(alpha.members.map((m: any) => m.ready)).toEqual([false, false]);
    expect(
      (await api("POST", `/matches/${matchId}/submit`, A1, { code: SOLVED_PY, language: "Python", documentRevision: 1 })).status,
    ).toBe(409);
    // Re-ready on R2 and submit succeeds with one evaluation.
    await api("POST", `/matches/${matchId}/ready`, A1, { ready: true, documentRevision: 2 });
    await api("POST", `/matches/${matchId}/ready`, A2, { ready: true, documentRevision: 2 });
    const ok = await api("POST", `/matches/${matchId}/submit`, A1, { code: SOLVED_PY, language: "Python", documentRevision: 2 });
    expect(ok.status).toBe(201);
    expect(ok.json.submissionId).toBeTruthy();
    expect(ok.json.evaluationId).toBeTruthy();
  });

  it("10. Alpha evaluation does not block Beta; both teams count, reveal is team scores", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    // Real collaborative text per team: the judge scores the frozen shared
    // source, never the submit payload (payload here is deliberately stale).
    const revA = await pushSource(A1, matchId, SOLVED_PY);
    const revB = await pushSource(B1, matchId, SOLVED_PY);
    for (const u of [A1, A2]) {
      expect((await api("POST", `/matches/${matchId}/ready`, u, { ready: true, documentRevision: revA })).status).toBe(201);
    }
    for (const u of [B1, B2]) {
      expect((await api("POST", `/matches/${matchId}/ready`, u, { ready: true, documentRevision: revB })).status).toBe(201);
    }
    expect((await api("POST", `/matches/${matchId}/submit`, A1, { code: "stale payload", language: "Python", documentRevision: revA })).status).toBe(201);
    expect((await api("POST", `/matches/${matchId}/submit`, B1, { code: "stale payload", language: "Python", documentRevision: revB })).status).toBe(201);
    // ponytail: auto-reveal is fire-and-forget off submit, so poll like the
    // 1v1 suite instead of asserting the immediate snapshot.
    let snap = await api("GET", `/matches/${matchId}/snapshot`, A1);
    for (let i = 0; i < 120 && snap.json.roundPhase !== "SCORE_REVEAL"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      snap = await api("GET", `/matches/${matchId}/snapshot`, A1);
    }
    expect(snap.json.roundPhase).toBe("SCORE_REVEAL");
    expect(snap.json.reveal.scores).toEqual({ left: 100, right: 100 });
  }, 60000);

  it("11. reconnect restores readiness + revision; presence follows sockets", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    const a1 = await connect(A1, matchId);
    await api("POST", `/matches/${matchId}/ready`, A1, { ready: true, documentRevision: 1 });
    a1.disconnect();
    // Reconnect: readiness and revision persist; presence flips back online.
    const again = await connect(A1, matchId);
    try {
      const snap = await api("GET", `/matches/${matchId}/snapshot`, A1);
      const alpha = snap.json.teams.find((t: any) => t.side === "left");
      expect(alpha.members.find((m: any) => m.userId === A1).ready).toBe(true);
      expect(alpha.documentRevision).toBe(1);
      expect(alpha.members.find((m: any) => m.userId === A1).presence).toBe("online");
    } finally {
      again.disconnect();
    }
  });

  it("12. reveal reaches all four authorized clients", async () => {
    const matchId = await newTeamMatch();
    await startCoding(matchId);
    const socks = await Promise.all([connect(A1, matchId), connect(A2, matchId), connect(B1, matchId), connect(B2, matchId)]);
    try {
      const waits = socks.map((s) => once(s, "reveal.published", 30000));
      const revA = await pushSource(A1, matchId, SOLVED_PY);
      const revB = await pushSource(B1, matchId, SOLVED_PY);
      for (const u of [A1, A2]) {
        await api("POST", `/matches/${matchId}/ready`, u, { ready: true, documentRevision: revA });
      }
      for (const u of [B1, B2]) {
        await api("POST", `/matches/${matchId}/ready`, u, { ready: true, documentRevision: revB });
      }
      await api("POST", `/matches/${matchId}/submit`, A1, { code: SOLVED_PY, language: "Python", documentRevision: revA });
      await api("POST", `/matches/${matchId}/submit`, B1, { code: SOLVED_PY, language: "Python", documentRevision: revB });
      const events = await Promise.all(waits);
      expect(events).toHaveLength(4);
      for (const u of [A1, A2, B1, B2]) {
        const snap = await api("GET", `/matches/${matchId}/snapshot`, u);
        expect(snap.json.reveal.scores).toEqual({ left: 100, right: 100 });
      }
    } finally {
      for (const s of socks) s.disconnect();
    }
  }, 60000);
});
