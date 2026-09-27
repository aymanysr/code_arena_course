import {
  type CaseResult,
  type DriverKind,
  type ExecutionStatus,
  JudgeInfraError,
  type GameJudge,
  type JudgeLimits,
  type SealedEvaluationRequest,
  type SealedGroupResult,
  type SupportedLanguage,
  type VisibleTest,
} from "../src/judge.js";

export type ScriptPlan =
  | { score: 100 | 0 }
  | { passes: boolean[] }
  | { verdict: ExecutionStatus }
  | { infra: string }
  | { defer: true };

/**
 * Scripted GameJudge: deterministic plan per evaluateSealed call; runVisible
 * passes fixture expected outputs unless failed. Deferred entries park until
 * released, proving in-flight overlap.
 */
export class ScriptedJudge implements GameJudge {
  private readonly plan: ScriptPlan[];
  private parked: Array<(v: ScriptPlan) => void> = [];
  private failRun: string | null = null;
  private queuedRunStatus: ExecutionStatus | null = null;
  private runArmed = false;
  private runGate: Array<() => void> = [];
  runCalls = 0;
  evalCalls = 0;
  lastRunTests: VisibleTest[] = [];
  lastSealedGroups: SealedEvaluationRequest["groups"] = [];

  constructor(plan: ScriptPlan[] = [{ score: 100 }]) {
    this.plan = [...plan];
  }

  failNextRun(message: string): void {
    this.failRun = message;
  }

  queueRunStatus(status: ExecutionStatus): void {
    this.queuedRunStatus = status;
  }

  deferNextRun(): void {
    this.runArmed = true;
  }

  releaseRun(): void {
    const resume = this.runGate.shift();
    if (!resume) throw new Error("no parked run");
    resume();
  }

  release(v: ScriptPlan): void {
    const settle = this.parked.shift();
    if (!settle) throw new Error("nothing parked");
    settle(v);
  }

  queuePlan(...entries: ScriptPlan[]): void {
    this.plan.push(...entries);
  }

  async runVisible(
    _language: SupportedLanguage,
    _driver: DriverKind,
    _source: string,
    tests: VisibleTest[],
    _limits: JudgeLimits,
  ): Promise<CaseResult[]> {
    this.runCalls += 1;
    this.lastRunTests = tests.map((t) => ({ ...t }));
    if (this.failRun) {
      const message = this.failRun;
      this.failRun = null;
      throw new JudgeInfraError(message);
    }
    if (this.runArmed) {
      this.runArmed = false;
      await new Promise<void>((resolve) => {
        this.runGate.push(resolve);
      });
    }
    if (this.queuedRunStatus) {
      const status = this.queuedRunStatus;
      this.queuedRunStatus = null;
      return tests.map((t, i) => ({ id: t.id, passed: false, status, output: "", runtimeMs: 1 + i }));
    }
    return tests.map((t, i) => ({ id: t.id, passed: true, status: "accepted" as const, output: t.expected, runtimeMs: 1 + i }));
  }

  async evaluateSealed(request: SealedEvaluationRequest): Promise<{ groups: SealedGroupResult[] }> {
    this.evalCalls += 1;
    this.lastSealedGroups = request.groups;
    const next = this.plan.shift() ?? { score: 100 };
    if (typeof next === "object" && "defer" in next) {
      const v = await new Promise<ScriptPlan>((resolve) => this.parked.push(resolve));
      return this.apply(request, v);
    }
    return this.apply(request, next);
  }

  private apply(request: SealedEvaluationRequest, next: ScriptPlan): { groups: SealedGroupResult[] } {
    if ("infra" in next) throw new JudgeInfraError(next.infra);
    if ("verdict" in next) {
      return {
        groups: request.groups.map((g) => ({
          name: g.name,
          weight: g.weight,
          results: g.tests.map((t) => ({ id: t.id, passed: false, status: next.verdict, runtimeMs: 1 })),
        })),
      };
    }
    // ponytail: the script deals per-test pass/fail only — earned/bp/score are
    // computed by the engine through arena-model, never here.
    const total = request.groups.reduce((s, g) => s + g.tests.length, 0);
    const flags: boolean[] =
      "passes" in next
        ? next.passes
        : "score" in next
          ? request.groups.flatMap((g) => g.tests.map(() => next.score === 100))
          : (() => {
              throw new Error("parked plan reached apply without release");
            })();
    if (flags.length !== total) {
      throw new Error(`pass pattern length ${flags.length} mismatches ${total} tests`);
    }
    let i = 0;
    return {
      groups: request.groups.map((g) => ({
        name: g.name,
        weight: g.weight,
        results: g.tests.map((t) => {
          const passed = flags[i++]!;
          return { id: t.id, passed, status: "accepted" as const, runtimeMs: 1 };
        }),
      })),
    };
  }
}
