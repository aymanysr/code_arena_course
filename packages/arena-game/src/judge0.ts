import {
  type CaseResult,
  type DriverKind,
  type ExecutionStatus,
  JudgeInfraError,
  type JudgeExecutionMetrics,
  type JudgeLimits,
  type SealedEvaluationRequest,
  type SealedGroupResult,
  type SupportedLanguage,
  type VisibleTest,
  type GameJudge,
} from "./judge.js";

export interface Judge0SubmissionRequest {
  languageId: number;
  sourceCode: string;
  stdin: string;
  cpuTimeLimitSeconds: number;
  wallTimeLimitSeconds: number;
  memoryLimitKb: number;
  maxOutputSizeKb: number;
  maxProcessesAndOrThreads: number;
  enablePerProcessAndThreadTimeLimit: true;
  enablePerProcessAndThreadMemoryLimit: true;
  maxFileSizeKb: number;
  redirectStderrToStdout: false;
  /** Always false for this adapter; callers cannot opt into network access. */
  enableNetwork: false;
}

export interface Judge0SubmissionResponse {
  status?: { id?: number; description?: string };
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  message?: string;
  time?: string | number | null;
  memory?: number | null;
}

/** Provider seam used by tests and by the small fetch client below. */
export interface Judge0HttpClient {
  createSubmission(input: Judge0SubmissionRequest): Promise<{ token: string }>;
  getSubmission(token: string): Promise<Judge0SubmissionResponse>;
}

export interface Judge0AdapterOptions {
  /** Inject this in tests; production normally supplies baseUrl instead. */
  http?: Judge0HttpClient;
  baseUrl?: string;
  headers?: Record<string, string>;
  languageIds?: Partial<Record<SupportedLanguage, number>>;
  pollIntervalMs?: number;
  maxPolls?: number;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}

const DEFAULT_LANGUAGE_IDS: Record<SupportedLanguage, number> = {
  C: 50,
  "C++": 54,
  Python: 71,
};

const DEFAULT_POLL_INTERVAL_MS = 250;
const DEFAULT_MAX_POLLS = 120;

interface CaseInput {
  id: string;
  input: string;
  expected: string;
}

interface NormalizedCase {
  id: string;
  status: ExecutionStatus;
  passed: boolean;
  output: string;
  runtimeMs: number;
}

interface SnippetOutput {
  result?: unknown;
  output?: unknown;
}

/**
 * Judge0 execution adapter.
 *
 * Judge0 is deliberately hidden behind GameJudge: provider tokens, polling,
 * provider status IDs, raw responses, and hidden expected values never leave
 * this module. One logical Evaluation is reduced to grouped game verdicts;
 * recovery may create a fresh provider job without changing that identity.
 */
export class Judge0Adapter implements GameJudge {
  readonly provider = "judge0";
  private readonly http: Judge0HttpClient;
  private readonly languageIds: Record<SupportedLanguage, number>;
  private readonly pollIntervalMs: number;
  private readonly maxPolls: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly clock: () => number;
  private lastMetrics: JudgeExecutionMetrics | undefined;

  constructor(options: Judge0AdapterOptions = {}) {
    this.http = options.http ?? this.createHttpClient(options);
    this.languageIds = { ...DEFAULT_LANGUAGE_IDS, ...options.languageIds };
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.maxPolls = options.maxPolls ?? DEFAULT_MAX_POLLS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.clock = options.clock ?? (() => Date.now());
  }

  consumeMetrics(): JudgeExecutionMetrics | undefined {
    const metrics = this.lastMetrics;
    this.lastMetrics = undefined;
    return metrics;
  }

  async runVisible(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    tests: VisibleTest[],
    limits: JudgeLimits,
  ): Promise<CaseResult[]> {
    const results = await this.runCases(
      language,
      driver,
      source,
      undefined,
      tests.map((test) => ({ id: test.id, input: test.input, expected: test.expected })),
      limits,
    );
    return results.map((result) => ({
      id: result.id,
      passed: result.passed,
      status: result.status,
      output: result.output.slice(0, 4000),
      runtimeMs: result.runtimeMs,
    }));
  }

  async evaluateSealed(request: SealedEvaluationRequest): Promise<{ groups: SealedGroupResult[] }> {
    const cases = request.groups.flatMap((group) =>
      group.tests.map((test) => ({ id: test.id, input: test.input, expected: test.expected })),
    );
    const results = await this.runCases(
      request.language,
      request.driver,
      request.source,
      request.entrypoint,
      cases,
      request.limits,
    );
    const byId = new Map(results.map((result) => [result.id, result]));
    return {
      groups: request.groups.map((group) => ({
        name: group.name,
        weight: group.weight,
        results: group.tests.map((test) => {
          const result = byId.get(test.id) ?? {
            id: test.id,
            status: "internal_error" as const,
            passed: false,
            output: "",
            runtimeMs: 0,
          };
          return { id: result.id, passed: result.passed, status: result.status, runtimeMs: result.runtimeMs };
        }),
      })),
    };
  }

