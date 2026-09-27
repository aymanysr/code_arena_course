import { ArenaEngine, type EngineOptions } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { testPrincipal, type AuthenticatedPrincipal } from "../src/principal.js";
import { ScriptedJudge, type ScriptPlan } from "./scripted-judge.js";

export const SOLVED_PY = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;

export const STARTER_PY = `def ledger_sum(nums):
    return 0
`;

/**
 * Pass pattern over even-ledger's 7 hidden tests (Basic×3, Neg×2, Bounds×2).
 * Attainable totals: 100, 85, 70, 60, 55, 45, 40, 30, 15, 13, 0.
 */
export function passes(s: string): ScriptPlan {
  if (!/^[01]{7}$/.test(s)) throw new Error(`pattern must be 7 bits, got ${s}`);
  return { passes: s.split("").map((c) => c === "1") };
}

export const P100: ScriptPlan = { score: 100 };
export const P85: ScriptPlan = passes("1111110");
export const P70: ScriptPlan = passes("1111100");
export const P60: ScriptPlan = passes("0001111");
export const P55: ScriptPlan = passes("1110010");
export const P45: ScriptPlan = passes("0001101");
export const P40: ScriptPlan = passes("1110000");
export const P30: ScriptPlan = passes("0000011");

/**
 * Flush pending microtask chains (store writes between dispatch and judge).
 * Async stores mean activity transitions land a few ticks after dispatch;
 * awaiting one macrotask makes mid-flight assertions deterministic.
 */
export const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export interface Fixture {
  engine: ArenaEngine;
  judge: ScriptedJudge;
  left: AuthenticatedPrincipal;
  right: AuthenticatedPrincipal;
  stranger: AuthenticatedPrincipal;
  matchId: string;
  advance: (ms: number) => void;
}

export async function setup(plan: ScriptPlan[] = [{ score: 100 }], options: Partial<EngineOptions> = {}): Promise<Fixture> {
  let now = 1_000_000;
  const judge = new ScriptedJudge(plan);
  const engine = new ArenaEngine({
    judge,
    bank: new FileBank(),
    clock: () => now,
    revealGraceMs: 0,
    ...options,
  });
  const left = testPrincipal("user-left");
  const right = testPrincipal("user-right");
  const stranger = testPrincipal("user-stranger");
  const matchId = await engine.createMatch({
    mode: "1v1",
    participants: [
      { userId: "user-left", sideId: "left" },
      { userId: "user-right", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
  });
  await engine.startRound(left, matchId);
  await engine.beginCoding(left, matchId);
  return { engine, judge, left, right, stranger, matchId, advance: (ms: number) => { now += ms; } };
}
