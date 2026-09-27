import { describe, expect, it } from "vitest";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { InMemoryCollabPersist } from "../src/collab.js";
import { StoreBackedMatchPersistence } from "../src/persistence.js";
import { testPrincipal } from "../src/principal.js";
import type { SubmissionRecord } from "../src/records.js";
import { InMemoryMatchStore, InMemoryRevealStore, InMemorySubmissionStore } from "../src/store.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { P100, P40, SOLVED_PY, STARTER_PY, setup, tick } from "./setup.js";

const HIDDEN_MARKERS = ["1000000000", '"b1"', '"n1"', '"e1"'];

describe("presence owns connectivity, never activity (ticket 11 §1)", () => {
  it("fresh sides read offline; socket attach flips online without touching activity", async () => {
    const { engine, left, matchId } = await setup();
    let snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.presence).toBe("offline");
    expect(snap.sides.right?.presence).toBe("offline");
    await engine.setPresence(matchId, "left", "online");
    await engine.setPresence(matchId, "right", "online");
    snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left).toMatchObject({ presence: "online", status: "coding", submissions: 0 });
    expect(snap.sides.right).toMatchObject({ presence: "online", status: "coding", submissions: 0 });
  });

  it("socket loss keeps coding/running/submitted/evaluating/locked activities", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ defer: true }, { defer: true }]);
    judge.deferNextRun();
    const running = engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    const submitting = engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    await engine.setPresence(matchId, "left", "offline");
    await engine.setPresence(matchId, "right", "offline");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.status).toBe("running");
    expect(snap.sides.right?.status).toBe("evaluating");
    judge.releaseRun();
    judge.release(P100);
    await running;
    await submitting;
    const after = await engine.snapshot(left, matchId);
    expect(after.sides.left?.status).toBe("coding");
    expect(after.sides.right?.status).toBe("coding");
    expect(after.sides.right?.submissions).toBe(1);
  });

  it("PlayerStatus has no connectivity value", async () => {
    const { engine, left, matchId } = await setup();
    const snap = await engine.snapshot(left, matchId);
    for (const side of Object.values(snap.sides)) {
      expect(side.status).not.toBe("disconnected");
    }
    await expect(engine.setPresence(matchId, "nope", "online")).rejects.toThrow();
  });
});

describe("match clock survives disconnect (ticket 11 §4)", () => {
  it("offline N seconds lowers the clock by N; restart-equivalent reload keeps startedAt", async () => {
    const { engine, left, matchId, advance } = await setup();
    const before = await engine.snapshot(left, matchId);
    await engine.setPresence(matchId, "left", "offline");
    advance(45_000);
    const after = await engine.snapshot(left, matchId);
    expect(before.remainingMs - after.remainingMs).toBe(45_000);
    expect(after.expired).toBe(false);
  });
});

describe("reconnect snapshot restores authoritative state (ticket 11 §2)", () => {
  it("run result, submissions, and sealed reveal all survive an offline window", async () => {
    const { engine, left, right, matchId } = await setup([P100, P40]);
    await engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.submit(right, matchId, { code: STARTER_PY, language: "Python" });
    await engine.setPresence(matchId, "left", "offline");
    const reveal = await engine.publishReveal(right, matchId);
    await engine.setPresence(matchId, "left", "online");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("SCORE_REVEAL");
    expect(snap.reveal?.roundId).toBe(reveal.roundId);
    expect(snap.reveal?.scores).toEqual({ left: 100, right: 40 });
    expect(snap.tests.filter((t) => t.status === "passed")).toHaveLength(3);
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.pendingEvaluation).toBe(false);
  });

  it("advance while offline lands the client on the new round with reset tests", async () => {
    const { engine, left, right, matchId } = await setup([P100, P100]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.submit(right, matchId, { code: STARTER_PY, language: "Python" });
    await engine.publishReveal(left, matchId);
    await engine.setPresence(matchId, "left", "offline");
    await engine.nextRound(right, matchId);
    await engine.setPresence(matchId, "left", "online");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.round).toBe(2);
    expect(snap.roundPhase).toBe("ROUND_INTRO");
    expect(snap.reveal).toBeNull();
    expect(snap.tests.every((t) => t.status === "idle")).toBe(true);
  });

  it("sealed material never leaks through any reconnect snapshot", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ defer: true }]);
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    await engine.setPresence(matchId, "left", "offline");
    await engine.setPresence(matchId, "left", "online");
    for (const snap of [await engine.snapshot(left, matchId), await engine.snapshot(right, matchId)]) {
      expect(snap.reveal).toBeNull();
      const text = JSON.stringify(snap);
      for (const marker of HIDDEN_MARKERS) expect(text).not.toContain(marker);
    }
    expect((await engine.snapshot(left, matchId)).pendingEvaluation).toBe(true);
    expect((await engine.snapshot(right, matchId)).pendingEvaluation).toBe(false);
    judge.release(P100);
    await pending;
    const sealed = await engine.snapshot(left, matchId);
    expect(JSON.stringify(sealed)).not.toContain('"b1"');
  });
});

