import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderCatalogOutputs, renderLessonTemplate } from "./build-catalog.mjs";

const filePath = "packages/arena-game/src/engine.ts";
let browser;
let fixtureDirectory;
let mapUrl;
let homeUrl;
let lessonUrl;
let prototypeUrl;
let server;
let serverUrl;
let serverMapUrl;
let serverHomeUrl;
let prototypeAvailable = false;

before(async () => {
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "code-arena-source-preview-"));
  mapUrl = pathToFileURL(path.join(fixtureDirectory, "source-map.html")).href;
  homeUrl = pathToFileURL(path.join(fixtureDirectory, "index.html")).href;
  lessonUrl = pathToFileURL(path.join(fixtureDirectory, "lessons/0001-first.html")).href;
  prototypeUrl = pathToFileURL(path.join(fixtureDirectory, ".scratch/learning-platform-ux-prototype.html")).href;
  await mkdir(path.join(fixtureDirectory, "packages/arena-game/src"), { recursive: true });
  await mkdir(path.join(fixtureDirectory, "lessons"), { recursive: true });
  await mkdir(path.join(fixtureDirectory, ".tours/learning"), { recursive: true });
  await mkdir(path.join(fixtureDirectory, ".scratch"), { recursive: true });
  await mkdir(path.join(fixtureDirectory, "templates"), { recursive: true });
  await mkdir(path.join(fixtureDirectory, "assets"), { recursive: true });
  await mkdir(path.join(fixtureDirectory, "lessons"), { recursive: true });
  const source = Array.from({ length: 40 }, (_, index) => index === 19
    ? `const line20 = "${"x".repeat(160)}";`
    : `const line${index + 1} = ${index + 1};`).join("\n");
  await writeFile(path.join(fixtureDirectory, filePath), source);
  await writeFile(path.join(fixtureDirectory, "templates/first.html"), "First lesson template.\n");
  await writeFile(path.join(fixtureDirectory, "templates/second.html"), "Second lesson template.\n");

  const template = await readFile(new URL("../templates/source-map.template.html", import.meta.url), "utf8");
  const homeTemplate = await readFile(new URL("../templates/course-home.template.html", import.meta.url), "utf8");
  const stylesheet = await readFile(new URL("../assets/course.css", import.meta.url), "utf8");
  const activityRuntime = await readFile(new URL("../assets/course-activity.mjs", import.meta.url), "utf8");
  let prototype;
  try {
    prototype = await readFile(new URL("../../../.scratch/learning-platform-ux-prototype.html", import.meta.url), "utf8");
    prototypeAvailable = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const lessons = [
    {
      id: "0001-first",
      order: 1,
      title: "First lesson",
      goal: "Follow one behavior.",
      template: "templates/first.html",
      output: "lessons/0001-first.html",
      references: [
        { path: filePath, startLine: 1, endLine: 40, title: "Engine" },
        { path: "packages/arena-game/src/missing.ts", startLine: 1, endLine: 1, title: "Missing source" },
      ],
    },
    {
      id: "0002-second",
      order: 2,
      title: "Second lesson",
      goal: "Follow another behavior.",
      template: "templates/second.html",
      output: "lessons/0002-second.html",
      references: [],
    },
  ];
  const coverageMap = {
    version: 2,
    scope: { roots: [{ path: "packages", area: "Game" }], files: [], excluded: [] },
    batches: [
      { id: "start-here", order: 1, title: "Start here", description: "Follow the player path.", lessonIds: ["0001-first"] },
      { id: "next-step", order: 2, title: "Next step", description: "Check the next behavior.", lessonIds: ["0002-second"] },
    ],
    lessons,
    supportingFiles: [],
  };
  await writeFile(path.join(fixtureDirectory, "templates/course-home.template.html"), homeTemplate);
  await writeFile(path.join(fixtureDirectory, "templates/source-map.template.html"), template);
  await writeFile(path.join(fixtureDirectory, "assets/course.css"), stylesheet);
  await writeFile(path.join(fixtureDirectory, "assets/course-activity.mjs"), activityRuntime);
  const renderedCatalog = await renderCatalogOutputs(fixtureDirectory, fixtureDirectory, coverageMap, { tours: [] });
  const { data } = renderedCatalog;
  const renderedMap = renderedCatalog.files.get(path.join(fixtureDirectory, "source-map.html"));
  const renderedHome = renderedCatalog.files.get(path.join(fixtureDirectory, "index.html"));
  const lessonTemplate = `<!doctype html><html lang="en"><head><!-- INLINE_COURSE_STYLES --></head><body data-lesson-step="2"><main style="min-height: 1800px"><a id="source-link" href="../../../${filePath}#L20">Open source</a><a id="missing-source-link" href="../../../packages/arena-game/src/missing.ts#L1">Missing source</a></main></body></html>`;
  const lessonFiles = data.files.filter((file) => lessons[0].references.some((reference) => reference.path === file.path));
  const renderedLesson = renderLessonTemplate(
    lessonTemplate,
    stylesheet,
    "preview-test-snapshot",
    { stale: 0, total: 1 },
    lessons[0],
    { files: lessonFiles },
    fixtureDirectory,
  );

  await writeFile(path.join(fixtureDirectory, "source-map.html"), renderedMap);
  await writeFile(path.join(fixtureDirectory, "index.html"), renderedHome);
  await writeFile(path.join(fixtureDirectory, ".tours/learning/source-map.html"), renderedMap);
  if (prototypeAvailable) {
    await writeFile(path.join(fixtureDirectory, ".scratch/learning-platform-ux-prototype.html"), prototype);
  }
  await writeFile(path.join(fixtureDirectory, "lessons/0001-first.html"), renderedLesson);

  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
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
  const serverOrigin = `http://127.0.0.1:${server.address().port}`;
  serverUrl = `${serverOrigin}/lessons/0001-first.html`;
  serverMapUrl = `${serverOrigin}/source-map.html`;
  serverHomeUrl = `${serverOrigin}/index.html`;
});

