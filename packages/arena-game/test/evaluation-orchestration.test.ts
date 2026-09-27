import { describe, expect, it } from "vitest";
import { EvaluationInFlightRegistry } from "../src/evaluation-orchestration.js";

describe("evaluation orchestration in-flight ownership", () => {
  it("settles the current owner and leaves other evaluations discoverable by round", async () => {
    const registry = new EvaluationInFlightRegistry();
    const tracked = registry.track("evaluation-1", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "left",
      submissionId: "submission-1",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-1",
      documentRevision: null,
    });
    registry.track("evaluation-2", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "right",
      submissionId: "submission-2",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-2",
      documentRevision: null,
    });

    expect(registry.get("evaluation-1")).toBe(tracked);
    expect(registry.forRound("match-1", "round-1").map(({ evaluationId }) => evaluationId)).toEqual([
      "evaluation-1",
      "evaluation-2",
    ]);

    const completion = tracked.promise;
    registry.settle("evaluation-1", tracked, { ok: true });

    await expect(completion).resolves.toEqual({ ok: true });
    expect(registry.get("evaluation-1")).toBeUndefined();
    expect(registry.forRound("match-1", "round-1").map(({ evaluationId }) => evaluationId)).toEqual(["evaluation-2"]);
  });

  it("does not remove a newer owner when an old owner settles late", async () => {
    const registry = new EvaluationInFlightRegistry();
    const original = registry.track("evaluation-1", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "left",
      submissionId: "submission-1",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-1",
      documentRevision: null,
    });
    const replacement = registry.track("evaluation-1", {
      matchId: "match-1",
      roundId: "round-1",
      sideId: "left",
      submissionId: "submission-2",
      problemVersionId: "even-ledger",
      language: "Python",
      sourceHash: "hash-2",
      documentRevision: null,
    });

    registry.settle("evaluation-1", original, { ok: false, error: new Error("stale") });

    expect(registry.get("evaluation-1")).toBe(replacement);
    await expect(original.promise).resolves.toMatchObject({ ok: false });
    expect(registry.forRound("match-1", "round-1")).toHaveLength(1);

    registry.settle("evaluation-1", replacement, { ok: true });
    await expect(replacement.promise).resolves.toEqual({ ok: true });
  });
});
