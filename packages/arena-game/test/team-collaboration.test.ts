import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CollabDocs, type CollabRow } from "../src/collab.js";
import { TeamCollaboration, type TeamCollaborationPersistence } from "../src/team-collaboration.js";
import type { MatchRecord } from "../src/records.js";

class MemoryTeamPersistence implements TeamCollaborationPersistence {
  readonly rows = new Map<string, CollabRow>();

  async saveMatch(_match: MatchRecord): Promise<void> {}

  async loadTeamDocument(matchId: string, roundId: string, sideId: string) {
    const row = this.rows.get(`${matchId}:${roundId}:${sideId}`);
    return row
      ? { appRevision: row.appRevision, language: row.language, stateB64: row.stateB64 }
      : undefined;
  }

  async commitMatchAndTeamDocuments(match: MatchRecord, rows: CollabRow[]): Promise<void> {
    for (const row of rows) this.rows.set(`${match.id}:${row.roundId}:${row.sideId}`, { ...row });
  }
}

function match(): MatchRecord {
  return {
    id: "match-1",
    mode: "2v2",
    roundPhase: "CODING",
    currentRound: 1,
    totalRounds: 1,
    durationMs: 1_800_000,
    startedAt: 1_000,
    participants: [
      { userId: "a1", sideId: "left" },
      { userId: "a2", sideId: "left" },
      { userId: "b1", sideId: "right" },
      { userId: "b2", sideId: "right" },
    ],
    rounds: [
      {
        roundId: "round-1",
        problemVersionId: "problem-1",
        hiddenSuiteId: "hidden-1",
        counted: {},
        attempts: {},
        activities: { left: "coding", right: "coding" },
        runTests: {},
        teamDocs: {
          left: { revision: 1, language: "Python" },
          right: { revision: 1, language: "Python" },
        },
        readiness: {
          a1: { userId: "a1", ready: true, documentRevision: 1, updatedAt: 1_000 },
          a2: { userId: "a2", ready: true, documentRevision: 1, updatedAt: 1_000 },
        },
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
    memberPresence: {},
    memberOfflineSinceMs: {},
    forfeit: null,
  };
}

function updateFrom(source: string, edit: (text: Y.Text) => void): string {
  const doc = new Y.Doc();
  doc.getText("source").insert(0, source);
  doc.transact(() => edit(doc.getText("source")));
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
}

function createCollaboration(persistence = new MemoryTeamPersistence()): TeamCollaboration {
  return new TeamCollaboration({
    persistence,
    collab: new CollabDocs(),
    bank: { loadProblem: () => ({ starters: { Python: "starter()", C: "", "C++": "" } }) },
    clock: () => 2_000,
  });
}

describe("TeamCollaboration", () => {
  it("persists a changed Yjs source once and invalidates both approvals", async () => {
    const state = match();
    const persistence = new MemoryTeamPersistence();
    const collaboration = createCollaboration(persistence);
    const baseline = await collaboration.sync(state, "a1");

    const result = await collaboration.applyUpdate(state, "a1", {
      roundId: baseline.roundId,
      updateB64: updateFrom(baseline.source, (text) => text.insert(text.length, "\n# changed")),
    });

    expect(result).toMatchObject({ changed: true, revision: 2, side: "left" });
    expect(state.rounds[0]?.readiness?.a1?.ready).toBe(false);
    expect(state.rounds[0]?.readiness?.a2?.ready).toBe(false);
    expect(persistence.rows.get("match-1:round-1:left")).toMatchObject({ appRevision: 2 });
    expect(result.source).toContain("# changed");
  });

  it("only exposes the authoritative current document at its approved revision", async () => {
    const state = match();
    const collaboration = createCollaboration();
    const baseline = await collaboration.sync(state, "a1");

    await expect(collaboration.submissionDocument(state, "left", "Python", baseline.revision + 1)).rejects.toThrow(
      /stale document revision/,
    );

    const document = await collaboration.submissionDocument(state, "left", "Python", baseline.revision);
    expect(document).toEqual({ source: "starter()", documentRevision: 1, language: "Python" });
  });
});