  private async runCases(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    entrypoint: string | undefined,
    cases: CaseInput[],
    limits: JudgeLimits,
  ): Promise<NormalizedCase[]> {
    if (driver === "snippet" && language !== "Python") {
      throw new JudgeInfraError("Judge0 snippet driver is only configured for Python");
    }
    const startedAt = this.clock();
    const results: NormalizedCase[] = [];
    try {
      for (const test of cases) {
        results.push(await this.runCase(language, driver, source, entrypoint, test, limits));
      }
      return results;
    } finally {
      const executionMs = Math.max(0, this.clock() - startedAt);
      const providerRuntimeMs = results.reduce((total, result) => total + result.runtimeMs, 0);
      this.lastMetrics = {
        provider: this.provider,
        queueWaitMs: Math.max(0, executionMs - providerRuntimeMs),
        executionMs,
        jobs: cases.length,
      };
    }
  }

  private async runCase(
    language: SupportedLanguage,
    driver: DriverKind,
    source: string,
    entrypoint: string | undefined,
    test: CaseInput,
    limits: JudgeLimits,
  ): Promise<NormalizedCase> {
    const providerSource = driver === "snippet" ? this.snippetHarness(source, test.input, entrypoint) : source;
    let response: Judge0SubmissionResponse;
    try {
      const created = await this.http.createSubmission({
        languageId: this.languageIds[language],
        sourceCode: providerSource,
        stdin: test.input,
        cpuTimeLimitSeconds: Math.max(0.001, limits.runWallMs / 1000),
        wallTimeLimitSeconds: Math.max(0.001, Math.max(limits.compileWallMs, limits.runWallMs) / 1000),
        memoryLimitKb: Math.max(1, limits.runMemoryMb * 1024),
        maxOutputSizeKb: Math.max(1, Math.ceil(limits.runOutputBytes / 1024)),
        maxProcessesAndOrThreads: Math.max(1, limits.runPids),
        enablePerProcessAndThreadTimeLimit: true,
        enablePerProcessAndThreadMemoryLimit: true,
        maxFileSizeKb: Math.max(1, Math.ceil(limits.runOutputBytes / 1024)),
        redirectStderrToStdout: false,
        enableNetwork: false,
      });
      if (!created.token) throw new JudgeInfraError("Judge0 did not return a submission token");
      response = await this.poll(created.token);
    } catch (error) {
      if (error instanceof JudgeInfraError) throw error;
      throw new JudgeInfraError("Judge0 request failed");
    }

    const status = this.statusFrom(response.status?.id);
    if (status === "internal_error") throw new JudgeInfraError("Judge0 returned an internal execution failure");
    const runtimeMs = this.runtimeMs(response.time);
    if (status !== "accepted") {
      return { id: test.id, status, passed: false, output: "", runtimeMs };
    }

    const output = this.outputFor(response, driver);
    const comparison = driver === "snippet" ? this.snippetResult(response.stdout) : output;
    return {
      id: test.id,
      status,
      passed: this.normalize(comparison) === this.normalize(test.expected),
      output,
      runtimeMs,
    };
  }

  private async poll(token: string): Promise<Judge0SubmissionResponse> {
    for (let attempt = 0; attempt < this.maxPolls; attempt++) {
      const response = await this.http.getSubmission(token);
      const statusId = response.status?.id;
      if (statusId !== 1 && statusId !== 2) return response;
      if (attempt + 1 < this.maxPolls) await this.sleep(this.pollIntervalMs);
    }
    throw new JudgeInfraError("Judge0 polling timed out");
  }

  private statusFrom(statusId: number | undefined): ExecutionStatus {
    if (statusId === 3 || statusId === 4) return "accepted";
    if (statusId === 5) return "time_limit_exceeded";
    if (statusId === 6) return "compile_error";
    if (statusId !== undefined && statusId >= 7 && statusId <= 12) return "runtime_error";
    return "internal_error";
  }

  private outputFor(response: Judge0SubmissionResponse, driver: DriverKind): string {
    if (driver === "snippet") return this.snippetOutput(response.stdout);
    return response.stdout ?? "";
  }

  private snippetResult(stdout: string | undefined): string {
    try {
      const parsed = JSON.parse(stdout ?? "") as SnippetOutput;
      return typeof parsed.result === "string" ? parsed.result : String(parsed.result ?? "");
    } catch {
      return "";
    }
  }

