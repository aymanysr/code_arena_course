import { describe, expect, it } from "vitest";
import { InMemoryEvaluationTelemetry } from "../src/evaluation-telemetry.js";

describe("evaluation telemetry", () => {
  it("records provider timing and aggregates infrastructure failures", () => {
    const telemetry = new InMemoryEvaluationTelemetry();
    telemetry.record({
      evaluationId: "evaluation-1",
      provider: "judge0",
      queueWaitMs: 40,
      executionMs: 120,
      outcome: "completed",
    });
    telemetry.record({
      evaluationId: "evaluation-2",
      provider: "judge0",
      queueWaitMs: 10,
      executionMs: 30,
      outcome: "infrastructure_error",
    });

    expect(telemetry.snapshot()).toEqual({
      observations: [
        {
          evaluationId: "evaluation-1",
          provider: "judge0",
          queueWaitMs: 40,
          executionMs: 120,
          outcome: "completed",
        },
        {
          evaluationId: "evaluation-2",
          provider: "judge0",
          queueWaitMs: 10,
          executionMs: 30,
          outcome: "infrastructure_error",
        },
      ],
      providers: {
        judge0: {
          evaluations: 2,
          queueWaitMs: 50,
          executionMs: 150,
          infrastructureErrors: 1,
        },
      },
    });
  });
});
