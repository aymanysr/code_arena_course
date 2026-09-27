/** Verdict taxonomy (ticket 06): over-limit conditions are verdicts, never hangs. */
export type ExecutionStatus =
  | "accepted"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "output_limit_exceeded"
  | "process_limit_exceeded"
  | "internal_error";

/** Any completed judge verdict (all statuses except internal_error) is a competitive attempt. */
export function isCompetitiveVerdict(status: ExecutionStatus): boolean {
  return status !== "internal_error";
}

export interface VisibleTest {
  id: string;
  input: string;
  expected: string;
}

export interface CaseResult {
  id: string;
  passed: boolean;
  status: ExecutionStatus;
  output: string;
  runtimeMs: number;
}

export interface JudgeExecutionMetrics {
  provider: string;
  queueWaitMs: number;
  executionMs: number;
  jobs: number;
}

/** Sealed hidden material: travels game→judge only, never to the browser. */
export interface SealedTest {
  id: string;
  input: string;
  expected: string;
}

export interface SealedGroup {
  name: string;
  weight: number;
  tests: SealedTest[];
}

export interface SealedGroupResult {
  name: string;
  weight: number;
  results: Array<{ id: string; passed: boolean; status: ExecutionStatus; runtimeMs: number }>;
}

export interface JudgeLimits {
  compileWallMs: number;
  runWallMs: number;
  runMemoryMb: number;
  runOutputBytes: number;
  runCpus: number;
  runPids: number;
}

/** Spike-calibrated starting quotas (spikes/judge-isolation/DECISION.md). Not frozen. */
export const SPIKE_LIMITS: JudgeLimits = {
  compileWallMs: 150000,
  runWallMs: 8000,
  runMemoryMb: 256,
  runOutputBytes: 65536,
  runCpus: 1,
  runPids: 64,
};

export type SupportedLanguage = "C++" | "Python" | "C";

export function assertSupportedLanguage(language: string): asserts language is SupportedLanguage {
  if (language !== "C++" && language !== "Python" && language !== "C") {
    throw new ValidationError(`unsupported language ${language}`);
  }
}

/**
 * Execution driver: "snippet" evaluates bank-style input snippets against the
 * player's single public function (Python); "stdio" feeds raw input bytes to a
 * complete program over stdin. The game resolves the driver from bank metadata;
 * until the bank declares `driver`/`entrypoint` (05 follow-up), the engine uses
 * snippet for Python and stdio otherwise.
 */
export type DriverKind = "snippet" | "stdio";

export interface SealedEvaluationRequest {
  evaluationId: string;
  submissionId: string;
  problemVersionId: string;
  hiddenSuiteId: string;
  language: SupportedLanguage;
  driver: DriverKind;
  /** Bank-declared entrypoint for snippet drivers; undefined selects single-public-function discovery. */
  entrypoint?: string;
  source: string;
  groups: SealedGroup[];
  limits: JudgeLimits;
}

/**
 * GameJudge: execution only. The judge compiles/runs untrusted source, enforces
 * limits, and returns verdicts. It owns no match state, counting, or reveal.
 */
export interface GameJudge {
  /** Stable adapter name for internal rollout telemetry. */
  readonly provider?: string;
  /** One logical call may cover multiple provider jobs; consume after it returns. */
  consumeMetrics?(): JudgeExecutionMetrics | undefined;
  runVisible(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    tests: VisibleTest[],
    limits: JudgeLimits,
  ): Promise<CaseResult[]>;
  evaluateSealed(request: SealedEvaluationRequest): Promise<{ groups: SealedGroupResult[] }>;
}

/** Thrown when the judging platform fails before any competitive verdict. */
export class JudgeInfraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JudgeInfraError";
  }
}

/** Thrown when game-side input validation rejects a request before judging. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