describe("evaluation completes or fails while the side is offline (ticket 11 §7)", () => {
  it("offline completion counts normally and stays sealed", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    await engine.setPresence(matchId, "left", "offline");
    judge.release(P100);
    await pending;
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.reveal).toBeNull();
  });

  it("offline judge failure restores coding with no fabricated score", async () => {
    const { engine, left, matchId } = await setup([{ infra: "boom" }]);
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    pending.catch(() => {});
    await tick();
    await engine.setPresence(matchId, "left", "offline");
    await expect(pending).rejects.toThrow("boom");
    await engine.setPresence(matchId, "left", "online");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.sides.left?.submissions).toBe(0);
    expect(snap.failures.length).toBeGreaterThan(0);
  });
});

describe("revision ordering (ticket 11 §3)", () => {
  it("mutations bump revision exactly once; reads and idempotent retries do not", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const r0 = (await engine.snapshot(left, matchId)).revision;
    const r1 = (await engine.snapshot(left, matchId)).revision;
    expect(r1).toBe(r0);
    const pending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    judge.release(P100);
    await pending;
    const r2 = (await engine.snapshot(left, matchId)).revision;
    expect(r2).toBeGreaterThan(r1);
  });

  it("every event payload carries the post-commit revision", async () => {
    const { engine, left, matchId } = await setup([P100]);
    const seen: Array<{ event: string; revision: unknown }> = [];
    engine.on((event, payload) => {
      seen.push({ event, revision: (payload as { revision?: unknown }).revision });
    });
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(typeof s.revision).toBe("number");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.revision).toBeGreaterThanOrEqual(Math.max(...seen.map((s) => s.revision as number)));
  });
});

describe("grace expiry forfeits; rejoin in time resumes (ticket 11 §11)", () => {
  it("offline past grace forfeits to the connected side", async () => {
    const { engine, left, right, matchId, advance } = await setup([], { reconnectGraceMs: 5000 });
    await engine.setPresence(matchId, "left", "online");
    await engine.setPresence(matchId, "right", "online");
    await engine.setPresence(matchId, "left", "offline");
    advance(6000);
    expect(await engine.applyGraceIfExpired(matchId)).toBe(true);
    const snap = await engine.snapshot(right, matchId);
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.final?.winner).toBe("right");
    expect(snap.final?.forfeit).toMatchObject({ winner: "right", loser: "left", reason: "grace-expired" });
    const fin = await engine.finalResult(right, matchId);
    expect(fin.winner).toBe("right");
  });

  it("reconnect before expiry clears grace with no forfeit", async () => {
    const { engine, left, matchId, advance } = await setup([], { reconnectGraceMs: 5000 });
    await engine.setPresence(matchId, "left", "online");
    await engine.setPresence(matchId, "left", "offline");
    advance(4000);
    await engine.setPresence(matchId, "left", "online");
    advance(4000);
    expect(await engine.applyGraceIfExpired(matchId)).toBe(false);
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("CODING");
  });

  it("repeated disconnects never extend the original grace start", async () => {
    const { engine, left, matchId, advance } = await setup([], { reconnectGraceMs: 5000 });
    await engine.setPresence(matchId, "left", "online");
    await engine.setPresence(matchId, "left", "offline");
    advance(4000);
    await engine.setPresence(matchId, "left", "offline");
    advance(2000);
    expect(await engine.applyGraceIfExpired(matchId)).toBe(true);
  });

  it("both sides past grace forfeits the earliest-offline side", async () => {
    const { engine, right, matchId, advance } = await setup([], { reconnectGraceMs: 5000 });
    await engine.setPresence(matchId, "left", "online");
    await engine.setPresence(matchId, "right", "online");
    await engine.setPresence(matchId, "left", "offline");
    advance(1000);
    await engine.setPresence(matchId, "right", "offline");
    advance(6000);
    await engine.applyGraceIfExpired(matchId);
    expect((await engine.snapshot(right, matchId)).final?.forfeit).toMatchObject({
      winner: "right",
      loser: "left",
    });
  });

  it("sides never attached have no grace clock (fresh matches never self-forfeit)", async () => {
    const { engine, matchId, advance } = await setup([], { reconnectGraceMs: 5000 });
    advance(60_000);
    expect(await engine.applyGraceIfExpired(matchId)).toBe(false);
  });
});

