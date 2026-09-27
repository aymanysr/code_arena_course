import { describe, expect, it } from "vitest";
import { ContainerJudge } from "../src/container-judge.js";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { SPIKE_LIMITS } from "../src/judge.js";
import { testPrincipal } from "../src/principal.js";

const LIMITS = { ...SPIKE_LIMITS, runWallMs: 8000, compileWallMs: 60000 };

const C_SOLVE = [
  "#include <stdio.h>",
  "int main(void){long long x; if(scanf(\"%lld\",&x)!=1) return 1; printf(\"%lld\\n\", x*2); return 0;}",
  "",
].join("\n");

const CPP_SOLVE = [
  "#include <cstdio>",
  "int main(){long long x; if(!(std::scanf(\"%lld\",&x))) return 1; std::printf(\"%lld\\n\", x*2); return 0;}",
  "",
].join("\n");

const PY_SOLVE = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;

async function realEngine(problemVersionIds: string[]): Promise<{ engine: ArenaEngine; matchId: string }> {
  const engine = new ArenaEngine({
    judge: new ContainerJudge(),
    bank: new FileBank(),
    clock: () => 1_000_000,
    revealGraceMs: 0,
    limits: LIMITS,
  });
  const left = testPrincipal("user-left");
  const matchId = await engine.createMatch({
    mode: "1v1",
    participants: [
      { userId: "user-left", sideId: "left" },
      { userId: "user-right", sideId: "right" },
    ],
    problemVersionIds,
  });
  await engine.startRound(left, matchId);
  await engine.beginCoding(left, matchId);
  return { engine, matchId };
}

describe("real compiled bank execution (double-it, isolated containers)", () => {
  it("C solution scores 100 end-to-end", async () => {
    const { engine, matchId } = await realEngine(["double-it"]);
    const left = testPrincipal("user-left");
    await engine.submit(left, matchId, { code: C_SOLVE, language: "C" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);

  it("C++ solution scores 100 end-to-end", async () => {
    const { engine, matchId } = await realEngine(["double-it"]);
    const left = testPrincipal("user-left");
    await engine.submit(left, matchId, { code: CPP_SOLVE, language: "C++" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);

  it("C starter scores 25, not 100 (only the zero case passes its 50-weight group half)", async () => {
    const { engine, matchId } = await realEngine(["double-it"]);
    const left = testPrincipal("user-left");
    const starter = new FileBank().loadProblem("double-it").starters.C!;
    await engine.submit(left, matchId, { code: starter, language: "C" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(25);
  }, 120000);

  it("Python bank solution scores 100 via snippet entrypoint", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const left = testPrincipal("user-left");
    await engine.submit(left, matchId, { code: PY_SOLVE, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);
});
