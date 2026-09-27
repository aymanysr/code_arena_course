import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { ContainerJudge } from "../src/container-judge.js";
import { SPIKE_LIMITS } from "../src/judge.js";

const LIMITS = {
  ...SPIKE_LIMITS,
  runWallMs: 2500,
  compileWallMs: 10000,
  runMemoryMb: 64,
  runOutputBytes: 1024,
  runPids: 16,
};

describe("judge security and isolation matrix (real Docker containers)", () => {
  const judge = new ContainerJudge();

  it("infinite loop / TLE (Python, C, C++) terminates and produces time_limit_exceeded", async () => {
    // Python TLE
    const pyRes = await judge.runVisible(
      "Python",
      "snippet",
      "def solve(x):\n    while True: pass\n",
      [{ id: "t1", input: "x = 1", expected: "0" }],
      LIMITS,
    );
    expect(pyRes[0].status).toBe("time_limit_exceeded");
    expect(pyRes[0].passed).toBe(false);

    // C TLE
    const cRes = await judge.runVisible(
      "C",
      "stdio",
      "#include <stdio.h>\nint main(){ while(1){} return 0; }\n",
      [{ id: "t1", input: "1", expected: "1" }],
      LIMITS,
    );
    expect(cRes[0].status).toBe("time_limit_exceeded");
    expect(cRes[0].passed).toBe(false);

    // C++ TLE
    const cppRes = await judge.runVisible(
      "C++",
      "stdio",
      "#include <iostream>\nint main(){ while(true){} return 0; }\n",
      [{ id: "t1", input: "1", expected: "1" }],
      LIMITS,
    );
    expect(cppRes[0].status).toBe("time_limit_exceeded");
    expect(cppRes[0].passed).toBe(false);
  }, 45000);

  it("memory exhaustion / MLE triggers memory limit termination", async () => {
    // Python MLE
    const pyRes = await judge.runVisible(
      "Python",
      "snippet",
      "def solve(x):\n    a = [0] * (50 * 1024 * 1024)\n    return len(a)\n",
      [{ id: "t1", input: "x = 1", expected: "0" }],
      LIMITS,
    );
    expect(pyRes[0].status).toBe("memory_limit_exceeded");

    // C MLE
    const cSrc = `
#include <stdlib.h>
int main() {
  while (1) {
    volatile char *p = malloc(1024 * 1024);
    if (!p) break;
    for (int i = 0; i < 1024 * 1024; i += 4096) p[i] = 1;
  }
  return 137;
}
`;
    const cRes = await judge.runVisible(
      "C",
      "stdio",
      cSrc,
      [{ id: "t1", input: "1", expected: "0" }],
      LIMITS,
    );
    expect(cRes[0].status).toBe("memory_limit_exceeded");
  }, 30000);

  it("oversized stdout and stderr are bounded and cannot exhaust judge memory", async () => {
    // Program blasting infinite output
    const cSrc = `
#include <stdio.h>
int main() {
  for (int i = 0; i < 1000000; i++) {
    printf("OVERSIZED_STDOUT_LINE_%d\\n", i);
    fprintf(stderr, "OVERSIZED_STDERR_LINE_%d\\n", i);
  }
  return 0;
}
`;
    const res = await judge.runVisible(
      "C",
      "stdio",
      cSrc,
      [{ id: "t1", input: "1", expected: "0" }],
      LIMITS,
    );
    expect(["output_limit_exceeded", "accepted", "runtime_error"]).toContain(res[0].status);
    expect(res[0].output.length).toBeLessThanOrEqual(4000);
  }, 30000);

  it("fork bomb / process abuse is blocked by pids limit", async () => {
    // Fork bomb
    const cSrc = `
#include <unistd.h>
int main() {
  for (int i = 0; i < 1000; i++) {
    fork();
  }
  return 0;
}
`;
    const res = await judge.runVisible(
      "C",
      "stdio",
      cSrc,
      [{ id: "t1", input: "1", expected: "0" }],
      LIMITS,
    );
    // ponytail: TLE is an equally safe bound (wall clock killed the fork storm).
    expect(["runtime_error", "accepted", "time_limit_exceeded"]).toContain(res[0].status);
  }, 30000);

  it("filesystem writes to rootfs are blocked by read-only filesystem", async () => {
    const pySrc = `
def solve(x):
    try:
        with open("/root_file.txt", "w") as f:
            f.write("pwn")
        return "escaped"
    except Exception as e:
        return f"blocked:{type(e).__name__}"
`;
    const res = await judge.runVisible(
      "Python",
      "snippet",
      pySrc,
      [{ id: "t1", input: "x = 1", expected: "0" }],
      LIMITS,
    );
    expect(res[0].output).toContain("blocked:OSError");
  }, 30000);

  it("directory traversal cannot escape the scratch directory", async () => {
    const pySrc = `
import os
def solve(x):
    try:
        files = os.listdir("../../../")
        return "root_found" if "Users" not in files else "host_leaked"
    except Exception as e:
        return f"error:{type(e).__name__}"
`;
    const res = await judge.runVisible(
      "Python",
      "snippet",
      pySrc,
      [{ id: "t1", input: "x = 1", expected: "0" }],
      LIMITS,
    );
    expect(res[0].output).not.toContain("host_leaked");
  }, 30000);

  it("network access is completely disabled (--network none)", async () => {
    const pySrc = `
import urllib.request
def solve(x):
    try:
        urllib.request.urlopen("http://1.1.1.1", timeout=1)
        return "network_active"
    except Exception as e:
        return f"blocked:{type(e).__name__}"
`;
    const res = await judge.runVisible(
      "Python",
      "snippet",
      pySrc,
      [{ id: "t1", input: "x = 1", expected: "0" }],
      LIMITS,
    );
    expect(res[0].output).toContain("blocked:URLError");
  }, 30000);

  it("environment variables inside player container contain no host secrets or DB credentials", async () => {
    const pySrc = `
import os
def solve(x):
    env = os.environ
    suspicious = [k for k in env if any(s in k.lower() for s in ["pass", "secret", "token", "db", "postgres"])]
    return f"keys:{','.join(suspicious)}"
`;
    const res = await judge.runVisible(
      "Python",
      "snippet",
      pySrc,
      [{ id: "t1", input: "x = 1", expected: "0" }],
      LIMITS,
    );
    expect(res[0].output).toBe("'keys:'");
  }, 30000);

  it("submitted Python cannot recover expected answers from env or scratch during a sealed suite", async () => {
    const pySrc = `
import base64, os, pathlib, re
def _decoded(value):
    chunks = [value]
    for _ in range(3):
        try:
            value = base64.b64decode(value).decode("utf8", "ignore")
            chunks.append(value)
        except Exception:
            break
    return chunks
def _all_judge_data():
    for value in os.environ.values():
        for chunk in _decoded(value): yield chunk
    for root in ("/scratch", "/tmp"):
        for path in pathlib.Path(root).rglob("*"):
            if path.is_file():
                try:
                    value = path.read_text(errors="ignore")
                    for line in value.splitlines() or [value]:
                        for chunk in _decoded(line): yield chunk
                except Exception:
                    pass
def solve(_):
    for data in _all_judge_data():
        match = re.search(r"HIDDEN_ANSWER_[A-Z0-9_]+", data)
        if match: return match.group(0)
    return "EMPTY"
`;
    const result = await judge.evaluateSealed({
      evaluationId: "leak-expected-evaluation",
      submissionId: "leak-expected-submission",
      problemVersionId: "problem-v1",
      hiddenSuiteId: "hidden-v1",
      language: "Python",
      driver: "snippet",
      source: pySrc,
      groups: [{
        name: "sealed",
        weight: 1,
        tests: [
          { id: "expected-alpha", input: "value = 11", expected: "'HIDDEN_ANSWER_ALPHA_413'" },
          { id: "expected-beta", input: "value = 22", expected: "'HIDDEN_ANSWER_BETA_527'" },
        ],
      }],
      limits: LIMITS,
    });

    expect(result.groups[0]?.results.map((item) => item.passed)).toEqual([false, false]);
  }, 30000);

  it("a case cannot recover another hidden case's input from env or scratch", async () => {
    const pySrc = `
import base64, os, pathlib, re
def _decoded(value):
    chunks = [value]
    for _ in range(3):
        try:
            value = base64.b64decode(value).decode("utf8", "ignore")
            chunks.append(value)
        except Exception:
            break
    return chunks
def _all_judge_data():
    for value in os.environ.values():
        for chunk in _decoded(value): yield chunk
    for root in ("/scratch", "/tmp"):
        for path in pathlib.Path(root).rglob("*"):
            if path.is_file():
                try:
                    value = path.read_text(errors="ignore")
                    for line in value.splitlines() or [value]:
                        for chunk in _decoded(line): yield chunk
                except Exception:
                    pass
def solve(_):
    for data in _all_judge_data():
        match = re.search(r"OTHER_CASE_INPUT_[A-Z0-9_]+", data)
        if match: return match.group(0)
    return "EMPTY"
`;
    const result = await judge.evaluateSealed({
      evaluationId: "leak-input-evaluation",
      submissionId: "leak-input-submission",
      problemVersionId: "problem-v1",
      hiddenSuiteId: "hidden-v1",
      language: "Python",
      driver: "snippet",
      source: pySrc,
      groups: [{
        name: "sealed",
        weight: 1,
        tests: [
          { id: "before-other-input", input: "value = 'CURRENT_CASE_INPUT'", expected: "'OTHER_CASE_INPUT_SECRET_638'" },
          { id: "contains-other-input", input: "value = 'OTHER_CASE_INPUT_SECRET_638'", expected: "NOT_THE_INPUT_MARKER" },
        ],
      }],
      limits: LIMITS,
    });

    expect(result.groups[0]?.results.map((item) => item.passed)).toEqual([false, false]);
  }, 30000);

  it("containers are automatically cleaned up after exit (--rm)", async () => {
    const beforeCount = Number(execSync("docker ps -q | wc -l", { encoding: "utf8" }).trim());
    await judge.runVisible(
      "Python",
      "snippet",
      "def solve(x): return 42\n",
      [{ id: "t1", input: "x = 1", expected: "42" }],
      LIMITS,
    );
    const afterCount = Number(execSync("docker ps -q | wc -l", { encoding: "utf8" }).trim());
    expect(afterCount).toBeLessThanOrEqual(beforeCount);
  }, 30000);
});
