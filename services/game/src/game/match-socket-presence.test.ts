import { describe, expect, it } from "vitest";
import { MatchSocketPresence, type MatchSocketPresenceTarget } from "./match-socket-presence.js";

type SidePresenceCall = {
  kind: "side";
  matchId: string;
  side: string;
  presence: "online" | "offline";
};

type MemberPresenceCall = {
  kind: "member";
  matchId: string;
  userId: string;
  presence: "online" | "offline";
};

class RecordingPresenceTarget implements MatchSocketPresenceTarget {
  readonly calls: Array<SidePresenceCall | MemberPresenceCall> = [];
  readonly modes = new Map<string, "1v1" | "2v2">();
  readonly sides = new Map<string, string>();

  async participantSide(userId: string, matchId: string): Promise<string> {
    const side = this.sides.get(`${matchId}:${userId}`);
    if (!side) throw new Error("unknown participant");
    return side;
  }

  async modeOf(matchId: string): Promise<"1v1" | "2v2"> {
    return this.modes.get(matchId) ?? "1v1";
  }

  async setPresence(matchId: string, side: string, presence: "online" | "offline"): Promise<void> {
    this.calls.push({ kind: "side", matchId, side, presence });
  }

  async setMemberPresence(matchId: string, userId: string, presence: "online" | "offline"): Promise<void> {
    this.calls.push({ kind: "member", matchId, userId, presence });
  }
}

function addParticipant(target: RecordingPresenceTarget, matchId: string, userId: string, side: string): void {
  target.sides.set(`${matchId}:${userId}`, side);
}

describe("MatchSocketPresence", () => {
  it("marks a 1v1 side online on the first socket and offline on the last socket", async () => {
    const target = new RecordingPresenceTarget();
    const presence = new MatchSocketPresence(target);
    target.modes.set("match-1", "1v1");
    addParticipant(target, "match-1", "alice", "left");

    await expect(presence.noteSocketOpen("alice", "match-1", "socket-1")).resolves.toBe("left");
    await presence.noteSocketOpen("alice", "match-1", "socket-2");
    await presence.noteSocketClosed("alice", "match-1", "socket-1");

    expect(target.calls).toEqual([{ kind: "side", matchId: "match-1", side: "left", presence: "online" }]);

    await presence.noteSocketClosed("alice", "match-1", "socket-2");

    expect(target.calls).toEqual([
      { kind: "side", matchId: "match-1", side: "left", presence: "online" },
      { kind: "side", matchId: "match-1", side: "left", presence: "offline" },
    ]);
  });

  it("ignores unknown and duplicate socket closes", async () => {
    const target = new RecordingPresenceTarget();
    const presence = new MatchSocketPresence(target);
    target.modes.set("match-1", "1v1");
    addParticipant(target, "match-1", "alice", "left");

    await presence.noteSocketClosed("alice", "match-1", "unknown");
    await presence.noteSocketOpen("alice", "match-1", "socket-1");
    await presence.noteSocketClosed("alice", "match-1", "socket-1");
    await presence.noteSocketClosed("alice", "match-1", "socket-1");

    expect(target.calls).toEqual([
      { kind: "side", matchId: "match-1", side: "left", presence: "online" },
      { kind: "side", matchId: "match-1", side: "left", presence: "offline" },
    ]);
  });

  it("tracks 2v2 presence independently for members sharing one side", async () => {
    const target = new RecordingPresenceTarget();
    const presence = new MatchSocketPresence(target);
    target.modes.set("match-2", "2v2");
    addParticipant(target, "match-2", "alice", "left");
    addParticipant(target, "match-2", "bob", "left");

    await presence.noteSocketOpen("alice", "match-2", "alice-socket");
    await presence.noteSocketOpen("bob", "match-2", "bob-socket");
    await presence.noteSocketClosed("alice", "match-2", "alice-socket");

    expect(target.calls).toEqual([
      { kind: "member", matchId: "match-2", userId: "alice", presence: "online" },
      { kind: "member", matchId: "match-2", userId: "bob", presence: "online" },
      { kind: "member", matchId: "match-2", userId: "alice", presence: "offline" },
    ]);
  });
});
