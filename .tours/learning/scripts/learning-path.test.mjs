import assert from "node:assert/strict";
import test from "node:test";
import { validateLearningPath } from "./learning-path.mjs";

const lessons = [{ id: "0001-submit-journey" }, { id: "0014-rewrite-with-tests" }];
const files = [{ path: "package.json" }, { path: "packages/arena-game/test/submit-path.test.ts" }];
const step = (id, order, requires = []) => ({
  id, order, title: "Find the rule", why: "A Match needs a Round.",
  requires, lessonIds: ["0001-submit-journey"],
  deliverable: "One Match rule", placement: "Use the existing game package.",
  pattern: "Pure rule with a fixed clock.",
  check: "A fixed-clock test passes.", sourcePath: "package.json",
  testPath: "packages/arena-game/test/submit-path.test.ts",
});
const path = () => ({
  version: 1,
  orientation: { output: "lessons/0000-before-lesson-one.html", title: "Before Lesson 1" },
  steps: [step("find-homes", 0), step("match-core", 1, ["find-homes"])],
});

test("accepts a dependency-ordered path", () => {
  assert.deepEqual(validateLearningPath(path(), lessons, files).steps.map((item) => item.id), ["find-homes", "match-core"]);
});

test("rejects duplicate, missing, cyclic, unknown-lesson, and unsafe path data", () => {
  const cases = [
    [() => { const data = path(); data.steps[1].id = "find-homes"; return data; }, /duplicate.*step/i],
    [() => { const data = path(); data.steps[1].requires = ["missing"]; return data; }, /unknown prerequisite.*missing/i],
    [() => { const data = path(); data.steps[0].requires = ["match-core"]; return data; }, /cycle/i],
    [() => { const data = path(); data.steps[0].lessonIds = ["removed"]; return data; }, /unknown lesson.*removed/i],
    [() => { const data = path(); data.steps[0].sourcePath = "../secret"; return data; }, /unsafe.*path/i],
    [() => { const data = path(); data.steps[0].sourcePath = "missing.ts"; return data; }, /unknown source.*missing.ts/i],
  ];
  for (const [makeInput, message] of cases) {
    assert.throws(() => validateLearningPath(makeInput(), lessons, files), message);
  }
});

test("requires every prerequisite to appear before the step that depends on it", () => {
  const data = path();
  data.steps[0].requires = ["match-core"];
  data.steps[1].requires = [];
  assert.throws(() => validateLearningPath(data, lessons, files), /prerequisite.*order/i);
});
