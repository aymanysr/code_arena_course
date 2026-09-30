import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditCourseOrder, auditTemplateLinks, buildCatalogData, missingLessonReviews, renderCatalogTemplate, renderLessonTemplate } from "./build-catalog.mjs";

let renderCatalogOutputs;
let renderCourseHomeTemplate;
let acceptReviewedSnapshot;
let writeRenderedOutputs;
let formatAuditReport;
try {
  ({ renderCatalogOutputs, renderCourseHomeTemplate, acceptReviewedSnapshot, writeRenderedOutputs, formatAuditReport } = await import("./build-catalog.mjs"));
} catch {
  renderCatalogOutputs = null;
  renderCourseHomeTemplate = null;
  acceptReviewedSnapshot = null;
  writeRenderedOutputs = null;
  formatAuditReport = null;
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const DEFAULT_TEMPLATE = "templates/0001-submit-journey.template.html";

function lessonRecord({
  id = "0001-submit-journey",
  order = 1,
  title = "Trace a Submit",
  goal = "Follow one real Submit request through the game.",
  template = DEFAULT_TEMPLATE,
  output = `lessons/${id}.html`,
  references = [],
} = {}) {
  return { id, order, title, goal, template, output, references };
}

function makeCoverageMap({ version = 1, batches, roots = [], files = [], excluded = [], lessons = [], supportingFiles = [] } = {}) {
  return {
    version,
    ...(batches === undefined ? {} : { batches }),
    scope: {
      roots: roots.map((item) => typeof item === "string" ? { path: item, area: item } : item),
      files,
      excluded,
    },
    lessons,
    supportingFiles,
  };
}

async function writeActivityRuntimeFixture(learningDir) {
  await writeFile(
    path.join(learningDir, "assets/course-activity.mjs"),
    await readFile(new URL("../assets/course-activity.mjs", import.meta.url), "utf8"),
  );
}

function makeReferenceSnapshot(files, {
  recordedAt = "2026-09-26T12:00:00.000Z",
  gitHead = "d".repeat(40),
} = {}) {
  const orderedFiles = [...files].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const snapshotId = sha256(orderedFiles.map(([filePath, digest]) => `${filePath}\0${digest}`).join("\n")).slice(0, 16);
  return {
    schemaVersion: 1,
    recordedAt,
    gitHead,
    snapshotId,
    files: new Map(orderedFiles),
  };
}

test("indexes every scoped source and makes coverage freshness explicit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-"));
  try {
    const currentSource = "export async function submit() { return true; }\n";
    const testSource = 'test("rejects submit after reveal", () => {});\n';
    await mkdir(path.join(root, "frontend/src"), { recursive: true });
    await mkdir(path.join(root, "frontend/test"), { recursive: true });
    await mkdir(path.join(root, "frontend/node_modules/ignored"), { recursive: true });
    await mkdir(path.join(root, "services/game/src"), { recursive: true });
    await mkdir(path.join(root, "spikes/judge-isolation"), { recursive: true });
    await mkdir(path.join(root, "spikes/another-experiment"), { recursive: true });
    await mkdir(path.join(root, "experimental"), { recursive: true });
    await writeFile(path.join(root, "frontend/src/submit.ts"), currentSource);
    await writeFile(path.join(root, "frontend/src/new-flow.ts"), "export const newFlow = true;\n");
    await writeFile(path.join(root, "frontend/test/submit.test.ts"), testSource);
    await writeFile(path.join(root, "frontend/node_modules/ignored/index.ts"), "export {};\n");
    await writeFile(path.join(root, "services/game/src/engine.ts"), "export class ArenaEngine {}\n");
    await writeFile(path.join(root, "spikes/judge-isolation/probe.sh"), "#!/bin/sh\n");
    await writeFile(path.join(root, "spikes/another-experiment/probe.ts"), "export const probe = true;\n");
    await writeFile(path.join(root, "experimental/unclassified.ts"), "export const mystery = 1;\n");

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({
        roots: ["frontend", "services", "spikes/judge-isolation"],
        excluded: [{ path: "prototype", reason: "non-runtime mockups" }],
        lessons: [lessonRecord({ references: [
        { path: "frontend/src/submit.ts", startLine: 1, endLine: 1 },
        { path: "services/game/src/engine.ts", startLine: 1, endLine: 1 },
        ] })],
      }),
      referenceSnapshot: makeReferenceSnapshot(new Map([
        ["frontend/src/submit.ts", sha256(currentSource)],
        ["frontend/src/new-flow.ts", sha256("export const newFlow = true;\n")],
        ["frontend/test/submit.test.ts", sha256(testSource)],
        ["services/game/src/engine.ts", sha256("older engine source\n")],
      ])),
    });

    const files = new Map(data.files.map((file) => [file.path, file]));
    assert.equal(files.get("frontend/src/submit.ts").status, "current-lesson-reference");
    assert.equal(files.get("frontend/src/submit.ts").symbols.some((symbol) => symbol.name === "submit"), true);
    assert.equal(files.get("frontend/src/new-flow.ts").status, "uncovered");
    assert.equal(files.get("frontend/test/submit.test.ts").tests[0].title, "rejects submit after reveal");
    assert.equal(files.get("services/game/src/engine.ts").status, "source-changed-since-lesson");
    assert.equal(files.has("spikes/judge-isolation/probe.sh"), true);
    assert.equal(files.has("frontend/node_modules/ignored/index.ts"), false);
    assert.deepEqual(data.unclassified.map((file) => file.path), ["experimental/unclassified.ts", "spikes/another-experiment/probe.ts"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports every in-scope file without a lesson or support disposition as uncovered", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-uncovered-"));
  try {
    await mkdir(path.join(root, "frontend/src"), { recursive: true });
    await writeFile(path.join(root, "frontend/src/new-flow.ts"), "export const newFlow = true;\n");

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["frontend"] }),
    });

    assert.deepEqual(data.uncoveredFiles.map(({ path: filePath }) => filePath), ["frontend/src/new-flow.ts"]);
    assert.equal(data.files[0].status, "uncovered");
    assert.equal(data.summary.uncovered, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps support-only files distinct from taught lesson behavior", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-support-"));
  try {
    const filePath = "packages/arena-game/test/fixtures.ts";
    const reason = "Shared fixture data supports tests but is not a behavior lesson.";
    await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
    await writeFile(path.join(root, filePath), "export const fixture = {};\n");

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({
        roots: ["packages"],
        supportingFiles: [{ path: filePath, reason }],
      }),
    });

    assert.deepEqual(data.supportingFiles.map(({ path: itemPath, reason: itemReason }) => [itemPath, itemReason]), [[filePath, reason]]);
    assert.equal(data.files[0].status, "support-only");
    assert.deepEqual(data.files[0].references, []);
    assert.equal(data.summary.supporting, 1);
    assert.equal(data.summary.uncovered, 0);
    const template = await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8");
    const rendered = renderCatalogTemplate(template, "", data, root);
    assert.match(rendered, /<strong>1<\/strong><span>support-only files/);
    assert.match(rendered, /Support-only: Shared fixture data supports tests but is not a behavior lesson\./);
    assert.equal(rendered.includes("{{COUNT_"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preserves all lesson links to one file and marks it current only when every hash matches", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-multilesson-"));
  try {
    const filePath = "packages/arena-game/src/engine.ts";
    const source = "export class ArenaEngine {}\n";
    await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
    await writeFile(path.join(root, filePath), source);
    const firstReference = { path: filePath, startLine: 1, endLine: 1, label: "Engine" };
    const secondReference = { path: filePath, startLine: 1, endLine: 1, label: "Authority" };

    const current = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["packages"], lessons: [
        lessonRecord({ references: [firstReference] }),
        lessonRecord({ id: "0002-match-authority", order: 2, title: "Match authority", references: [secondReference] }),
      ] }),
      referenceSnapshot: makeReferenceSnapshot(new Map([[filePath, sha256(source)]])),
    });
    assert.deepEqual(current.files[0].references.map(({ lessonId }) => lessonId), ["0001-submit-journey", "0002-match-authority"]);
    assert.equal(current.files[0].status, "current-lesson-reference");

    const stale = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["packages"], lessons: [
        lessonRecord({ references: [firstReference] }),
        lessonRecord({ id: "0002-match-authority", order: 2, title: "Match authority", references: [
          secondReference,
        ] }),
      ] }),
      referenceSnapshot: makeReferenceSnapshot(new Map([[filePath, "b".repeat(64)]])),
    });
    assert.equal(stale.files[0].status, "source-changed-since-lesson");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires explicit reasons for exclusions and never lets an exclusion hide an in-scope file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-exclusions-"));
  try {
    const inScopePath = "frontend/src/kept.ts";
    const outsidePath = "experiments/probe.ts";
    await mkdir(path.dirname(path.join(root, inScopePath)), { recursive: true });
    await mkdir(path.dirname(path.join(root, outsidePath)), { recursive: true });
    await writeFile(path.join(root, inScopePath), "export const kept = true;\n");
    await writeFile(path.join(root, outsidePath), "export const probe = true;\n");

    await assert.rejects(
      buildCatalogData({
        repoRoot: root,
        coverageMap: makeCoverageMap({ excluded: [{ path: outsidePath, reason: "   " }] }),
      }),
      /exclusion.*reason|reason.*exclusion/i,
    );

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({
        roots: ["frontend"],
        excluded: [
          { path: inScopePath, reason: "This deliberately overlaps the in-scope tree." },
          { path: outsidePath, reason: "Standalone sandbox probe outside the current game inventory." },
        ],
      }),
    });
    assert.equal(data.files.some(({ path: filePath }) => filePath === inScopePath), true);
    assert.equal(data.unclassified.some(({ path: filePath }) => filePath === outsidePath), false);
    assert.equal(data.summary.excluded, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validates unique lesson metadata, existing templates, support records, and source anchors", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-validation-"));
  try {
    const duplicateIds = makeCoverageMap({ lessons: [
      lessonRecord(), lessonRecord({ order: 2, output: "lessons/second.html" }),
    ] });
    await assert.rejects(buildCatalogData({ repoRoot: root, coverageMap: duplicateIds }), /duplicate.*lesson id|lesson id.*duplicate/i);

    const duplicateOrders = makeCoverageMap({ lessons: [
      lessonRecord(), lessonRecord({ id: "0002-second", title: "Second", output: "lessons/second.html" }),
    ] });
    await assert.rejects(buildCatalogData({ repoRoot: root, coverageMap: duplicateOrders }), /duplicate.*order|order.*duplicate/i);

    const duplicateOutputs = makeCoverageMap({ lessons: [
      lessonRecord(), lessonRecord({ id: "0002-second", order: 2, title: "Second", output: "lessons/0001-submit-journey.html" }),
    ] });
    await assert.rejects(buildCatalogData({ repoRoot: root, coverageMap: duplicateOutputs }), /duplicate.*output|output.*duplicate/i);

    await assert.rejects(buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ lessons: [lessonRecord({ goal: "  " })] }),
    }), /goal/i);
    await assert.rejects(buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ lessons: [lessonRecord({ template: "templates/missing.html" })] }),
    }), /template/i);
    await assert.rejects(buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ supportingFiles: [{ path: "support.txt", reason: " " }] }),
    }), /support.*reason|reason.*support/i);
    await assert.rejects(buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ supportingFiles: [{ path: "support.txt", reason: "External helper." }] }),
    }), /not in the declared inventory/i);

    const invalidPath = "src/invalid-anchor.ts";
    await mkdir(path.dirname(path.join(root, invalidPath)), { recursive: true });
    await writeFile(path.join(root, invalidPath), "export const anchor = true;\n");
    const invalidAnchor = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["src"], lessons: [lessonRecord({ references: [
        { path: invalidPath, startLine: 0, endLine: 1 },
      ] })] }),
      referenceSnapshot: makeReferenceSnapshot(new Map([[invalidPath, sha256("export const anchor = true;\n")]])),
    });
    assert.equal(invalidAnchor.invalidReferences[0].startLine, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validates catalog batches against every lesson in lesson order", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-batches-"));
  const learningDir = path.join(tempRoot, ".tours/learning");
  try {
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await writeFile(path.join(learningDir, "templates/lesson.html"), "<h1>{{LESSON_TITLE}}</h1>");
    const lessons = [1, 2, 3].map((order) => lessonRecord({
      id: `lesson-${order}`,
      order,
      title: `Lesson ${order}`,
      template: "templates/lesson.html",
      output: `lessons/lesson-${order}.html`,
    }));
    const firstBatch = {
      id: "start-here",
      order: 1,
      title: "Start here",
      description: "Follow the player path.",
      lessonIds: ["lesson-1", "lesson-2"],
    };
    const secondBatch = {
      id: "next-boundary",
      order: 2,
      title: "Next boundary",
      description: "Trace the next responsibility.",
      lessonIds: ["lesson-3"],
    };
    const map = (batches) => makeCoverageMap({ version: 2, lessons, batches });
    const build = (batches) => buildCatalogData({
      repoRoot: tempRoot,
      learningDir,
      coverageMap: map(batches),
      tours: [],
    });

    await assert.rejects(build([
      firstBatch,
      { ...secondBatch, id: firstBatch.id },
    ]), /duplicate.*batch id|batch id.*duplicate/i);
    await assert.rejects(build([
      firstBatch,
      { ...secondBatch, order: firstBatch.order },
    ]), /duplicate.*batch order|batch order.*duplicate/i);
    await assert.rejects(build([
      { ...firstBatch, lessonIds: ["lesson-1", "unknown-lesson"] },
      secondBatch,
    ]), /unknown lesson.*unknown-lesson|unknown-lesson.*lesson/i);
    await assert.rejects(build([
      firstBatch,
      { ...secondBatch, lessonIds: ["lesson-2", "lesson-3"] },
    ]), /lesson-2.*more than one batch|more than one batch.*lesson-2/i);
    await assert.rejects(build([
      { ...firstBatch, lessonIds: ["lesson-1"] },
      secondBatch,
    ]), /omit(?:s)? lesson.*lesson-2|lesson-2.*omitted/i);
    await assert.rejects(build([
      { ...firstBatch, lessonIds: ["lesson-2", "lesson-1"] },
      secondBatch,
    ]), /flattened batch order.*lesson order|lesson order.*flattened batch order/i);

    const data = await build([firstBatch, secondBatch]);
    assert.deepEqual(data.batches, [firstBatch, secondBatch]);
    assert.deepEqual(data.batches.flatMap(({ lessonIds }) => lessonIds), ["lesson-1", "lesson-2", "lesson-3"]);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("renders a catalog-owned Course Home with a Lesson 1 fallback and visible batch links", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-home-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(repoRoot, ".tours/learning");
  try {
    await mkdir(path.join(learningDir, "assets"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await mkdir(path.join(learningDir, "lessons"), { recursive: true });
    await writeFile(path.join(learningDir, "assets/course.css"), ".course-home { color: inherit; }\n");
    await writeActivityRuntimeFixture(learningDir);
    await writeFile(path.join(learningDir, "templates/source-map.template.html"), "<!doctype html><title>Source map</title><body>Map</body>");
    await writeFile(path.join(learningDir, "templates/lesson.html"), "<!doctype html><title>{{LESSON_TITLE}}</title><body data-course-lesson=\"{{LESSON_ID}}\"><h1>{{LESSON_TITLE}}</h1><!-- COURSE_LESSON_NAV --><!-- COURSE_ACTIVITY_RUNTIME --></body>");
    await writeFile(path.join(learningDir, "templates/course-home.template.html"), [
      "<!doctype html>",
      "<html lang=\"en\"><head><title>Learn Code Arena</title><!-- INLINE_COURSE_STYLES --></head><body>",
      "<a class=\"skip-link\" href=\"#course\">Skip to the course</a>",
      "<header class=\"course-header\"><nav aria-label=\"Course\"><a aria-current=\"page\" href=\"index.html\">Learn</a><a href=\"source-map.html\">Explore code</a></nav></header>",
      "<main class=\"page course-home\" id=\"course\" tabindex=\"-1\">",
      "<p class=\"eyebrow\">A guided route through this exact codebase</p><h1>Understand the game, one behavior at a time.</h1>",
      "<a class=\"primary-button\" data-course-start href=\"{{FIRST_LESSON_URL}}\">{{FIRST_LESSON_ACTION}}</a>",
      "<p class=\"quiet\" data-course-snapshot><span class=\"status {{SNAPSHOT_STATUS_CLASS}}\">{{SNAPSHOT_STATUS}}</span> <span>Snapshot <code>{{SNAPSHOT_ID}}</code></span></p>",
      "<p data-course-activity>Activity stays on this browser and is not a mastery score.</p>",
      "<!-- COURSE_BATCHES -->",
      "<!-- COURSE_ACTIVITY_RUNTIME -->",
      "</main></body></html>",
    ].join("\n"));
    const first = lessonRecord({ id: "lesson-1", order: 1, title: "Read the request", template: "templates/lesson.html", output: "lessons/lesson-1.html" });
    const second = lessonRecord({ id: "lesson-2", order: 2, title: "Check the rule", template: "templates/lesson.html", output: "lessons/lesson-2.html" });
    const third = lessonRecord({ id: "lesson-3", order: 3, title: "Inspect the verdict", template: "templates/lesson.html", output: "lessons/lesson-3.html" });
    const rendered = await renderCatalogOutputs(repoRoot, learningDir, makeCoverageMap({
      version: 2,
      lessons: [third, second, first],
      batches: [
        { id: "start-here", order: 1, title: "Start here", description: "Follow one action.", lessonIds: [first.id, second.id] },
        { id: "next-boundary", order: 2, title: "Next boundary", description: "See what happens after.", lessonIds: [third.id] },
      ],
    }), { tours: [] });
    const home = rendered.files.get(path.join(learningDir, "index.html"));

    assert.equal(typeof renderCourseHomeTemplate, "function", "renderCourseHomeTemplate must be available for generated pages");
    assert.ok(home, "renderCatalogOutputs must include the Course Home");
    assert.equal((home.match(/class=\"primary-button\"/g) ?? []).length, 1);
    assert.match(home, /data-course-start href=\"lessons\/lesson-1\.html\">Start Lesson 1/);
    assert.match(home, /data-course-storage-unavailable aria-live=\"polite\" hidden/);
    assert.equal((home.match(/<script type=\"module\">/g) ?? []).length, 1);
    assert.match(home, /export function installCourseActivity\(/);
    assert.match(home, /Continue Lesson/);
    assert.match(home, /href=\"source-map\.html\">Explore code<\/a>/);
    assert.match(home, /class=\"quiet\" data-course-snapshot/);
    assert.match(home, /<h2[^>]*>Start here<\/h2>[\s\S]*?<h2[^>]*>Next boundary<\/h2>/);
    assert.doesNotMatch(home, /<summary[^>]*>[\s\S]*?<h[1-6]\b/);
    for (const [lessonId, href] of [["lesson-1", "lesson-1.html"], ["lesson-2", "lesson-2.html"], ["lesson-3", "lesson-3.html"]]) {
      assert.match(home, new RegExp(`<a[^>]+data-lesson-link=\"${lessonId}\"[^>]+href=\"lessons/${href}\"`));
      assert.match(home, new RegExp(`data-course-activity-status=\"${lessonId}\">Not started<\\/span>`));
    }
    assert.doesNotMatch(home, /data-lesson-link=\"(?:lesson-1|lesson-2|lesson-3)\"[^>]*disabled/);
    assert.ok(home.indexOf("lesson-1.html") < home.indexOf("lesson-2.html"));
    assert.ok(home.indexOf("lesson-2.html") < home.indexOf("lesson-3.html"));
    const firstPage = rendered.files.get(path.join(learningDir, "lessons/lesson-1.html"));
    const secondPage = rendered.files.get(path.join(learningDir, "lessons/lesson-2.html"));
    const thirdPage = rendered.files.get(path.join(learningDir, "lessons/lesson-3.html"));
    for (const page of [firstPage, secondPage, thirdPage]) {
      assert.match(page, /data-course-lesson=\"lesson-[123]\"/);
      assert.match(page, /data-course-storage-unavailable aria-live=\"polite\" hidden/);
      assert.equal((page.match(/<script type=\"module\">/g) ?? []).length, 1);
      assert.match(page, /data-course-home href=\"\.\.\/index\.html\"/);
      assert.match(page, /data-course-explore href=\"\.\.\/source-map\.html\"/);
    }
    assert.match(firstPage, /data-next-lesson[^>]*href=\"lesson-2\.html\"/);
    assert.match(secondPage, /data-previous-lesson[^>]*href=\"lesson-1\.html\"/);
    assert.match(secondPage, /data-next-lesson[^>]*href=\"lesson-3\.html\"/);
    assert.match(thirdPage, /data-previous-lesson[^>]*href=\"lesson-2\.html\"/);
    assert.doesNotMatch(firstPage, /data-previous-lesson/);
    assert.doesNotMatch(thirdPage, /data-next-lesson/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("renders catalog lessons and carries a validated optional build path", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-multi-output-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(learningDir, "assets"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    const source = "export function run() { return true; }\n";
    await writeFile(path.join(repoRoot, "src/engine.ts"), source);
    await writeFile(
      path.join(learningDir, "assets/course.css"),
      await readFile(new URL("../assets/course.css", import.meta.url), "utf8"),
    );
    await writeActivityRuntimeFixture(learningDir);
    await writeFile(
      path.join(learningDir, "templates/source-map.template.html"),
      await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8"),
    );
    await writeFile(
      path.join(learningDir, "templates/0000-before-lesson-one.template.html"),
      await readFile(new URL("../templates/0000-before-lesson-one.template.html", import.meta.url), "utf8"),
    );
    const firstTemplate = "<!doctype html><html><head><title>{{LESSON_TITLE}}</title><!-- INLINE_COURSE_STYLES --></head><body data-lesson-id=\"{{LESSON_ID}}\"><main><h1>{{LESSON_TITLE}}</h1><p>{{LESSON_GOAL}}</p><p>Lesson {{LESSON_ORDER}}</p><p>{{LESSON_FRESHNESS}}</p><p>{{SNAPSHOT_ID}}</p><a href=\"../../../src/engine.ts#L1\">source</a></main></body></html>";
    const secondTemplate = "<!doctype html><html><head><title>{{LESSON_TITLE}}</title><!-- INLINE_COURSE_STYLES --></head><body data-lesson-id=\"{{LESSON_ID}}\"><article><h1>{{LESSON_TITLE}}</h1><p>{{LESSON_GOAL}}</p><p>Lesson {{LESSON_ORDER}}</p><p>{{LESSON_FRESHNESS}}</p><p>{{SNAPSHOT_ID}}</p><a href=\"../../../src/engine.ts#L1\">source</a></article></body></html>";
    await writeFile(path.join(learningDir, "templates/first.html"), firstTemplate);
    await writeFile(path.join(learningDir, "templates/second.html"), secondTemplate);

    const reference = { path: "src/engine.ts", startLine: 1, endLine: 1, label: "Run entry" };
    const coverageMap = makeCoverageMap({
      roots: ["src"],
      lessons: [
        lessonRecord({
          id: "0002-second",
          order: 2,
          title: "Second lesson",
          goal: "Trace the second behavior.",
          template: "templates/second.html",
          output: "lessons/second.html",
          references: [reference],
        }),
        lessonRecord({
          id: "0001-first",
          order: 1,
          title: "First lesson",
          goal: "Trace the first behavior.",
          template: "templates/first.html",
          output: "lessons/first.html",
          references: [reference],
        }),
      ],
    });

    assert.equal(typeof renderCatalogOutputs, "function", "renderCatalogOutputs must render every metadata lesson");
    if (typeof renderCatalogOutputs !== "function") return;
    const learningPath = {
      version: 1,
      orientation: { output: "lessons/0000-before-lesson-one.html", title: "Before Lesson 1" },
      steps: [{
        id: "inspect-boundary", order: 0, title: "Inspect the boundary",
        why: "A test makes the boundary visible.", requires: [], lessonIds: ["0001-first"],
        deliverable: "One observable rule", placement: "Beside its current owner.",
        pattern: "A focused rule and test.", check: "The test shows the expected result.",
        sourcePath: "src/engine.ts", testPath: "src/engine.ts",
      }],
    };
    const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, {
      referenceSnapshot: makeReferenceSnapshot(new Map([["src/engine.ts", sha256(source)]])),
      learningPath,
    });
    assert.deepEqual(rendered.data.learningPath.steps.map(({ id }) => id), ["inspect-boundary"]);
    const firstPage = rendered.files.get(path.join(learningDir, "lessons/first.html"));
    const secondPage = rendered.files.get(path.join(learningDir, "lessons/second.html"));
    const catalogPage = rendered.files.get(path.join(learningDir, "source-map.html"));

    assert.ok(firstPage);
    assert.ok(secondPage);
    assert.match(firstPage, /data-lesson-id="0001-first"/);
    assert.match(firstPage, /<h1>First lesson<\/h1>/);
    assert.match(firstPage, /Source references match 1 pinned files/);
    assert.match(secondPage, /data-lesson-id="0002-second"/);
    assert.match(secondPage, /<h1>Second lesson<\/h1>/);
    assert.match(secondPage, /Source references match 1 pinned files/);
    assert.match(firstPage, /href="\.\.\/source-map\.html\?file=src%2Fengine\.ts&amp;line=1"/);
    assert.match(catalogPage, /class="hljs-keyword"/);
    assert.match(catalogPage, /<title>Code Arena · Explore the exact implementation<\/title>/);
    assert.match(catalogPage, /<h1>Explore the exact implementation<\/h1>/);
    assert.match(catalogPage, /<a href="index\.html">Back to Course Home<\/a>/);
    assert.match(catalogPage, /<a aria-current="page" href="source-map\.html">Explore code<\/a>/);
    assert.match(catalogPage, /<details class="focus-panel" id="course-list">/);
    assert.ok(catalogPage.indexOf('href="lessons/first.html"') < catalogPage.indexOf('href="lessons/second.html"'));
    assert.doesNotMatch(catalogPage, /lesson-progress|code-arena-learning:activity:v1|localStorage/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("embeds only cited lesson sources and keeps source text inert", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-lesson-source-preview-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(repoRoot, ".tours/learning");
  const enginePath = "src/engine.ts";
  const notesPath = "src/notes.txt";
  const unusedPath = "src/unused.ts";
  const engineSource = 'export const payload = "</template><script>window.sourceExecuted = true</script>";\nexport const current = true;\n';
  const notesSource = '<img src=x onerror="window.sourceExecuted = true">\n';
  const unusedSource = "export const unused = true;\n";

  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(learningDir, "assets"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await mkdir(path.join(learningDir, "lessons"), { recursive: true });
    await writeFile(path.join(repoRoot, enginePath), engineSource);
    await writeFile(path.join(repoRoot, notesPath), notesSource);
    await writeFile(path.join(repoRoot, unusedPath), unusedSource);
    await writeFile(path.join(learningDir, "README.md"), "[First](lessons/first.html)\n[Second](lessons/second.html)\n");
    await writeFile(
      path.join(learningDir, "assets/course.css"),
      await readFile(new URL("../assets/course.css", import.meta.url), "utf8"),
    );
    await writeActivityRuntimeFixture(learningDir);
    await writeFile(
      path.join(learningDir, "templates/source-map.template.html"),
      await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8"),
    );
    await writeFile(
      path.join(learningDir, "templates/first.html"),
      '<!doctype html><html><head><title>{{LESSON_TITLE}}</title><!-- INLINE_COURSE_STYLES --></head><body data-lesson-id="{{LESSON_ID}}"><a href="../../../src/engine.ts#L2">Engine</a><a href="../../../src/missing.ts#L1">Missing</a></body></html>',
    );
    await writeFile(
      path.join(learningDir, "templates/second.html"),
      '<!doctype html><html><head><title>{{LESSON_TITLE}}</title><!-- INLINE_COURSE_STYLES --></head><body data-lesson-id="{{LESSON_ID}}"><a href="../../../src/notes.txt#L1">Notes</a></body></html>',
    );

    const rendered = await renderCatalogOutputs(repoRoot, learningDir, makeCoverageMap({
      roots: ["src"],
      lessons: [
        lessonRecord({ id: "first", template: "templates/first.html", output: "lessons/first.html", references: [
          { path: enginePath, startLine: 2, endLine: 2, label: "Current rule" },
          { path: "src/missing.ts", startLine: 1, endLine: 1, label: "Unavailable source" },
        ] }),
        lessonRecord({ id: "second", order: 2, template: "templates/second.html", output: "lessons/second.html", references: [
          { path: notesPath, startLine: 1, endLine: 1, label: "Plain text note" },
        ] }),
      ],
    }), { tours: [] });
    const [engineFile, notesFile, unusedFile] = [enginePath, notesPath, unusedPath]
      .map((sourcePath) => rendered.data.files.find((file) => file.path === sourcePath));
    const firstPage = rendered.files.get(path.join(learningDir, "lessons/first.html"));
    const secondPage = rendered.files.get(path.join(learningDir, "lessons/second.html"));

    assert.ok(engineFile && notesFile && unusedFile);
    assert.ok(firstPage && secondPage);
    assert.match(firstPage, new RegExp(`<template id="${engineFile.sourceId}"`));
    assert.doesNotMatch(firstPage, new RegExp(`<template id="${notesFile.sourceId}"`));
    assert.doesNotMatch(firstPage, new RegExp(`<template id="${unusedFile.sourceId}"`));
    assert.match(secondPage, new RegExp(`<template id="${notesFile.sourceId}"`));
    assert.doesNotMatch(secondPage, new RegExp(`<template id="${engineFile.sourceId}"`));
    assert.match(firstPage, /href="\.\.\/source-map\.html\?file=src%2Fengine\.ts&amp;line=2"/);
    assert.match(firstPage, /href="\.\.\/source-map\.html\?file=src%2Fmissing\.ts&amp;line=1"/);
    const missingLink = firstPage.match(/<a href="\.\.\/source-map\.html\?file=src%2Fmissing\.ts&amp;line=1"[^>]*>/)?.[0];
    assert.ok(missingLink);
    assert.doesNotMatch(missingLink, /data-source-id=/);
    assert.match(firstPage, new RegExp(`data-source-id="${engineFile.sourceId}" data-source-path="src/engine\\.ts" data-source-line="2"`));
    assert.match(firstPage, /data-editor-url="vscode:\/\/file/);
    assert.match(firstPage, /&lt;script&gt;window\.sourceExecuted = true&lt;\/script&gt;/);
    assert.doesNotMatch(firstPage, /<script>window\.sourceExecuted = true/);
    assert.doesNotMatch(firstPage, /\bfetch\s*\(/);
    assert.match(secondPage, /&lt;img src=x onerror=/);
    assert.doesNotMatch(secondPage, /<img src=x onerror=/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("reports changed source impact across every lesson, CodeTour step, and checksum record", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-impact-"));
  try {
    const filePath = "src/engine.ts";
    const previousSource = "export const allowed = false;\n";
    const currentSource = "export const allowed = true;\n";
    const tourPath = ".tours/engine.tour";
    const tourText = JSON.stringify({
      title: "Engine rule",
      steps: [{ file: filePath, line: 1, title: "The engine decides" }],
    });
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, ".tours"), { recursive: true });
    await writeFile(path.join(root, filePath), currentSource);
    await writeFile(path.join(root, tourPath), tourText);

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({
        roots: ["src"],
        lessons: [lessonRecord({ title: "Engine authority", references: [
          { path: filePath, startLine: 1, endLine: 1, label: "Current rule" },
        ] })],
      }),
      referenceSnapshot: makeReferenceSnapshot(new Map([[filePath, sha256(previousSource)]])),
      tours: [{
        path: tourPath,
        title: "Engine rule",
        steps: [{ step: 1, file: filePath, line: 1, title: "The engine decides" }],
      }],
      referenceBaseline: {
        path: ".tours/reference-baseline.sha256",
        files: new Map([[filePath, sha256(previousSource)], [tourPath, sha256(tourText)]]),
      },
    });

    assert.deepEqual(data.sourceChanges.map(({ path: changedPath, kind }) => [changedPath, kind]), [[filePath, "changed"]]);
    assert.deepEqual(data.affectedArtifacts.lessons.map(({ lessonId }) => lessonId), ["0001-submit-journey"]);
    assert.deepEqual(data.affectedArtifacts.tours.map(({ path: affectedTour, step }) => [affectedTour, step]), [[tourPath, 1]]);
    assert.deepEqual(data.affectedArtifacts.baselineRecords, [
      { sourcePath: filePath, baselinePath: ".tours/reference-baseline.sha256" },
    ]);
    const report = formatAuditReport(data);
    assert.match(report, /src\/engine\.ts.*changed/);
    assert.match(report, /Lesson 0001-submit-journey/);
    assert.match(report, /CodeTour \.tours\/engine\.tour · step 1/);
    assert.match(report, /\.tours\/reference-baseline\.sha256/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports added and deleted snapshot paths instead of dropping them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-added-deleted-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src/added.ts"), "export const added = true;\n");

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["src"] }),
      referenceSnapshot: makeReferenceSnapshot(new Map([["src/deleted.ts", "a".repeat(64)]])),
    });

    assert.deepEqual(data.sourceChanges.map(({ path: changedPath, kind }) => [changedPath, kind]), [
      ["src/added.ts", "added"],
      ["src/deleted.ts", "deleted"],
    ]);
    assert.match(formatAuditReport(data), /src\/added\.ts.*added[\s\S]*src\/deleted\.ts.*deleted/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports CodeTour file drift and rejects broken anchors outside the covered source roots", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-tour-drift-"));
  try {
    const sourcePath = "src/engine.ts";
    const tourPath = ".tours/engine.tour";
    const tourText = JSON.stringify({ title: "Updated tour", steps: [
      { file: "docs/overview.md", line: 1, title: "Out-of-scope but valid" },
      { file: "src/engine.ts", line: 99, title: "Out of range" },
    ] });
    const previousTourText = JSON.stringify({ title: "Old tour", steps: [] });
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "docs"), { recursive: true });
    await mkdir(path.join(root, ".tours"), { recursive: true });
    const source = "export const engine = true;\n";
    await writeFile(path.join(root, sourcePath), source);
    await writeFile(path.join(root, "docs/overview.md"), "Overview.\n");
    await writeFile(path.join(root, tourPath), tourText);

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["src"] }),
      referenceSnapshot: makeReferenceSnapshot(new Map([[sourcePath, sha256(source)]])),
      tours: [{ path: tourPath, title: "Updated tour", steps: [
        { step: 1, file: "docs/overview.md", line: 1, title: "Out-of-scope but valid" },
        { step: 2, file: sourcePath, line: 99, title: "Out of range" },
      ] }],
      referenceBaseline: {
        path: ".tours/reference-baseline.sha256",
        files: new Map([[tourPath, sha256(previousTourText)]]),
      },
    });

    assert.deepEqual(data.evidenceChanges.map(({ path: changedPath, kind }) => [changedPath, kind]), [[tourPath, "changed"]]);
    assert.deepEqual(data.invalidTourAnchors, [{
      tourPath,
      step: 2,
      file: sourcePath,
      line: 99,
      lines: 1,
      issue: "line beyond EOF",
    }]);
    assert.match(formatAuditReport(data), /\.tours\/engine\.tour.*changed/);
    assert.match(formatAuditReport(data), /step 2.*line beyond EOF/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normal page generation leaves frozen baselines untouched; explicit acceptance refreshes both fingerprints", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-accept-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(repoRoot, ".tours"), { recursive: true });
    await mkdir(path.join(learningDir, "assets"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await mkdir(path.join(learningDir, "lessons"), { recursive: true });
    const source = "export const stable = true;\n";
    const tourText = JSON.stringify({ title: "Tiny tour", steps: [{ file: "src/engine.ts", line: 1, title: "Source" }] });
    const sourcePath = "src/engine.ts";
    const tourPath = ".tours/tiny.tour";
    await writeFile(path.join(repoRoot, sourcePath), source);
    await writeFile(path.join(repoRoot, tourPath), tourText);
    const baselineMarkdownPath = path.join(repoRoot, ".tours/reference-baseline.md");
    await writeFile(baselineMarkdownPath, [
      "# Baseline",
      "",
      "- Recorded: 2026-09-25",
      "- Git HEAD: oldhead",
      "- Git worktree: dirty; HEAD alone does not identify the implementation.",
      "- Tour links checked: all 1 file-and-line anchors resolve in current files.",
      "",
      "## Test evidence captured for this snapshot",
      "",
      "All commands ran on 2026-09-25. Old test record.",
      "",
    ].join("\n"));
    await writeFile(path.join(learningDir, "assets/course.css"), await readFile(new URL("../assets/course.css", import.meta.url), "utf8"));
    await writeActivityRuntimeFixture(learningDir);
    await writeFile(path.join(learningDir, "templates/source-map.template.html"), await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8"));
    await writeFile(path.join(learningDir, "templates/lesson.html"), "<h1>{{LESSON_TITLE}}</h1>{{LESSON_FRESHNESS}}<!-- COURSE_LESSON_NAV -->");
    const snapshotPath = path.join(learningDir, "reference-snapshot.json");
    const checksumPath = path.join(repoRoot, ".tours/reference-baseline.sha256");
    const beforeSnapshot = "existing reviewed snapshot remains unchanged\n";
    const beforeChecksums = `${"a".repeat(64)}  ${sourcePath}\n${"b".repeat(64)}  ${tourPath}\n`;
    await writeFile(snapshotPath, beforeSnapshot);
    await writeFile(checksumPath, beforeChecksums);

    const coverageMap = makeCoverageMap({
      roots: ["src"],
      lessons: [lessonRecord({ template: "templates/lesson.html", references: [
        { path: sourcePath, startLine: 1, endLine: 1 },
      ] })],
    });
    const referenceSnapshot = makeReferenceSnapshot(new Map([[sourcePath, sha256(source)]]));
    const referenceBaseline = {
      path: ".tours/reference-baseline.sha256",
      files: new Map([[sourcePath, "a".repeat(64)], [tourPath, "b".repeat(64)]]),
    };
    const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, {
      referenceSnapshot,
      referenceBaseline,
      tours: [{ path: tourPath, title: "Tiny tour", steps: [{ step: 1, file: sourcePath, line: 1, title: "Source" }] }],
    });
    assert.equal(typeof writeRenderedOutputs, "function");
    if (typeof writeRenderedOutputs !== "function") return;
    await writeRenderedOutputs(rendered.files);
    assert.equal(await readFile(snapshotPath, "utf8"), beforeSnapshot);
    assert.equal(await readFile(checksumPath, "utf8"), beforeChecksums);

    assert.equal(typeof acceptReviewedSnapshot, "function");
    if (typeof acceptReviewedSnapshot !== "function") return;
    const accepted = await acceptReviewedSnapshot({
      repoRoot,
      learningDir,
      files: new Map([[sourcePath, sha256(source)]]),
      gitHead: "e".repeat(40),
      recordedAt: "2026-09-26T13:00:00.000Z",
      auditData: rendered.data,
      worktreeStatus: "dirty",
      reviewedLessons: ["0001-submit-journey"],
    });
    assert.equal(accepted.snapshot.gitHead, "e".repeat(40));
    assert.equal(accepted.snapshot.snapshotId, referenceSnapshot.snapshotId);
    assert.equal(accepted.checksumCount, 2);
    assert.notEqual(await readFile(snapshotPath, "utf8"), beforeSnapshot);
    assert.notEqual(await readFile(checksumPath, "utf8"), beforeChecksums);
    assert.match(await readFile(checksumPath, "utf8"), new RegExp(`${sha256(source)}  ${sourcePath}`));
    assert.match(await readFile(checksumPath, "utf8"), new RegExp(`${sha256(tourText)}  ${tourPath}`));
    const refreshedMarkdown = await readFile(baselineMarkdownPath, "utf8");
    assert.match(refreshedMarkdown, /Recorded: 2026-09-26/);
    assert.match(refreshedMarkdown, /Git worktree: dirty;/);
    assert.match(refreshedMarkdown, /Historical test evidence/);
    assert.match(refreshedMarkdown, /not rerun during that refresh/);

    const acceptedAgain = await acceptReviewedSnapshot({
      repoRoot,
      learningDir,
      files: new Map([[sourcePath, sha256(source)]]),
      gitHead: "f".repeat(40),
      recordedAt: "2026-09-27T13:00:00.000Z",
      auditData: rendered.data,
      worktreeStatus: "clean",
      reviewedLessons: ["0001-submit-journey"],
    });
    assert.equal(acceptedAgain.snapshot.gitHead, "f".repeat(40));
    const refreshedAgainMarkdown = await readFile(baselineMarkdownPath, "utf8");
    assert.match(refreshedAgainMarkdown, /Recorded: 2026-09-27/);
    assert.match(refreshedAgainMarkdown, /Git worktree: clean;/);
    assert.equal((refreshedAgainMarkdown.match(/^## Historical test evidence \(not rerun by snapshot refresh\)$/gm) ?? []).length, 1);
    assert.match(refreshedAgainMarkdown, /These test results were captured on 2026-09-25\. The reference baseline was refreshed on 2026-09-27; tests were not rerun during that refresh\./);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("keeps deleted lesson references visible as stale instead of silently dropping them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-"));
  try {
    await mkdir(path.join(root, "packages/arena-game/src"), { recursive: true });
    await writeFile(path.join(root, "packages/arena-game/src/engine.ts"), "line one\nline two\n");
    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: ["packages"], lessons: [lessonRecord({ references: [
        { path: "packages/arena-game/src/removed.ts", startLine: 4, endLine: 8 },
        { path: "packages/arena-game/src/engine.ts", startLine: 1, endLine: 4 },
      ] })] }),
      referenceSnapshot: makeReferenceSnapshot(new Map([
        ["packages/arena-game/src/removed.ts", "a".repeat(64)],
        ["packages/arena-game/src/engine.ts", sha256("line one\nline two\n")],
      ])),
    });

    assert.deepEqual(data.missingReferences, [
      { path: "packages/arena-game/src/removed.ts", lessonId: "0001-submit-journey", title: "Trace a Submit" },
    ]);
    assert.deepEqual(data.invalidReferences, [
      { path: "packages/arena-game/src/engine.ts", lessonId: "0001-submit-journey", startLine: 1, endLine: 4 },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("renders clickable source previews without turning source text into active HTML", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-preview-"));
  try {
    const filePath = "frontend/src/read me.ts";
    const sourceText = 'const closing = "</template><script>alert(1)</script>";\nexport function submit() {}\n';
    await mkdir(path.join(root, "frontend/src"), { recursive: true });
    await writeFile(path.join(root, filePath), sourceText);

    const coverageMap = makeCoverageMap({ roots: [{ path: "frontend", area: "Frontend" }] });
    const data = await buildCatalogData({ repoRoot: root, coverageMap });
    const template = await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8");
    const rendered = renderCatalogTemplate(template, "", data);

    assert.match(rendered, /Open code preview/);
    assert.match(rendered, /vscode:\/\/file\/[^" ]*read%20me\.ts:1/);
    assert.match(rendered, /class="hljs-keyword"/);
    assert.match(rendered, /class="hljs-string"/);
    assert.match(rendered, /&lt;\/template&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.equal(rendered.includes('</template><script>alert(1)</script>'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps unsupported source formats readable as escaped plain text", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-preview-fallback-"));
  try {
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "docs/notes.txt"), "Remember: <plain text> & literal\n");

    const data = await buildCatalogData({
      repoRoot: root,
      coverageMap: makeCoverageMap({ roots: [{ path: "docs", area: "Docs" }] }),
    });
    const template = await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8");
    const rendered = renderCatalogTemplate(template, "", data, root);

    assert.match(rendered, /Remember: &lt;plain text&gt; &amp; literal/);
    assert.equal(rendered.includes('class="hljs-keyword"'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("routes lesson source links to the browser preview at the cited line", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0001-submit-journey");
  const template = await readFile(new URL("../templates/0001-submit-journey.template.html", import.meta.url), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 12 }, lesson);

  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fcomponents%2FEditorToolbar\.tsx&amp;line=46"/);
  assert.equal(rendered.includes("../../../frontend/src/components/EditorToolbar.tsx#L46"), false);
});

test("keeps the two-client 1v1 browser journey linked from the Submit lesson", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0001-submit-journey");

  assert.ok(lesson, "coverage map includes the authored first lesson");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "frontend/e2e/live-1v1.spec.ts" && startLine === 61,
  ), "Lesson 1 maps the two-client browser journey source");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 14 }, lesson);

  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Flive-1v1\.spec\.ts&amp;line=61"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fjudge-factory\.ts&amp;line=19"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fworker-judge\.ts&amp;line=68"/);
  assert.match(template, /linked as source, not as a pass from this lesson update/);
});

test("renders the Reveal cutoff lesson's source links into the local preview", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0002-reveal-cutoff");

  assert.ok(lesson, "coverage map includes the authored Lesson 2");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 4 }, lesson);

  assert.match(rendered, /data-lesson-id="0002-reveal-cutoff"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fround-lifecycle\.ts&amp;line=120"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fengine\.ts&amp;line=743"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fevaluation-orchestration\.ts&amp;line=463"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fscoring-reveal\.test\.ts&amp;line=86"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fdeadline-closure\.test\.ts&amp;line=11"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fdeadline-closure\.test\.ts&amp;line=69"/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/packages\//);
});

test("renders the Round score lesson's source links into the local preview", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0003-rounds-and-final-score");

  assert.ok(lesson, "coverage map includes the authored Lesson 3");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 9 }, lesson);

  assert.match(rendered, /data-lesson-id="0003-rounds-and-final-score"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Frecords\.ts&amp;line=40"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-model%2Fsrc%2Fscoring\.ts&amp;line=98"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fscoring-reveal\.test\.ts&amp;line=40"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fsubmit-path\.test\.ts&amp;line=35"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fdeadline-closure\.test\.ts&amp;line=23"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fcomponents%2FArenaPage\.test\.tsx&amp;line=71"/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/packages\//);
});

test("renders the Lobby-to-Match lesson's source links into the local preview", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0004-lobby-to-match");

  assert.ok(lesson, "coverage map includes the authored Lesson 4");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 9 }, lesson);

  assert.match(rendered, /data-lesson-id="0004-lobby-to-match"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Farena%2Flobby-session\.test\.ts&amp;line=64"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fcomponents%2FLobbyPage\.tsx&amp;line=311"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Flobby\.ts&amp;line=685"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Flobby\.test\.ts&amp;line=150"/);
  assert.match(template, /The first release is invitation-only/);
  assert.match(template, /Test files and browser journeys are linked as evidence source, not as a pass from this lesson update/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services)\//);
});

test("renders the Problem-to-Run lesson's source links into the local preview", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0005-problem-editor-run");

  assert.ok(lesson, "coverage map includes the authored Lesson 5");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 10 }, lesson);

  assert.match(rendered, /data-lesson-id="0005-problem-editor-run"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Fproblem-bank%2Fproblems%2Feven-ledger\.json&amp;line=30"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Ffile-bank\.ts&amp;line=10"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fengine\.ts&amp;line=477"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fcomponents%2FCodeWorkspace\.tsx&amp;line=87"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Frun-path\.test\.ts&amp;line=26"/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services)\//);
});

test("keeps the core learning pages connected in the intended beginner order", async () => {
  // ponytail: coverage-map.json owns the order; the test derives prev/next from it.
  const learningDir = path.join(process.cwd(), ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const ordered = [...coverageMap.lessons].sort((left, right) => left.order - right.order);
  assert.equal(ordered.length, 14);
  assert.deepEqual(ordered.map((lesson) => lesson.order), ordered.map((_, index) => index + 1));
  for (let index = 0; index < ordered.length; index++) {
    const template = await readFile(path.join(learningDir, ordered[index].template), "utf8");
    assert.equal((template.match(/<!-- COURSE_LESSON_NAV -->/g) ?? []).length, 1, `${ordered[index].template} delegates navigation to the catalog renderer`);
  }
  const issues = await auditCourseOrder({ lessons: coverageMap.lessons, learningDir });
  assert.deepEqual(issues, []);
});

test("renders the Evaluation-retry lesson's source links into the local preview", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0006-evaluation-retries");

  assert.ok(lesson, "coverage map includes the authored Lesson 6");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 7 }, lesson);

  assert.match(rendered, /data-lesson-id="0006-evaluation-retries"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fengine\.ts&amp;line=581"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fevaluation-orchestration\.ts&amp;line=22"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fsubmit-path\.test\.ts&amp;line=93"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fmatch-revision\.test\.ts&amp;line=58"/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/packages\//);
});

test("renders the Judge-boundary lesson's source links into the local preview", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0007-judge-boundary");

  assert.ok(lesson, "coverage map includes the authored Lesson 7");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 10 }, lesson);

  assert.match(rendered, /data-lesson-id="0007-judge-boundary"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fjudge\.ts&amp;line=107"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fcontainer-judge\.ts&amp;line=260"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fjudge-security\.test\.ts&amp;line=191"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fworker-judge\.ts&amp;line=68"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fjudge-factory\.ts&amp;line=21"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fworker-judge\.test\.ts&amp;line=82"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fjudge-factory\.test\.ts&amp;line=32"/);
  for (const sourcePath of [
    "packages/arena-game/src/worker-judge.ts",
    "packages/arena-game/test/worker-judge.test.ts",
    "services/game/src/game/judge-factory.ts",
    "services/game/src/game/judge-factory.test.ts",
  ]) {
    assert.ok(lesson.references.some(({ path: referencePath }) => referencePath === sourcePath),
      `Lesson 7 maps ${sourcePath}`);
  }
  assert.match(template, /WorkerJudgeAdapter/);
  assert.match(template, /JUDGE_BACKEND=worker/);
  assert.match(template, /provider failures never trigger fallback/);
  assert.match(template, /validates.*case identity/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=spikes%2Fjudge-isolation%2FDECISION\.md&amp;line=1"/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:packages|services|spikes)\//);
});

test("renders the persistence-and-recovery lesson with durable-store and restart evidence", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0008-persistence-recovery");

  assert.ok(lesson, "coverage map includes the authored Lesson 8");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 12 }, lesson);

  assert.match(rendered, /data-lesson-id="0008-persistence-recovery"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fpostgres-store\.ts&amp;line=12"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fmatch-authority\.ts&amp;line=41"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fgame\.service\.ts&amp;line=99"/);
  assert.ok(lesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "packages/arena-game/src/evaluation-orchestration.ts" && startLine === 39 && endLine === 80,
  ), "Lesson 8 maps the process-local registry separately from its durable persistence claim");
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fevaluation-orchestration\.ts&amp;line=39"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Freconnect\.test\.ts&amp;line=565"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fpostgres\.test\.ts&amp;line=384"/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:packages|services)\//);
  assert.match(rendered, /process-local/);
  assert.match(rendered, /not run/);
  assert.match(template, /Match events are delivered only after the Match save commits/);
  assert.match(template, /a failed Match save publishes no event/);
  assert.match(template, /the committed revision/);
  assert.match(template, /not a durable outbox/);
  assert.ok(lesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "packages/arena-game/test/post-commit-events.test.ts" && startLine === 21 && endLine === 32,
  ), "Lesson 8 maps failed-save suppression evidence");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "packages/arena-game/test/post-commit-events.test.ts" && startLine === 34 && endLine === 54,
  ), "Lesson 8 maps committed-revision and listener-isolation evidence");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "packages/arena-game/src/engine.ts" && startLine === 164,
  ), "Lesson 8 maps post-lock event delivery");
});

test("renders the live-connection lesson with identity, Presence, and reconnect evidence", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0009-live-connection");

  assert.ok(lesson, "coverage map includes the authored Lesson 9");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 14 }, lesson);

  assert.match(rendered, /data-lesson-id="0009-live-connection"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Farena%2Fsocket\.ts&amp;line=265"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fgame\.gateway\.ts&amp;line=42"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fengine\.ts&amp;line=845"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fmatch-socket-presence\.ts&amp;line=15"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Freconnect\.test\.ts&amp;line=14"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Freconnect\.spec\.ts&amp;line=88"/);
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "services/game/src/game/reconnect.test.ts" && startLine === 86,
  ), "Lesson 9 maps the real-socket/Postgres reconnect suite as inspected source evidence");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "services/game/src/game/reconnect.test.ts" && startLine === 205,
  ), "Lesson 9 maps the service-level 1v1 grace-expiry and rejoin case");
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Freconnect\.test\.ts&amp;line=86"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Freconnect\.test\.ts&amp;line=205"/);
  assert.match(template, /Postgres-backed reconnect suite was inspected but not run here/);
  assert.match(template, /Live Match events are notifications, not a replayable event log/);
  assert.match(template, /fetch the authoritative snapshot/);
  assert.match(template, /Missed individual events are not replayed/);
  assert.match(template, /older committed revision/);
  assert.ok(lesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "packages/arena-game/test/post-commit-events.test.ts" && startLine === 21 && endLine === 54,
  ), "Lesson 9 maps event durability boundaries");
  assert.match(rendered, /not a production authentication implementation/);
  assert.match(rendered, /Presence is not Player status/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services)\//);
});

