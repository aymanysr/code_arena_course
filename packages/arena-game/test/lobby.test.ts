import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  InMemoryLobbyStore,
  LobbyStore,
  LobbyError,
  generateInviteCode,
  selectProblems,
} from "../src/lobby.js";
import { Pool } from "pg";

describe("Lobby and Matchmaking (In-Memory)", () => {
  it("generateInviteCode produces 6-character uppercase alphanumeric code", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("selectProblems shuffles available problems and picks requested count", () => {
    const available = ["p1", "p2", "p3", "p4", "p5"];
    const picked = selectProblems(available, 3, () => 0.5);
    expect(picked).toHaveLength(3);
    for (const p of picked) expect(available).toContain(p);
  });

  it("serializes in-memory matcher callbacks", async () => {
    const lobby = new InMemoryLobbyStore();
    await lobby.joinQueue("a", "1v1");
    await lobby.joinQueue("b", "1v1");
    let calls = 0;
    const create = async () => { calls++; await Promise.resolve(); return "only-match"; };
    await Promise.all([lobby.tryMatch("1v1", ["p"], create), lobby.tryMatch("1v1", ["p"], create)]);
    expect(calls).toBe(1);
  });

  it("rejects in-memory private joins while queued or in another room", async () => {
    const lobby = new InMemoryLobbyStore();
    const { room } = await lobby.createPrivateRoom("host", "2v2");
    await lobby.joinQueue("queued", "1v1");
    await expect(lobby.joinPrivateRoom("queued", room.code)).rejects.toThrow("already in queue");
    await lobby.createPrivateRoom("other-host", "1v1");
    await expect(lobby.joinPrivateRoom("other-host", room.code)).rejects.toThrow("already in a private room");
  });

  describe("Queue lifecycle and matchmaking", () => {
    it("joins queue, checks status, and cancels", async () => {
      const lobby = new InMemoryLobbyStore();
      const entry = await lobby.joinQueue("user-1", "1v1");
      expect(entry.userId).toBe("user-1");
      expect(entry.mode).toBe("1v1");
      expect(entry.status).toBe("waiting");

      const status = await lobby.queueStatus("user-1");
      expect(status).not.toBeNull();
      expect(status?.id).toBe(entry.id);

      // Duplicate join rejected
      await expect(lobby.joinQueue("user-1", "1v1")).rejects.toThrow("already in queue");

      const cancelRes = await lobby.cancelQueue("user-1");
      expect(cancelRes.cancelled).toBe(true);
      expect(cancelRes.matched).toBe(false);

      const statusAfter = await lobby.queueStatus("user-1");
      expect(statusAfter).toBeNull();
    });

    it("matches 2 players in 1v1 queue into a match", async () => {
      const lobby = new InMemoryLobbyStore();
      await lobby.joinQueue("p1", "1v1");

      let createdMatch: any = null;
      const fakeCreate = async (input: any) => {
        createdMatch = input;
        return "match-1v1-abc";
      };

      // Only 1 player -> no match yet
      const match1 = await lobby.tryMatch("1v1", ["prob-1"], fakeCreate);
      expect(match1).toBeNull();

      // Second player joins
      await lobby.joinQueue("p2", "1v1");

      const match2 = await lobby.tryMatch("1v1", ["prob-1"], fakeCreate);
      expect(match2).not.toBeNull();
      expect(match2?.matchId).toBe("match-1v1-abc");
      expect(match2?.entries).toHaveLength(2);

      expect(createdMatch).toEqual({
        mode: "1v1",
        participants: [
          { userId: "p1", sideId: "left" },
          { userId: "p2", sideId: "right" },
        ],
        problemVersionIds: ["prob-1"],
      });

      // Checking status reflects matched
      const s1 = await lobby.queueStatus("p1");
      expect(s1?.status).toBe("matched");
      expect(s1?.matchedMatchId).toBe("match-1v1-abc");

      // Cancelling when matched returns matched: true
      const c1 = await lobby.cancelQueue("p1");
      expect(c1.matched).toBe(true);
      expect(c1.matchId).toBe("match-1v1-abc");
    });

    it("matches 4 players in 2v2 queue with 2 per side", async () => {
      const lobby = new InMemoryLobbyStore();
      await lobby.joinQueue("u1", "2v2");
      await lobby.joinQueue("u2", "2v2");
      await lobby.joinQueue("u3", "2v2");

      let createdMatch: any = null;
      const fakeCreate = async (input: any) => {
        createdMatch = input;
        return "match-2v2-xyz";
      };

      expect(await lobby.tryMatch("2v2", ["prob-2"], fakeCreate)).toBeNull();

      await lobby.joinQueue("u4", "2v2");
      const res = await lobby.tryMatch("2v2", ["prob-2"], fakeCreate);
      expect(res).not.toBeNull();
      expect(res?.matchId).toBe("match-2v2-xyz");

      expect(createdMatch.participants).toEqual([
        { userId: "u1", sideId: "left" },
        { userId: "u2", sideId: "left" },
        { userId: "u3", sideId: "right" },
        { userId: "u4", sideId: "right" },
      ]);
    });
  });

  describe("Private rooms, invitation codes, side assembly & host start gate", () => {
    it("creates a private room, auto-assigns host on left with ready=false", async () => {
      const lobby = new InMemoryLobbyStore();
      const { room, members } = await lobby.createPrivateRoom("host-1", "1v1");
      expect(room.ownerUserId).toBe("host-1");
      expect(room.mode).toBe("1v1");
      expect(room.code).toHaveLength(6);
      expect(room.status).toBe("open");

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe("host-1");
      expect(members[0].sideId).toBe("left");
      expect(members[0].ready).toBe(false);

      // Reconnect / active room lookup
      const active = await lobby.userActiveRoom("host-1");
      expect(active?.room.id).toBe(room.id);
    });

    it("joins private room by code, rejects full and started joins with clear errors", async () => {
      const lobby = new InMemoryLobbyStore();
      const { room } = await lobby.createPrivateRoom("host-1", "1v1");

      // Join via code
      const join1 = await lobby.joinPrivateRoom("guest-1", room.code);
      expect(join1.members).toHaveLength(2);
      expect(join1.full).toBe(true);
      expect(join1.members.find((m) => m.userId === "guest-1")?.sideId).toBe("right");

      // Recovery uses the active endpoint; a second admission is rejected.
      await expect(lobby.joinPrivateRoom("guest-1", room.code)).rejects.toMatchObject({ code: 409 });

      // 3rd player in 1v1 rejected: room is full
      await expect(lobby.joinPrivateRoom("intruder", room.code)).rejects.toThrow("room is full");

      // Both ready
      await lobby.setRoomMemberReady("host-1", room.id, true);
      await lobby.setRoomMemberReady("guest-1", room.id, true);

      // Start room
      await lobby.startPrivateRoom("host-1", room.id, ["prob-1"], async () => "match-started-1");

      // Joining started room rejected
      await expect(lobby.joinPrivateRoom("late-comer", room.code)).rejects.toThrow("room has already started");
    });

    it("enforces side switching rules and change-clears-ready semantics", async () => {
      const lobby = new InMemoryLobbyStore();
      const { room } = await lobby.createPrivateRoom("host-1", "1v1");
      await lobby.joinPrivateRoom("guest-1", room.code);

      // Host readies up
      await lobby.setRoomMemberReady("host-1", room.id, true);
      let rm = (await lobby.getRoomWithMembers(room.id))!;
      expect(rm.members.find((m) => m.userId === "host-1")?.ready).toBe(true);

      // Guest tries to switch to 'right' (already on right) -> ok
      await lobby.setRoomMemberSide("guest-1", room.id, "right");

      // Guest tries to switch to 'left' -> full! (1v1 max 1 per side)
      await expect(lobby.setRoomMemberSide("guest-1", room.id, "left")).rejects.toThrow("side is full");

      // In 2v2: test change-clears-ready
      const { room: r2 } = await lobby.createPrivateRoom("h2", "2v2"); // h2 on left
      await lobby.joinPrivateRoom("g2", r2.code); // g2 joins left (left has 1, cap 2)
      await lobby.setRoomMemberReady("g2", r2.id, true);
      let r2m = (await lobby.getRoomWithMembers(r2.id))!;
      expect(r2m.members.find((m) => m.userId === "g2")?.ready).toBe(true);

      // Switch to right (actual side switch)
      await lobby.setRoomMemberSide("g2", r2.id, "right");
      r2m = (await lobby.getRoomWithMembers(r2.id))!;
      const g2Member = r2m.members.find((m) => m.userId === "g2");
      expect(g2Member?.sideId).toBe("right");
      // Change-clears-ready: ready MUST BE FALSE
      expect(g2Member?.ready).toBe(false);
    });

    it("host start gate blocks until sides are full and all players ready", async () => {
      const lobby = new InMemoryLobbyStore();
      const { room } = await lobby.createPrivateRoom("host-1", "1v1");

      const fakeCreate = async () => "match-999";

      // Non-host cannot start
      await expect(lobby.startPrivateRoom("guest-1", room.id, ["prob-1"], fakeCreate)).rejects.toThrow(
        "only the lobby host can start the match",
      );

      // Host cannot start when sides not full
      await expect(lobby.startPrivateRoom("host-1", room.id, ["prob-1"], fakeCreate)).rejects.toThrow(
        "cannot start: sides must be full",
      );

      // Guest joins
      await lobby.joinPrivateRoom("guest-1", room.code);

      // Host cannot start when not all ready
      await expect(lobby.startPrivateRoom("host-1", room.id, ["prob-1"], fakeCreate)).rejects.toThrow(
        "cannot start: all players must be ready",
      );

      // Only host ready
      await lobby.setRoomMemberReady("host-1", room.id, true);
      await expect(lobby.startPrivateRoom("host-1", room.id, ["prob-1"], fakeCreate)).rejects.toThrow(
        "cannot start: all players must be ready",
      );

      // Both ready
      await lobby.setRoomMemberReady("guest-1", room.id, true);
      const started = await lobby.startPrivateRoom("host-1", room.id, ["prob-1"], fakeCreate);
      expect(started.matchId).toBe("match-999");

      // Starting twice fails
      await expect(lobby.startPrivateRoom("host-1", room.id, ["prob-1"], fakeCreate)).rejects.toThrow(
        "room has already started",
      );
    });

    it("leaving room closes it if owner leaves, or frees slot if member leaves", async () => {
      const lobby = new InMemoryLobbyStore();
      const { room } = await lobby.createPrivateRoom("host-1", "1v1");
      await lobby.joinPrivateRoom("guest-1", room.code);

      // Guest leaves
      const leaveRes = await lobby.leavePrivateRoom("guest-1", room.id);
      expect(leaveRes.left).toBe(true);
      expect(leaveRes.closed).toBe(false);

      const rm = (await lobby.getRoomWithMembers(room.id))!;
      expect(rm.members).toHaveLength(1);

      // Another guest can now join
      const join2 = await lobby.joinPrivateRoom("guest-2", room.code);
      expect(join2.members).toHaveLength(2);

      // Host leaves -> room is closed
      const hostLeave = await lobby.leavePrivateRoom("host-1", room.id);
      expect(hostLeave.closed).toBe(true);

      // Joins to closed room fail
      await expect(lobby.joinPrivateRoom("guest-3", room.code)).rejects.toThrow("room is closed");
    });
  });
});

// Real database tests if DATABASE_URL is set
const dbUrl = process.env.DATABASE_URL;
describe.runIf(Boolean(dbUrl))("Lobby and Matchmaking (Postgres Real Database)", () => {
  let pool: Pool;
  let lobby: LobbyStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    lobby = new LobbyStore(pool);
    await lobby.ensureSchema();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("handles concurrent join races without overfilling a side", async () => {
    const uniqueHost = `host-pg-${Date.now()}`;
    const { room } = await lobby.createPrivateRoom(uniqueHost, "1v1");

    // 5 concurrent join requests for the 1 remaining slot
    const joiners = ["p2", "p3", "p4", "p5", "p6"].map((id) => `${id}-${Date.now()}`);
    const results = await Promise.allSettled(
      joiners.map((userId) => lobby.joinPrivateRoom(userId, room.code)),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 succeeded, remaining 4 rejected with 'room is full'
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    const rm = await lobby.getRoomWithMembers(room.id);
    expect(rm?.members).toHaveLength(2);
  });

  it("handles concurrent start races so match is created exactly once", async () => {
    const uniqueHost = `host-race-${Date.now()}`;
    const guest = `guest-race-${Date.now()}`;
    const { room } = await lobby.createPrivateRoom(uniqueHost, "1v1");
    await lobby.joinPrivateRoom(guest, room.code);
    await lobby.setRoomMemberReady(uniqueHost, room.id, true);
    await lobby.setRoomMemberReady(guest, room.id, true);

    let createdMatches = 0;
    const fakeCreate = async () => {
      createdMatches++;
      return `match-race-${createdMatches}`;
    };

    // 4 concurrent start attempts
    const startAttempts = await Promise.allSettled([
      lobby.startPrivateRoom(uniqueHost, room.id, ["even-ledger"], fakeCreate),
      lobby.startPrivateRoom(uniqueHost, room.id, ["even-ledger"], fakeCreate),
      lobby.startPrivateRoom(uniqueHost, room.id, ["even-ledger"], fakeCreate),
      lobby.startPrivateRoom(uniqueHost, room.id, ["even-ledger"], fakeCreate),
    ]);

    const succeeded = startAttempts.filter((r) => r.status === "fulfilled");
    const failed = startAttempts.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(3);
    expect(createdMatches).toBe(1);
  });
});
