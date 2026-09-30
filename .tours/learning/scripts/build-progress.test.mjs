import test from "node:test";
import assert from "node:assert/strict";
import { foundationFixture } from "./fixtures/build-course.mjs";
import { validateBuildPath } from "./build-path.mjs";
let api = {};
try {
  api = await import("../assets/build-progress.mjs");
} catch {}
function setup() {
  assert.equal(typeof api.emptyProgress, "function", "progress API exists");
  const f = foundationFixture();
  const course = validateBuildPath(f.raw, f.lessons, f.referenceData);
  return { course, state: api.emptyProgress(course) };
}
const report = {
  status: "passed",
  source: "learner-report",
  note: "Explained it",
  reportedAt: "2026-09-28T12:00:00.000Z",
  courseRevision: "course-1",
  sourceSnapshotId: "snapshot-1",
  needsReview: false,
};
test("viewing and trying never record a passed check", () => {
  let { course, state } = setup();
  state = api.reduceProgress(
    state,
    { type: "visit", stepId: "m00-start-build" },
    course
  );
  state = api.reduceProgress(
    state,
    { type: "attempt", stepId: "m00-start-build" },
    course
  );
  assert.equal(state.workspaces.practice.position, "m00-start-build");
  assert.equal(state.workspaces.practice.attempts["m00-start-build"], 1);
  assert.deepEqual(state.workspaces.practice.reports, {});
});
test("practice result stays separate when a team profile is selected", () => {
  let { course, state } = setup();
  state = api.reduceProgress(
    state,
    { type: "report", checkId: "m00-start-check", report },
    course
  );
  state = api.reduceProgress(
    state,
    {
      type: "profile",
      profile: { id: "team-a", kind: "team", root: "/tmp/team", mappings: [] },
    },
    course
  );
  state = api.reduceProgress(
    state,
    { type: "workspace", id: "team-a" },
    course
  );
  assert.deepEqual(state.workspaces["team-a"].reports, {});
  assert.equal(
    state.workspaces.practice.reports["m00-start-check"].status,
    "passed"
  );
});

