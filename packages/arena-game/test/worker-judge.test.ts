import { describe, expect, it } from "vitest";
import { JudgeInfraError } from "../src/judge.js";
import { setup, SOLVED_PY } from "./setup.js";

const modulePath = "../src/worker-judge.js";
const baseUrl = "http://judge-worker.internal:3010";
const token = "worker-adapter-test-token";
const limits = {
  compileWallMs: 1000,
  runWallMs: 1000,
  runMemoryMb: 64,
  runOutputBytes: 1024,
  runCpus: 1,
  runPids: 16,
};

async function loadAdapterModule(): Promise<any> {
  let loaded: any;
  try { loaded = await import(modulePath); } catch { loaded = null; }
  expect(loaded?.WorkerJudgeAdapter).toBeTypeOf("function");
  return loaded;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("WorkerJudgeAdapter", () => {
  it("sends authenticated visible requests and returns the existing CaseResult shape", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse([{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 2 }]);
    };
    const { WorkerJudgeAdapter } = await loadAdapterModule();
    const judge = new WorkerJudgeAdapter({ baseUrl, token, fetchImpl });

    const result = await judge.runVisible("Python", "snippet", "def solve(value): return value", [
      { id: "visible-1", input: "value=1", expected: "1" },
    ], limits);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${baseUrl}/v1/run-visible`);
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ language: "Python", tests: [{ expected: "1" }] });
    expect(result).toEqual([{ id: "visible-1", passed: true, status: "accepted", output: "1", runtimeMs: 2 }]);
  });

  it("sends sealed evaluations and accepts only sealed group verdicts in the response", async () => {
    let sent: Record<string, unknown> | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({ groups: [{
        name: "hidden",
        weight: 1,
        results: [{ id: "hidden-1", passed: false, status: "accepted", runtimeMs: 4 }],
      }] });
    };
    const { WorkerJudgeAdapter } = await loadAdapterModule();
    const judge = new WorkerJudgeAdapter({ baseUrl, token, fetchImpl });

    const result = await judge.evaluateSealed({
      evaluationId: "evaluation-1",
      submissionId: "submission-1",
      problemVersionId: "problem-v1",
      hiddenSuiteId: "suite-v1",
      language: "Python",
      driver: "snippet",
      source: "def solve(value): return value",
      groups: [{ name: "hidden", weight: 1, tests: [{ id: "hidden-1", input: "value=2", expected: "2" }] }],
      limits,
    });

    expect(sent).toMatchObject({ hiddenSuiteId: "suite-v1", groups: [{ tests: [{ expected: "2" }] }] });
    expect(result).toEqual({ groups: [{
      name: "hidden",
      weight: 1,
      results: [{ id: "hidden-1", passed: false, status: "accepted", runtimeMs: 4 }],
    }] });
  });

  it("maps worker HTTP errors and timeouts to JudgeInfraError without trying another backend", async () => {
    let calls = 0;
    const failedFetch: typeof fetch = async () => {
      calls++;
      return jsonResponse({ error: "judge unavailable" }, 503);
    };
    const { WorkerJudgeAdapter } = await loadAdapterModule();
    const judge = new WorkerJudgeAdapter({ baseUrl, token, fetchImpl: failedFetch, timeoutMs: 20 });
    const run = () => judge.runVisible("Python", "snippet", "source", [], limits);

    await expect(run()).rejects.toBeInstanceOf(JudgeInfraError);
    expect(calls).toBe(1);

    const hangingFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
    const timed = new WorkerJudgeAdapter({ baseUrl, token, fetchImpl: hangingFetch, timeoutMs: 10 });
    await expect(timed.runVisible("Python", "snippet", "source", [], limits)).rejects.toBeInstanceOf(JudgeInfraError);
  });

  it("keeps infrastructure failures uncounted and retries recovery through this same worker", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls++;
      if (calls === 1) return jsonResponse({ error: "judge unavailable" }, 503);
      const request = JSON.parse(String(init?.body)) as {
        groups: Array<{ name: string; weight: number; tests: Array<{ id: string }> }>;
      };
      return jsonResponse({ groups: request.groups.map((group) => ({
        name: group.name,
        weight: group.weight,
        results: group.tests.map((test) => ({ id: test.id, passed: true, status: "accepted", runtimeMs: 1 })),
      })) });
    };
    const { WorkerJudgeAdapter } = await loadAdapterModule();
    const judge = new WorkerJudgeAdapter({ baseUrl, token, fetchImpl });
    const { engine, left, matchId } = await setup([{ score: 100 }], { judge });

    await expect(engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" })).rejects.toBeInstanceOf(JudgeInfraError);
    const afterFailure = await engine.snapshot(left, matchId);
    expect(afterFailure.sides.left?.submissions).toBe(0);
    expect(afterFailure.roundPhase).toBe("CODING");

    const receipt = await engine.submit(left, matchId, { code: SOLVED_PY, language: "Python" });
    expect(receipt.ok).toBe(true);
    expect(calls).toBe(2);
    expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(1);
  });
});
