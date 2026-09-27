import { useEffect, useState, useTransition } from "react";
import type { LobbyClient, LobbySideId, PrivateRoomMember, QueueEntry, RoomWithMembers } from "../arena/lobby.js";
import type { MatchMode } from "../arena/types.js";

export function LobbyPage({
  client,
  userId,
  onMatchFound,
  initialMode = "1v1",
}: {
  client: LobbyClient;
  userId: string;
  onMatchFound: (matchId: string) => void;
  initialMode?: MatchMode;
}) {
  const [mode, setMode] = useState<MatchMode>(initialMode);
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [roomData, setRoomData] = useState<RoomWithMembers | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  // Socket subscription
  useEffect(() => {
    let disposed = false;
    const recover = () => {
      void client.getActive().then((active) => {
        if (disposed) return;
        if (active.queue?.status === "matched" && active.queue.matchedMatchId) {
          onMatchFound(active.queue.matchedMatchId);
        } else if (active.room?.room.status === "matched" && active.room.room.matchId) {
          onMatchFound(active.room.room.matchId);
        } else {
          setQueueEntry(active.queue?.status === "waiting" ? active.queue : null);
          setRoomData(active.room?.room.status === "open" ? active.room : null);
          if (active.queue?.status === "waiting") setMode(active.queue.mode);
          if (active.room?.room.status === "open") {
            setMode(active.room.room.mode);
            client.joinRoomChannel(active.room.room.id);
          }
        }
      }).catch((err: unknown) => {
        if (!disposed) setError(err instanceof Error ? err.message : "Failed to recover lobby");
      });
    };
    const unsub = client.connectSocket({
      onConnect: recover,
      onRoomUpdated: (data) => {
        setRoomData(data.room.status === "open" ? { room: data.room, members: data.members } : null);
        setError(null);
      },
      onMatchFound: (data) => onMatchFound(data.matchId),
      onQueueMatched: (data) => onMatchFound(data.matchId),
    });

    return () => {
      disposed = true;
      unsub();
    };
  }, [client, onMatchFound]);

  // Public Queue Actions
  const handleJoinQueue = async () => {
    setError(null);
    try {
      const entry = await client.joinQueue(mode);
      if (entry.status === "matched" && entry.matchedMatchId) onMatchFound(entry.matchedMatchId);
      else setQueueEntry(entry);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join queue");
    }
  };

  const handleCancelQueue = async () => {
    setError(null);
    try {
      const res = await client.cancelQueue();
      if (res.matched && res.matchId) {
        onMatchFound(res.matchId);
      } else {
        setQueueEntry(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel queue");
    }
  };

  // Private Room Actions
  const handleCreateRoom = async () => {
    setError(null);
    try {
      const res = await client.createRoom(mode);
      setRoomData(res);
      client.joinRoomChannel(res.room.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setError(null);
    try {
      const res = await client.joinRoom(inviteInput.trim());
      setRoomData(res);
      client.joinRoomChannel(res.room.id);
      setInviteInput("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    }
  };

  const handleSwitchSide = async (targetSide: LobbySideId) => {
    if (!roomData) return;
    setError(null);
    try {
      const res = await client.setSide(roomData.room.id, targetSide);
      setRoomData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change side");
    }
  };

  const handleToggleReady = async () => {
    if (!roomData) return;
    const myMember = roomData.members.find((m) => m.userId === userId);
    if (!myMember) return;
    setError(null);
    try {
      const res = await client.setReady(roomData.room.id, !myMember.ready);
      setRoomData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle ready");
    }
  };

  const handleLeaveRoom = async () => {
    if (!roomData) return;
    setError(null);
    try {
      client.leaveRoomChannel(roomData.room.id);
      await client.leaveRoom(roomData.room.id);
      setRoomData(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to leave room");
    }
  };

  const handleStartRoom = async () => {
    if (!roomData) return;
    setError(null);
    try {
      const res = await client.startRoom(roomData.room.id);
      onMatchFound(res.matchId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start room");
    }
  };

  const copyCode = () => {
    if (!roomData) return;
    navigator.clipboard?.writeText(roomData.room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper values for private room view
  const isHost = roomData?.room.ownerUserId === userId;
  const myMember = roomData?.members.find((m) => m.userId === userId);
  const leftMembers = roomData?.members.filter((m) => m.sideId === "left") ?? [];
  const rightMembers = roomData?.members.filter((m) => m.sideId === "right") ?? [];
  const targetSideCap = roomData?.room.mode === "1v1" ? 1 : 2;
  const targetTotalCap = roomData?.room.mode === "1v1" ? 2 : 4;
  const isSidesFull =
    leftMembers.length === targetSideCap && rightMembers.length === targetSideCap;
  const isAllReady =
    (roomData?.members.length ?? 0) === targetTotalCap &&
    (roomData?.members.every((m) => m.ready) ?? false);
  const canHostStart = isHost && isSidesFull && isAllReady;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Code Arena Matchmaking</h1>
          <p className="font-mono text-xs text-neutral-500">
            Player: <span className="text-neutral-800">{userId}</span>
          </p>
        </div>

        {/* Mode Selector (disabled during queue or in room) */}
        <div className="flex gap-1 rounded border border-neutral-200 bg-neutral-50 p-1" role="group" aria-label="Game Mode">
          {(["1v1", "2v2"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={queueEntry !== null || roomData !== null}
              aria-pressed={mode === m}
              className={`rounded px-3 py-1 font-mono text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
              }`}
              onClick={() => {
                startTransition(() => setMode(m));
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div role="alert" className="mb-6 rounded border border-red-700 bg-white p-3 font-mono text-xs text-red-700">
          {error}
        </div>
      )}

      {/* VIEW 1: QUEUE SEARCHING */}
      {queueEntry && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-700 border-r-transparent align-[-0.125em]" />
            <h2 className="text-lg font-semibold text-neutral-900">Finding {queueEntry.mode} Opponent…</h2>
            <p className="mt-1 font-mono text-xs text-neutral-500">Searching public queue (FIFO matchmaking)</p>
            <button
              type="button"
              onClick={handleCancelQueue}
              className="mt-6 rounded border border-neutral-300 bg-white px-4 py-1.5 font-mono text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel Search
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: PRIVATE LOBBY ROOM */}
      {roomData && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          {/* Room Top Bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">Invite Code</span>
                <span className="rounded bg-neutral-100 px-2.5 py-0.5 font-mono text-base font-bold text-neutral-900">
                  {roomData.room.code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">Share this code with other players to invite them</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded border border-neutral-300 px-2 py-0.5 font-mono text-xs text-neutral-600">
                {roomData.room.mode} Mode
              </span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-xs ${
                  isAllReady ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {isAllReady ? "All Players Ready" : "Waiting for Players"}
              </span>
            </div>
          </div>

          {/* Sides Grid */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Left Side */}
            <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  Left Side ({leftMembers.length}/{targetSideCap})
                </h3>
                {myMember?.sideId !== "left" && leftMembers.length < targetSideCap && (
                  <button
                    type="button"
                    onClick={() => handleSwitchSide("left")}
                    className="font-mono text-xs text-teal-700 hover:underline"
                  >
                    Switch Here
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {leftMembers.map((m: PrivateRoomMember) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded border border-neutral-200 bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-neutral-900">
                        {m.userId} {m.userId === userId && "(You)"}
                      </span>
                      {m.userId === roomData.room.ownerUserId && (
                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-700">
                          Host
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${
                        m.ready ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {m.ready ? "READY" : "NOT READY"}
                    </span>
                  </div>
                ))}
                {Array.from({ length: targetSideCap - leftMembers.length }).map((_, i) => (
                  <div
                    key={`empty-left-${i}`}
                    className="flex items-center justify-center rounded border border-dashed border-neutral-300 p-2.5 font-mono text-xs text-neutral-400"
                  >
                    Open Slot
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side */}
            <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  Right Side ({rightMembers.length}/{targetSideCap})
                </h3>
                {myMember?.sideId !== "right" && rightMembers.length < targetSideCap && (
                  <button
                    type="button"
                    onClick={() => handleSwitchSide("right")}
                    className="font-mono text-xs text-teal-700 hover:underline"
                  >
                    Switch Here
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {rightMembers.map((m: PrivateRoomMember) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded border border-neutral-200 bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-neutral-900">
                        {m.userId} {m.userId === userId && "(You)"}
                      </span>
                      {m.userId === roomData.room.ownerUserId && (
                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-700">
                          Host
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${
                        m.ready ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {m.ready ? "READY" : "NOT READY"}
                    </span>
                  </div>
                ))}
                {Array.from({ length: targetSideCap - rightMembers.length }).map((_, i) => (
                  <div
                    key={`empty-right-${i}`}
                    className="flex items-center justify-center rounded border border-dashed border-neutral-300 p-2.5 font-mono text-xs text-neutral-400"
                  >
                    Open Slot
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lobby Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 font-mono text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Leave Room
            </button>

            <div className="flex items-center gap-3">
              {myMember && (
                <button
                  type="button"
                  onClick={handleToggleReady}
                  className={`rounded px-4 py-1.5 font-mono text-xs font-medium transition-colors ${
                    myMember.ready
                      ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                      : "bg-teal-700 text-white hover:bg-teal-600"
                  }`}
                >
                  {myMember.ready ? "Cancel Ready" : "Ready Up"}
                </button>
              )}

              {isHost ? (
                <button
                  type="button"
                  disabled={!canHostStart}
                  onClick={handleStartRoom}
                  className={`rounded px-4 py-1.5 font-mono text-xs font-bold transition-colors ${
                    canHostStart
                      ? "bg-teal-700 text-white hover:bg-teal-600"
                      : "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
                  }`}
                >
                  Start Match
                </button>
              ) : (
                <span className="font-mono text-xs text-neutral-500">Waiting for host to start…</span>
              )}
            </div>
          </div>

          {/* Host Help Status */}
          {isHost && !canHostStart && (
            <p className="mt-3 text-right font-mono text-xs text-neutral-500">
              {!isSidesFull
                ? `Both sides must be full (${targetSideCap} each) before match can start.`
                : "All players must click 'Ready Up' before match can start."}
            </p>
          )}
        </div>
      )}

      {/* VIEW 3: INITIAL ENTRY (NOT IN QUEUE OR ROOM) */}
      {!queueEntry && !roomData && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Quick Play Queue */}
          <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div>
              <div className="mb-2 inline-block rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-medium text-teal-700">
                Automated Matchmaking
              </div>
              <h2 className="text-base font-semibold text-neutral-900">Quick Play Queue</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Join the public queue for a {mode} match. The matchmaker forms an authoritative duel as soon as enough
                players join.
              </p>
            </div>
            <button
              type="button"
              onClick={handleJoinQueue}
              className="mt-6 w-full rounded bg-teal-700 px-4 py-2 font-mono text-xs font-bold text-white hover:bg-teal-600"
            >
              Find {mode} Match
            </button>
          </div>

          {/* Private Room */}
          <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div>
              <div className="mb-2 inline-block rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-medium text-neutral-700">
                Invitation Code
              </div>
              <h2 className="text-base font-semibold text-neutral-900">Private Custom Room</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Create a private room to play with friends, pick teams, and start when everyone is ready.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full rounded border border-neutral-300 bg-white px-4 py-2 font-mono text-xs font-medium text-neutral-800 hover:bg-neutral-50"
              >
                Create {mode} Room
              </button>

              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="INVITE CODE"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 font-mono text-xs uppercase placeholder:text-neutral-400 focus:border-teal-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inviteInput.trim()}
                  className="rounded bg-neutral-800 px-3 py-1.5 font-mono text-xs font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