test("renders the 2v2 collaboration lesson with authoritative revision and readiness evidence", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0010-team-collaboration");

  assert.ok(lesson, "coverage map includes the authored Lesson 10");
  assert.equal(lesson.order, 10);
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 14 }, lesson);

  assert.match(rendered, /data-lesson-id="0010-team-collaboration"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fteam-collaboration\.ts&amp;line=151"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fteam-collaboration\.ts&amp;line=221"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Fsrc%2Fengine\.ts&amp;line=547"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-game%2Ftest%2Fteam-2v2\.test\.ts&amp;line=305"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Flive-collab\.spec\.ts&amp;line=75"/);
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "frontend/src/arena/collab.test.ts" && startLine === 26,
  ), "Lesson 10 maps the server-free client baseline and replay tests");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "services/game/src/game/team-2v2.test.ts" && startLine === 135,
  ), "Lesson 10 maps real-service 2v2 integration as inspected source evidence");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "frontend/e2e/collab-reconnect.spec.ts" && startLine === 94,
  ), "Lesson 10 maps the collaboration reconnect browser scenarios");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "frontend/e2e/live-2v2.spec.ts" && startLine === 70,
  ), "Lesson 10 maps the four-client 2v2 proof source");
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Farena%2Fcollab\.test\.ts&amp;line=26"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fteam-2v2\.test\.ts&amp;line=135"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Fcollab-reconnect\.spec\.ts&amp;line=94"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Fcollab-reconnect\.spec\.ts&amp;line=270"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Flive-2v2\.spec\.ts&amp;line=70"/);
  assert.match(template, /Ticket-14 four-client browser proof is source evidence, not a run from this lesson update/);
  assert.match(template, /real HTTP\/socket\/Postgres 2v2 suite and browser reconnect E2E were inspected but not run here/);
  assert.match(template, /not run/);
  assert.match(template, /<!-- COURSE_LESSON_NAV -->/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services)\//);
});