after(async () => {
  await browser?.close();
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
});

test("a lesson citation opens a syntax-colored excerpt without changing its URL", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(lessonUrl);
  await page.locator("#source-link").scrollIntoViewIfNeeded();
  await page.locator("#source-link").click();
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);

  assert.equal(page.url(), lessonUrl);
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector("#source-dialog").getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      left: dialog.left,
      right: dialog.right,
      width: dialog.width,
      backdrop: getComputedStyle(document.querySelector("#source-dialog"), "::backdrop").backgroundColor,
    };
  });
  assert.ok(layout.left > layout.viewportWidth / 2, "desktop preview leaves most of the lesson visible");
  assert.ok(layout.viewportWidth - layout.right <= 17, "desktop preview sits beside the right edge");
  assert.ok(layout.width <= 545, "desktop preview stays narrow");
  assert.match(layout.backdrop, /rgba\(8, 14, 13, 0\.08\)/, "the lesson remains visible behind the preview");
  assert.equal(await page.locator("#source-file-path code").textContent(), filePath);
  assert.equal(await page.locator("#source-file-summary").textContent(), "Lines 15–25 of 40");
  assert.equal(await page.locator(".source-line").count(), 11);
  assert.equal(await page.locator(".source-line-number").first().textContent(), "15");
  assert.equal(await page.locator(".source-line-number").last().textContent(), "25");
  assert.equal(await page.locator(".source-line.is-reference-line .hljs-keyword").count() > 0, true);
  assert.match(await page.locator("#source-editor-link").getAttribute("href"), /^vscode:\/\/file/);
});

test("Close restores citation focus and keeps the lesson, URL, step, and scroll position", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(lessonUrl);
  await page.evaluate(() => window.scrollTo(0, 520));
  const link = page.locator("#source-link");
  await link.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await link.click();
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);
  await page.getByRole("button", { name: "Close preview" }).click();

  assert.equal(page.url(), lessonUrl);
  assert.equal(await page.locator("body").getAttribute("data-lesson-step"), "2");
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
  assert.equal(await page.evaluate(() => document.activeElement.id), "source-link");
});

test("Escape closes the lesson preview and restores citation focus without changing scroll", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(lessonUrl);
  await page.evaluate(() => window.scrollTo(0, 520));
  const link = page.locator("#source-link");
  await link.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await link.click();
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);
  await page.keyboard.press("Escape");

  assert.equal(page.url(), lessonUrl);
  assert.equal(await page.evaluate(() => document.activeElement.id), "source-link");
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
  assert.equal(await page.locator("body").getAttribute("data-lesson-step"), "2");
});

test("a citation with unavailable source keeps its source-map fallback", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(lessonUrl);
  const missingLink = page.locator("#missing-source-link");
  const fallbackHref = await missingLink.getAttribute("href");
  assert.equal(await missingLink.getAttribute("data-source-id"), null);
  await missingLink.click();
  await page.waitForTimeout(200);

  assert.ok(
    new URL(page.url()).pathname.endsWith("/source-map.html"),
    `expected the citation fallback ${fallbackHref} to open the source map, got ${page.url()}`,
  );
  assert.equal(new URL(page.url()).search, "");
  assert.equal(await page.locator("#source-dialog").evaluate((dialog) => dialog.open), false);
  assert.match(await page.locator("#filter-results").textContent(), /No source preview is available for packages\/arena-game\/src\/missing\.ts/);
});