describe("deliberate leave is immediate and distinct from disconnect (ticket 11 §15)", () => {
  it("leave forfeits at once; disconnect stays in grace", async () => {
    const { engine, left, right, matchId } = await setup();
    await engine.setPresence(matchId, "right", "online");
    await engine.setPresence(matchId, "right", "offline");
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("CODING");
    const res = await engine.leaveMatch(left, matchId);
    expect(res).toEqual({ winner: "right", loser: "left" });
    const snap = await engine.snapshot(right, matchId);
    expect(snap.roundPhase).toBe("MATCH_COMPLETE");
    expect(snap.final?.forfeit).toMatchObject({ reason: "leave" });
    await expect(engine.leaveMatch(right, matchId)).rejects.toThrow("already complete");
  });
});

describe("boot recovery across a simulated process death (ticket 11 §10)", () => {
  it("does not mark a pending evaluation failed when claim acquisition is unavailable", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals,
      collab: new InMemoryCollabPersist(),
      claimPendingEvaluation: async () => {
        throw new Error("claim unavailable");
      },
    });
    const judge = new ScriptedJudge([P100]);
    const engine = new ArenaEngine({ judge, bank: new FileBank(), persistence, clock: () => 1_000_000, revealGraceMs: 0 });
    const left = testPrincipal("user-left");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    const match = await matches.load(matchId);
    const round = match!.rounds[0]!;
    const pending: SubmissionRecord = {
      submissionId: "claim-unavailable-submission",
      evaluationId: "claim-unavailable-evaluation",
      matchId,
      roundId: round.roundId,
      sideId: "left",
      problemVersionId: round.problemVersionId,
      language: "Python",
      source: SOLVED_PY,
      sourceHash: "source-hash",
      documentRevision: null,
      submittedAt: 1_000_000,
      elapsedMatchMs: 0,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    await submissions.append(pending);

    await expect(engine.recover()).rejects.toThrow("claim unavailable");
    expect((await submissions.getByEvaluationId(pending.evaluationId))?.status).toBe("pending");
    expect(judge.evalCalls).toBe(0);
  });

  it("settles a losing retry when its terminal-row read fails", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals,
      collab: new InMemoryCollabPersist(),
    });
    const originalClaim = persistence.claimPendingEvaluation.bind(persistence);
    const originalFind = persistence.findSubmissionByEvaluationId.bind(persistence);
    let failNextTerminalRead = false;
    persistence.claimPendingEvaluation = async (evaluationId) => {
      const claim = await originalClaim(evaluationId);
      if (!claim) failNextTerminalRead = true;
      return claim;
    };
    persistence.findSubmissionByEvaluationId = async (evaluationId) => {
      if (failNextTerminalRead) {
        failNextTerminalRead = false;
        throw new Error("terminal read unavailable");
      }
      return originalFind(evaluationId);
    };

    const firstJudge = new ScriptedJudge([{ defer: true }]);
    const secondJudge = new ScriptedJudge([P100]);
    const left = testPrincipal("user-left");
    const engine1 = new ArenaEngine({ judge: firstJudge, bank: new FileBank(), persistence, clock: () => 1_000_000, revealGraceMs: 0 });
    const engine2 = new ArenaEngine({ judge: secondJudge, bank: new FileBank(), persistence, clock: () => 1_000_000, revealGraceMs: 0 });
    const matchId = await engine1.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine1.startRound(left, matchId);
    await engine1.beginCoding(left, matchId);

    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "terminal-read-submission",
      evaluationId: "terminal-read-evaluation",
    };
    const first = engine1.submit(left, matchId, input);
    first.catch(() => {});
    for (let i = 0; i < 100 && firstJudge.evalCalls < 1; i++) await tick();
    expect(firstJudge.evalCalls).toBe(1);

    const second = engine2.submit(left, matchId, input);
    second.catch(() => {});
    await tick();
    firstJudge.release(P100);
    await first;
    await expect(second).rejects.toThrow("terminal read unavailable");

    const retry = engine2.submit(left, matchId, input);
    retry.catch(() => {});
    await expect(
      Promise.race([
        retry,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("retry remained attached to a settled loser")), 500)),
      ]),
    ).resolves.toMatchObject({ ok: true });
    expect(secondJudge.evalCalls).toBe(0);
  });

  it("settles retries when recording a judge failure itself fails", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals,
      collab: new InMemoryCollabPersist(),
    });
    persistence.updateSubmission = async () => {
      throw new Error("failure persistence unavailable");
    };
    const judge = new ScriptedJudge([{ infra: "judge unavailable" }]);
    const engine = new ArenaEngine({ judge, bank: new FileBank(), persistence, clock: () => 1_000_000, revealGraceMs: 0 });
    const left = testPrincipal("user-left");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    const input = { code: SOLVED_PY, language: "Python", submissionId: "failed-persist-submission", evaluationId: "failed-persist-evaluation" };

    const first = engine.submit(left, matchId, input);
    first.catch(() => {});
    await expect(first).rejects.toThrow("failure persistence unavailable");

    const retry = engine.submit(left, matchId, input);
    retry.catch(() => {});
    await expect(
      Promise.race([
        retry,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("retry remained attached after failure persistence error")), 500)),
      ]),
    ).rejects.toThrow("failure persistence unavailable");
    expect(judge.evalCalls).toBe(2);
  });

  it("keeps a pending row recoverable when verdict persistence fails", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    let commitAttempts = 0;
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals,
      collab: new InMemoryCollabPersist(),
      commitClaimedEvaluation: async (_claim, match, submission) => {
        commitAttempts += 1;
        if (commitAttempts === 1) throw new Error("verdict persistence unavailable");
        if (submission) await submissions.update(submission);
        await matches.save(match);
      },
    });
    const judge = new ScriptedJudge([P100]);
    const engine = new ArenaEngine({ judge, bank: new FileBank(), persistence, clock: () => 1_000_000, revealGraceMs: 0 });
    const left = testPrincipal("user-left");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    const match = await matches.load(matchId);
    const round = match!.rounds[0]!;
    const pending: SubmissionRecord = {
      submissionId: "recovery-commit-failure-submission",
      evaluationId: "recovery-commit-failure-evaluation",
      matchId,
      roundId: round.roundId,
      sideId: "left",
      problemVersionId: round.problemVersionId,
      language: "Python",
      source: SOLVED_PY,
      sourceHash: "recovery-commit-failure-hash",
      documentRevision: null,
      submittedAt: 1_000_000,
      elapsedMatchMs: 0,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    };
    await submissions.append(pending);

    await expect(engine.recover()).rejects.toThrow("verdict persistence unavailable");
    expect((await submissions.getByEvaluationId(pending.evaluationId))?.status).toBe("pending");
    expect(judge.evalCalls).toBe(1);
    expect(commitAttempts).toBe(1);
  });

  it("stamps the protected evaluation commit without a second ordinary Match save", async () => {
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions,
      reveals,
      collab: new InMemoryCollabPersist(),
    });
    const originalSave = persistence.saveMatch.bind(persistence);
    const originalCommit = persistence.commitClaimedEvaluation.bind(persistence);
    let protectedCommitDone = false;
    persistence.saveMatch = async (match) => {
      if (protectedCommitDone) throw new Error("unprotected revision save");
      await originalSave(match);
    };
    persistence.commitClaimedEvaluation = async (claim, match, submission) => {
      await originalCommit(claim, match, submission);
      protectedCommitDone = true;
    };
    const engine = new ArenaEngine({
      judge: new ScriptedJudge([P100]),
      bank: new FileBank(),
      persistence,
      clock: () => 1_000_000,
      revealGraceMs: 0,
    });
    const left = testPrincipal("user-left");
    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    await engine.startRound(left, matchId);
    await engine.beginCoding(left, matchId);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(protectedCommitDone).toBe(true);
  });

  async function twoEngines(plans: Parameters<typeof setup>[0], options: Record<string, unknown> = {}) {
    let now = 1_000_000;
    const judge = new ScriptedJudge(plans);
    const matches = new InMemoryMatchStore();
    const submissions = new InMemorySubmissionStore();
    const reveals = new InMemoryRevealStore();
    const stores = { matches, submissions, reveals };
    const left = testPrincipal("user-left");
    const right = testPrincipal("user-right");
    const engine1 = new ArenaEngine({
      judge,
      bank: new FileBank(),
      clock: () => now,
      revealGraceMs: 0,
      ...stores,
      ...options,
    });
    const matchId = await engine1.createMatch({
      mode: "1v1",
      participants: [
        { userId: "user-left", sideId: "left" },
        { userId: "user-right", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });
    await engine1.startRound(left, matchId);
    await engine1.beginCoding(left, matchId);
    const engine2 = new ArenaEngine({
      judge,
      bank: new FileBank(),
      clock: () => now,
      revealGraceMs: 0,
      ...stores,
      ...options,
    });
    return { engine1, engine2, judge, left, right, matchId, stores, advance: (ms: number) => { now += ms; } };
  }

  it("presence resets offline, transient activity repairs, pending re-drives once", async () => {
    const { engine1, engine2, judge, left, right, matchId, stores } = await twoEngines([{ defer: true }]);
    const match = await stores.matches.load(matchId);
    const round = match!.rounds[0]!;
    await stores.submissions.append({
      submissionId: "recovery-unclaimed-submission",
      evaluationId: "recovery-unclaimed-evaluation",
      matchId,
      roundId: round.roundId,
      sideId: "left",
      problemVersionId: round.problemVersionId,
      language: "Python",
      source: SOLVED_PY,
      sourceHash: "recovery-unclaimed-hash",
      documentRevision: null,
      submittedAt: 1_000_000,
      elapsedMatchMs: 0,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    });
    await engine1.setPresence(matchId, "left", "online");
    await engine1.setPresence(matchId, "right", "online");
    const recovered = engine2.recover();
    for (let i = 0; i < 100 && judge.evalCalls < 1; i++) await tick();
    expect(judge.evalCalls).toBe(1);
    judge.release(P100);
    const report = await recovered;
    expect(report).toEqual({ matches: 1, retried: 1, failed: 0 });
    const snap = await engine2.snapshot(left, matchId);
    expect(snap.sides.left?.presence).toBe("offline");
    expect(snap.sides.right?.presence).toBe("offline");
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.sides.right?.submissions).toBe(0);
  });

  it("supersedes an expired pending evaluation during recovery without rerunning the judge", async () => {
    const graceMs = 25;
    const { engine1, engine2, judge, left, matchId, stores, advance } = await twoEngines(
      [{ score: 100 }],
      { revealGraceMs: graceMs },
    );
    const match = await stores.matches.load(matchId);
    const round = match!.rounds[0]!;
    round.activities.left = "evaluating";
    await stores.matches.save(match!);
    await stores.submissions.append({
      submissionId: "expired-recovery-submission",
      evaluationId: "expired-recovery-evaluation",
      matchId,
      roundId: round.roundId,
      sideId: "left",
      problemVersionId: round.problemVersionId,
      language: "Python",
      source: SOLVED_PY,
      sourceHash: "expired-recovery-hash",
      documentRevision: null,
      submittedAt: match!.startedAt + match!.durationMs - 1,
      elapsedMatchMs: match!.durationMs - 1,
      status: "pending",
      score: null,
      scoreBp: null,
      groups: null,
      testStatuses: null,
      failureCode: null,
    });
    advance(match!.durationMs + graceMs + 1);

    const report = await engine2.recover();

    expect(judge.evalCalls).toBe(0);
    expect(report).toEqual({ matches: 1, retried: 0, failed: 0 });
    expect((await stores.submissions.getByEvaluationId("expired-recovery-evaluation"))?.status).toBe("superseded");
    expect((await engine2.snapshot(left, matchId)).roundPhase).toBe("MATCH_COMPLETE");
    await engine1.setPresence(matchId, "left", "offline");
  });

  it("interrupted reveal flip unwinds cleanly; late verdict still counts", async () => {
    const { engine1, engine2, judge, left, right, matchId } = await twoEngines(
      [{ score: 100 }, { defer: true }, { defer: true }],
      { revealGraceMs: 1500 },
    );
    await engine1.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const late = engine1.submit(right, matchId, { code: STARTER_PY, language: "Python" });
    late.catch(() => {});
    await tick();
    const revealing = engine1.publishReveal(left, matchId, { graceMs: 1500 });
    await tick();
    // Death during the grace wait: closing persisted, no reveal row yet.
    const recovering = engine2.recover();
    for (let i = 0; i < 100 && judge.evalCalls < 3; i++) await tick();
    expect(judge.evalCalls).toBe(3);
    judge.release(P100);
    judge.release(P100);
    await late;
    const report = await recovering;
    expect(report.matches).toBe(1);
    const reveal = await revealing;
    expect(reveal.scores).toEqual({ left: 100, right: 100 });
    const snap = await engine2.snapshot(right, matchId);
    expect(snap.roundPhase).toBe("SCORE_REVEAL");
    expect(snap.sides.right?.submissions).toBe(1);
  }, 20000);
});