test("renders the team-chat lesson with room isolation and Match-versus-Round lifetimes", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0011-team-chat");

  assert.ok(lesson, "coverage map includes the authored Lesson 11");
  assert.equal(lesson.order, 11);
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 14 }, lesson);

  assert.match(rendered, /data-lesson-id="0011-team-chat"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fteam-chat\.gateway\.ts&amp;line=45"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-model%2Fsrc%2Fchat\.ts&amp;line=21"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Farena%2Fsidecars\.ts&amp;line=178"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Farena%2Fsidecars\.test\.ts&amp;line=44"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fteam-chat\.test\.ts&amp;line=329"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Flive-team-chat\.spec\.ts&amp;line=68"/);
  assert.match(template, /process-local/);
  assert.match(template, /not run/);
  assert.match(template, /<!-- COURSE_LESSON_NAV -->/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services)\//);
});

test("renders the Arena screen lesson from app entry through snapshot-driven display components", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0012-arena-screen");

  assert.ok(lesson, "coverage map includes the authored Lesson 12");
  assert.equal(lesson.order, 12);
  const expectedSourcePaths = [
    "frontend/src/App.tsx",
    "frontend/src/main.tsx",
    "frontend/src/components/ArenaPage.tsx",
    "frontend/src/components/ArenaWorkspace.tsx",
    "frontend/src/components/ArenaHeader.tsx",
    "frontend/src/components/DuelPanel.tsx",
    "frontend/src/components/MatchPanel.tsx",
    "frontend/src/components/MatchResult.tsx",
    "frontend/src/components/PhaseBanner.tsx",
    "frontend/src/components/RoundScoreReveal.tsx",
    "frontend/src/components/TeamPanel.tsx",
    "frontend/src/components/TestPanel.tsx",
    "frontend/src/components/status.ts",
    "frontend/src/index.css",
    "frontend/e2e/live-1v1.spec.ts",
    "frontend/e2e/live-2v2.spec.ts",
  ];
  for (const sourcePath of expectedSourcePaths) {
    assert.ok(lesson.references.some(({ path: referencePath }) => referencePath === sourcePath),
      `Lesson 12 maps ${sourcePath}`);
  }

  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: 16 }, lesson);
  assert.match(rendered, /data-lesson-id="0012-arena-screen"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2FApp\.tsx&amp;line=52"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fmain\.tsx&amp;line=6"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fcomponents%2FArenaPage\.tsx&amp;line=166"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fsrc%2Fcomponents%2FPhaseBanner\.tsx&amp;line=12"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Flive-1v1\.spec\.ts&amp;line=61"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Flive-2v2\.spec\.ts&amp;line=70"/);
  assert.match(template, /expired Match.*first shows the saved Round Reveal/);
  assert.match(template, /button changes only the presentation/);
  assert.match(template, /current snapshot computes the final result from saved Match state/);
  assert.match(template, /ordinary completion with time remaining, the page can render the Match result immediately/);
  assert.match(template, /initial-render tests do not click the presentation action/);
  assert.ok(lesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "frontend/src/components/ArenaPage.test.tsx" && startLine === 70 && endLine === 84,
  ), "Lesson 12 maps both terminal render assertions and their limits");
  assert.ok(lesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "packages/arena-game/src/engine.ts" && startLine === 845 && endLine === 900,
  ), "Lesson 12 maps Match snapshot and final-result projection");
  assert.match(template, /<!-- COURSE_LESSON_NAV -->/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/frontend\//);
});

