import {
  type CaseResult,
  type DriverKind,
  type ExecutionStatus,
  GameJudge,
  JudgeInfraError,
  type JudgeLimits,
  type SealedEvaluationRequest,
  type SealedGroupResult,
  type SupportedLanguage,
  type VisibleTest,
} from "./judge.js";

export interface WorkerJudgeAdapterOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const STATUSES = new Set<ExecutionStatus>([
  "accepted",
  "compile_error",
  "runtime_error",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "output_limit_exceeded",
  "process_limit_exceeded",
  "internal_error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCaseResult(value: unknown): CaseResult | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.passed !== "boolean"
    || typeof value.status !== "string" || !STATUSES.has(value.status as ExecutionStatus)
    || typeof value.output !== "string" || typeof value.runtimeMs !== "number"
    || !Number.isFinite(value.runtimeMs) || value.runtimeMs < 0) return null;
  return {
    id: value.id,
    passed: value.passed,
    status: value.status as ExecutionStatus,
    output: value.output,
    runtimeMs: value.runtimeMs,
  };
}

function parseSealedGroup(value: unknown): SealedGroupResult | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.weight !== "number"
    || !Number.isFinite(value.weight) || !Array.isArray(value.results)) return null;
  const results = value.results.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.passed !== "boolean"
      || typeof item.status !== "string" || !STATUSES.has(item.status as ExecutionStatus)
      || typeof item.runtimeMs !== "number" || !Number.isFinite(item.runtimeMs) || item.runtimeMs < 0) return null;
    return {
      id: item.id,
      passed: item.passed,
      status: item.status as ExecutionStatus,
      runtimeMs: item.runtimeMs,
    };
  });
  if (results.some((item) => item === null)) return null;
  return { name: value.name, weight: value.weight, results: results as SealedGroupResult["results"] };
}

/** Game-side transport adapter. It has no provider fallback by design. */
export class WorkerJudgeAdapter implements GameJudge {
  readonly provider = "worker";
  private readonly endpoint: URL;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WorkerJudgeAdapterOptions) {
    const token = options.token.trim();
    if (!token) throw new Error("JUDGE_WORKER_TOKEN is required");
    let endpoint: URL;
    try {
      endpoint = new URL(options.baseUrl);
    } catch {
      throw new Error("JUDGE_WORKER_URL must be an absolute HTTP URL");
    }
    if ((endpoint.protocol !== "http:" && endpoint.protocol !== "https:") || endpoint.username || endpoint.password) {
      throw new Error("JUDGE_WORKER_URL must be an absolute HTTP URL without embedded credentials");
    }
    this.endpoint = endpoint;
    this.token = token;
    this.timeoutMs = options.timeoutMs ?? 930000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1) throw new Error("worker timeout must be positive");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async runVisible(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    tests: VisibleTest[],
    limits: JudgeLimits,
  ): Promise<CaseResult[]> {
    const result = await this.post("/v1/run-visible", { language, driver, source, tests, limits });
    if (!Array.isArray(result) || result.length !== tests.length) {
      throw new JudgeInfraError("judge worker returned an invalid visible result");
    }
    const cases = result.map(parseCaseResult);
    if (cases.some((item) => item === null)) throw new JudgeInfraError("judge worker returned an invalid visible result");
    const typedCases = cases as CaseResult[];
    if (typedCases.some((item, index) => item.id !== tests[index]?.id)) {
      throw new JudgeInfraError("judge worker returned mismatched visible cases");
    }
    return typedCases;
  }

  async evaluateSealed(request: SealedEvaluationRequest): Promise<{ groups: SealedGroupResult[] }> {
    const result = await this.post("/v1/evaluate-sealed", request);
    if (!isRecord(result) || !Array.isArray(result.groups) || result.groups.length !== request.groups.length) {
      throw new JudgeInfraError("judge worker returned an invalid sealed result");
    }
    const groups = result.groups.map(parseSealedGroup);
    if (groups.some((item) => item === null)) throw new JudgeInfraError("judge worker returned an invalid sealed result");
    const typedGroups = groups as SealedGroupResult[];
    for (let groupIndex = 0; groupIndex < typedGroups.length; groupIndex++) {
      const actual = typedGroups[groupIndex]!;
      const expected = request.groups[groupIndex]!;
      if (actual.name !== expected.name || actual.weight !== expected.weight || actual.results.length !== expected.tests.length
        || actual.results.some((item, testIndex) => item.id !== expected.tests[testIndex]?.id)) {
        throw new JudgeInfraError("judge worker returned mismatched sealed cases");
      }
    }
    return { groups: typedGroups };
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const url = new URL(path, this.endpoint);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "";
      throw new JudgeInfraError(errorName === "TimeoutError" || errorName === "AbortError"
        ? "judge worker request timed out"
        : "judge worker request failed");
    }
    if (!response.ok) throw new JudgeInfraError(`judge worker returned HTTP ${response.status}`);
    try {
      return await response.json() as unknown;
    } catch {
      throw new JudgeInfraError("judge worker returned invalid JSON");
    }
  }
}
