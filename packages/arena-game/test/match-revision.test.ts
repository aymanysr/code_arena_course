import { describe, expect, it } from "vitest";
import { InMemoryCollabPersist } from "../src/collab.js";
import { StoreBackedMatchPersistence, type MatchPersistence } from "../src/persistence.js";
import type { MatchRecord } from "../src/records.js";
import {
  InMemoryMatchStore,
  InMemoryRevealStore,
  InMemorySubmissionStore,
  MatchRevisionConflictError,
} from "../src/store.js";

function match(): MatchRecord {
  return {
    id: "revision-match",
    mode: "1v1",
    roundPhase: "ROUND_INTRO",
    currentRound: 1,
    totalRounds: 1,
    durationMs: 60_000,
    startedAt: 1_000,
    participants: [
      { userId: "left-user", sideId: "left" },
      { userId: "right-user", sideId: "right" },
    ],
    rounds: [
      {
        roundId: "revision-round",
        problemVersionId: "problem-v1",
        hiddenSuiteId: "hidden-v1",
        counted: {},
        attempts: {},
        activities: { left: "coding", right: "coding" },
        runTests: {},
        reveal: null,
        closing: false,
        cutoffPassed: false,
        superseded: [],
      },
    ],
    failures: [],
    revision: 0,
    presence: {},
    offlineSinceMs: {},
    forfeit: null,
  };
}

function persistence(): MatchPersistence {
  return new StoreBackedMatchPersistence({
    matches: new InMemoryMatchStore(),
    submissions: new InMemorySubmissionStore(),
    reveals: new InMemoryRevealStore(),
    collab: new InMemoryCollabPersist(),
  });
}

describe("optimistic Match persistence", () => {
  it("rejects a stale second Match write and preserves the winner", async () => {
    const store = persistence();
    await store.saveMatch(match());

    const first = await store.loadMatch("revision-match");
    const second = await store.loadMatch("revision-match");
    first!.presence.left = "online";
    await store.saveMatch(first!, 0);

    second!.presence.right = "online";
    await expect(store.saveMatch(second!, 0)).rejects.toBeInstanceOf(MatchRevisionConflictError);
    await expect(store.loadMatch("revision-match")).resolves.toMatchObject({
      revision: 1,
      presence: { left: "online" },
    });
  });

  it("accepts a write that names the current revision", async () => {
    const store = persistence();
    await store.saveMatch(match());

    const next = await store.loadMatch("revision-match");
    next!.presence.right = "online";
    next!.revision = 1;
    await store.saveMatch(next!, 0);

    const committed = await store.loadMatch("revision-match");
    committed!.presence.left = "online";
    committed!.revision = 2;
    await store.saveMatch(committed!, 1);

    await expect(store.loadMatch("revision-match")).resolves.toMatchObject({
      revision: 2,
      presence: { left: "online", right: "online" },
    });
  });
});
