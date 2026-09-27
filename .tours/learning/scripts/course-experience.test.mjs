import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { COURSE_ACTIVITY_KEY } from "../assets/course-activity.mjs";
import { renderCatalogOutputs } from "./build-catalog.mjs";

const repoRoot = process.cwd();
const learningDir = path.join(repoRoot, ".tours/learning");
const lessonId = "0001-submit-journey";
let lessonOutput;
let browser;
let fixtureDirectory;
let server;
let serverBaseUrl;

async function createRenderedFixture() {
  fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "code-arena-course-experience-"));
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const learningPath = JSON.parse(await readFile(path.join(learningDir, "learning-path.json"), "utf8"));
  lessonOutput = coverageMap.lessons.find((lesson) => lesson.id === lessonId).output;
  const rendered = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, { tours: [], learningPath });
  for (const [outputPath, contents] of rendered.files) {
    const relativeOutput = path.relative(learningDir, outputPath);
    const destination = path.join(fixtureDirectory, relativeOutput);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }

  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (pathname === "/favicon.ico") {
      response.statusCode = 204;
      response.end();
      return;
    }
    const file = path.join(fixtureDirectory, pathname.replace(/^\/+/, ""));
    try {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  serverBaseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function tabUntil(page, selector, maxTabs = 80) {
  const target = page.locator(selector).first();
  for (let index = 0; index < maxTabs; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return true;
    await page.keyboard.press("Tab");
  }
  return false;
}

async function readStartText(page) {
  return (await page.locator("[data-course-start]").innerText()).replace(/\s+/g, " ").trim();
}

function route(mode, relativePath) {
  if (mode === "file") return pathToFileURL(path.join(fixtureDirectory, relativePath)).href;
  return `${serverBaseUrl}/${relativePath}`;
}

before(async () => {
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  await createRenderedFixture();
});

after(async () => {
  await browser?.close();
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
});

test("a complete first lesson session works from a direct file and local server", async (t) => {
  for (const mode of ["file", "server"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const browserErrors = [];
    t.after(() => context.close());
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") browserErrors.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    await page.goto(route(mode, "index.html"));
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        // The explicit blocked-storage scenario below covers this browser policy.
      }
    });
    const canPersist = await page.evaluate(() => {
      try {
        localStorage.setItem("course-experience-probe", "ok");
        localStorage.removeItem("course-experience-probe");
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(await readStartText(page), "Start with the map →");
    assert.equal(await page.locator("[data-lesson-link]").count(), 14);
    assert.equal(await page.locator("[data-build-step]").count(), 8);
    assert.equal(await tabUntil(page, "[data-build-step] a"), true, `${mode}: keyboard reaches the build map`);

    assert.equal(await tabUntil(page, "a[aria-current='page']"), true, `${mode}: keyboard reaches Learn`);
    assert.equal(await tabUntil(page, "a[href='source-map.html']"), true, `${mode}: keyboard reaches Explore code`);
    assert.equal(await tabUntil(page, "[data-course-start]"), true, `${mode}: keyboard reaches Start`);
    for (const lessonLink of await page.locator("[data-lesson-link]").evaluateAll((links) => links.map((link) => `[data-lesson-link='${link.dataset.lessonLink}']`))) {
      assert.equal(await tabUntil(page, lessonLink), true, `${mode}: keyboard reaches ${lessonLink}`);
    }

    const startHref = await page.locator("[data-course-start]").getAttribute("href");
    assert.equal(startHref, "lessons/0000-before-lesson-one.html");
    await page.locator("[data-course-start]").click({ noWaitAfter: true });
    await page.waitForTimeout(100);
    assert.ok(new URL(page.url()).pathname.endsWith("lessons/0000-before-lesson-one.html"), `${mode}: Start opens orientation`);
    assert.equal(await page.locator("#homes-title").isVisible(), true, `${mode}: orientation explains where code lives`);
    await page.goto(route(mode, lessonOutput));
    assert.equal(await page.locator("#trace").isVisible(), true, "the full trace is visible before any prediction answer");
    assert.equal(await page.locator("#recall").isVisible(), true, "the retrieval prompt is visible before any prediction answer");
    if (canPersist) {
      await page.waitForFunction((key) => {
        const record = JSON.parse(localStorage.getItem(key) ?? "null");
        return record?.lastLessonId === "0001-submit-journey" && record.lessons?.["0001-submit-journey"] === "started";
      }, COURSE_ACTIVITY_KEY);
    } else {
      assert.equal(await page.locator("[data-course-storage-unavailable]").isVisible(), true);
    }

    await page.locator("#quiz-authority [data-answer='toolbar']").click();
    assert.match(await page.locator("#authority-feedback").innerText(), /Not quite/);
    assert.equal(await page.locator("#trace").isVisible(), true, "a wrong guess does not hide the trace");
    await page.locator("#quiz-authority [data-answer='engine']").click();
    assert.match(await page.locator("#authority-feedback").innerText(), /Exactly/);
    assert.equal(await page.locator("#trace").isVisible(), true, "a correct guess leaves the trace available");
    await page.locator("#quiz-phase [data-answer='route']").click();
    assert.match(await page.locator("#phase-feedback").innerText(), /Look for/);
    await page.locator("#quiz-phase [data-answer='engine']").click();
    assert.match(await page.locator("#phase-feedback").innerText(), /Right/);

    assert.match(await page.locator("[data-course-self-check-note]").innerText(), /This records activity on this browser\. It is not proof of mastery or rewrite parity\./);
    await page.locator("[data-course-self-check]").click();
    assert.equal((await page.locator("[data-course-self-check-status]").innerText()).trim(), "Self-check recorded");
    assert.doesNotMatch((await page.locator("[data-course-self-check-status]").innerText()).toLowerCase(), /mastery|completed|passed/);
    if (canPersist) {
      await page.waitForFunction((key) => {
        const record = JSON.parse(localStorage.getItem(key) ?? "null");
        return record?.lessons?.["0001-submit-journey"] === "self-check-recorded";
      }, COURSE_ACTIVITY_KEY);
    }

    await page.locator("a[data-course-home]").click();
    await page.waitForURL(/index\.html$/);
    const homeActivityStatus = (await page.locator(`[data-course-activity-status='${lessonId}']`).innerText()).trim();
    if (canPersist) {
      assert.equal(homeActivityStatus, "Self-check recorded", `${mode}: activity returns with the learner to Course Home`);
      assert.equal(await readStartText(page), "Continue Lesson 1");
    } else {
      assert.equal(await readStartText(page), "Start with the map →");
      assert.equal(await page.locator("[data-course-storage-unavailable]").isVisible(), true);
    }

    await page.goto(route(mode, lessonOutput));
    assert.equal(await tabUntil(page, "#quiz-authority [data-answer='toolbar']"), true, `${mode}: keyboard reaches prediction controls`);
    assert.equal(await tabUntil(page, "a[data-source-id]"), true, `${mode}: keyboard reaches source citations`);
    assert.equal(await tabUntil(page, "a[data-course-home]"), true, `${mode}: keyboard reaches Course Home`);
    assert.equal(await tabUntil(page, "a[data-course-explore]"), true, `${mode}: keyboard reaches Explore code from a lesson`);
    assert.equal(await tabUntil(page, "a[data-next-lesson]"), true, `${mode}: keyboard reaches next lesson`);
    await page.goto(route(mode, "lessons/0002-reveal-cutoff.html"));
    assert.equal(await tabUntil(page, "a[data-previous-lesson]"), true, `${mode}: keyboard reaches previous lesson`);

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(route(mode, lessonOutput));
    const mobileLayout = await page.evaluate(() => {
      const actions = [...document.querySelectorAll("[data-course-home], [data-course-explore], [data-next-lesson], [data-previous-lesson], #quiz-authority button, #quiz-phase button, [data-course-self-check]")];
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        actionHeights: actions.map((action) => Math.round(action.getBoundingClientRect().height)),
      };
    });
    assert.ok(mobileLayout.documentWidth <= mobileLayout.viewportWidth, `${mode}: 320px lesson has no horizontal overflow`);
    assert.ok(mobileLayout.actionHeights.every((height) => height >= 44), `${mode}: main actions are at least 44px high`);
    await page.goto(route(mode, "lessons/0000-before-lesson-one.html"));
    assert.equal(await tabUntil(page, "a[href='../index.html#build-path']"), true, `${mode}: keyboard reaches the build map from orientation`);
    const orientationLayout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      mapLinkHeight: Math.round(document.querySelector("a[href='../index.html#build-path']").getBoundingClientRect().height),
    }));
    assert.ok(orientationLayout.documentWidth <= orientationLayout.viewportWidth, `${mode}: 320px orientation has no horizontal overflow`);
    assert.ok(orientationLayout.mapLinkHeight >= 44, `${mode}: orientation map link is at least 44px high`);
    assert.deepEqual(browserErrors, [], `${mode}: no console warnings or errors`);
    await context.close();
  }
});

