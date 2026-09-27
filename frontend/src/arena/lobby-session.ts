import type { LobbyClient, LobbySideId, RoomWithMembers } from "./lobby.js";
import type { MatchMode } from "./types.js";

export type LobbySessionClient = Pick<
  LobbyClient,
  | "getActive"
  | "cancelQueue"
  | "createRoom"
  | "joinRoom"
  | "setSide"
  | "setReady"
  | "leaveRoom"
  | "startRoom"
  | "connectSocket"
  | "joinRoomChannel"
  | "leaveRoomChannel"
>;

export interface LobbySessionSnapshot {
  mode: MatchMode;
  roomData: RoomWithMembers | null;
  error: string | null;
}

/**
 * Owns Lobby recovery and client-side convergence around the authoritative
 * active-state endpoint. Socket payloads and mutation responses only trigger
 * a refresh; they never replace the latest Lobby snapshot directly.
 */
export class LobbySession {
  private snapshot: LobbySessionSnapshot;
  private readonly listeners = new Set<() => void>();
  private requestVersion = 0;
  private socketCleanup?: () => void;
  private active = false;
  private joinedRoomId: string | null = null;
  private readonly handedOffMatches = new Set<string>();

  constructor(
    private readonly client: LobbySessionClient,
    private readonly onMatchFound: (matchId: string) => void,
    initialMode: MatchMode = "1v1",
  ) {
    this.snapshot = { mode: initialMode, roomData: null, error: null };
  }

  getSnapshot = (): LobbySessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): Promise<void> {
    if (!this.socketCleanup) {
      this.active = true;
      this.socketCleanup = this.client.connectSocket({
        onConnect: () => {
          this.joinedRoomId = null;
          void this.refresh();
        },
        onRoomUpdated: () => void this.refresh(),
        onMatchFound: () => void this.refresh(),
        onQueueMatched: () => void this.refresh(),
      });
    }
    return this.refresh();
  }

  stop(): void {
    this.active = false;
    this.requestVersion += 1;
    this.socketCleanup?.();
    this.socketCleanup = undefined;
    this.joinedRoomId = null;
  }

  setMode(mode: MatchMode): void {
    if (this.snapshot.roomData) return;
    this.update({ mode });
  }

  async refresh(): Promise<void> {
    const requestVersion = ++this.requestVersion;
    const isCurrent = () => this.active && requestVersion === this.requestVersion;
    this.update({ error: null });
    try {
      let activeState = await this.client.getActive();
      if (!isCurrent()) return;

      if (activeState.queue?.status === "matched" && activeState.queue.matchedMatchId) {
        this.handoff(activeState.queue.matchedMatchId);
        this.applyRoom(null);
        return;
      }

      // Public matchmaking is retained by the server for a future release.
      // Clear a persisted waiting entry so this release remains invite-only.
      if (activeState.queue?.status === "waiting") {
        const cancelled = await this.client.cancelQueue();
        if (!isCurrent()) return;
        if (cancelled.matched && cancelled.matchId) {
          this.handoff(cancelled.matchId);
          this.applyRoom(null);
          return;
        }
        activeState = await this.client.getActive();
        if (!isCurrent()) return;
      }

      if (activeState.room?.room.status === "matched" && activeState.room.room.matchId) {
        this.handoff(activeState.room.room.matchId);
        this.applyRoom(null);
        return;
      }

      const roomData = activeState.room?.room.status === "open" ? activeState.room : null;
      this.applyRoom(roomData);
    } catch (error) {
      if (isCurrent()) this.update({ error: this.message(error, "Failed to recover lobby") });
    }
  }

  async createRoom(): Promise<void> {
    await this.mutate(() => this.client.createRoom(this.snapshot.mode));
  }

  joinRoom(code: string): Promise<boolean> {
    return this.mutate(() => this.client.joinRoom(code));
  }

  async setSide(side: LobbySideId): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    await this.mutate(() => this.client.setSide(roomId, side));
  }

  async setReady(ready: boolean): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    await this.mutate(() => this.client.setReady(roomId, ready));
  }

  async leaveRoom(): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    await this.mutate(() => this.client.leaveRoom(roomId));
  }

  async startRoom(): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    this.update({ error: null });
    try {
      const result = await this.client.startRoom(roomId);
      this.handoff(result.matchId);
    } catch (error) {
      this.update({ error: this.message(error, "Failed to start room") });
    }
  }

  private async mutate(action: () => Promise<unknown>): Promise<boolean> {
    this.update({ error: null });
    try {
      await action();
      await this.refresh();
      return true;
    } catch (error) {
      this.update({ error: this.message(error, "Failed to update lobby") });
      return false;
    }
  }

  private applyRoom(roomData: RoomWithMembers | null): void {
    const nextRoomId = roomData?.room.id ?? null;
    let joinedRoom = false;
    if (this.joinedRoomId !== nextRoomId) {
      if (this.joinedRoomId) this.client.leaveRoomChannel(this.joinedRoomId);
      if (nextRoomId) {
        this.client.joinRoomChannel(nextRoomId);
        joinedRoom = true;
      }
      this.joinedRoomId = nextRoomId;
    }
    this.update({
      roomData,
      ...(roomData ? { mode: roomData.room.mode } : {}),
    });
    if (joinedRoom) {
      queueMicrotask(() => {
        if (this.active && this.joinedRoomId === nextRoomId) void this.refresh();
      });
    }
  }

  private handoff(matchId: string): void {
    if (this.handedOffMatches.has(matchId)) return;
    this.handedOffMatches.add(matchId);
    this.onMatchFound(matchId);
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private update(changes: Partial<LobbySessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener();
  }
}
