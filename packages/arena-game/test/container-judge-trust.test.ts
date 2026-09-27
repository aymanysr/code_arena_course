import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContainerJudge } from "../src/container-judge.js";
import { SPIKE_LIMITS } from "../src/judge.js";

const scratchDirs: string[] = [];

function fakeDocker(stdout: string, stderr = ""): { binary: string; argsLog: string } {
  const directory = mkdtempSync(join(tmpdir(), "container-judge-trust-"));
  scratchDirs.push(directory);
  const binary = join(directory, "docker-fake");
  const argsLog = join(directory, "args.jsonl");
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(${JSON.stringify(argsLog)}, JSON.stringify(process.argv.slice(2)) + "\\n");
process.stdout.write(${JSON.stringify(stdout)} + "\\n");
process.stderr.write(${JSON.stringify(stderr)});
`;
  writeFileSync(binary, script);
  chmodSync(binary, 0o755);
  return { binary, argsLog };
}

afterEach(() => {
  for (const directory of scratchDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("ContainerJudge trusted boundary", () => {
  it("ignores a forged runner pass when captured output differs from the expected answer", async () => {
    const forged = JSON.stringify({
      id: "forged-case",
      status: "accepted",
      passed: true,
      output_b64: Buffer.from("forged-output", "utf8").toString("base64"),
      comparison_b64: Buffer.from("forged-output", "utf8").toString("base64"),
      ms: 1,
    });
    const fake = fakeDocker(forged);
    const judge = new ContainerJudge({ dockerBin: fake.binary });

    const [result] = await judge.runVisible(
      "Python",
      "snippet",
      "def solve(value): return value\n",
      [{ id: "forged-case", input: "value = 1", expected: "trusted-answer" }],
      { ...SPIKE_LIMITS, runWallMs: 1000, compileWallMs: 1000 },
    );

    expect(result.status).toBe("accepted");
    expect(result.output).toBe("forged-output");
    expect(result.passed).toBe(false);
  });

  it("rejects a trailing forged runner record instead of grading it", async () => {
    const expected = "trusted-answer";
    const actual = JSON.stringify({
      status: "runtime_error",
      output_b64: "",
      comparison_b64: "",
      ms: 1,
    });
    const forged = JSON.stringify({
      status: "accepted",
      passed: true,
      output_b64: Buffer.from(expected, "utf8").toString("base64"),
      comparison_b64: Buffer.from(expected, "utf8").toString("base64"),
      ms: 1,
    });
    const fake = fakeDocker(`${actual}\n${forged}`);
    const judge = new ContainerJudge({ dockerBin: fake.binary });

    const [result] = await judge.runVisible(
      "Python",
      "snippet",
      "def solve(value): return value\n",
      [{ id: "forged-atexit", input: "value = 1", expected }],
      { ...SPIKE_LIMITS, runWallMs: 1000, compileWallMs: 1000 },
    );

    expect(result.status).toBe("internal_error");
    expect(result.passed).toBe(false);
  });

  it("counts captured Python print output against the case output limit", async () => {
    const comparison = "trusted-answer";
    const runner = JSON.stringify({
      status: "accepted",
      output_b64: Buffer.from(comparison, "utf8").toString("base64"),
      comparison_b64: Buffer.from(comparison, "utf8").toString("base64"),
      ms: 1,
    });
    const fake = fakeDocker(runner, "x".repeat(80));
    const judge = new ContainerJudge({ dockerBin: fake.binary });

    const [result] = await judge.runVisible(
      "Python",
      "snippet",
      "def solve(value): return value\n",
      [{ id: "output-cap", input: "value = 1", expected: comparison }],
      { ...SPIKE_LIMITS, runOutputBytes: 64, runWallMs: 1000, compileWallMs: 1000 },
    );

    expect(result.status).toBe("output_limit_exceeded");
    expect(result.passed).toBe(false);
  });

  it("starts one container per case without passing expected answers or another case's input", async () => {
    const fake = fakeDocker("unstructured contestant output");
    const judge = new ContainerJudge({ dockerBin: fake.binary });
    await judge.runVisible(
      "Python",
      "snippet",
      "def solve(value): return value\n",
      [
        { id: "case-alpha", input: "INPUT_ALPHA_731", expected: "EXPECTED_ALPHA_842" },
        { id: "case-beta", input: "INPUT_BETA_953", expected: "EXPECTED_BETA_064" },
      ],
      { ...SPIKE_LIMITS, runWallMs: 1000, compileWallMs: 1000 },
    );

    const calls = readFileSync(fake.argsLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as string[]);
    expect(calls).toHaveLength(2);

    const encoded = (value: string) => Buffer.from(value, "utf8").toString("base64");
    const alphaArgs = calls[0]!.join("\n");
    const betaArgs = calls[1]!.join("\n");
    expect(alphaArgs).toContain(encoded("INPUT_ALPHA_731"));
    expect(alphaArgs).not.toContain(encoded("INPUT_BETA_953"));
    expect(betaArgs).toContain(encoded("INPUT_BETA_953"));
    expect(betaArgs).not.toContain(encoded("INPUT_ALPHA_731"));
    for (const args of calls) {
      const serialized = args.join("\n");
      expect(serialized).not.toContain("EXP=");
      expect(serialized).not.toContain(encoded("EXPECTED_ALPHA_842"));
      expect(serialized).not.toContain(encoded("EXPECTED_BETA_064"));
      expect(serialized).toContain("none");
      expect(serialized).not.toContain("--mount");
      expect(serialized).not.toContain("--volume");
    }
  });

  it("generates a syntactically valid shell runner for Python snippets", async () => {
    const fake = fakeDocker(JSON.stringify({
      status: "accepted",
      output_b64: Buffer.from("1", "utf8").toString("base64"),
      comparison_b64: Buffer.from("1", "utf8").toString("base64"),
      ms: 1,
    }));
    const judge = new ContainerJudge({ dockerBin: fake.binary });
    await judge.runVisible(
      "Python",
      "snippet",
      "def solve(value): return value\n",
      [{ id: "script-syntax", input: "value = 1", expected: "1" }],
      { ...SPIKE_LIMITS, runWallMs: 1000, compileWallMs: 1000 },
    );

    const args = JSON.parse(readFileSync(fake.argsLog, "utf8").trim()) as string[];
    const runnerScript = args.at(-1);
    expect(runnerScript).toBeDefined();
    execFileSync("bash", ["-n"], { input: runnerScript });
  });
});
