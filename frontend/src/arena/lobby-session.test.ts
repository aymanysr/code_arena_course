import { describe, expect, it, vi } from "vitest";
import type { LobbyClient, RoomWithMembers } from "./lobby.js";
import { LobbySession, type LobbySessionClient } from "./lobby-session.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function room(code: string, ready = false): RoomWithMembers {
  const roomId = `room-${code}`;
  return {
    room: {
      id: roomId,
      code,
      mode: "1v1" as const,
      ownerUserId: "left-user",
      status: "open" as const,
      createdAt: 1,
      expiresAt: 1000,
      matchId: null,
    },
    members: [
      { roomId, userId: "left-user", sideId: "left" as const, ready, joinedAt: 1 },
    ],
  };
}

function active(value: ReturnType<typeof room> | null, queue: Awaited<ReturnType<LobbyClient["getQueueStatus"]>> = null) {
  return { room: value, queue };
}

function makeClient(overrides: Partial<LobbySessionClient> = {}) {
  let callbacks: Parameters<LobbyClient["connectSocket"]>[0] | undefined;
  const client: LobbySessionClient = {
    getActive: vi.fn(async () => active(null)),
    cancelQueue: vi.fn(async () => ({ cancelled: true, matched: false })),
    createRoom: vi.fn(async () => room("CREATED")),
    joinRoom: vi.fn(async () => room("JOINED")),
    setSide: vi.fn(async () => room("SIDE")),
    setReady: vi.fn(async () => room("MUTATION")),
    leaveRoom: vi.fn(async () => ({ left: true, closed: false })),
    startRoom: vi.fn(async () => ({ matchId: "match-started" })),
    connectSocket: vi.fn((value) => {
      callbacks = value;
      return () => {
        callbacks = undefined;
      };
    }),
    joinRoomChannel: vi.fn(),
    leaveRoomChannel: vi.fn(),
    ...overrides,
  };
  return {
    client,
    callbacks: () => callbacks,
  };
}

describe("LobbySession authoritative reconciliation", () => {
  it("rejects an older active-state response after a newer room update refresh", async () => {
    const oldResponse = deferred<ReturnType<typeof active>>();
    const newResponse = deferred<ReturnType<typeof active>>();
    const getActive = vi.fn().mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    const { client, callbacks } = makeClient({ getActive });
    const session = new LobbySession(client, vi.fn());

    const startup = session.start();
    const onRoomUpdated = callbacks()?.onRoomUpdated;
    expect(onRoomUpdated).toBeDefined();
    const stale = room("SOCKET-STALE");
    onRoomUpdated!({ roomId: stale.room.id, room: stale.room, members: stale.members });

    newResponse.resolve(active(room("LATEST")));
    await Promise.resolve();
    await Promise.resolve();
    oldResponse.resolve(active(room("OLDER")));
    await startup;

    expect(session.getSnapshot().roomData?.room.code).toBe("LATEST");
    expect(client.joinRoomChannel).toHaveBeenCalledTimes(1);
    expect(client.joinRoomChannel).toHaveBeenCalledWith("room-LATEST");
    session.stop();
  });

  it("treats duplicate Match events as hints and hands off once from the latest snapshot", async () => {
    const matchedRoom: RoomWithMembers = {
      ...room("MATCHED"),
      room: { ...room("MATCHED").room, status: "matched", matchId: "match-1" },
    };
    const { client, callbacks } = makeClient({ getActive: vi.fn(async () => active(matchedRoom)) });
    const onMatchFound = vi.fn();
    const session = new LobbySession(client, onMatchFound);

    await session.start();
    callbacks()?.onMatchFound?.({ roomId: "room-MATCHED", matchId: "stale-match" });
    callbacks()?.onQueueMatched?.({ matchId: "stale-queue-match" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onMatchFound).toHaveBeenCalledTimes(1);
    expect(onMatchFound).toHaveBeenCalledWith("match-1");
    expect(client.getActive).toHaveBeenCalledTimes(3);
    session.stop();
  });

  it("cancels a legacy waiting queue before exposing the invitation-only entry state", async () => {
    const queue = {
      id: "queue-1",
      userId: "left-user",
      mode: "1v1" as const,
      status: "waiting" as const,
      joinedAt: 1,
      matchedMatchId: null,
    };
    const getActive = vi.fn().mockResolvedValueOnce(active(null, queue)).mockResolvedValueOnce(active(null));
    const { client } = makeClient({ getActive });
    const session = new LobbySession(client, vi.fn());

    await session.start();

    expect(client.cancelQueue).toHaveBeenCalledOnce();
    expect(getActive).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().roomData).toBeNull();
    expect(session.getSnapshot().mode).toBe("1v1");
    session.stop();
  });

  it("refreshes after room mutations instead of applying their possibly stale response", async () => {
    const getActive = vi.fn()
      .mockResolvedValue(active(room("CURRENT", true)))
      .mockResolvedValueOnce(active(room("CURRENT")))
      .mockResolvedValueOnce(active(room("CURRENT", true)));
    const { client } = makeClient({ getActive });
    const session = new LobbySession(client, vi.fn());
    await session.start();
    await Promise.resolve();
    await Promise.resolve();
    const requestsBeforeMutation = getActive.mock.calls.length;

    await session.setReady(false);

    expect(session.getSnapshot().roomData?.room.code).toBe("CURRENT");
    expect(session.getSnapshot().roomData?.members[0]?.ready).toBe(true);
    expect(getActive).toHaveBeenCalledTimes(requestsBeforeMutation + 1);
    session.stop();
  });

  it("rejoins the active room channel after socket reconnection", async () => {
    const currentRoom = room("RECONNECT");
    const { client, callbacks } = makeClient({ getActive: vi.fn(async () => active(currentRoom)) });
    const session = new LobbySession(client, vi.fn());
    await session.start();

    callbacks()?.onConnect?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(client.joinRoomChannel).toHaveBeenCalledTimes(2);
    expect(client.joinRoomChannel).toHaveBeenLastCalledWith(currentRoom.room.id);
    session.stop();
  });

  it("refreshes after joining a room channel to cover updates during room recovery", async () => {
    const getActive = vi.fn()
      .mockResolvedValueOnce(active(room("INITIAL")))
      .mockResolvedValueOnce(active(room("INITIAL", true)));
    const { client } = makeClient({ getActive });
    const session = new LobbySession(client, vi.fn());

    await session.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(getActive).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().roomData?.room.code).toBe("INITIAL");
    expect(session.getSnapshot().roomData?.members[0]?.ready).toBe(true);
    session.stop();
  });
});