  private snippetOutput(stdout: string | undefined): string {
    try {
      const parsed = JSON.parse(stdout ?? "") as SnippetOutput;
      return typeof parsed.output === "string" ? parsed.output : "";
    } catch {
      return "";
    }
  }

  private normalize(value: string): string {
    return value.trim();
  }

  private runtimeMs(time: string | number | null | undefined): number {
    if (typeof time === "number") return Math.max(0, Math.round(time * 1000));
    if (typeof time === "string") {
      const seconds = Number(time);
      return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
    }
    return 0;
  }

  private snippetHarness(source: string, input: string, entrypoint: string | undefined): string {
    return [
      "import contextlib, inspect, io, json",
      `__source = ${JSON.stringify(source)}`,
      "exec(__source, globals(), globals())",
      `__entrypoint = ${JSON.stringify(entrypoint ?? "")}`,
      "if __entrypoint and inspect.isclass(globals().get('Solution')):",
      "    __target = getattr(globals()['Solution'](), __entrypoint, None)",
      "elif __entrypoint:",
      "    __target = globals().get(__entrypoint)",
      "else:",
      "    __public = [v for k, v in globals().items() if not k.startswith('_') and callable(v) and getattr(v, '__module__', None) == '__main__']",
      "    __target = __public[0] if len(__public) == 1 else None",
      "if not callable(__target): raise RuntimeError('missing or ambiguous entrypoint')",
      "__case = {}",
      `exec(${JSON.stringify(input)}, __case, __case)`,
      "__args = [v for k, v in __case.items() if not k.startswith('_')]",
      "__buffer = io.StringIO()",
      "with contextlib.redirect_stdout(__buffer):",
      "    __result = __target(*__args)",
      "print(json.dumps({'result': repr(__result), 'output': __buffer.getvalue()}, separators=(',', ':'))) ",
    ].join("\n");
  }

  private createHttpClient(options: Judge0AdapterOptions): Judge0HttpClient {
    if (!options.baseUrl) throw new Error("Judge0Adapter requires an HTTP client or baseUrl");
    return new FetchJudge0HttpClient(options.baseUrl, options.headers ?? {});
  }
}

class FetchJudge0HttpClient implements Judge0HttpClient {
  constructor(private readonly baseUrl: string, private readonly headers: Record<string, string>) {}

  async createSubmission(input: Judge0SubmissionRequest): Promise<{ token: string }> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/submissions?base64_encoded=true&wait=false`, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body: JSON.stringify({
        language_id: input.languageId,
        source_code: Buffer.from(input.sourceCode, "utf8").toString("base64"),
        stdin: Buffer.from(input.stdin, "utf8").toString("base64"),
        cpu_time_limit: input.cpuTimeLimitSeconds,
        wall_time_limit: input.wallTimeLimitSeconds,
        memory_limit: input.memoryLimitKb,
        max_output_size: input.maxOutputSizeKb,
        max_processes_and_or_threads: input.maxProcessesAndOrThreads,
        enable_per_process_and_thread_time_limit: input.enablePerProcessAndThreadTimeLimit,
        enable_per_process_and_thread_memory_limit: input.enablePerProcessAndThreadMemoryLimit,
        max_file_size: input.maxFileSizeKb,
        redirect_stderr_to_stdout: input.redirectStderrToStdout,
        enable_network: input.enableNetwork,
      }),
    });
    if (!response.ok) throw new JudgeInfraError("Judge0 submission request failed");
    const body = (await response.json()) as { token?: unknown };
    if (typeof body.token !== "string") throw new JudgeInfraError("Judge0 submission token missing");
    return { token: body.token };
  }

  async getSubmission(token: string): Promise<Judge0SubmissionResponse> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/submissions/${encodeURIComponent(token)}?base64_encoded=true&fields=status,stdout,stderr,compile_output,message,time,memory`,
      { headers: this.headers },
    );
    if (!response.ok) throw new JudgeInfraError("Judge0 result request failed");
    const body = (await response.json()) as {
      status?: { id?: number; description?: string };
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      message?: string | null;
      time?: string | null;
      memory?: number | null;
    };
    return {
      status: body.status,
      stdout: this.decode(body.stdout),
      stderr: this.decode(body.stderr),
      compileOutput: this.decode(body.compile_output),
      message: this.decode(body.message),
      time: body.time,
      memory: body.memory,
    };
  }

  private decode(value: string | null | undefined): string | undefined {
    if (value == null) return undefined;
    try {
      return Buffer.from(value, "base64").toString("utf8");
    } catch {
      return "";
    }
  }
}
