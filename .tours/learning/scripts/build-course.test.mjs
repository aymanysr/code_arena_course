import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderCatalogOutputs } from "./build-catalog.mjs";
import { foundationFixture } from "./fixtures/build-course.mjs";
import { validateBuildPath } from "./build-path.mjs";
const repoRoot = process.cwd(),
  learningDir = path.join(repoRoot, ".tours/learning");
let api = {};
try {
  api = await import("./build-course.mjs");
} catch {}
test("guided entry preserves reference pages, orientation, and authored M13 lessons", async () => {
  const coverage = JSON.parse(
    await readFile(path.join(learningDir, "coverage-map.json"), "utf8")
  );
  const { files } = await renderCatalogOutputs(
    repoRoot,
    learningDir,
    coverage,
    { tours: [] }
  );
  for (const l of coverage.lessons)
    assert.ok(files.has(path.join(learningDir, l.output)));
  const home = files.get(path.join(learningDir, "index.html"));
  assert.match(home, /data-build-continue/);
  assert.ok(files.has(path.join(learningDir, "reference.html")));
  assert.ok(files.has(path.join(learningDir, "build/m00-destination.html")));
  const reference = files.get(path.join(learningDir, "reference.html"));
  assert.equal((reference.match(/data-build-step=/g) || []).length, 8);
  const destination = files.get(
    path.join(learningDir, "build/m00-destination.html")
  );
  assert.ok(destination.includes('href="../reference.html#build-path"'));
  const orientation = files.get(
    path.join(learningDir, "lessons/0000-before-lesson-one.html")
  );
  assert.ok(orientation.includes('href="../reference.html#build-path"'));
  assert.match(home, /href="build\/m13-parity\.html"/);
  assert.doesNotMatch(home, /Being written/);
});
test("embedded lesson data cannot end its JSON script", async () => {
  assert.equal(typeof api.renderBuildOutputs, "function");
  const f = foundationFixture();
  f.lessons[0].steps[0].explanation = ["</script><img src=x onerror=alert(1)>"];
  const course = validateBuildPath(f.raw, f.lessons, f.referenceData);
  const files = await api.renderBuildOutputs({
    learningDir,
    referenceData: f.referenceData,
    course,
    runtimeSource: "",
  });
  const page = files.get(path.join(learningDir, "build/m00-start.html"));
  assert.doesNotMatch(page, /<img src=x/);
  assert.match(page, /\\u003c\/script/);
  assert.match(page, /href="\.\.\/source-map.html/);
});

test("completed guided route does not claim lessons are still being written", async () => {
  const coverage = JSON.parse(
    await readFile(path.join(learningDir, "coverage-map.json"), "utf8")
  );
  const { files } = await renderCatalogOutputs(
    repoRoot,
    learningDir,
    coverage,
    { tours: [] }
  );
  const home = files.get(path.join(learningDir, "index.html"));
  assert.ok(
    home.includes("68 of 68 lessons are available"),
    "home should report all 68 lessons"
  );
  assert.ok(
    home.includes("all lessons are ready to explore"),
    "home should not say future lessons are still being written"
  );
  assert.ok(
    !/later lessons are still being written/i.test(home),
    "completed home should not claim lessons are unfinished"
  );
  const final = files.get(path.join(learningDir, "build/m13-handover.html"));
  assert.ok(
    /end of the guided route/i.test(final),
    "last lesson should identify the end of the route"
  );
  assert.ok(
    !/next lesson is being written/i.test(final),
    "last lesson should not claim another lesson is in progress"
  );
});

test("guided steps explain their controls and open the exact cited code beside the lesson", async () => {
  const f = foundationFixture();
  const course = validateBuildPath(f.raw, f.lessons, f.referenceData);
  const files = await api.renderBuildOutputs({
    learningDir,
    referenceData: f.referenceData,
    course,
    runtimeSource: "",
  });
  const page = files.get(path.join(learningDir, "build/m00-start.html"));
  assert.match(page, /Reference walkthroughs/);
  assert.match(page, /Browse all code/);
  assert.match(page, /aria-label="Coding destination"/);
  assert.match(page, /What is Practice or Team\?/);
  assert.match(page, /Practice is a separate folder for your learning code/);
  assert.match(page, /summary>Need a hint\?/);
  assert.match(
    page,
    /Open Hint 1 and try again\. Open the next hint only if you still need help/
  );
  assert.match(page, /summary>Answer or notes for this step/);
  assert.match(page, /Your answer or question/);
  assert.match(
    page,
    /Click Save note to keep it in this browser. It is not graded or sent/
  );
  const buildStart = page.indexOf('<section data-build-step="m00-start-build"');
  const buildEnd = page.indexOf("</section>", buildStart);
  const buildStep = page.slice(buildStart, buildEnd);
  assert.match(
    buildStep,
    /href="\.\.\/source-map\.html\?file=src%2Frule\.ts&amp;line=1&amp;end=2"/
  );
  assert.match(buildStep, /target="_blank" rel="noopener"/);
  assert.match(
    buildStep,
    /Open reference code in src\/rule\.ts, lines 1 to 2, in a new tab/
  );
});

test("a read-only reference file stays directly reachable when it has no cited line span", async () => {
  const f = foundationFixture();
  f.lessons[0].references = [];
  const course = validateBuildPath(f.raw, f.lessons, f.referenceData);
  const files = await api.renderBuildOutputs({
    learningDir,
    referenceData: f.referenceData,
    course,
    runtimeSource: "",
  });
  const page = files.get(path.join(learningDir, "build/m00-start.html"));
  const buildStart = page.indexOf('<section data-build-step="m00-start-build"');
  const buildEnd = page.indexOf("</section>", buildStart);
  const buildStep = page.slice(buildStart, buildEnd);
  assert.match(buildStep, /href="\.\.\/source-map\.html\?file=src%2Frule\.ts"/);
  assert.match(buildStep, /Open this reference file in the code browser/);
});
