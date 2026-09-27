import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { TeamChatAuthContext, TeamChatMessage, TeamChatPing } from "arena-model";

const PORT = 3221;
const BASE = `http://localhost:${PORT}`;

const A1 = "t16-a1";
const A2 = "t16-a2";
const B1 = "t16-b1";
const B2 = "t16-b2";
const STRANGER = "t16-stranger";

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

function connectChat(userId: string, matchId: string): Promise<{ sock: Socket; auth: TeamChatAuthContext }> {
  return new Promise((resolve, reject) => {
    const sock = io(`${BASE}/chat`, { auth: { userId, matchId }, forceNew: true });
    const timer = setTimeout(() => {
      sock.disconnect();
      reject(new Error(`no chat auth received for ${userId}`));
    }, 10000);
    sock.once("authorized", (auth) => {
      clearTimeout(timer);
      resolve({ sock, auth: auth as TeamChatAuthContext });
    });
    sock.once("connect_error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.once("disconnect", () => {
      clearTimeout(timer);
      reject(new Error(`refused chat room for ${userId}`));
    });
  });
}

function emitAck(sock: Socket, event: string, body: unknown): Promise<{ ok: boolean; id?: string; error?: string }> {
  return new Promise((resolve) => {
    sock.emit(event, body, (res: { ok: boolean; id?: string; error?: string }) => resolve(res));
  });
}