test("renders the local-runtime lesson with honest service roles and setup links", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0013-running-the-project");

  assert.ok(lesson, "coverage map includes the authored Lesson 13");
  assert.equal(lesson.order, 13);
  const expectedSetupPaths = [
    ".env.example",
    ".gitignore",
    "docker-compose.yml",
    "frontend/index.html",
    "frontend/package.json",
    "frontend/playwright.config.ts",
    "frontend/tsconfig.json",
    "frontend/vite.config.ts",
    "infra/nginx/nginx.conf",
    "infra/postgres/init-db.sh",
    "package.json",
    "packages/arena-game/package.json",
    "packages/arena-game/tsconfig.build.json",
    "packages/arena-game/tsconfig.json",
    "packages/arena-harness/package.json",
    "packages/arena-harness/tsconfig.json",
    "packages/arena-model/package.json",
    "packages/arena-model/tsconfig.build.json",
    "packages/arena-model/tsconfig.json",
    "scripts/gen-dev-certs.sh",
    "scripts/play.sh",
    "services/chat/Dockerfile",
    "services/chat/package.json",
    "services/chat/src/app.module.ts",
    "services/chat/src/health.controller.ts",
    "services/chat/src/main.ts",
    "services/chat/tsconfig.json",
    "services/core/Dockerfile",
    "services/core/package.json",
    "services/core/src/app.module.ts",
    "services/core/src/health.controller.ts",
    "services/core/src/main.ts",
    "services/core/tsconfig.json",
    "services/game/Dockerfile",
    "services/game/package.json",
    "services/game/src/app.module.ts",
    "services/game/src/game/game.module.ts",
    "services/game/src/game/judge-factory.ts",
    "services/game/src/game/judge-factory.test.ts",
    "services/game/src/health.controller.ts",
    "services/game/src/main.ts",
    "services/game/tsconfig.json",
    "services/judge-worker/src/http-server.ts",
    "services/judge-worker/src/job-queue.ts",
    "services/judge-worker/src/main.ts",
    "services/judge-worker/src/readiness.ts",
  ];
  for (const sourcePath of expectedSetupPaths) {
    assert.ok(lesson.references.some(({ path: referencePath }) => referencePath === sourcePath),
      `Lesson 13 maps ${sourcePath}`);
  }
  for (const supportPath of ["package-lock.json", "frontend/.oxlintrc.json"]) {
    assert.ok(coverageMap.supportingFiles.some(({ path: supportFile }) => supportFile === supportPath),
      `${supportPath} stays discoverable as setup support`);
  }

  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: expectedSetupPaths.length }, lesson);
  assert.match(rendered, /data-lesson-id="0013-running-the-project"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=docker-compose\.yml&amp;line=1"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fgame\.module\.ts&amp;line=11"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fchat%2Fsrc%2Fhealth\.controller\.ts&amp;line=21"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Fsrc%2Fhttp-server\.ts&amp;line=183"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Fsrc%2Fjob-queue\.ts&amp;line=22"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fjudge-factory\.ts&amp;line=19"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Fsrc%2Freadiness\.ts&amp;line=31"/);
  assert.match(template, /deferred Chat skeleton/);
  assert.match(template, /no frontend container/);
  assert.match(template, /Compose sets <code>JUDGE_BACKEND=worker<\/code>/);
  assert.match(template, /WorkerJudgeAdapter/);
  assert.match(template, /JUDGE_WORKER_URL/);
  assert.match(template, /JUDGE_WORKER_TOKEN/);
  assert.match(template, /JUDGE_WORKER_TIMEOUT_MS/);
  assert.match(template, /JUDGE_WORKER_CONCURRENCY/);
  assert.match(template, /JUDGE_WORKER_MAX_QUEUE/);
  assert.match(template, /JUDGE_WORKER_QUEUE_TIMEOUT_MS/);
  assert.match(template, /JUDGE_WORKER_JOB_TIMEOUT_MS/);
  assert.match(template, /Docker socket into the Judge Worker only/);
  assert.match(template, /worker readiness checks Docker and required images/);
  assert.match(template, /Nginx does not publish or proxy the worker/);
  assert.match(template, /uses HTTP for local connections.*not evidence.*HTTPS requirement/);
  assert.match(template, /Never copy real secrets/);
  assert.match(template, /<!-- COURSE_LESSON_NAV -->/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services|infra|scripts)\//);
});