test("the lesson excerpt works from the local static server and contains horizontal code scrolling", async (t) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(serverUrl);
  await page.locator("#source-link").click();
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
    dialog: document.querySelector("#source-dialog").getBoundingClientRect().toJSON(),
    codeClientWidth: document.querySelector(".source-code").clientWidth,
    codeScrollWidth: document.querySelector(".source-code").scrollWidth,
    closeVisible: document.querySelector('form[method="dialog"] button').getBoundingClientRect().bottom <= window.innerHeight,
    closeHeight: document.querySelector('form[method="dialog"] button').getBoundingClientRect().height,
    editorHeight: document.querySelector("#source-editor-link").getBoundingClientRect().height,
  }));
  assert.equal(layout.pageWidth, layout.viewportWidth);
  assert.ok(layout.dialog.left >= 0 && layout.dialog.right <= layout.viewportWidth);
  assert.ok(layout.codeScrollWidth > layout.codeClientWidth);
  assert.equal(layout.closeVisible, true);
  assert.ok(layout.closeHeight >= 44, `Close target height was ${layout.closeHeight}px`);
  assert.ok(layout.editorHeight >= 44, `VS Code target height was ${layout.editorHeight}px`);
  assert.equal(page.url(), serverUrl);
});

test("keyboard Tab stays inside the lesson dialog and Escape returns to the citation", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(lessonUrl);
  await page.locator("#source-link").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);
  const initialFocus = await page.evaluate(() => `${document.activeElement.tagName}#${document.activeElement.id}.${document.activeElement.className}`);

  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    assert.equal(
      await page.locator("#source-dialog").evaluate((dialog) => dialog.contains(document.activeElement)),
      true,
      `focus stays in the dialog after ${key}; initial focus was ${initialFocus}, active element is ${await page.evaluate(() => `${document.activeElement.tagName}#${document.activeElement.id}.${document.activeElement.className}`)}`,
    );
  }
  await page.keyboard.press("Escape");

  assert.equal(page.url(), lessonUrl);
  assert.equal(await page.evaluate(() => document.activeElement.id), "source-link");
});

test("refreshing a lesson source preview does not reopen it", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(lessonUrl);
  await page.locator("#source-link").click();
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);
  await page.reload();

  assert.equal(await page.locator("#source-dialog").evaluate((dialog) => dialog.open), false);
  assert.equal(new URL(page.url()).search, "");
});

test("closing a preview opened from the source map stays on the source map", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(mapUrl);
  await page.locator("#source-inventory > summary").click();
  await page.getByRole("button", { name: `Open code preview for ${filePath}`, exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#source-dialog").open);
  await page.getByRole("button", { name: "Close preview" }).click();

  assert.equal(new URL(page.url()).pathname, new URL(mapUrl).pathname);
  assert.equal(await page.locator("#source-dialog").evaluate((dialog) => dialog.open), false);
});

test("source map keeps full-file previews contained on desktop and 320px mobile", async (t) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  for (const url of [mapUrl, serverMapUrl]) {
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
      await page.goto(url);
      assert.equal(await page.getByRole("link", { name: "Back to Course Home" }).getAttribute("href"), "index.html");
      assert.equal(await page.getByRole("link", { name: "Explore code" }).getAttribute("aria-current"), "page");
      assert.equal(await page.locator("[data-course-self-check], [data-course-activity-status], #lesson-progress").count(), 0);
      await page.locator("#source-inventory > summary").click();
      await page.getByRole("button", { name: `Open code preview for ${filePath}`, exact: true }).click();
      await page.waitForFunction(() => document.querySelector("#source-dialog").open);

      const layout = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: window.innerHeight,
        pageWidth: document.documentElement.scrollWidth,
        dialog: document.querySelector("#source-dialog").getBoundingClientRect().toJSON(),
        codeClientWidth: document.querySelector(".source-code").clientWidth,
        codeScrollWidth: document.querySelector(".source-code").scrollWidth,
        codeClientHeight: document.querySelector(".source-code").clientHeight,
        codeScrollHeight: document.querySelector(".source-code").scrollHeight,
        closeBottom: document.querySelector('form[method="dialog"] button').getBoundingClientRect().bottom,
        backdrop: getComputedStyle(document.querySelector("#source-dialog"), "::backdrop").backgroundColor,
      }));
      assert.equal(await page.locator(".source-line").count(), 40, "source-map preview keeps the full file");
      assert.equal(layout.pageWidth, layout.viewportWidth, `no page overflow at ${width}px for ${url}`);
      assert.ok(layout.dialog.left >= 0 && layout.dialog.right <= layout.viewportWidth);
      assert.ok(layout.closeBottom <= layout.viewportHeight, "Close remains visible");
      assert.match(layout.backdrop, /rgba\(8, 14, 13, 0\.08\)/);
      if (width > 34 * 16) {
        assert.ok(layout.dialog.left > layout.viewportWidth / 2, "desktop source-map preview leaves the inventory visible");
        assert.ok(layout.viewportWidth - layout.dialog.right <= 17, "desktop source-map preview sits beside the right edge");
      }
      if (width === 320) {
        assert.ok(layout.codeScrollWidth > layout.codeClientWidth, "long code scrolls inside its pane");
        assert.ok(layout.codeScrollHeight > layout.codeClientHeight, "full-file code scrolls vertically inside its pane");
      }

      await page.getByRole("button", { name: "Close preview" }).click();
    }
  }
});

