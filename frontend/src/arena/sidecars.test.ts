import { describe, expect, it, vi } from "vitest";
import type { TeamChatClient } from "./chat.js";
import type { CollabClient } from "./collab.js";
import {
  createArenaSidecarLifecycle,
  type LiveClientConfig,
  type SidecarScope,
} from "./sidecars.js";

const config = (matchId = "match-1"): LiveClientConfig => ({
  baseUrl: "http://localhost:3220",
  userId: "user-1",
  matchId,
});

function scope(transportKey: object, round: number, matchId = "match-1"): SidecarScope {
  return {
    transportKey,
    round,
    collabConfig: config(matchId),
    chatConfig: config(matchId),
  };
}

function collabClient(): CollabClient & { disconnect: ReturnType<typeof vi.fn> } {
  return { disconnect: vi.fn() } as unknown as CollabClient & { disconnect: ReturnType<typeof vi.fn> };
}

function chatClient(): TeamChatClient & { disconnect: ReturnType<typeof vi.fn> } {
  return { disconnect: vi.fn() } as unknown as TeamChatClient & { disconnect: ReturnType<typeof vi.fn> };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("arena sidecar lifecycle", () => {
  it("replaces collaboration per round while preserving match-scoped chat", async () => {
    const transportKey = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const chat = chatClient();
    const nextCollab = deferred<CollabClient>();
    const createCollab = vi
      .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
      .mockResolvedValueOnce(firstCollab)
      .mockReturnValueOnce(nextCollab.promise);
    const createChat = vi.fn<(input: LiveClientConfig) => Promise<TeamChatClient>>().mockResolvedValue(chat);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    expect(await lifecycle.sync(scope(transportKey, 1))).toEqual({ collab: firstCollab, chat });

    const nextRound = lifecycle.sync(scope(transportKey, 2));
    expect(firstCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(lifecycle.getState().chat).toBe(chat);
    expect(createChat).toHaveBeenCalledTimes(1);

    nextCollab.resolve(secondCollab);
    expect(await nextRound).toEqual({ collab: secondCollab, chat });
    expect(chat.disconnect).not.toHaveBeenCalled();
  });

  it("disposes both clients when the match changes", async () => {
    const transportKey = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const firstChat = chatClient();
    const secondChat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi
        .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
        .mockResolvedValueOnce(firstCollab)
        .mockResolvedValueOnce(secondCollab),
      createChat: vi
        .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
        .mockResolvedValueOnce(firstChat)
        .mockResolvedValueOnce(secondChat),
    });

    await lifecycle.sync(scope(transportKey, 1, "match-1"));
    expect(await lifecycle.sync(scope(transportKey, 1, "match-2"))).toEqual({ collab: secondCollab, chat: secondChat });

    expect(firstCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(firstChat.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disposes both clients when the transport changes", async () => {
    const firstTransport = {};
    const secondTransport = {};
    const firstCollab = collabClient();
    const secondCollab = collabClient();
    const firstChat = chatClient();
    const secondChat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi
        .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
        .mockResolvedValueOnce(firstCollab)
        .mockResolvedValueOnce(secondCollab),
      createChat: vi
        .fn<(input: LiveClientConfig) => Promise<TeamChatClient>>()
        .mockResolvedValueOnce(firstChat)
        .mockResolvedValueOnce(secondChat),
    });

    await lifecycle.sync(scope(firstTransport, 1));
    expect(await lifecycle.sync(scope(secondTransport, 1))).toEqual({ collab: secondCollab, chat: secondChat });

    expect(firstCollab.disconnect).toHaveBeenCalledTimes(1);
    expect(firstChat.disconnect).toHaveBeenCalledTimes(1);
  });

  it("cancels a stale factory and disposes a client that resolves after replacement", async () => {
    const transportKey = {};
    const staleCollab = collabClient();
    const currentCollab = collabClient();
    const staleFactory = deferred<CollabClient>();
    const createCollab = vi
      .fn<(input: LiveClientConfig) => Promise<CollabClient>>()
      .mockReturnValueOnce(staleFactory.promise)
      .mockResolvedValueOnce(currentCollab);
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat: vi.fn() });
    const collabOnlyScope = (round: number): SidecarScope => ({
      transportKey,
      round,
      collabConfig: config(),
      chatConfig: null,
    });

    const staleSync = lifecycle.sync(collabOnlyScope(1));
    const currentSync = lifecycle.sync(collabOnlyScope(2));
    expect(await currentSync).toEqual({ collab: currentCollab, chat: null });

    staleFactory.resolve(staleCollab);
    expect(await staleSync).toBeNull();
    expect(staleCollab.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not create clients when the transport exposes no live sidecar configs", async () => {
    const createCollab = vi.fn<(input: LiveClientConfig) => Promise<CollabClient>>();
    const createChat = vi.fn<(input: LiveClientConfig) => Promise<TeamChatClient>>();
    const lifecycle = createArenaSidecarLifecycle({ createCollab, createChat });

    const result = await lifecycle.sync({
      transportKey: {},
      round: 1,
      collabConfig: null,
      chatConfig: null,
    });

    expect(result).toEqual({ collab: null, chat: null });
    expect(createCollab).not.toHaveBeenCalled();
    expect(createChat).not.toHaveBeenCalled();
  });

  it("disconnects active clients when the lifecycle is disposed", async () => {
    const collab = collabClient();
    const chat = chatClient();
    const lifecycle = createArenaSidecarLifecycle({
      createCollab: vi.fn().mockResolvedValue(collab),
      createChat: vi.fn().mockResolvedValue(chat),
    });

    await lifecycle.sync(scope({}, 1));
    lifecycle.dispose();

    expect(collab.disconnect).toHaveBeenCalledTimes(1);
    expect(chat.disconnect).toHaveBeenCalledTimes(1);
    expect(lifecycle.getState()).toEqual({ collab: null, chat: null });
  });
});