test("renders the test-evidence capstone and disposes every remaining source path", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0014-rewrite-with-tests");

  assert.ok(lesson, "coverage map includes the authored Lesson 14");
  assert.equal(lesson.order, 14);
  const expectedLessonPaths = [
    "frontend/src/arena/fixture.ts",
    "frontend/src/arena/mock-authority.ts",
    "frontend/src/arena/mock.ts",
    "frontend/src/components/EditorAdapter.test.ts",
    "frontend/test/live-config.test.ts",
    "frontend/test/mock-transport.test.ts",
    "frontend/test/transport-session.test.ts",
    "packages/arena-game/src/evaluation-telemetry.ts",
    "packages/arena-game/test/cross-isolation.test.ts",
    "packages/arena-game/test/evaluation-telemetry.test.ts",
    "packages/arena-game/test/lobby-atomic.test.ts",
    "services/judge-worker/test/http-server.test.ts",
    "services/judge-worker/test/job-queue.test.ts",
    "services/judge-worker/test/readiness.test.ts",
    "services/judge-worker/test/compose-topology.test.ts",
    "packages/arena-game/test/scripted-judge.ts",
    "packages/arena-game/test/setup.ts",
    "packages/arena-harness/src/fake-judge.ts",
    "packages/arena-harness/src/fixtures.ts",
    "packages/arena-harness/src/judge-port.ts",
    "packages/arena-harness/src/mock-game.ts",
    "packages/arena-harness/test/bank.test.ts",
    "packages/arena-harness/test/lifecycle.test.ts",
    "packages/arena-model/src/events.ts",
    "packages/arena-model/test/events.test.ts",
    "packages/arena-model/test/scoring.test.ts",
    "packages/arena-model/test/transitions.test.ts",
    "services/game/src/game/dev-fixture-gate.test.ts",
    "services/game/src/game/errors.ts",
    "services/game/src/game/service.test.ts",
  ];
  for (const sourcePath of expectedLessonPaths) {
    assert.ok(lesson.references.some(({ path: referencePath }) => referencePath === sourcePath),
      `Lesson 14 maps ${sourcePath}`);
  }
  const expectedSupportPaths = [
    "AGENTS.md",
    "CONTEXT.md",
    "packages/arena-game/src/index.ts",
    "packages/arena-game/src/principal.ts",
    "packages/arena-model/src/index.ts",
    "scripts/check-run-opencode-plan-launcher.sh",
    "scripts/finalize-opencode-run.sh",
    "spikes/judge-isolation/bench-compile-model.sh",
    "spikes/judge-isolation/spike.sh",
  ];
  for (const supportPath of expectedSupportPaths) {
    assert.ok(coverageMap.supportingFiles.some(({ path: supportFile }) => supportFile === supportPath),
      `${supportPath} has an explicit support-only disposition`);
  }

  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const rendered = renderLessonTemplate(template, "", "snapshot-id", { stale: 0, total: expectedLessonPaths.length }, lesson);
  assert.match(rendered, /data-lesson-id="0014-rewrite-with-tests"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=packages%2Farena-harness%2Fsrc%2Ffake-judge\.ts&amp;line=1"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fgame%2Fsrc%2Fgame%2Fservice\.test\.ts&amp;line=57"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Ftest%2Fhttp-server\.test\.ts&amp;line=90"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Ftest%2Fjob-queue\.test\.ts&amp;line=28"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Ftest%2Freadiness\.test\.ts&amp;line=5"/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=services%2Fjudge-worker%2Ftest%2Fcompose-topology\.test\.ts&amp;line=27"/);
  assert.match(rendered, /href="0007-judge-boundary\.html#trace"/);
  assert.match(rendered, /Twenty tests passed across the WorkerJudgeAdapter/);
  assert.match(rendered, /listen EPERM 127\.0\.0\.1/);
  assert.match(rendered, /href="\.\.\/source-map\.html\?file=frontend%2Fe2e%2Fcollab-reconnect\.spec\.ts&amp;line=270"/);
  assert.match(rendered, /href="\.\.\/\.\.\/\.\.\/prototype\/game-ui\/42-subject-compliance\.md#L60"/);
  assert.match(rendered, /href="\.\.\/\.\.\/\.\.\/prototype\/game-ui\/42-subject-compliance\.md#L237"/);
  assert.doesNotMatch(rendered, /source-map\.html\?file=prototype%2Fgame-ui%2F42-subject-compliance\.md/);
  assert.match(rendered, /PASS only when the equivalent test in your rewrite ran and passed/);
  assert.match(rendered, /PostgreSQL-only proofs were skipped/);
  assert.match(template, /WorkerJudgeAdapter unit tests/);
  assert.match(template, /Judge Worker service tests/);
  assert.match(template, /Compose topology test/);
  assert.match(template, /Container security tests/);
  assert.match(template, /npx vitest run packages\/arena-game\/test\/worker-judge\.test\.ts packages\/arena-game\/test\/container-judge-trust\.test\.ts services\/game\/src\/game\/judge-factory\.test\.ts services\/judge-worker\/test\/\*\.test\.ts/);
  assert.match(rendered, /does not establish hidden-case confidentiality/);
  assert.match(rendered, /42-subject-compliance\.md/);
  assert.match(rendered, /team sign-off/);
  assert.match(template, /<!-- COURSE_LESSON_NAV -->/);
  assert.match(template, /CodeTour 6/);
  assert.doesNotMatch(rendered, /href="\.\.\/\.\.\/\.\.\/(?:frontend|packages|services|infra|scripts)\//);

  const readme = await readFile(path.join(learningDir, "README.md"), "utf8");
  assert.match(readme, /14 short lessons/);
  assert.match(readme, /Learn: Course Home/);
  assert.match(readme, /\[Before Lesson 1\]\(lessons\/0000-before-lesson-one\.html\)/);
  assert.equal([...readme.matchAll(/lessons\/\d{4}-[^)]+\.html/g)].length, 1);
});

