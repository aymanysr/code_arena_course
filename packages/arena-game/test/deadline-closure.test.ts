import { describe, expect, it } from "vitest";
import { ArenaEngine, MATCH_DURATION_MS } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P70, SOLVED_PY, setup, tick } from "./setup.js";
import { testPrincipal } from "../src/principal.js";

describe("Match deadline closure", () => {
  it("rejects Run and Submit at the exact deadline", async () => {
    const fx = await setup([]);
    const events: string[] = [];
    fx.engine.on((event) => events.push(event));
    fx.advance(MATCH_DURATION_MS);

    await expect(fx.engine.run(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/expired/);
    expect(events).toContain("match.ended");
    await expect(fx.engine.submit(fx.right, fx.matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow(/expired/);
    expect(events.filter((event) => event === "match.ended")).toHaveLength(1);
  });

  it("reveals the current Round and ends the Match with unplayed Rounds at zero", async () => {
    const fx = await setup([P70]);
    const events: string[] = [];
    fx.engine.on((event) => events.push(event));
    await fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    fx.advance(MATCH_DURATION_MS);

    await expect(fx.engine.sweepExpiredMatches()).resolves.toEqual([fx.matchId]);

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.reveal?.scores).toEqual({ left: 70, right: 0 });
    expect(snapshot.final?.scores).toEqual({ left: 70, right: 0 });
    expect(events.indexOf("reveal.published")).toBeLessThan(events.indexOf("match.ended"));
    expect(events.filter((event) => event === "match.ended")).toHaveLength(1);

    const revision = snapshot.revision;
    await expect(fx.engine.sweepExpiredMatches()).resolves.toEqual([]);
    expect((await fx.engine.snapshot(fx.left, fx.matchId)).revision).toBe(revision);
    expect(events.filter((event) => event === "match.ended")).toHaveLength(1);
  });

  it("shows a zero-score Reveal when the deadline expires in Round Intro", async () => {
    let now = 1_000_000;
    const engine = new ArenaEngine({ judge: new ScriptedJudge([]), bank: new FileBank(), clock: () => now, revealGraceMs: 0 });
    const left = testPrincipal("intro-left");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "intro-left", sideId: "left" },
        { userId: "intro-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger"],
      durationMs: 1000,
    });
    await engine.startRound(left, matchId);
    now += 1000;

    await engine.sweepExpiredMatches();
    const snapshot = await engine.snapshot(left, matchId);

    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.reveal?.scores).toEqual({ left: 0, right: 0 });
    expect(snapshot.final?.scores).toEqual({ left: 0, right: 0 });
  });

  it("counts a pre-deadline Submit that settles inside reveal grace", async () => {
    const graceMs = 100;
    const fx = await setup([{ defer: true }], { revealGraceMs: graceMs });
    const submission = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    fx.advance(MATCH_DURATION_MS);

    const closing = fx.engine.sweepExpiredMatches();
    setTimeout(() => fx.judge.release(P70), 10);
    await Promise.all([submission, closing]);

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.reveal?.scores.left).toBe(70);
    expect(snapshot.final?.scores.left).toBe(70);
  });

  it("waits for an accepted evaluation owned by another Game process", async () => {
    let now = 1_000_000;
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const collab = new InMemoryCollabPersist();
    const bank = new FileBank();
    const shared = {
      bank,
      matches,
      submissions,
      reveals,
      collab,
      clock: () => now,
      revealGraceMs: 100,
    };
    const judge = new ScriptedJudge([{ defer: true }]);
    const gameWithSubmission = new ArenaEngine({ ...shared, judge });
    const gameClosingMatch = new ArenaEngine({ ...shared, judge: new ScriptedJudge([]) });
    const left = testPrincipal("remote-left");
    const matchId = await gameWithSubmission.createMatch({
      mode: "1v1",
      participants: [
        { userId: "remote-left", sideId: "left" },
        { userId: "remote-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
      durationMs: 1000,
    });
    await gameWithSubmission.startRound(left, matchId);
    await gameWithSubmission.beginCoding(left, matchId);

    const submission = gameWithSubmission.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    now += 1000;

    const closing = gameClosingMatch.sweepExpiredMatches();
    const closedBeforeRemoteJudge = await Promise.race([
      closing.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10)),
    ]);
    judge.release(P70);
    await Promise.all([submission, closing]);

    expect(closedBeforeRemoteJudge).toBe(false);
    const snapshot = await gameClosingMatch.snapshot(left, matchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.reveal?.scores.left).toBe(70);
  });

  it("supersedes a pre-deadline Submit that settles after reveal grace", async () => {
    const graceMs = 30;
    const fx = await setup([{ defer: true }], { revealGraceMs: graceMs });
    const submission = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    fx.advance(MATCH_DURATION_MS);

    const closing = fx.engine.sweepExpiredMatches();
    setTimeout(() => {
      fx.advance(graceMs + 1);
      fx.judge.release(P70);
    }, 5);
    await Promise.all([submission, closing]);

    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.reveal?.scores.left).toBe(0);
    expect(snapshot.final?.scores.left).toBe(0);
    expect(snapshot.sides.left?.submissions).toBe(0);
  });

  it("does not wait through grace again when the sweep starts after its deadline", async () => {
    const graceMs = 200;
    const fx = await setup([{ defer: true }], { revealGraceMs: graceMs });
    const submission = fx.engine.submit(fx.left, fx.matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    fx.advance(MATCH_DURATION_MS + graceMs + 1);

    const closing = fx.engine.sweepExpiredMatches();
    const closedBeforeAnotherGrace = await Promise.race([
      closing.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20)),
    ]);
    fx.judge.release(P70);
    await Promise.all([closing, submission]);

    expect(closedBeforeAnotherGrace).toBe(true);
    const snapshot = await fx.engine.snapshot(fx.left, fx.matchId);
    expect(snapshot.roundPhase).toBe("MATCH_COMPLETE");
    expect(snapshot.reveal?.scores.left).toBe(0);
  });
});
