import { describe, expect, it } from "vitest";
import { InMemoryCollabPersist } from "../src/collab.js";
import { StoreBackedMatchPersistence } from "../src/persistence.js";
import {
  InMemoryMatchStore,
  InMemoryRevealStore,
  InMemorySubmissionStore,
  MatchRevisionConflictError,
} from "../src/store.js";
import { P100, SOLVED_PY, setup, tick } from "./setup.js";

class ConflictOnceMatchStore extends InMemoryMatchStore {
  private failNextCompareSave = false;

  armConflict(): void {
    this.failNextCompareSave = true;
  }

  override async save(match: Parameters<InMemoryMatchStore["save"]>[0], expectedRevision?: number): Promise<void> {
    if (this.failNextCompareSave && expectedRevision !== undefined) {
      this.failNextCompareSave = false;
      throw new MatchRevisionConflictError(match.id, expectedRevision, expectedRevision + 1);
    }
    return super.save(match, expectedRevision);
  }
}

describe("per-match critical sections (no lost updates, no cross-side freeze)", () => {
  it("concurrent submits from both sides both become counted", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ defer: true }, { defer: true }]);
    const a = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const b = engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("evaluating");
    expect((await engine.snapshot(left, matchId)).sides.right?.status).toBe("evaluating");
    judge.release(P100);
    judge.release(P100);
    await a;
    await b;
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores).toEqual({ left: 100, right: 100 });
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.sides.right?.submissions).toBe(1);
  });

  it("concurrent duplicate submits for one side: second is rejected, first counts once", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const first = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    await expect(engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
    judge.release(P100);
    await first;
    expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(1);
  });

  it("run and submit overlap: both complete, round stays active", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ defer: true }]);
    judge.deferNextRun();
    const running = engine.run(left, matchId, { code: SOLVED_PY, language: "Python" });
    const submitting = engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("CODING");
    judge.releaseRun();
    judge.release(P100);
    const [runRes] = await Promise.all([running, submitting]);
    expect(runRes.tests.every((t) => t.passed)).toBe(true);
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.right).toBe(100);
  });

  it("retries an idempotent grace snapshot after an optimistic conflict", async () => {
    const matches = new ConflictOnceMatchStore();
    const persistence = new StoreBackedMatchPersistence({
      matches,
      submissions: new InMemorySubmissionStore(),
      reveals: new InMemoryRevealStore(),
      collab: new InMemoryCollabPersist(),
    });
    const { engine, left, matchId, advance } = await setup([{ score: 100 }], { persistence });

    await engine.setPresence(matchId, "left", "offline");
    advance(90_001);
    matches.armConflict();

    await expect(engine.snapshot(left, matchId)).resolves.toMatchObject({
      roundPhase: "MATCH_COMPLETE",
      final: { forfeit: { winner: "right", loser: "left", reason: "grace-expired" } },
    });
  });
});