test("rejects lesson template links outside their cited coverage ranges", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-template-links-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await writeFile(path.join(repoRoot, "src/engine.ts"), "line one\nline two\nline three\n");
    await writeFile(
      path.join(learningDir, "templates/lesson.html"),
      '<a href="../../../src/engine.ts#L2">inside</a><a href="../../../src/engine.ts#L3">outside</a>',
    );
    const coverageMap = makeCoverageMap({
      roots: ["src"],
      lessons: [lessonRecord({ template: "templates/lesson.html", references: [
        { path: "src/engine.ts", startLine: 1, endLine: 2 },
      ] })],
    });
    const data = await buildCatalogData({ repoRoot, learningDir, coverageMap });
    assert.equal(data.templateLinkIssues.length, 1);
    assert.equal(data.templateLinkIssues[0].line, 3);
    assert.match(formatAuditReport(data), /outside cited range/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("allows out-of-scope doc links without a coverage record when the file exists", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-doc-links-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(repoRoot, "docs"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await writeFile(path.join(repoRoot, "src/engine.ts"), "export const engine = true;\n");
    await writeFile(path.join(repoRoot, "docs/notes.md"), "Notes.\n");
    await writeFile(path.join(learningDir, "templates/lesson.html"), '<a href="../../../src/engine.ts#L1">code</a><a href="../../../docs/notes.md#L1">doc</a>');
    await writeFile(path.join(learningDir, "README.md"), "Course.\n");
    const coverageMap = makeCoverageMap({
      roots: ["src"],
      excluded: [{ path: "docs", reason: "Reference docs." }],
      lessons: [lessonRecord({ template: "templates/lesson.html", references: [
        { path: "src/engine.ts", startLine: 1, endLine: 1 },
      ] })],
    });
    const issues = await auditTemplateLinks({
      lessons: coverageMap.lessons,
      scope: coverageMap.scope,
      learningDir,
      repoRoot,
    });
    assert.deepEqual(issues, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("requires affected lessons to be reviewed before accepting a snapshot", async () => {
  const affected = [{ lessonId: "0001-submit-journey" }, { lessonId: "0002-reveal-cutoff" }];
  assert.deepEqual(missingLessonReviews({ affectedLessons: affected, reviewedLessons: ["0001-submit-journey"] }), ["0002-reveal-cutoff"]);
  assert.deepEqual(missingLessonReviews({ affectedLessons: affected, reviewedLessons: ["0001-submit-journey", "0002-reveal-cutoff"] }), []);
  assert.deepEqual(missingLessonReviews({ affectedLessons: [], reviewedLessons: [] }), []);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-review-gate-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(repoRoot, ".tours"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await mkdir(path.join(learningDir, "assets"), { recursive: true });
    await writeFile(path.join(repoRoot, "src/engine.ts"), "export const engine = true;\n");
    await writeFile(path.join(learningDir, "templates/lesson.html"), "<h1>Lesson</h1><!-- COURSE_LESSON_NAV -->");
    await writeFile(
      path.join(learningDir, "assets/course.css"),
      await readFile(new URL("../assets/course.css", import.meta.url), "utf8"),
    );
    await writeActivityRuntimeFixture(learningDir);
    await writeFile(
      path.join(learningDir, "templates/source-map.template.html"),
      await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8"),
    );
    const coverageMap = makeCoverageMap({
      roots: ["src"],
      lessons: [lessonRecord({ template: "templates/lesson.html", references: [
        { path: "src/engine.ts", startLine: 1, endLine: 1 },
      ] })],
    });
    const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, {
      referenceSnapshot: makeReferenceSnapshot(new Map([["src/engine.ts", "a".repeat(64)]])),
      tours: [],
    });
    assert.equal(typeof acceptReviewedSnapshot, "function");
    await assert.rejects(
      acceptReviewedSnapshot({
        repoRoot,
        learningDir,
        files: new Map([["src/engine.ts", sha256("export const engine = true;\n")]]),
        gitHead: "e".repeat(40),
        recordedAt: "2026-09-26T13:00:00.000Z",
        auditData: rendered.data,
        worktreeStatus: "clean",
        reviewedLessons: [],
      }),
      /unreviewed lessons: 0001-submit-journey/,
    );
    const accepted = await acceptReviewedSnapshot({
      repoRoot,
      learningDir,
      files: new Map([["src/engine.ts", sha256("export const engine = true;\n")]]),
      gitHead: "e".repeat(40),
      recordedAt: "2026-09-26T13:00:00.000Z",
      auditData: rendered.data,
      worktreeStatus: "clean",
      reviewedLessons: ["0001-submit-journey"],
    });
    assert.deepEqual(accepted.snapshot.lessonReviews, ["0001-submit-journey"]);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("checks README order or Course Home delegation against the single coverage order", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-order-"));
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    const lessons = [
      lessonRecord({ id: "0001-first", order: 1, title: "First", template: "templates/first.html", output: "lessons/first.html" }),
      lessonRecord({ id: "0002-second", order: 2, title: "Second", template: "templates/second.html", output: "lessons/second.html" }),
    ];
    await writeFile(path.join(learningDir, "templates/first.html"), '<nav><!-- COURSE_LESSON_NAV --></nav>');
    await writeFile(path.join(learningDir, "templates/second.html"), '<nav><!-- COURSE_LESSON_NAV --></nav>');
    await writeFile(path.join(learningDir, "README.md"), "[First](lessons/first.html)\n[Second](lessons/second.html)\n");
    assert.deepEqual(await auditCourseOrder({ lessons, learningDir }), []);

    await writeFile(
      path.join(learningDir, "README.md"),
      "[Before Lesson 1](lessons/0000-before-lesson-one.html)\n[Course Home](index.html#build-path)\n",
    );
    assert.deepEqual(await auditCourseOrder({ lessons, learningDir }), [], "the generated Course Home owns the ordered lesson list");

    await writeFile(path.join(learningDir, "README.md"), "[Second](lessons/second.html)\n[First](lessons/first.html)\n");
    const readmeDrift = await auditCourseOrder({ lessons, learningDir });
    assert.equal(readmeDrift.some((issue) => issue.kind === "readme-order"), true);

    await writeFile(path.join(learningDir, "README.md"), "Course start page without lesson links.\n");
    const missingReadmeLessons = await auditCourseOrder({ lessons, learningDir });
    assert.equal(missingReadmeLessons.some((issue) => issue.kind === "readme-order"), true);

    await writeFile(path.join(learningDir, "README.md"), "[First](lessons/first.html)\n[Second](lessons/second.html)\n");
    await writeFile(path.join(learningDir, "templates/second.html"), '<nav><!-- COURSE_LESSON_NAV --><!-- COURSE_LESSON_NAV --></nav>');
    const wrongNavTarget = await auditCourseOrder({ lessons, learningDir });
    assert.equal(wrongNavTarget.some((issue) => issue.kind === "nav-order"), true);
    await writeFile(path.join(learningDir, "templates/second.html"), '<nav>No generated navigation</nav>');
    const navDrift = await auditCourseOrder({ lessons, learningDir });
    assert.equal(navDrift.some((issue) => issue.kind === "nav-order"), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("requires every lesson review when creating the first source snapshot", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "code-arena-initial-review-"));
  const repoRoot = path.join(tempRoot, "repo");
  const learningDir = path.join(tempRoot, "learning");
  try {
    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await mkdir(path.join(repoRoot, ".tours"), { recursive: true });
    await mkdir(path.join(learningDir, "templates"), { recursive: true });
    await mkdir(path.join(learningDir, "assets"), { recursive: true });
    const source = "export const engine = true;\n";
    await writeFile(path.join(repoRoot, "src/engine.ts"), source);
    await writeFile(path.join(learningDir, "templates/lesson.html"), "<h1>Lesson</h1><!-- COURSE_LESSON_NAV -->");
    await writeFile(
      path.join(learningDir, "assets/course.css"),
      await readFile(new URL("../assets/course.css", import.meta.url), "utf8"),
    );
    await writeActivityRuntimeFixture(learningDir);
    await writeFile(
      path.join(learningDir, "templates/source-map.template.html"),
      await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8"),
    );
    const coverageMap = makeCoverageMap({
      roots: ["src"],
      lessons: [lessonRecord({ template: "templates/lesson.html", references: [
        { path: "src/engine.ts", startLine: 1, endLine: 1 },
      ] })],
    });
    const initial = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [] });
    assert.equal(initial.data.referenceSnapshotId, null);
    await assert.rejects(
      acceptReviewedSnapshot({
        repoRoot,
        learningDir,
        files: new Map([["src/engine.ts", sha256(source)]]),
        gitHead: "e".repeat(40),
        recordedAt: "2026-09-26T13:00:00.000Z",
        auditData: initial.data,
        reviewedLessons: [],
      }),
      /unreviewed lessons: 0001-submit-journey/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("teaches Match-deadline closure and cites its source evidence", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lessonTemplate = async (id) => {
    const lesson = coverageMap.lessons.find((item) => item.id === id);
    assert.ok(lesson, `coverage map includes ${id}`);
    return { lesson, template: await readFile(path.join(learningDir, lesson.template), "utf8") };
  };
  const { lesson: revealLesson, template: revealTemplate } = await lessonTemplate("0002-reveal-cutoff");
  const { lesson: scoreLesson, template: scoreTemplate } = await lessonTemplate("0003-rounds-and-final-score");
  const { lesson: submitLesson, template: submitTemplate } = await lessonTemplate("0001-submit-journey");

  assert.match(revealTemplate, /Match deadline/);
  assert.match(revealTemplate, /bounded reveal grace/);
  assert.match(revealTemplate, /sweepExpiredMatches/);
  assert.match(revealTemplate, /MATCH_COMPLETE/);
  assert.match(revealTemplate, /unplayed Rounds contribute zero/i);
  assert.match(scoreTemplate, /persists the current Round Reveal/i);
  assert.match(scoreTemplate, /MATCH_COMPLETE/);
  assert.match(scoreTemplate, /computed from the saved counted Round records/i);
  assert.match(scoreTemplate, /unplayed Rounds contribute zero/i);
  assert.match(scoreTemplate, /UI stages their presentation/i);
  assert.match(submitTemplate, /WorkerJudgeAdapter/);
  assert.match(submitTemplate, /Compose selects the worker provider/);
  assert.ok(submitLesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "docker-compose.yml" && startLine === 92 && endLine === 97,
  ));
  for (const [sourcePath, startLine, endLine] of [
    ["services/game/src/game/game.service.ts", 216, 221],
    ["packages/arena-game/src/engine.ts", 547, 569],
    ["packages/arena-game/src/engine.ts", 646, 668],
    ["packages/arena-game/src/engine.ts", 708, 724],
    ["packages/arena-game/src/evaluation-orchestration.ts", 191, 234],
  ]) {
    assert.ok(submitLesson.references.some((reference) =>
      reference.path === sourcePath && reference.startLine === startLine && reference.endLine === endLine,
    ), `Lesson 1 maps the current ${sourcePath}:${startLine}-${endLine} implementation`);
  }
  assert.ok(revealLesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "packages/arena-game/test/deadline-closure.test.ts" && startLine === 11,
  ));
  assert.ok(revealLesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "packages/arena-game/test/deadline-closure.test.ts" && startLine === 69,
  ));
  assert.ok(scoreLesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "packages/arena-game/test/deadline-closure.test.ts" && startLine === 23,
  ));
  assert.ok(scoreLesson.references.some(({ path: sourcePath, startLine }) =>
    sourcePath === "packages/arena-game/test/deadline-closure.test.ts" && startLine === 69,
  ));
  assert.ok(scoreLesson.references.some(({ path: sourcePath }) => sourcePath === "frontend/src/components/ArenaPage.test.tsx"));
  assert.ok(scoreLesson.references.some(({ path: sourcePath, startLine, endLine }) =>
    sourcePath === "packages/arena-game/src/evaluation-orchestration.ts" && startLine === 472 && endLine === 480,
  ));
});

test("teaches invitation-only Lobby recovery and cites authoritative reconciliation evidence", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const lesson = coverageMap.lessons.find(({ id }) => id === "0004-lobby-to-match");
  assert.ok(lesson, "coverage map includes Lesson 4");
  const template = await readFile(path.join(learningDir, lesson.template), "utf8");
  const lobbyPage = await readFile(path.join(repoRoot, "frontend/src/components/LobbyPage.tsx"), "utf8");
  const lobbyClient = await readFile(path.join(repoRoot, "frontend/src/arena/lobby.ts"), "utf8");
  const lobbyDomain = await readFile(path.join(repoRoot, "packages/arena-game/src/lobby.ts"), "utf8");

  assert.match(template, /invitation-only/i);
  assert.match(template, /socket payloads are refresh hints/i);
  assert.match(template, /stale responses are discarded/i);
  assert.match(template, /public queue backend code remains for a future release/i);
  assert.doesNotMatch(template, /two current ways to gather players/i);
  assert.match(lobbyPage, /INVITATION-ONLY ENTRY/);
  assert.doesNotMatch(lobbyPage, /joinQueue|Quick Play/);
  assert.match(lobbyClient, /async joinQueue\(/);
  assert.match(lobbyDomain, /async tryMatch\(/);
  for (const [sourcePath, startLine, endLine] of [
    ["frontend/src/arena/lobby-session.ts", 83, 122],
    ["frontend/src/arena/lobby-session.ts", 162, 199],
    ["frontend/src/arena/lobby-session.test.ts", 64, 87],
    ["frontend/src/arena/lobby-session.test.ts", 89, 131],
    ["frontend/src/arena/lobby-session.test.ts", 133, 183],
    ["frontend/src/components/LobbyPage.tsx", 311, 352],
    ["frontend/e2e/live-lobby.spec.ts", 109, 126],
  ]) {
    assert.ok(lesson.references.some((reference) =>
      reference.path === sourcePath && reference.startLine === startLine && reference.endLine === endLine,
    ), `Lesson 4 maps the current ${sourcePath}:${startLine}-${endLine} behavior`);
  }
});

test("tracks planned dispositions and the exact remaining source files", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const data = await buildCatalogData({ repoRoot, learningDir, coverageMap });
  const lessonIdsByPath = new Map();
  for (const lesson of coverageMap.lessons) {
    for (const reference of lesson.references) {
      const ids = lessonIdsByPath.get(reference.path) ?? [];
      if (!ids.includes(lesson.id)) ids.push(lesson.id);
      lessonIdsByPath.set(reference.path, ids);
    }
  }

  const taughtByLesson = {
    "frontend/src/arena/lobby-session.ts": ["0004-lobby-to-match"],
    "frontend/src/arena/lobby-session.test.ts": ["0004-lobby-to-match"],
    "frontend/src/components/ArenaPage.test.tsx": ["0003-rounds-and-final-score", "0012-arena-screen"],
    "packages/arena-game/test/deadline-closure.test.ts": ["0002-reveal-cutoff", "0003-rounds-and-final-score"],
    "packages/arena-game/test/post-commit-events.test.ts": ["0008-persistence-recovery", "0009-live-connection"],
    "packages/arena-game/src/worker-judge.ts": ["0001-submit-journey", "0007-judge-boundary"],
    "packages/arena-game/test/worker-judge.test.ts": ["0007-judge-boundary"],
    "packages/arena-game/test/container-judge-trust.test.ts": ["0007-judge-boundary"],
    "services/game/src/game/judge-factory.ts": ["0001-submit-journey", "0007-judge-boundary", "0013-running-the-project"],
    "services/game/src/game/judge-factory.test.ts": ["0007-judge-boundary", "0013-running-the-project"],
    "services/judge-worker/src/http-server.ts": ["0013-running-the-project"],
    "services/judge-worker/src/job-queue.ts": ["0013-running-the-project"],
    "services/judge-worker/src/main.ts": ["0013-running-the-project"],
    "services/judge-worker/src/readiness.ts": ["0013-running-the-project"],
    "services/judge-worker/test/http-server.test.ts": ["0014-rewrite-with-tests"],
    "services/judge-worker/test/job-queue.test.ts": ["0014-rewrite-with-tests"],
    "services/judge-worker/test/readiness.test.ts": ["0014-rewrite-with-tests"],
    "services/judge-worker/test/compose-topology.test.ts": ["0014-rewrite-with-tests"],
  };
  const supportingPaths = [
    "services/judge-worker/Dockerfile",
    "services/judge-worker/docker-entrypoint.sh",
    "services/judge-worker/package.json",
    "services/judge-worker/tsconfig.build.json",
    "services/judge-worker/tsconfig.json",
  ];
  const expectedPendingLessons = {};
  const expectedRemaining = [];
  const expectedRemainingSet = new Set(expectedRemaining);

  assert.deepEqual(data.uncoveredFiles.map(({ path: filePath }) => filePath), expectedRemaining);
  assert.deepEqual(data.unclassified.map(({ path: filePath }) => filePath), []);
  for (const [filePath, expectedLessonIds] of Object.entries(taughtByLesson)) {
    const pendingLessonIds = expectedPendingLessons[filePath] ?? [];
    const expectedLessonIdsNow = expectedRemainingSet.has(filePath)
      ? []
      : expectedLessonIds.filter((id) => !pendingLessonIds.includes(id));
    assert.deepEqual(lessonIdsByPath.get(filePath) ?? [], expectedLessonIdsNow, `${filePath} has its current lesson disposition`);
    for (const pendingLessonId of pendingLessonIds) {
      assert.ok(expectedLessonIds.includes(pendingLessonId), `${pendingLessonId} is a planned lesson disposition`);
    }
    if (expectedLessonIdsNow.length === 0) {
      assert.ok(expectedRemainingSet.has(filePath), `${filePath} is one of the explicitly pending source paths`);
    }
  }
  for (const filePath of supportingPaths) {
    const supporting = coverageMap.supportingFiles.find((item) => item.path === filePath);
    if (supporting) {
      assert.ok(supporting.reason.includes("Lesson 13"), `${filePath} has an explicit build-support reason`);
      assert.ok(supporting.reason.includes("Compose/runtime anchors"), `${filePath} is supported by Lesson 13's Compose/runtime topology`);
      assert.ok(supporting.reason.includes("supporting build configuration"), `${filePath} remains build configuration, not a second behavior lesson`);
    } else {
      assert.ok(expectedRemainingSet.has(filePath), `${filePath} is pending its explicit build-support reason`);
    }
  }
  assert.ok(coverageMap.scope.excluded.some(({ path: excludedPath, reason }) =>
    excludedPath === ".codex" && reason === "Agent planning state; it is neither game runtime nor learner course content.",
  ));
});

test("keeps refreshed gameplay lessons on current source anchors", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const expectedReferences = {
    "0005-problem-editor-run": [
      ["packages/arena-game/src/engine.ts", 845, 900],
      ["frontend/src/components/ArenaPage.tsx", 139, 154],
      ["packages/arena-game/src/engine.ts", 477, 545],
      ["packages/arena-game/src/engine.ts", 645, 692],
    ],
    "0006-evaluation-retries": [
      ["packages/arena-game/src/engine.ts", 581, 603],
      ["packages/arena-game/src/engine.ts", 616, 637],
      ["packages/arena-game/src/evaluation-orchestration.ts", 191, 216],
    ],
    "0010-team-collaboration": [
      ["packages/arena-game/src/engine.ts", 378, 420],
      ["packages/arena-game/src/engine.ts", 547, 579],
      ["packages/arena-game/test/team-2v2.test.ts", 289, 338],
      ["packages/arena-game/test/team-2v2.test.ts", 388, 417],
    ],
    "0009-live-connection": [
      ["packages/arena-game/src/engine.ts", 845, 852],
    ],
  };

  for (const [lessonId, expected] of Object.entries(expectedReferences)) {
    const lesson = coverageMap.lessons.find(({ id }) => id === lessonId);
    assert.ok(lesson, `coverage map includes ${lessonId}`);
    for (const [sourcePath, startLine, endLine] of expected) {
      assert.ok(lesson.references.some((reference) =>
        reference.path === sourcePath && reference.startLine === startLine && reference.endLine === endLine,
      ), `${lessonId} maps the reviewed ${sourcePath}:${startLine}-${endLine} behavior`);
    }
  }

  const anchors = {
    "0005-problem-editor-run": [
      ["packages/arena-game/src/engine.ts", 845],
      ["frontend/src/components/ArenaPage.tsx", 139],
      ["packages/arena-game/src/engine.ts", 477],
      ["packages/arena-game/src/engine.ts", 645],
    ],
    "0006-evaluation-retries": [
      ["packages/arena-game/src/engine.ts", 581],
      ["packages/arena-game/src/engine.ts", 616],
      ["packages/arena-game/src/evaluation-orchestration.ts", 191],
    ],
    "0010-team-collaboration": [
      ["packages/arena-game/src/engine.ts", 378],
      ["packages/arena-game/src/engine.ts", 547],
      ["packages/arena-game/test/team-2v2.test.ts", 305],
      ["packages/arena-game/test/team-2v2.test.ts", 388],
    ],
    "0009-live-connection": [
      ["packages/arena-game/src/engine.ts", 845],
    ],
  };
  for (const [lessonId, expected] of Object.entries(anchors)) {
    const lesson = coverageMap.lessons.find(({ id }) => id === lessonId);
    const template = await readFile(path.join(learningDir, lesson.template), "utf8");
    for (const [sourcePath, line] of expected) {
      assert.ok(template.includes(`../../../${sourcePath}#L${line}`), `${lessonId} links ${sourcePath}:${line}`);
    }
  }
});

test("renders orientation before the fourteen trace lessons", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
  const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath });
  const home = rendered.files.get(path.join(learningDir, "index.html"));
  const orientation = rendered.files.get(path.join(learningDir, "lessons/0000-before-lesson-one.html"));
  assert.match(home, /data-course-start href="lessons\/0000-before-lesson-one.html">Start with the map/);
  assert.match(home, /id="build-path"/);
  assert.equal((home.match(/data-build-step=/g) ?? []).length, 8);
  assert.equal((home.match(/data-lesson-link=/g) ?? []).length, 14);
  assert.match(orientation, /Find the homes/);
  assert.match(orientation, /packages\/arena-game\/src/);
  assert.match(orientation, /fixed clock/);
});

