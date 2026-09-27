import {
  ContainerJudge,
  Judge0Adapter,
  WorkerJudgeAdapter,
  type GameJudge,
} from "arena-game-engine";

export type JudgeEnvironment = Readonly<Record<string, string | undefined>>;

function configuredPositiveInteger(environment: JudgeEnvironment, name: string): number | undefined {
  const raw = environment[name]?.trim();
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

/** Select one GameJudge provider at process startup; provider failures never trigger fallback. */
export function createGameJudge(environment: JudgeEnvironment = process.env): GameJudge {
  const backend = (environment.JUDGE_BACKEND ?? "container").trim().toLowerCase();
  if (backend === "container") return new ContainerJudge();
  if (backend === "worker") {
    const baseUrl = environment.JUDGE_WORKER_URL?.trim();
    if (!baseUrl) throw new Error("JUDGE_WORKER_URL is required when JUDGE_BACKEND=worker");
    const token = environment.JUDGE_WORKER_TOKEN?.trim();
    if (!token) throw new Error("JUDGE_WORKER_TOKEN is required when JUDGE_BACKEND=worker");
    return new WorkerJudgeAdapter({
      baseUrl,
      token,
      timeoutMs: configuredPositiveInteger(environment, "JUDGE_WORKER_TIMEOUT_MS"),
    });
  }
  if (backend !== "judge0") throw new Error(`unsupported JUDGE_BACKEND ${backend}`);

  const baseUrl = environment.JUDGE0_URL?.trim();
  if (!baseUrl) throw new Error("JUDGE0_URL is required when JUDGE_BACKEND=judge0");
  const authToken = environment.JUDGE0_AUTH_TOKEN?.trim();
  return new Judge0Adapter({
    baseUrl,
    headers: authToken ? { "X-Auth-Token": authToken } : {},
    languageIds: {
      C: Number(environment.JUDGE0_C_LANGUAGE_ID ?? 50),
      "C++": Number(environment.JUDGE0_CPP_LANGUAGE_ID ?? 54),
      Python: Number(environment.JUDGE0_PYTHON_LANGUAGE_ID ?? 71),
    },
    pollIntervalMs: Number(environment.JUDGE0_POLL_INTERVAL_MS ?? 250),
    maxPolls: Number(environment.JUDGE0_MAX_POLLS ?? 120),
  });
}