test("a source preview cannot redirect its return link outside the project", async (t) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  const unsafeUrl = new URL(mapUrl);
  unsafeUrl.searchParams.set("file", filePath);
  unsafeUrl.searchParams.set("line", "1");
  unsafeUrl.searchParams.set("return", "https://example.invalid/leave-project.html");
  await page.goto(unsafeUrl.href);
  await page.waitForFunction(() => document.querySelector("#source-dialog")?.open);
  await page.getByRole("button", { name: "Close preview" }).click();

  assert.equal(page.url(), mapUrl);
});

test("Course Home offers Lesson 1, keeps every lesson link visible, and opens Explore code separately", async (t) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(homeUrl);

  const start = page.locator("[data-course-start]");
  assert.equal(await start.textContent(), "Start Lesson 1 →");
  assert.equal(await start.getAttribute("href"), "lessons/0001-first.html");
  assert.equal(await page.locator(".course-batch").count(), 2);
  assert.equal(await page.locator(".course-batch h2").count(), 2);
  assert.equal(await page.locator(".course-batch summary h2").count(), 0);
  assert.equal(await page.locator("a[data-lesson-link]").count(), 2);
  for (const lessonLink of await page.locator("a[data-lesson-link]").all()) {
    assert.equal(await lessonLink.isVisible(), true);
    assert.equal(await lessonLink.evaluate((anchor) => anchor.hasAttribute("disabled")), false);
    assert.ok(await lessonLink.evaluate((anchor) => anchor.getBoundingClientRect().height >= 44));
  }
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(layout.scrollWidth <= layout.viewportWidth, "Course Home fits a 320px viewport");
  assert.match(await page.locator("[data-course-snapshot]").getAttribute("class"), /quiet/);

  await page.getByRole("link", { name: "Explore code" }).click();
  assert.ok(new URL(page.url()).pathname.endsWith("/source-map.html"));
  assert.equal(await page.locator("#course-list").evaluate((details) => details.open), false);

  const serverPage = await browser.newPage();
  t.after(() => serverPage.close());
  await serverPage.goto(serverHomeUrl);
  assert.equal(await serverPage.locator("[data-course-start]").getAttribute("href"), "lessons/0001-first.html");
  assert.equal(await serverPage.locator("a[data-lesson-link]").count(), 2);
});

test("the learning prototype keeps one lesson step in one reading column", async (t) => {
  if (!prototypeAvailable) {
    t.skip("The untracked prototype fixture is not present in this checkout.");
    return;
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  const prototypeUrl = new URL("../../../.scratch/learning-platform-ux-prototype.html", import.meta.url).href;
  await page.goto(prototypeUrl);

  assert.equal(await page.locator(".chapter[open]").count(), 0);
  await page.getByRole("button", { name: /Start Lesson 1/ }).click();
  assert.equal(await page.locator("[data-panel]:visible").count(), 1);
  assert.equal(await page.locator(".side-grid").count(), 0);
  const columns = await page.locator(".lesson-workspace").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
  );
  assert.equal(columns, 1);

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `no horizontal overflow at ${width}px`);
  }
});

test("a prototype source preview returns to the exact lesson step", async (t) => {
  if (!prototypeAvailable) {
    t.skip("The untracked prototype fixture is not present in this checkout.");
    return;
  }

  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(() => page.close());

  await page.goto(prototypeUrl);
  await page.getByRole("button", { name: /Start Lesson 1/ }).click();
  await page.locator('[data-panel="0"] [data-go="1"]').click();
  await page.locator('[data-panel="1"] .source-ref').nth(2).click();
  await page.waitForFunction(() => document.querySelector("#source-dialog")?.open);
  await page.getByRole("button", { name: "Close preview" }).click();

  await page.waitForURL((url) => url.pathname.endsWith("/.scratch/learning-platform-ux-prototype.html") && url.hash === "#lesson-step-1");
  assert.equal(await page.locator("#lesson-screen").isVisible(), true);
  assert.equal(await page.locator('[data-panel="1"]').isVisible(), true);
});
