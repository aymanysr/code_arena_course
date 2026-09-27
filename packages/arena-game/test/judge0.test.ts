import { describe, expect, it } from "vitest";
import { JudgeInfraError, type JudgeLimits, type SealedEvaluationRequest } from "../src/judge.js";
import { Judge0Adapter, type Judge0HttpClient, type Judge0SubmissionResponse } from "../src/judge0.js";

const limits: JudgeLimits = {
  compileWallMs: 2_000,
  runWallMs: 500,
  runMemoryMb: 128,
  runOutputBytes: 4_000,
  runCpus: 1,
  runPids: 32,
};

const request: SealedEvaluationRequest = {
  evaluationId: "evaluation-1",
  submissionId: "submission-1",
  problemVersionId: "problem-1",
  hiddenSuiteId: "hidden-1",
  language: "Python",
  driver: "stdio",
  source: "print(2)",
  groups: [
    {
      name: "Basic",
      weight: 60,
      tests: [
        { id: "case-1", input: "1", expected: "2" },
        { id: "case-2", input: "2", expected: "4" },
      ],
    },
    {
      name: "Edge",
      weight: 40,
      tests: [{ id: "case-3", input: "0", expected: "0" }],
    },
  ],
  limits,
};

function accepted(stdout: string): Judge0SubmissionResponse {
  return { status: { id: 3, description: "Accepted" }, stdout, time: "0.01", memory: 128 };
}

class ScriptedJudge0Http implements Judge0HttpClient {
  readonly created: Array<{ sourceCode: string; stdin: string; enableNetwork: boolean }> = [];
  private index = 0;

  constructor(private readonly responses: Judge0SubmissionResponse[]) {}

  async createSubmission(input: { sourceCode: string; stdin: string; enableNetwork: boolean }): Promise<{ token: string }> {
    this.created.push(input);
    return { token: `provider-token-${this.created.length}` };
  }

  async getSubmission(_token: string): Promise<Judge0SubmissionResponse> {
    return this.responses[this.index++] ?? this.responses.at(-1)!;
  }
}

describe("Judge0Adapter", () => {
  it("maps one logical hidden Evaluation into grouped sealed results", async () => {
    const http = new ScriptedJudge0Http([accepted("2"), accepted("4"), accepted("0")]);
    const judge = new Judge0Adapter({ http, sleep: async () => {} });

    await expect(judge.evaluateSealed(request)).resolves.toEqual({
      groups: [
        {
          name: "Basic",
          weight: 60,
          results: [
            { id: "case-1", passed: true, status: "accepted", runtimeMs: 10 },
            { id: "case-2", passed: true, status: "accepted", runtimeMs: 10 },
          ],
        },
        {
          name: "Edge",
          weight: 40,
          results: [{ id: "case-3", passed: true, status: "accepted", runtimeMs: 10 }],
        },
      ],
    });
    expect(http.created).toHaveLength(3);
    expect(http.created.every((job) => job.enableNetwork === false)).toBe(true);
    expect(http.created.map((job) => job.stdin)).toEqual(["1", "2", "0"]);
    expect(http.created.every((job) => !job.sourceCode.includes('"2"'))).toBe(true);
    expect(judge.consumeMetrics()).toMatchObject({ provider: "judge0", jobs: 3 });
  });

  it("turns provider polling timeout into JudgeInfraError without leaking the provider token", async () => {
    const http = new ScriptedJudge0Http([{ status: { id: 2, description: "Processing" } }]);
    const judge = new Judge0Adapter({ http, maxPolls: 1, sleep: async () => {} });

    await expect(judge.evaluateSealed(request)).rejects.toMatchObject({ name: "JudgeInfraError" });
    await expect(judge.evaluateSealed(request)).rejects.not.toThrow("provider-token");
  });

  it("normalizes provider compilation errors as non-competitive case results", async () => {
    const http = new ScriptedJudge0Http([{ status: { id: 6, description: "Compilation Error" }, compileOutput: "bad code" }]);
    const judge = new Judge0Adapter({ http, sleep: async () => {} });

    const result = await judge.runVisible("Python", "stdio", "bad", [{ id: "visible-1", input: "", expected: "" }], limits);
    expect(result).toEqual([{ id: "visible-1", passed: false, status: "compile_error", output: "", runtimeMs: 0 }]);
    expect(result[0]).not.toEqual(expect.objectContaining({ output: expect.stringContaining("provider-token") }));
  });
});