test("workspace export keeps exact team paths and unverified command details separate", () => {
  let { course, state } = setup();
  const profile = {
    id: "team",
    kind: "team",
    root: "/tmp/team fixture",
    mappings: [
      {
        role: "rule",
        referencePath: null,
        practicePath: "src/rule.ts",
        targetPath: "packages/match/src/policy.ts",
        action: "reuse",
        reason: "Confirmed existing Match policy",
        dependency: null,
        checks: [
          {
            checkId: "m00-start-check",
            command: "npm run policy:test",
            cwd: "apps/match",
            verification: "unverified",
          },
        ],
      },
    ],
  };
  state = api.reduceProgress(state, { type: "profile", profile }, course);
  state = api.reduceProgress(state, { type: "workspace", id: "team" }, course);
  const imported = api.importProgress(api.exportProgress(state), course);
  assert.equal(imported.activeWorkspace, "team");
  assert.equal(
    imported.profiles.find((p) => p.id === "team").root,
    "/tmp/team fixture"
  );
  assert.deepEqual(
    imported.profiles.find((p) => p.id === "team").mappings[0],
    profile.mappings[0]
  );
  assert.deepEqual(imported.workspaces.team.reports, {});
  assert.deepEqual(imported.workspaces.practice.reports, {});
});
test("import retains notes but marks every imported result for review", () => {
  let { course, state } = setup();
  state = api.reduceProgress(
    state,
    { type: "report", checkId: "m00-start-check", report },
    course
  );
  state = api.reduceProgress(
    state,
    {
      type: "note",
      stepId: "m00-start-build",
      text: "<img src=x onerror=alert(1)>",
    },
    course
  );
  const imported = api.importProgress(api.exportProgress(state), course);
  assert.equal(
    imported.workspaces.practice.notes["m00-start-build"],
    "<img src=x onerror=alert(1)>"
  );
  assert.equal(
    imported.workspaces.practice.reports["m00-start-check"].source,
    "import"
  );
  assert.equal(
    imported.workspaces.practice.reports["m00-start-check"].needsReview,
    true
  );
});
test("a changed course retains history and requests another check", () => {
  let { course, state } = setup();
  state = api.reduceProgress(
    state,
    { type: "report", checkId: "m00-start-check", report },
    course
  );
  course.path.revision = "course-2";
  const read = api.readProgress(
    { getItem: () => JSON.stringify(state) },
    course
  );
  assert.equal(
    read.state.workspaces.practice.reports["m00-start-check"].needsReview,
    true
  );
});
test("denied storage is a warning with usable in-session state", () => {
  const { course, state } = setup();
  assert.match(
    api.readProgress(
      {
        getItem() {
          throw Error("denied");
        },
      },
      course
    ).warning,
    /blocked/i
  );
  assert.equal(
    api.saveProgress(
      {
        setItem() {
          throw Error("quota");
        },
      },
      state
    ),
    "unavailable"
  );
});
test("window-name fallback carries progress across page mounts when browser storage is denied", () => {
  const { course, state } = setup();
  let name = "existing-window-name";
  const fallback = api.createWindowNameProgressStorage({
    get name() {
      return name;
    },
    set name(value) {
      name = value;
    },
  });
  const denied = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  state.profiles.find((profile) => profile.id === "practice").root =
    "/tmp/my practice";
  state.workspaces.practice.notes["m00-start-build"] =
    "saved before navigation";
  assert.equal(api.saveProgress(denied, state, fallback), "temporary");
  const nextPage = api.readProgress(denied, course, fallback);
  assert.match(nextPage.warning, /temporary copy/i);
  assert.equal(
    nextPage.state.workspaces.practice.notes["m00-start-build"],
    "saved before navigation"
  );
  assert.equal(
    nextPage.state.profiles.find((profile) => profile.id === "practice").root,
    "/tmp/my practice"
  );
  assert.match(name, /existing-window-name/);
});
test("corrupt storage is not overwritten or mistaken for success", () => {
  const { course } = setup();
  let writes = 0;
  const result = api.readProgress(
    { getItem: () => "{broken", setItem: () => writes++ },
    course
  );
  assert.match(result.warning, /corrupt/i);
  assert.equal(writes, 0);
  assert.deepEqual(result.state.workspaces.practice.reports, {});
});
for (const [name, mutate] of [
  ["version", (s) => (s.version = 9)],
  ["unknown step", (s) => (s.workspaces.practice.position = "removed")],
  [
    "invalid report",
    (s) =>
      (s.workspaces.practice.reports["m00-start-check"] = {
        ...report,
        status: "mastered",
      }),
  ],
  [
    "invalid date",
    (s) =>
      (s.workspaces.practice.reports["m00-start-check"] = {
        ...report,
        reportedAt: "bad",
      }),
  ],
  ["unknown check", (s) => (s.workspaces.practice.reports.removed = report)],
  [
    "negative attempts",
    (s) => (s.workspaces.practice.attempts["m00-start-build"] = -1),
  ],
])
  test(`import rejects ${name}`, () => {
    const { course, state } = setup();
    mutate(state);
    assert.throws(() => api.importProgress(JSON.stringify(state), course));
  });
test("rejects oversized and prototype keys", () => {
  const { course } = setup();
  assert.throws(() => api.importProgress(" ".repeat(1000001), course), /large/);
  assert.throws(() => api.importProgress('{"__proto__":{}}', course), /key/);
});
test("legacy activity key is not read or rewritten", () => {
  const { course } = setup();
  const keys = [];
  api.readProgress(
    {
      getItem: (key) => {
        keys.push(key);
        return null;
      },
    },
    course
  );
  assert.deepEqual(keys, ["code-arena-learning:build:v1"]);
});

test("temporary storage uses session storage first and window name only when both Storage writes fail", () => {
  const { course, state } = setup();
  let name = "other-app-name";
  const sessionData = new Map();
  const win = {
    get name() {
      return name;
    },
    set name(value) {
      name = value;
    },
    sessionStorage: {
      getItem: (key) => sessionData.get(key) ?? null,
      setItem: (key, value) => sessionData.set(key, value),
    },
  };
  const fallback = api.createTemporaryProgressStorage(win);
  assert.equal(
    api.saveProgress(
      {
        setItem() {
          throw Error("denied");
        },
      },
      state,
      fallback
    ),
    "temporary"
  );
  assert.equal(name, "other-app-name");
  assert.ok(sessionData.size);
  assert.equal(
    api.readProgress({ getItem: () => null }, course, fallback).state
      .activeWorkspace,
    "practice"
  );
  const denied = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  sessionData.clear();
  win.sessionStorage.setItem = () => {
    throw Error("denied");
  };
  state.workspaces.practice.notes["m00-start-build"] = "name fallback";
  api.saveProgress(denied, state, fallback);
  assert.match(name, /CODE_ARENA_BUILD_PROGRESS_V1/);
  assert.equal(
    api.readProgress(denied, course, fallback).state.workspaces.practice.notes[
      "m00-start-build"
    ],
    "name fallback"
  );
});
