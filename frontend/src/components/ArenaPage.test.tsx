import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArenaSnapshot } from "../arena/types.js";
import type { ArenaTransport } from "../arena/transport.js";
import { ArenaPage } from "./ArenaPage.js";

function terminalSnapshot(remainingSeconds: number): ArenaSnapshot {
  return {
    mode: "1v1",
    roundPhase: "MATCH_COMPLETE",
    round: 1,
    totalRounds: 3,
    remainingSeconds,
    problem: {
      id: "even-ledger",
      title: "Even Ledger",
      description: "Add and subtract values by index.",
      examples: [],
      starters: { Python: "def ledger_sum(nums):\n    return 0\n" },
    },
    language: "Python",
    tests: [],
    you: { name: "You", status: "locked", presence: "online", submissions: 1 },
    opponent: { name: "Opponent", status: "locked", presence: "online", submissions: 0 },
    alpha: {
      id: "left",
      members: [
        { name: "You", status: "locked", presence: "online", submissions: 1 },
        { name: "", status: "locked", presence: "offline", submissions: 0 },
      ],
      score: 70,
      submissions: 1,
    },
    beta: {
      id: "right",
      members: [
        { name: "Opponent", status: "locked", presence: "online", submissions: 0 },
        { name: "", status: "locked", presence: "offline", submissions: 0 },
      ],
      score: 0,
      submissions: 0,
    },
    ready: { you: false, mate: false },
    docRevision: null,
    readyRevision: null,
    reveal: { roundScore: 70, groups: [], totals: { you: 70, opponent: 0 } },
    notice: null,
    revision: 3,
    matchFinal: { you: 70, opponent: 0, outcome: "You win the match." },
  };
}

function transportFor(snapshot: ArenaSnapshot): ArenaTransport {
  return {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    connection: () => "connected",
    scopeKey: () => "deadline-match",
    startRound: async () => {},
    beginCoding: async () => {},
    setLanguage: async () => {},
    run: async () => ({ ok: true }),
    submit: async () => ({ ok: true, round: snapshot.round }),
    setReady: async () => {},
    advance: async () => {},
    leave: async () => {},
  };
}

describe("ArenaPage terminal presentation", () => {
  it("shows an expired Match Reveal before exposing its final result", () => {
    const html = renderToStaticMarkup(<ArenaPage transport={transportFor(terminalSnapshot(0))} />);

    expect(html).toContain('aria-label="Round 1 score reveal"');
    expect(html).toContain("See final result");
    expect(html).not.toContain('aria-label="Match result"');
  });

  it("shows a normally completed Match result after its Reveal phase", () => {
    const html = renderToStaticMarkup(<ArenaPage transport={transportFor(terminalSnapshot(60))} />);

    expect(html).toContain('aria-label="Match result"');
    expect(html).not.toContain("See final result");
  });
});