test("malformed and blocked storage keep Start and every lesson link usable", async (t) => {
  for (const scenario of ["malformed", "blocked"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const browserErrors = [];
    t.after(() => context.close());
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") browserErrors.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    if (scenario === "malformed") {
      await page.addInitScript((key) => {
        try {
          localStorage.setItem(key, "{not valid JSON");
        } catch {
          // Other assertions below still verify the route remains usable.
        }
      }, COURSE_ACTIVITY_KEY);
    } else {
      await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get() { throw new DOMException("Storage is disabled", "SecurityError"); },
        });
      });
    }

    await page.goto(route("server", "index.html"));
    assert.equal(await readStartText(page), "Start with the map →");
    assert.equal(await page.locator("[data-build-step]").count(), 8);
    assert.equal(await page.locator("[data-lesson-link]").count(), 14);
    assert.equal(await page.locator("[data-lesson-link]").evaluateAll((links) => links.every((link) => link.getAttribute("href") && !link.hasAttribute("disabled"))), true);
    assert.equal(await page.locator("[data-course-storage-unavailable]").isVisible(), scenario === "blocked");
    const startHref = await page.locator("[data-course-start]").getAttribute("href");
    assert.equal(startHref, "lessons/0000-before-lesson-one.html");
    await page.locator("[data-course-start]").click({ noWaitAfter: true });
    await page.waitForTimeout(100);
    assert.ok(new URL(page.url()).pathname.endsWith("lessons/0000-before-lesson-one.html"), `${scenario}: Start opens orientation`);
    assert.equal(await page.locator("#homes-title").isVisible(), true, `${scenario}: orientation stays available`);
    await page.goto(route("server", lessonOutput));
    assert.equal(await page.locator("#trace").isVisible(), true, `${scenario}: lesson content remains available`);
    assert.equal(await page.locator("#quiz-authority button").count(), 4);
    await page.locator("#quiz-authority [data-answer='engine']").click();
    assert.match(await page.locator("#authority-feedback").innerText(), /Exactly/);
    assert.deepEqual(browserErrors, [], `${scenario}: no console warnings or errors with unavailable course storage`);
    await context.close();
  }
});

