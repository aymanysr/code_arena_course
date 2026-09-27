import type { TeamChatClient } from "./chat.js";
import type { CollabClient } from "./collab.js";

export interface LiveClientConfig {
  baseUrl: string;
  userId: string;
  matchId: string;
}

export interface SidecarScope {
  transportKey: object;
  round: number;
  collabConfig: LiveClientConfig | null;
  chatConfig: LiveClientConfig | null;
}

export interface SidecarState {
  collab: CollabClient | null;
  chat: TeamChatClient | null;
}

export interface SidecarFactories {
  createCollab(config: LiveClientConfig): Promise<CollabClient>;
  createChat(config: LiveClientConfig): Promise<TeamChatClient>;
}

export interface ArenaSidecarLifecycle {
  sync(scope: SidecarScope): Promise<SidecarState | null>;
  getState(): SidecarState;
  dispose(): void;
}

type DisposableClient = { disconnect(): void };

interface PendingClient<T> {
  key: string;
  cancelled: boolean;
  client: T | null;
  promise: Promise<T | null>;
}

interface ScopeIdentity {
  transportKey: object;
  matchId: string | null;
}

const defaultFactories: SidecarFactories = {
  createCollab: async (config) => {
    const { CollabClient } = await import("./collab.js");
    return new CollabClient({ ...config, displayName: config.userId });
  },
  createChat: async (config) => {
    const { TeamChatClient } = await import("./chat.js");
    return new TeamChatClient(config);
  },
};

function configKey(config: LiveClientConfig): string {
  return JSON.stringify([config.baseUrl, config.userId, config.matchId]);
}

function disconnect(client: DisposableClient): void {
  try {
    client.disconnect();
  } catch {
    // Disposal is best effort so one sidecar cannot strand the other.
  }
}

function sameScope(left: ScopeIdentity, right: ScopeIdentity): boolean {
  return Object.is(left.transportKey, right.transportKey) && left.matchId === right.matchId;
}

function matchId(scope: SidecarScope): string | null {
  return scope.chatConfig?.matchId ?? scope.collabConfig?.matchId ?? null;
}

export function createArenaSidecarLifecycle(factories: SidecarFactories = defaultFactories): ArenaSidecarLifecycle {
  let disposed = false;
  let requestVersion = 0;
  let identity: ScopeIdentity | null = null;

  let collab: CollabClient | null = null;
  let collabKey: string | null = null;
  let collabPending: PendingClient<CollabClient> | null = null;

  let chat: TeamChatClient | null = null;
  let chatKey: string | null = null;
  let chatPending: PendingClient<TeamChatClient> | null = null;

  function state(): SidecarState {
    return { collab, chat };
  }

  function cancelCollabPending(): void {
    const pending = collabPending;
    if (!pending) return;
    pending.cancelled = true;
    if (pending.client) {
      disconnect(pending.client);
      pending.client = null;
    }
    collabPending = null;
  }

  function cancelChatPending(): void {
    const pending = chatPending;
    if (!pending) return;
    pending.cancelled = true;
    if (pending.client) {
      disconnect(pending.client);
      pending.client = null;
    }
    chatPending = null;
  }

  function clearCollab(): void {
    cancelCollabPending();
    if (collab) disconnect(collab);
    collab = null;
    collabKey = null;
  }

  function clearChat(): void {
    cancelChatPending();
    if (chat) disconnect(chat);
    chat = null;
    chatKey = null;
  }

  function start<T extends DisposableClient>(
    factory: (config: LiveClientConfig) => Promise<T>,
    config: LiveClientConfig,
    key: string,
  ): PendingClient<T> {
    const pending: PendingClient<T> = {
      key,
      cancelled: false,
      client: null,
      promise: Promise.resolve(null) as Promise<T | null>,
    };

    pending.promise = Promise.resolve()
      .then(() => factory(config))
      .then(
        (client) => {
          if (pending.cancelled || disposed) {
            disconnect(client);
            return null;
          }
          pending.client = client;
          return client;
        },
        (error: unknown) => {
          if (pending.cancelled || disposed) return null;
          throw error;
        },
      );
    return pending;
  }

  function ensureCollab(config: LiveClientConfig, key: string): Promise<CollabClient | null> {
    if (collab && collabKey === key) return Promise.resolve(collab);
    if (collabPending?.key === key) return collabPending.promise;
    const pending = start(factories.createCollab, config, key);
    collabPending = pending;
    return pending.promise;
  }

  function ensureChat(config: LiveClientConfig, key: string): Promise<TeamChatClient | null> {
    if (chat && chatKey === key) return Promise.resolve(chat);
    if (chatPending?.key === key) return chatPending.promise;
    const pending = start(factories.createChat, config, key);
    chatPending = pending;
    return pending.promise;
  }

  async function sync(scope: SidecarScope): Promise<SidecarState | null> {
    disposed = false;
    const version = ++requestVersion;
    const nextIdentity = { transportKey: scope.transportKey, matchId: matchId(scope) } satisfies ScopeIdentity;

    if (!identity || !sameScope(identity, nextIdentity)) {
      clearCollab();
      clearChat();
      identity = nextIdentity;
    }

    const desiredCollabKey = scope.collabConfig ? `${scope.round}:${configKey(scope.collabConfig)}` : null;
    if (collabKey !== desiredCollabKey) clearCollab();

    const desiredChatKey = scope.chatConfig ? configKey(scope.chatConfig) : null;
    if (chatKey !== desiredChatKey) clearChat();

    const collabPromise = scope.collabConfig
      ? ensureCollab(scope.collabConfig, desiredCollabKey!)
      : Promise.resolve(null);
    const chatPromise = scope.chatConfig ? ensureChat(scope.chatConfig, desiredChatKey!) : Promise.resolve(null);

    try {
      const [nextCollab, nextChat] = await Promise.all([collabPromise, chatPromise]);
      if (version !== requestVersion || disposed) return null;

      if (nextCollab) {
        collab = nextCollab;
        collabKey = desiredCollabKey;
        if (collabPending?.client === nextCollab) collabPending.client = null;
        collabPending = null;
      }
      if (nextChat) {
        chat = nextChat;
        chatKey = desiredChatKey;
        if (chatPending?.client === nextChat) chatPending.client = null;
        chatPending = null;
      }
      return state();
    } catch (error) {
      if (version === requestVersion && !disposed) {
        if (collabPending?.key === desiredCollabKey) clearCollab();
        if (chatPending?.key === desiredChatKey) clearChat();
      }
      throw error;
    }
  }

  function dispose(): void {
    disposed = true;
    requestVersion++;
    clearCollab();
    clearChat();
    identity = null;
  }

  return {
    sync,
    getState: state,
    dispose,
  };
}
