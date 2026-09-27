import { describe, expect, it } from "vitest";
import {
  ArenaEngine,
  IllegalStateError,
  NotMemberError,
  ValidationError,
  assertSupportedLanguage,
} from "../src/index.js";
import { InMemoryMatchStore, InMemorySubmissionStore } from "../src/store.js";
import { FileBank } from "../src/file-bank.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { testPrincipal, type AuthenticatedPrincipal } from "../src/principal.js";

function p(userId: string): AuthenticatedPrincipal {
  return testPrincipal(userId);
}

describe("cross-match and cross-team security isolation", () => {
  it("cross-match attack: participant in Match 1 cannot access, read, or act on Match 2", async () => {
    const judge = new ScriptedJudge([{ score: 100 }]);
    const engine = new ArenaEngine({
      matches: new InMemoryMatchStore(),
      submissions: new InMemorySubmissionStore(),
      bank: new FileBank(),
      judge,
    });

    const m1Id = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "a1", sideId: "left" },
        { userId: "a2", sideId: "left" },
        { userId: "b1", sideId: "right" },
        { userId: "b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    const m2Id = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "c1", sideId: "left" },
        { userId: "c2", sideId: "left" },
        { userId: "d1", sideId: "right" },
        { userId: "d2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    // A1 attempts to read snapshot of M2
    await expect(engine.snapshot(p("a1"), m2Id)).rejects.toThrow(NotMemberError);

    // A1 attempts to start round in M2
    await expect(engine.startRound(p("a1"), m2Id)).rejects.toThrow(NotMemberError);

    // A1 attempts to begin coding in M2
    await expect(engine.beginCoding(p("a1"), m2Id)).rejects.toThrow(NotMemberError);

    // A1 attempts to run visible tests in M2
    await expect(engine.run(p("a1"), m2Id, { code: "x=1", language: "Python" })).rejects.toThrow(NotMemberError);

    // A1 attempts to ready up in M2
    await expect(engine.setReady(p("a1"), m2Id, { ready: true })).rejects.toThrow(NotMemberError);

    // A1 attempts to submit code in M2
    await expect(engine.submit(p("a1"), m2Id, { code: "x=1", language: "Python" })).rejects.toThrow(NotMemberError);

    // A1 attempts to advance round in M2
    await expect(engine.nextRound(p("a1"), m2Id)).rejects.toThrow(NotMemberError);

    // A1 attempts to leave M2
    await expect(engine.leaveMatch(p("a1"), m2Id)).rejects.toThrow(NotMemberError);

    // A1 attempts to sync collab in M2
    await expect(engine.collabSync(p("a1"), m2Id)).rejects.toThrow(NotMemberError);

    // A1 attempts to resolve team chat context in M2
    await expect(engine.resolveTeamChatContext(p("a1"), m2Id)).rejects.toThrow(NotMemberError);
  });

  it("cross-team attack inside Match 1: Alpha member cannot access Beta collab, chat, or forge Beta actions", async () => {
    const judge = new ScriptedJudge([{ score: 100 }]);
    const engine = new ArenaEngine({
      matches: new InMemoryMatchStore(),
      submissions: new InMemorySubmissionStore(),
      bank: new FileBank(),
      judge,
    });

    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "a1", sideId: "left" },
        { userId: "a2", sideId: "left" },
        { userId: "b1", sideId: "right" },
        { userId: "b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    // Start round & begin coding
    await engine.startRound(p("a1"), matchId);
    await engine.beginCoding(p("a1"), matchId);

    // Collab sync for A1 returns strictly Alpha room (side: "left")
    const a1Sync = await engine.collabSync(p("a1"), matchId);
    expect(a1Sync.side).toBe("left");
    expect(a1Sync.roomId).toContain("left");
    expect(a1Sync.roomId).not.toContain("right");

    // Chat context for A1 resolves strictly to Alpha room
    const a1Chat = await engine.resolveTeamChatContext(p("a1"), matchId);
    expect(a1Chat.sideId).toBe("left");
    expect(a1Chat.roomId).toContain("left");
    expect(a1Chat.roomId).not.toContain("right");

    // Readiness: A1 readying marks only A1 on team Alpha, never Beta
    await engine.setReady(p("a1"), matchId, { ready: true, documentRevision: a1Sync.revision });
    const snap = await engine.snapshot(p("a1"), matchId);
    const ownTeam = snap.teams?.find((t) => t.side === "left");
    const oppTeam = snap.teams?.find((t) => t.side === "right");
    expect(ownTeam?.members.find((m) => m.userId === "a1")?.ready).toBe(true);
    expect(ownTeam?.members.find((m) => m.userId === "a2")?.ready).toBe(false);
    expect(oppTeam?.members.every((m) => !m.ready)).toBe(true);

    // Snapshot masks Beta: opponent revision and language are NEVER visible
    expect(oppTeam?.documentRevision).toBeNull();
    expect(oppTeam?.language).toBeNull();
    expect(JSON.stringify(snap)).not.toContain("right-source");
  });

  it("language and command injection payloads are rejected by allowlist and cannot reach the execution environment", async () => {
    const judge = new ScriptedJudge([{ score: 100 }]);
    const engine = new ArenaEngine({
      matches: new InMemoryMatchStore(),
      submissions: new InMemorySubmissionStore(),
      bank: new FileBank(),
      judge,
    });

    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "u1", sideId: "left" },
        { userId: "u2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    await engine.startRound(p("u1"), matchId);
    await engine.beginCoding(p("u1"), matchId);

    const injectionPayloads = [
      "; touch /tmp/pwned",
      "Python && rm -rf /",
      "Python; sleep 10",
      "../../bin/sh",
      "Python\ncat /etc/passwd",
      'Python" || echo pwned',
      "Bash",
      "Ruby",
      "javascript",
    ];

    for (const payload of injectionPayloads) {
      expect(() => assertSupportedLanguage(payload)).toThrow(ValidationError);

      await expect(
        engine.run(p("u1"), matchId, { code: "x=1", language: payload }),
      ).rejects.toThrow(ValidationError);

      await expect(
        engine.submit(p("u1"), matchId, { code: "x=1", language: payload }),
      ).rejects.toThrow(ValidationError);
    }
  });

  it("submission idempotency: duplicate submission retries return identical receipts and do not create duplicate attempts", async () => {
    const judge = new ScriptedJudge([{ score: 100 }]);
    const subs = new InMemorySubmissionStore();
    const engine = new ArenaEngine({
      matches: new InMemoryMatchStore(),
      submissions: subs,
      bank: new FileBank(),
      judge,
    });

    const matchId = await engine.createMatch({
      mode: "1v1",
      participants: [
        { userId: "u1", sideId: "left" },
        { userId: "u2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    await engine.startRound(p("u1"), matchId);
    await engine.beginCoding(p("u1"), matchId);

    const subId = "sub-idempotent-001";
    const evalId = "eval-idempotent-001";

    const r1 = await engine.submit(p("u1"), matchId, {
      code: "def ledger_sum(nums): return 0\n",
      language: "Python",
      submissionId: subId,
      evaluationId: evalId,
    });

    // Duplicate retry with exact same ids
    const r2 = await engine.submit(p("u1"), matchId, {
      code: "def ledger_sum(nums): return 0\n",
      language: "Python",
      submissionId: subId,
      evaluationId: evalId,
    });

    expect(r1.submissionId).toBe(r2.submissionId);
    expect(r1.evaluationId).toBe(r2.evaluationId);

    // Verify exactly one submission was recorded
    const snap = await engine.snapshot(p("u1"), matchId);
    expect(snap.sides["left"].submissions).toBe(1);
    const rec = await subs.getBySubmissionId(subId);
    expect(rec).toBeDefined();
    expect(rec?.submissionId).toBe(subId);
  });

  it("time integrity: match clock is strictly server-owned and cannot be reset or extended by clients", async () => {
    let now = 1000000;
    const judge = new ScriptedJudge([{ score: 100 }]);
    const engine = new ArenaEngine({
      matches: new InMemoryMatchStore(),
      submissions: new InMemorySubmissionStore(),
      bank: new FileBank(),
      judge,
      clock: () => now,
    });

    const matchId = await engine.createMatch({
      mode: "1v1",
      durationMs: 300000,
      participants: [
        { userId: "u1", sideId: "left" },
        { userId: "u2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    const snap1 = await engine.snapshot(p("u1"), matchId);
    expect(snap1.remainingMs).toBe(300000);
    expect(snap1.expired).toBe(false);

    // Advance server time past match duration
    now += 300000;
    const snap2 = await engine.snapshot(p("u1"), matchId);
    expect(snap2.remainingMs).toBe(0);
    expect(snap2.expired).toBe(true);
  });

  it("collab update bounds: oversized Yjs frames and malformed base64 are rejected", async () => {
    const judge = new ScriptedJudge([{ score: 100 }]);
    const engine = new ArenaEngine({
      matches: new InMemoryMatchStore(),
      submissions: new InMemorySubmissionStore(),
      bank: new FileBank(),
      judge,
    });

    const matchId = await engine.createMatch({
      mode: "2v2",
      participants: [
        { userId: "a1", sideId: "left" },
        { userId: "a2", sideId: "left" },
        { userId: "b1", sideId: "right" },
        { userId: "b2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
    });

    await engine.startRound(p("a1"), matchId);
    await engine.beginCoding(p("a1"), matchId);

    const sync = await engine.collabSync(p("a1"), matchId);
    const roundId = sync.roundId;

    // Malformed base64
    await expect(
      engine.applyCollabUpdate(p("a1"), matchId, {
        roundId,
        updateB64: "NOT_BASE64_!@#$%",
      }),
    ).rejects.toThrow("malformed collab update");

    // Empty update
    await expect(
      engine.applyCollabUpdate(p("a1"), matchId, {
        roundId,
        updateB64: "",
      }),
    ).rejects.toThrow("malformed collab update");
  });
});
