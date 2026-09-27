export type EvaluationTelemetryOutcome = "completed" | "failed" | "infrastructure_error";

export interface EvaluationTelemetryObservation {
  evaluationId: string;
  provider: string;
  queueWaitMs: number;
  executionMs: number;
  outcome: EvaluationTelemetryOutcome;
}

export interface EvaluationProviderTelemetry {
  evaluations: number;
  queueWaitMs: number;
  executionMs: number;
  infrastructureErrors: number;
}

export interface EvaluationTelemetrySnapshot {
  observations: EvaluationTelemetryObservation[];
  providers: Record<string, EvaluationProviderTelemetry>;
}

export interface EvaluationTelemetry {
  record(observation: EvaluationTelemetryObservation): void;
}

/**
 * Small process-local sink for rollout evidence. It deliberately makes no
 * scheduling decision and does not write MatchRecord or SubmissionRecord.
 */
export class InMemoryEvaluationTelemetry implements EvaluationTelemetry {
  private readonly observations: EvaluationTelemetryObservation[] = [];

  record(observation: EvaluationTelemetryObservation): void {
    this.observations.push({
      ...observation,
      queueWaitMs: Math.max(0, observation.queueWaitMs),
      executionMs: Math.max(0, observation.executionMs),
    });
  }

  snapshot(): EvaluationTelemetrySnapshot {
    const providers: Record<string, EvaluationProviderTelemetry> = {};
    for (const observation of this.observations) {
      const current =
        providers[observation.provider] ??
        (providers[observation.provider] = {
          evaluations: 0,
          queueWaitMs: 0,
          executionMs: 0,
          infrastructureErrors: 0,
        });
      current.evaluations += 1;
      current.queueWaitMs += observation.queueWaitMs;
      current.executionMs += observation.executionMs;
      if (observation.outcome === "infrastructure_error") current.infrastructureErrors += 1;
    }
    return {
      observations: this.observations.map((observation) => ({ ...observation })),
      providers: structuredClone(providers),
    };
  }
}
