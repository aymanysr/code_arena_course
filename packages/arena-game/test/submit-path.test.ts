import { describe, expect, it } from "vitest";
import { P100, P40, P55, P70, SOLVED_PY, STARTER_PY, setup, tick } from "./setup.js";

const HIDDEN_MARKERS = ["1000000000", "Negatives and zeros", "hiddenGroups", "expected.txt"];

describe("08 submit path (sealed hidden evaluation, last-wins)", () => {
  it("1. first submit completes and remains sealed", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    const receipt = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
    expect(JSON.stringify(receipt)).not.toContain("100");
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.reveal).toBeNull();
    expect(snap.sides.left?.submissions).toBe(1);
  });

  it("2. second submit overwrites counted result (100 then 40)", async () => {
    const { engine, left, matchId } = await setup([P100, P40]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.submit(left, matchId, { code: STARTER_PY, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(40);
    expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(2);
  });

  it("40 then 100 counts 100", async () => {
    const { engine, left, matchId } = await setup([P40, P100]);
    await engine.submit(left, matchId, { code: STARTER_PY, language: "Python" });
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  });

  it("3. failed resubmit preserves previous counted result", async () => {
    const { engine, left, matchId } = await setup([P70, { infra: "hidden suite timeout" }]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await expect(engine.submit(left, matchId, { code: STARTER_PY, language: "Python" })).rejects.toThrow();
    const snap = await engine.snapshot(left, matchId);
    expect(snap.roundPhase).toBe("CODING");
    expect(snap.sides.left?.status).toBe("coding");
    expect(snap.sides.left?.submissions).toBe(1);
    expect(snap.failures).toEqual(["submit: hidden suite timeout"]);
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(70);
  });

  it("4. idempotent retry of the same evaluationId creates no second attempt", async () => {
    const { engine, judge, left, matchId } = await setup([P100, P40]);
    const first = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-1",
      evaluationId: "eval-1",
    });
    const retry = await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-1",
      evaluationId: "eval-1",
    });
    expect(retry).toEqual(first);
    expect(judge.evalCalls).toBe(1);
    expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(1);
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  });

  it("concurrent retry of an in-flight evaluation does not hold the Match lock", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-in-flight",
      evaluationId: "eval-in-flight",
    };
    const first = engine.submit(left, matchId, input);
    await tick();

    const retry = engine.submit(left, matchId, input);
    judge.release(P100);

    const [firstReceipt, retryReceipt] = await Promise.race([
      Promise.all([first, retry]),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("in-flight retry deadlocked behind the Match lock")), 250);
      }),
    ]);
    expect(retryReceipt).toEqual(firstReceipt);
    expect(judge.evalCalls).toBe(1);
  });

  it("rejects an in-flight evaluation id reused for different submission data", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const first = engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-original",
      evaluationId: "eval-collision",
    });
    await tick();

    const conflicting = engine.submit(left, matchId, {
      code: STARTER_PY,
      language: "Python",
      submissionId: "sub-conflicting",
      evaluationId: "eval-collision",
    });
    judge.release(P100);
    await first;

    await expect(conflicting).rejects.toThrow("evaluation id is already bound to different submission data");
    expect(judge.evalCalls).toBe(1);
  });

  it("rejects a completed evaluation id reused for different submission data", async () => {
    const { engine, left, matchId } = await setup([P100]);
    await engine.submit(left, matchId, {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-completed",
      evaluationId: "eval-completed",
    });

    await expect(
      engine.submit(left, matchId, {
        code: STARTER_PY,
        language: "Python",
        submissionId: "sub-completed",
        evaluationId: "eval-completed",
      }),
    ).rejects.toThrow("evaluation id is already bound to different submission data");
  });

  it("replays an in-flight judge failure to the idempotent retry", async () => {
    const { engine, judge, left, matchId } = await setup([{ defer: true }]);
    const input = {
      code: SOLVED_PY,
      language: "Python",
      submissionId: "sub-failed-in-flight",
      evaluationId: "eval-failed-in-flight",
    };
    const first = engine.submit(left, matchId, input);
    await tick();
    const retry = engine.submit(left, matchId, input);
    judge.release({ infra: "hidden suite timeout" });

    await expect(first).rejects.toThrow("hidden suite timeout");
    await expect(retry).rejects.toThrow("hidden suite timeout");
    expect(judge.evalCalls).toBe(1);
  });

  it("new Submit click mints new submissionId and evaluationId", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }, { score: 100 }]);
    const first = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const second = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(first.submissionId).not.toBe(second.submissionId);
    expect(first.evaluationId).not.toBe(second.evaluationId);
  });

  it("5. compile error counts as an attempt with counted 0", async () => {
    const { engine, left, matchId } = await setup([{ verdict: "compile_error" }]);
    await engine.submit(left, matchId, { code: "def broken(:", language: "Python" });
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(1);
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(0);
  });

  it("6. TLE, MLE and OLE count as attempts", async () => {
    for (const verdict of ["time_limit_exceeded", "memory_limit_exceeded", "output_limit_exceeded"] as const) {
      const { engine, left, matchId } = await setup([{ verdict }]);
      await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
      const snap = await engine.snapshot(left, matchId);
      expect(snap.sides.left?.submissions).toBe(1);
      const reveal = await engine.publishReveal(left, matchId);
      expect(reveal.scores.left).toBe(0);
    }
  });

  it("7. infrastructure failure counts for history but not for tiebreak", async () => {
    const { engine, left, matchId } = await setup([P70, { infra: "queue down" }, P100]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await expect(engine.submit(left, matchId, { code: STARTER_PY, language: "Python" })).rejects.toThrow();
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const snap = await engine.snapshot(left, matchId);
    expect(snap.sides.left?.submissions).toBe(2);
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  });

  it("8+9. A evaluating does not block B; B can submit while A evaluates", async () => {
    const { engine, judge, left, right, matchId } = await setup([{ defer: true }, P100]);
    const aPending = engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await tick();
    expect((await engine.snapshot(right, matchId)).sides.left?.status).toBe("evaluating");
    const receipt = await engine.submit(right, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("evaluating");
    expect((await engine.snapshot(left, matchId)).roundPhase).toBe("CODING");
    judge.release(P55);
    await aPending;
    expect((await engine.snapshot(left, matchId)).sides.left?.status).toBe("coding");
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(55);
    expect(reveal.scores.right).toBe(100);
  });

  it("10. reveal unavailable before explicit publish action", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect((await engine.snapshot(left, matchId)).reveal).toBeNull();
  });

  it("11. post-reveal submit rejected", async () => {
    const { engine, left, matchId } = await setup([{ score: 100 }]);
    await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    await engine.publishReveal(left, matchId);
    await expect(engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toThrow();
  });

  it("12. hidden payload never reaches client-facing DTO or events", async () => {
    const { engine, judge, left, matchId } = await setup([{ score: 100 }]);
    const seen: unknown[] = [];
    engine.on((_event, payload) => seen.push(payload));
    const receipt = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    const snap = await engine.snapshot(left, matchId);
    // Judge DID receive sealed hidden material over the internal channel.
    expect(JSON.stringify(judge.lastSealedGroups)).toContain("1000000000");
    for (const body of [JSON.stringify(receipt), JSON.stringify(snap), ...seen.map((s) => JSON.stringify(s))]) {
      for (const marker of HIDDEN_MARKERS) {
        expect(body).not.toContain(marker);
      }
    }
  });
});