test("every trace lesson explains its build use without treating reference tests as parity", async () => {
  const repoRoot = process.cwd();
  const learningDir = path.join(repoRoot, ".tours/learning");
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
  const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath });
  for (const lesson of coverageMap.lessons) {
    const page = rendered.files.get(path.join(learningDir, lesson.output));
    assert.match(page, /data-build-card=/, lesson.id + " has build context");
    assert.match(page, /What must exist first/);
    assert.match(page, /Your teammate's repo/);
    assert.match(page, /Pattern:/);
    assert.match(page, /data-build-source/);
    assert.match(page, /data-build-test/);
  }
  const lessonOne = rendered.files.get(path.join(learningDir, "lessons/0001-follow-one-submit.html"));
  assert.match(lessonOne, /Before coding Submit/);
  assert.match(lessonOne, /0000-before-lesson-one.html/);
  const last = rendered.files.get(path.join(learningDir, "lessons/0014-rewrite-with-tests.html"));
  assert.match(last, /index.html#build-path/);
  assert.doesNotMatch(last, /<li><strong>Build the small domain core/);
  const unsafePath = structuredClone(learningPath);
  unsafePath.steps[0].why = "<script>alert(1)</script>";
  const escaped = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath: unsafePath });
  const lessonThirteen = escaped.files.get(path.join(learningDir, "lessons/0013-running-the-project.html"));
  assert.match(lessonThirteen, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(lessonThirteen, /<script>alert\(1\)<\/script>/);
});
