import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as api from "../assets/build-workspaces.mjs";
import { foundationFixture } from "./fixtures/build-course.mjs";
function fixture() {
  const f = foundationFixture(),
    lesson = f.lessons[0],
    step = lesson.steps[4];
  step.files[0].workspace = "active";
  lesson.checks[0] = {
    ...lesson.checks[0],
    kind: "unit",
    cwd: ".",
    command: "npm test",
  };
  return { lesson, step };
}
function resolve(...args) {
  assert.equal(
    typeof api.resolveBuildStep,
    "function",
    "workspace resolver exists"
  );
  return api.resolveBuildStep(...args);
}
test("missing team mapping does not show practice commands", () => {
  const { lesson, step } = fixture();
  const r = resolve(step, lesson, {
    id: "team",
    kind: "team",
    root: "/tmp/team",
    mappings: [],
  });
  assert.deepEqual(r.checks, []);
  assert.ok(r.blockedBy.some((x) => x.includes("rule")));
});
test("unselected practice root requires a folder first", () => {
  const { lesson, step } = fixture();
  const r = resolve(step, lesson, {
    id: "practice",
    kind: "practice",
    root: null,
    mappings: [],
  });
  assert.deepEqual(r.checks, []);
  assert.ok(r.blockedBy.length);
});
test("selected practice uses authored paths and cwd", () => {
  const { lesson, step } = fixture();
  const r = resolve(step, lesson, {
    id: "practice",
    kind: "practice",
    root: "/tmp/my practice",
    mappings: [],
  });
  assert.equal(r.files[0].path, "src/rule.ts");
  assert.equal(r.checks[0].command, "npm test");
  assert.deepEqual(r.blockedBy, []);
});
const mapping = {
  role: "rule",
  referencePath: "src/rule.ts",
  practicePath: "src/rule.ts",
  targetPath: "game/policy.ts",
  action: "reuse",
  reason: "This rule already exists",
  dependency: null,
  checks: [
    {
      checkId: "m00-start-check",
      command: "npm run test:game",
      cwd: "app",
      verification: "unverified",
    },
  ],
};
test("team guidance reuses the mapped owner and command", () => {
  const { lesson, step } = fixture();
  const r = resolve(step, lesson, {
    id: "team",
    kind: "team",
    root: "/tmp/team",
    mappings: [mapping],
  });
  assert.equal(r.files[0].path, "game/policy.ts");
  assert.equal(r.files[0].action, "read");
  assert.equal(r.checks[0].command, "npm run test:game");
  assert.equal(r.checks[0].cwd, "app");
});
test("a mapped team check stays visible when a sibling file is not mapped", () => {
  const { lesson, step } = fixture();
  const missing = {
    ...step.files[0],
    role: "test.http",
    path: "test/server.ts",
  };
  const r = resolve({ ...step, files: [...step.files, missing] }, lesson, {
    id: "team",
    kind: "team",
    root: "/tmp/team",
    mappings: [mapping],
  });
  assert.equal(r.checks[0].command, "npm run test:game");
  assert.ok(
    r.blockedBy.some((x) => x.includes("test.http for test/server.ts"))
  );
});
for (const [name, mutate] of [
  ["escape", (m) => (m.targetPath = "../secret")],
  ["absolute", (m) => (m.targetPath = "/secret")],
  ["empty command", (m) => (m.checks[0].command = "")],
  ["outside cwd", (m) => (m.checks[0].cwd = "../other")],
])
  test(`mapping rejects ${name}`, () => {
    const m = structuredClone(mapping);
    mutate(m);
    assert.throws(() =>
      api.validateWorkspaceProfile({
        id: "team",
        kind: "team",
        root: "/tmp/team",
        mappings: [m],
      })
    );
  });
test("one responsibility maps distinct practice files to distinct target paths", () => {
  const { lesson, step } = fixture();
  const another = structuredClone(step.files[0]);
  another.path = "src/rules.ts";
  const profile = {
    id: "team",
    kind: "team",
    root: "/tmp/team",
    mappings: [
      mapping,
      {
        ...mapping,
        practicePath: "src/rules.ts",
        referencePath: "src/rules.ts",
        targetPath: "game/rules.ts",
        checks: [],
      },
    ],
  };
  const r = resolve(
    { ...step, files: [...step.files, another] },
    lesson,
    profile
  );
  assert.deepEqual(
    r.files.map((f) => f.path),
    ["game/policy.ts", "game/rules.ts"]
  );
});
test("duplicate responsibility and practice-file pair is rejected", () =>
  assert.throws(
    () =>
      api.validateWorkspaceProfile({
        id: "team",
        kind: "team",
        root: null,
        mappings: [mapping, mapping],
      }),
    /duplicate/
  ));
test("mapping can state that no one-to-one reference path is linked", () => {
  const candidate = { ...mapping, referencePath: null };
  assert.equal(
    api.validateWorkspaceProfile({
      id: "team",
      kind: "team",
      root: null,
      mappings: [candidate],
    }).mappings[0].referencePath,
    null
  );
});
test("shell quoting preserves spaces and apostrophes without interpolation", () => {
  assert.equal(typeof api.quoteShellPath, "function");
  const value = "/tmp/learner's $(not-a-command) folder";
  const result = execFileSync(
    "/bin/sh",
    ["-c", `printf '%s' ${api.quoteShellPath(value)}`],
    { encoding: "utf8" }
  );
  assert.equal(result, value);
});