describe("TeamChatGateway: 2v2 isolation, contextual pings, and security", () => {
  let child: ChildProcess;

  beforeAll(async () => {
    child = await boot();
  });

  afterAll(() => {
    child?.kill();
  });

  it("resolves team chat context via HTTP endpoint for authorized members, rejects strangers and 1v1", async () => {
    const matchId = await newTeamMatch();

    // Authorized A1 (Alpha / left)
    const resA1 = await api("GET", `/matches/${matchId}/team-chat-auth`, A1);
    expect(resA1.status).toBe(200);
    expect(resA1.json.sideId).toBe("left");
    expect(resA1.json.roomId).toBe(`arena:${matchId}:team:left`);
    expect(resA1.json.active).toBe(true);

    // Authorized B1 (Beta / right)
    const resB1 = await api("GET", `/matches/${matchId}/team-chat-auth`, B1);
    expect(resB1.status).toBe(200);
    expect(resB1.json.sideId).toBe("right");
    expect(resB1.json.roomId).toBe(`arena:${matchId}:team:right`);

    // Stranger rejected (403)
    const resStranger = await api("GET", `/matches/${matchId}/team-chat-auth`, STRANGER);
    expect(resStranger.status).toBe(403);

    // 1v1 rejected
    const duelRes = await api("POST", "/matches", "duel-a", {
      mode: "1v1",
      participants: [
        { userId: "duel-a", sideId: "left" },
        { userId: "duel-b", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    const duelId = duelRes.json.matchId as string;
    const resDuelChat = await api("GET", `/matches/${duelId}/team-chat-auth`, "duel-a");
    expect(resDuelChat.status).toBe(409); // IllegalStateError maps to 409
  });

  it("four-client isolation: Alpha messages and pings stay in Alpha, Beta stay in Beta", async () => {
    const matchId = await newTeamMatch();

    const cA1 = await connectChat(A1, matchId);
    const cA2 = await connectChat(A2, matchId);
    const cB1 = await connectChat(B1, matchId);
    const cB2 = await connectChat(B2, matchId);

    expect(cA1.auth.roomId).toBe(`arena:${matchId}:team:left`);
    expect(cA2.auth.roomId).toBe(`arena:${matchId}:team:left`);
    expect(cB1.auth.roomId).toBe(`arena:${matchId}:team:right`);
    expect(cB2.auth.roomId).toBe(`arena:${matchId}:team:right`);

    const a1Messages: TeamChatMessage[] = [];
    const a2Messages: TeamChatMessage[] = [];
    const b1Messages: TeamChatMessage[] = [];
    const b2Messages: TeamChatMessage[] = [];

    const a1Pings: TeamChatPing[] = [];
    const a2Pings: TeamChatPing[] = [];
    const b1Pings: TeamChatPing[] = [];
    const b2Pings: TeamChatPing[] = [];

    cA1.sock.on("message", (m: TeamChatMessage) => a1Messages.push(m));
    cA2.sock.on("message", (m: TeamChatMessage) => a2Messages.push(m));
    cB1.sock.on("message", (m: TeamChatMessage) => b1Messages.push(m));
    cB2.sock.on("message", (m: TeamChatMessage) => b2Messages.push(m));

    cA1.sock.on("ping", (p: TeamChatPing) => a1Pings.push(p));
    cA2.sock.on("ping", (p: TeamChatPing) => a2Pings.push(p));
    cB1.sock.on("ping", (p: TeamChatPing) => b1Pings.push(p));
    cB2.sock.on("ping", (p: TeamChatPing) => b2Pings.push(p));

    // A1 sends message "check the empty case"
    const ackA1 = await emitAck(cA1.sock, "message", { text: "check the empty case" });
    expect(ackA1.ok).toBe(true);

    // Wait briefly for socket delivery
    await new Promise((r) => setTimeout(r, 100));

    // A1 and A2 received it; B1 and B2 did NOT
    expect(a1Messages.length).toBe(1);
    expect(a1Messages[0].text).toBe("check the empty case");
    expect(a1Messages[0].senderUserId).toBe(A1);
    expect(a2Messages.length).toBe(1);
    expect(a2Messages[0].text).toBe("check the empty case");
    expect(b1Messages.length).toBe(0);
    expect(b2Messages.length).toBe(0);

    // B1 sends message "watch overflow"
    const ackB1 = await emitAck(cB1.sock, "message", { text: "watch overflow" });
    expect(ackB1.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    // B1 and B2 received it; A1 and A2 did NOT receive B's message
    expect(b1Messages.length).toBe(1);
    expect(b1Messages[0].text).toBe("watch overflow");
    expect(b2Messages.length).toBe(1);
    expect(b2Messages[0].text).toBe("watch overflow");
    expect(a1Messages.length).toBe(1);
    expect(a2Messages.length).toBe(1);

    // A2 sends ping: CHECK_EDGE_CASE
    const ackPingA2 = await emitAck(cA2.sock, "ping", { ping: "CHECK_EDGE_CASE" });
    expect(ackPingA2.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    expect(a1Pings.length).toBe(1);
    expect(a1Pings[0].ping).toBe("CHECK_EDGE_CASE");
    expect(a1Pings[0].senderUserId).toBe(A2);
    expect(b1Pings.length).toBe(0);
    expect(b2Pings.length).toBe(0);

    // B2 sends ping: READY
    const ackPingB2 = await emitAck(cB2.sock, "ping", { ping: "READY" });
    expect(ackPingB2.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    expect(b1Pings.length).toBe(1);
    expect(b1Pings[0].ping).toBe("READY");
    expect(b1Pings[0].senderUserId).toBe(B2);
    expect(a1Pings.length).toBe(1); // Alpha unchanged

    // Prove pings NEVER mutate game readiness authority
    const snapB = await api("GET", `/matches/${matchId}/snapshot`, B2);
    const teamB = snapB.json.teams.find((t: any) => t.side === "right");
    expect(teamB.members.every((m: any) => m.ready === false)).toBe(true);

    cA1.sock.disconnect();
    cA2.sock.disconnect();
    cB1.sock.disconnect();
    cB2.sock.disconnect();
  });

  it("enforces security: stranger rejected, 1v1 rejected, client-forged identity overridden", async () => {
    const matchId = await newTeamMatch();

    // Stranger socket is disconnected with 0 room joins
    await expect(connectChat(STRANGER, matchId)).rejects.toThrow(/refused|no chat auth/);

    // 1v1 player socket is disconnected
    const duelRes = await api("POST", "/matches", "duel-x", {
      mode: "1v1",
      participants: [
        { userId: "duel-x", sideId: "left" },
        { userId: "duel-y", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    const duelId = duelRes.json.matchId as string;
    await expect(connectChat("duel-x", duelId)).rejects.toThrow(/refused|no chat auth/);

    // Forgery prevention: client tries to forge senderUserId and sideId in payload
    const cA1 = await connectChat(A1, matchId);
    let capturedMsg: TeamChatMessage | null = null;
    cA1.sock.on("message", (m: TeamChatMessage) => {
      capturedMsg = m;
    });

    const forgeAck = await emitAck(cA1.sock, "message", {
      text: "attempting forgery",
      senderUserId: B1,
      sideId: "right",
    } as any);
    expect(forgeAck.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));
    expect(capturedMsg).not.toBeNull();
    // Server must derive sender and side from socket auth, NEVER trusting the payload
    expect(capturedMsg!.senderUserId).toBe(A1);
    expect(capturedMsg!.sideId).toBe("left");

    cA1.sock.disconnect();
  });

  it("validates messages and pings: rejects empty, overlong, and invalid ping types", async () => {
    const matchId = await newTeamMatch();
    const cA1 = await connectChat(A1, matchId);

    // Empty / whitespace
    const emptyAck = await emitAck(cA1.sock, "message", { text: "   " });
    expect(emptyAck.ok).toBe(false);
    expect(emptyAck.error).toContain("empty");

    // Overlong message (>500)
    const longAck = await emitAck(cA1.sock, "message", { text: "a".repeat(501) });
    expect(longAck.ok).toBe(false);
    expect(longAck.error).toContain("exceeds");

    // Invalid ping type
    const badPing = await emitAck(cA1.sock, "ping", { ping: "HACK_SCORES" });
    expect(badPing.ok).toBe(false);
    expect(badPing.error).toContain("invalid ping");

    cA1.sock.disconnect();
  });

  it("lost-ack retry with the same clientMessageId does not duplicate teammate-visible messages", async () => {
    // ponytail: proves the ticket-16 carry-forward — ack lost after commit,
    // retry returns the original id with no second broadcast.
    const matchId = await newTeamMatch();
    const cA1 = await connectChat(A1, matchId);
    const cA2 = await connectChat(A2, matchId);
    const seen: TeamChatMessage[] = [];
    cA2.sock.on("message", (m: TeamChatMessage) => seen.push(m));

    const first = await emitAck(cA1.sock, "message", { text: "retry me", clientMessageId: "lost-ack-1" });
    expect(first.ok).toBe(true);
    // Simulate the lost ack: retry the identical clientMessageId as if the
    // first ack never arrived.
    const retry = await emitAck(cA1.sock, "message", { text: "retry me", clientMessageId: "lost-ack-1" });
    expect(retry.ok).toBe(true);
    expect(retry.id).toBe(first.id);

    await new Promise((r) => setTimeout(r, 200));
    expect(seen.length).toBe(1);
    expect(seen[0].id).toBe(first.id);

    cA1.sock.disconnect();
    cA2.sock.disconnect();
  });

  it("restores recent team room history on reconnect without duplicate messages", async () => {
    const matchId = await newTeamMatch();
    const cA1 = await connectChat(A1, matchId);
    const cA2First = await connectChat(A2, matchId);

    // A1 sends two messages
    await emitAck(cA1.sock, "message", { text: "first note" });
    await emitAck(cA1.sock, "message", { text: "second note" });

    // A2 disconnects
    cA2First.sock.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    // A2 reconnects
    const historyPromise = new Promise<TeamChatMessage[]>((resolve) => {
      const sock = io(`${BASE}/chat`, { auth: { userId: A2, matchId }, forceNew: true });
      sock.once("history", (hist) => {
        resolve(hist as TeamChatMessage[]);
      });
    });

    const reconnectedHistory = await historyPromise;
    expect(reconnectedHistory.length).toBe(2);
    expect(reconnectedHistory[0].text).toBe("first note");
    expect(reconnectedHistory[1].text).toBe("second note");

    cA1.sock.disconnect();
  });
});
