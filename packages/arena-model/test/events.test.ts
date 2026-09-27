import { describe, expect, it } from "vitest";
import { ARENA_EVENTS } from "../src/index.js";

describe("realtime event catalog (03 acceptance: every cross-client update has an event)", () => {
  it("covers phase, status, presence, readiness, tests, reveal, rounds, clock, and match end", () => {
    expect(ARENA_EVENTS).toContain("phase.changed");
    expect(ARENA_EVENTS).toContain("player.statusChanged");
    expect(ARENA_EVENTS).toContain("player.presenceChanged");
    expect(ARENA_EVENTS).toContain("readiness.changed");
    expect(ARENA_EVENTS).toContain("tests.updated");
    expect(ARENA_EVENTS).toContain("reveal.published");
    expect(ARENA_EVENTS).toContain("round.advanced");
    expect(ARENA_EVENTS).toContain("match.clock");
    expect(ARENA_EVENTS).toContain("match.ended");
  });
  it("has no duplicates", () => {
    expect(new Set(ARENA_EVENTS).size).toBe(ARENA_EVENTS.length);
  });
});
