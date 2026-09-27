import { describe, expect, it } from "vitest";
import { ContainerJudge } from "../src/container-judge.js";
import { JudgeInfraError, SPIKE_LIMITS } from "../src/judge.js";

const LIMITS = { ...SPIKE_LIMITS, runWallMs: 4000, compileWallMs: 15000 };
const SOLVED_PY = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;
const STARTER_PY = `def ledger_sum(nums):
    return 0
`;

describe("container judge (real isolated execution)", () => {
  it("python snippet: solved passes, starter fails, both accepted", async () => {
    const judge = new ContainerJudge();
    const ok = await judge.runVisible("Python", "snippet", SOLVED_PY, [{ id: "ex1", input: "nums = [1,2,3,4]", expected: "-2" }], LIMITS);
    expect(ok[0].passed).toBe(true);
    expect(ok[0].status).toBe("accepted");
    const bad = await judge.runVisible("Python", "snippet", STARTER_PY, [{ id: "ex1", input: "nums = [1,2,3,4]", expected: "-2" }], LIMITS);
    expect(bad[0].passed).toBe(false);
    expect(bad[0].status).toBe("accepted");
  });

  it("python malformed maps to compile_error without hanging", async () => {
    const judge = new ContainerJudge();
    const res = await judge.runVisible("Python", "snippet", "def broken(:\n", [{ id: "ex1", input: "nums = []", expected: "0" }], LIMITS);
    expect(res[0].status).toBe("compile_error");
    expect(res[0].passed).toBe(false);
  });

  it("python infinite loop maps to time_limit_exceeded", async () => {
    const judge = new ContainerJudge();
    const res = await judge.runVisible("Python", "snippet", "while True:\n    pass\n", [{ id: "ex1", input: "nums = []", expected: "0" }], LIMITS);
    expect(res[0].status).toBe("time_limit_exceeded");
  }, 30000);

  it("Python atexit output cannot forge an accepted result or bypass the output limit", async () => {
    const source = [
      "import atexit, base64, json, os",
      "def forge_runner_record():",
      "    record = {",
      "        'status': 'accepted',",
      "        'passed': True,",
      "        'output_b64': base64.b64encode(b'forged').decode(),",
      "        'comparison_b64': base64.b64encode(b'42').decode(),",
      "        'ms': 1,",
      "    }",
      "    os.write(1, (json.dumps(record) + '\\n').encode())",
      "atexit.register(forge_runner_record)",
      "def solve(value):",
      "    print('x' * 2048)",
      "    return value",
      "",
    ].join("\n");
    const judge = new ContainerJudge();
    const res = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "forged-atexit", input: "value = 42", expected: "42" }],
      { ...LIMITS, runOutputBytes: 64 },
    );

    expect(res[0].status).toBe("output_limit_exceeded");
    expect(res[0].passed).toBe(false);
  }, 30000);

  it("c++ stdio program compiles and runs isolated", async () => {
    const judge = new ContainerJudge();
    const src = `#include <cstdio>\nint main(){int x; if(std::scanf("%d",&x)==1) std::printf("%d\\n", x*2); return 0;}\n`;
    const res = await judge.runVisible("C++", "stdio", src, [{ id: "t1", input: "21", expected: "42" }], LIMITS);
    expect(res[0].status).toBe("accepted");
    expect(res[0].passed).toBe(true);
  });

  it("c stdio echo doubles input", async () => {
    const judge = new ContainerJudge();
    const src = `#include <stdio.h>\nint main(){int x; if(scanf("%d",&x)==1) printf("%d\\n", x*2); return 0;}\n`;
    const res = await judge.runVisible("C", "stdio", src, [{ id: "t1", input: "21", expected: "42" }], LIMITS);
    expect(res[0].status).toBe("accepted");
    expect(res[0].passed).toBe(true);
  });

  it("c++ compile error maps to compile_error", async () => {
    const judge = new ContainerJudge();
    const res = await judge.runVisible("C++", "stdio", "int main( { return 0; }\n", [{ id: "t1", input: "", expected: "" }], LIMITS);
    expect(res[0].status).toBe("compile_error");
  });

  it("missing docker binary raises JudgeInfraError, never synthesized verdicts", async () => {
    // ponytail: guards the compose case (no docker in the game image) — a
    // launch failure must surface as infra failure, not fake graded tests.
    const judge = new ContainerJudge({ dockerBin: "/nonexistent/docker-bin-ponytail" });
    await expect(
      judge.runVisible("Python", "snippet", SOLVED_PY, [{ id: "ex1", input: "nums = []", expected: "0" }], LIMITS),
    ).rejects.toThrow(JudgeInfraError);
  });
});
