import { afterEach, describe, expect, it, vi } from "vitest";
import { adaptFinal, adaptReveal, shouldApplyUpdate, SocketArenaTransport, StaleCommandError } from "./socket.js";

const SERVER_REVEAL = {
  round: 1,
  roundId: "r1",
  scores: { left: 100, right: 28 },
  groups: {
    left: [{ name: "Basic", weight: 40, earned: 40, earnedBp: 4000 }],
    right: [{ name: "Basic", weight: 40, earned: 12, earnedBp: 1200 }],
  },
  totals: { left: 100, right: 28 },
  publishedAt: 123,
};

describe("adaptReveal (server RevealSnapshot -> client RevealView)", () => {
  it("maps my side score, groups, and totals", () => {
    expect(adaptReveal(SERVER_REVEAL, "left", "right")).toEqual({
      roundScore: 100,
      groups: [{ name: "Basic", weight: 40, earned: 40 }],
      totals: { you: 100, opponent: 28 },
    });
  });

  it("maps from the right side perspective", () => {
    expect(adaptReveal(SERVER_REVEAL, "right", "left")).toEqual({
      roundScore: 28,
      groups: [{ name: "Basic", weight: 40, earned: 12 }],
      totals: { you: 28, opponent: 100 },
    });
  });

  it("passes null through when no reveal published", () => {
    expect(adaptReveal(null, "left", "right")).toBeNull();
  });
});

describe("adaptFinal (server terminal result -> viewer-relative final)", () => {
  const base = { scores: { left: 300, right: 84 }, outcome: "left" as const, winner: "left", forfeit: null };
  it("maps a score win", () => {
    expect(adaptFinal(base, "left", "right")).toEqual({
      you: 300,
      opponent: 84,
      outcome: "You win the match.",
    });
  });
  it("maps from the losing side", () => {
    expect(adaptFinal(base, "right", "left")).toEqual({
      you: 84,
      opponent: 300,
      outcome: "Opponent wins the match.",
    });
  });
  it("maps a forfeit win/loss", () => {
    const forfeit = { winner: "left", loser: "right", reason: "grace-expired" };
    expect(adaptFinal({ ...base, forfeit }, "left", "right")?.outcome).toBe("You win by forfeit.");
    expect(adaptFinal({ ...base, forfeit }, "right", "left")?.outcome).toBe("Opponent wins by forfeit.");
  });
  it("passes null through when the match is not terminal", () => {
    expect(adaptFinal(null, "left", "right")).toBeNull();
  });
});

describe("shouldApplyUpdate (stale-event guard)", () => {
  it("applies newer revisions", () => {
    expect(shouldApplyUpdate({ revision: 3, round: 1 }, { revision: 4, round: 1 })).toBe(true);
  });
  it("drops older revisions", () => {
    expect(shouldApplyUpdate({ revision: 4, round: 2 }, { revision: 3, round: 1 })).toBe(false);
  });
  it("drops older-round events at the same revision", () => {
    expect(shouldApplyUpdate({ revision: 4, round: 2 }, { revision: 4, round: 1 })).toBe(false);
  });
  it("applies untagged refreshes (converge on current truth)", () => {
    expect(shouldApplyUpdate({ revision: 4, round: 2 }, {})).toBe(true);
  });
});

describe("SocketArenaTransport revision conflicts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes authoritative state, then rethrows without replaying the command", async () => {
    const serverSnapshot = {
      mode: "1v1" as const,
      roundPhase: "CODING" as const,
      round: 1,
      totalRounds: 1,
      remainingMs: 10_000,
      problem: { id: "problem-1", title: "Problem", description: "", examples: [] },
      tests: [],
      mySide: "left",
      sides: {
        left: { status: "coding" as const, submissions: 0, presence: "online" as const },
        right: { status: "coding" as const, submissions: 0, presence: "online" as const },
      },
      reveal: null,
      revision: 7,
      pendingEvaluation: false,
      final: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "stale Match revision" }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(serverSnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const transport = new SocketArenaTransport({ baseUrl: "http://arena.test", userId: "user-left", matchId: "match-1" });
    (transport as unknown as { session: { setConnection: (state: "connected") => void } }).session.setConnection("connected");

    await expect(transport.startRound()).rejects.toBeInstanceOf(StaleCommandError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(transport.snapshot().revision).toBe(7);
  });
});