test("Course Home and core lessons stay usable at desktop and 320 CSS pixels", async (t) => {
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const coreLessonIds = [
    "0001-submit-journey",
    "0004-lobby-to-match",
    "0007-judge-boundary",
    "0012-arena-screen",
    "0014-rewrite-with-tests",
  ];
  const coreLessonOutputs = coreLessonIds.map((id) => {
    const lesson = coverageMap.lessons.find((item) => item.id === id);
    assert.ok(lesson, `coverage map includes ${id}`);
    return lesson.output;
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const browserErrors = [];
  t.after(() => page.close());
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") browserErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 800 : 900 });
    await page.goto(route("server", "index.html"));
    const home = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      actions: [...document.querySelectorAll("[data-course-start], [data-build-step] a, [data-lesson-link]")]
        .map((element) => Math.round(element.getBoundingClientRect().height)),
    }));
    assert.ok(home.pageWidth <= home.viewportWidth, `Course Home has no horizontal overflow at ${width}px`);
    assert.ok(home.actions.every((height) => height >= 44), `Course Home actions meet the 44px target at ${width}px`);
    assert.equal(await tabUntil(page, "[data-build-step] a"), true, `keyboard reaches the build map at ${width}px`);

    await page.goto(route("server", "lessons/0000-before-lesson-one.html"));
    assert.equal(await page.locator("#homes-title").isVisible(), true, `orientation renders at ${width}px`);
    const orientation = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      mapLinkHeight: Math.round(document.querySelector("a[href='../index.html#build-path']").getBoundingClientRect().height),
    }));
    assert.ok(orientation.pageWidth <= orientation.viewportWidth, `orientation has no horizontal overflow at ${width}px`);
    assert.ok(orientation.mapLinkHeight >= 44, `orientation map link meets the 44px target at ${width}px`);
    assert.equal(await tabUntil(page, "a[href='../index.html#build-path']"), true, `keyboard reaches the build map from orientation at ${width}px`);

    for (const output of coreLessonOutputs) {
      await page.goto(route("server", output));
      assert.equal(await page.locator("#lesson h1").count(), 1, `${output} renders its lesson heading`);
      assert.equal(await page.locator("a[data-course-home]").getAttribute("href"), "../index.html");
      assert.equal(await page.locator("a[data-course-explore]").getAttribute("href"), "../source-map.html");
      const layout = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        navigationTargets: [...document.querySelectorAll(".lesson-navigation a")]
          .map((element) => Math.round(element.getBoundingClientRect().height)),
        overflowing: [...document.querySelectorAll("body *")]
          .map((element) => ({
            element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className && typeof element.className === "string" ? `.${element.className.trim().replaceAll(/\s+/g, ".")}` : ""}`,
            right: Math.round(element.getBoundingClientRect().right),
          }))
          .filter(({ right }) => right > document.documentElement.clientWidth + 1)
          .slice(0, 8),
      }));
      assert.ok(layout.pageWidth <= layout.viewportWidth, `${output} has no horizontal overflow at ${width}px; overflowing elements: ${JSON.stringify(layout.overflowing)}`);
      assert.ok(layout.navigationTargets.every((height) => height >= 44), `${output} navigation meets the 44px target at ${width}px`);
      if (output === "lessons/0014-rewrite-with-tests.html" && width === 320) {
        const comparisonRegion = page.locator("[aria-label='Test evidence comparison']");
        assert.equal(await comparisonRegion.getAttribute("tabindex"), "0");
        assert.equal(await comparisonRegion.evaluate((element) => element.scrollWidth > element.clientWidth), true, "the evidence table scrolls inside its keyboard-focusable region");
      }
      assert.ok(await page.locator("a[data-source-id]").count() > 0, `${output} has keyboard-reachable source links`);
      assert.equal(await tabUntil(page, "a[data-course-home]"), true, `${output} keyboard reaches Course Home`);
      assert.equal(await tabUntil(page, "a[data-course-explore]"), true, `${output} keyboard reaches Explore code`);
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(route("server", "lessons/0004-lobby-to-match.html"));
  await page.locator("a[data-source-id]").first().click();
  await page.waitForFunction(() => document.querySelector("#source-dialog")?.open);
  await page.locator("#source-dialog form[method='dialog'] button").click();
  assert.equal(await page.locator("#source-dialog").evaluate((dialog) => dialog.open), false);
  await page.reload();
  assert.equal(await page.locator("#source-dialog").evaluate((dialog) => dialog.open), false);
  assert.deepEqual(browserErrors, [], "no console warnings or errors on Course Home or core lessons");
});
