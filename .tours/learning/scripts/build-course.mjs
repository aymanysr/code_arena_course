import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { validateBuildPath } from "./build-path.mjs";
const h = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
export async function loadBuildCourse(learningDir, referenceData) {
  const raw = JSON.parse(
      await readFile(path.join(learningDir, "learning-path.json"), "utf8")
    ),
    lessons = [];
  for (const milestone of raw.milestones) {
    if (
      !raw.lessons.some(
        (l) => l.milestoneId === milestone.id && l.status === "ready"
      )
    )
      continue;
    if (!/^content\/M\d\d\.json$/.test(milestone.content))
      throw Error(`${milestone.id}: invalid content path`);
    lessons.push(
      ...JSON.parse(
        await readFile(path.join(learningDir, milestone.content), "utf8")
      )
    );
  }
  return validateBuildPath(raw, lessons, referenceData);
}
export async function bundleBuildRuntime(learningDir) {
  const result = await build({
    entryPoints: [path.join(learningDir, "assets/build-runtime.mjs")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
  });
  return result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
}
function route(course, prefix, current) {
  return `<details class="route" open><summary>Your build route <span>14 milestones</span></summary><nav aria-label="Build route">${course.path.milestones
    .map(
      (m, i) =>
        `<details ${m.id === current ? "open" : ""}><summary><span class="route-number">${String(i).padStart(2, "0")}</span>${h(m.title)}</summary><p>${h(m.enables)}</p><ol>${m.lessonIds
          .map((id) => {
            const l = course.path.lessons.find((l) => l.id === id);
            return `<li>${l.status === "ready" ? `<a href="${prefix}${h(l.output)}">${h(l.title)}</a>` : `<span>${h(l.title)} <small>Being written</small></span>`}</li>`;
          })
          .join("")}</ol></details>`
    )
    .join("")}</nav></details>`;
}
function visual(v, stepId) {
  if (!v) return "";
  return `<div class="visual" data-visual><p class="eyebrow">SEE THE CONNECTION</p><h3>${h(v.title)}</h3><div class="frame-values" data-frame-values>${v.frames[0].values.map((x) => `<div><small>${h(x.label)}</small><strong>${h(x.value)}</strong></div>`).join("")}</div><pre class="trace-code" aria-label="Code or action trace">${v.code.map((line, i) => `<code data-line="${i + 1}" class="${v.frames[0].codeLines.includes(i + 1) ? "highlight" : ""}"><span>${i + 1}</span>${h(line)}</code>`).join("")}</pre><p data-frame-explanation>${h(v.frames[0].explanation)}</p><div class="frame-controls">${v.frames.map((f) => `<button type="button" data-frame="${h(f.id)}" aria-pressed="${f === v.frames[0]}">${h(f.label)}</button>`).join("")}</div>${v.kind === "boundary" ? `<form data-boundary><label>Seconds left <input name="seconds" type="number" value="0" required></label><label for="${h(stepId)}-operator">Comparison</label><select id="${h(stepId)}-operator" name="operator"><option value=">">greater than zero (&gt;)</option><option value=">=">zero or more (&gt;=)</option><option value="<">less than zero (&lt;)</option></select><button>Check this choice</button><p role="status" data-boundary-feedback>Try 12, 0, and −2. This is a teaching example, not full Submit authorization.</p></form>` : ""}</div>`;
}
function files(step) {
  return `<div data-file-guidance>${step.files.map((f) => `<article class="file-card"><p class="eyebrow">${h(f.workspace === "reference" ? "Reference · read only" : f.action)}</p><h3><code>${h(f.path)}</code></h3><p>${h(f.owner)}</p><p>${h(f.change)}</p><p class="muted">Pattern: ${h(f.pattern)}</p></article>`).join("")}</div>`;
}
function stepHtml(step, lesson) {
  return `<section data-build-step="${h(step.id)}" id="${h(step.id)}"><div class="step-heading"><p class="eyebrow">${h(step.phase)} / ${h(step.title)}</p><h2 tabindex="-1">${h(step.question)}</h2></div><div class="step-layout ${step.visual ? "with-visual" : ""}"><div class="explanation">${step.explanation.map((p) => `<p>${h(p)}</p>`).join("")}${step.vocabulary.length ? `<dl class="vocabulary">${step.vocabulary.map((v) => `<dt>${h(v.term)}</dt><dd>${h(v.meaning)}</dd>`).join("")}</dl>` : ""}${step.transfer ? `<aside class="transfer"><h3>Try a changed case</h3><p>${h(step.transfer)}</p></aside>` : ""}${files(step)}${
    step.checkIds.length
      ? `<div data-check-guidance>${step.checkIds
          .map((id) => {
            const c = lesson.checks.find((c) => c.id === id);
            return `<article class="check-card"><p class="eyebrow">${c.kind === "explain" ? "Explain in your own words" : "Check your work"}</p><pre>${h(c.command)}</pre><p>${h(c.expected)}</p></article>`;
          })
          .join("")}</div>`
      : ""
  }<details class="help"><summary>I need a clue</summary>${step.hints.map((hint, i) => `<details><summary>Hint ${i + 1} · ${["Restate the goal", "Find the value", "Compare an example", "Walk through it"][i] ?? "More help"}</summary><p>${h(hint)}</p></details>`).join("")}</details></div>${visual(step.visual, step.id)}</div><details class="notes"><summary>My notes for this step</summary><label>Your reasoning or question<textarea data-step-note maxlength="10000" rows="3"></textarea></label><button type="button" data-save-note>Save note</button><p data-note-status role="status"></p></details><p class="connection">Next connection · ${h(step.next)}</p></section>`;
}
function management() {
  return `<details class="progress-tools"><summary>Progress & backup</summary><p>Reading, attempts, and checks you report are separate. This browser cannot see your editor or run your terminal.</p><button type="button" data-export>Export progress</button><label class="file-label">Import a progress file <input type="file" data-import accept="application/json,.json"></label><p data-import-preview role="status"></p><button type="button" data-confirm-import hidden>Replace with imported progress</button><button type="button" data-cancel-import hidden>Cancel import</button><button type="button" data-reset>Reset this workspace’s progress</button><div data-reset-confirm hidden><p>Clear notes, position, attempts, and reported checks for this workspace? Other workspaces stay saved.</p><button type="button" data-confirm-reset>Yes, reset this workspace</button><button type="button" data-cancel-reset>Keep my progress</button></div><button type="button" data-replace-corrupt hidden>Replace corrupt saved progress with this session</button><p>Reference-reading history uses its original separate activity record.</p></details>`;
}
function workspaceForm() {
  return `<section class="workspace-editor"><h2>Choose where you will write</h2><p>The reference game is for reading. Your practice folder is where you build. Your team’s repository becomes available when your friend creates it.</p><form data-profile-form><label>Workspace <select name="kind"><option value="practice">Practice</option><option value="team">Team repository</option></select></label><label>Absolute folder path <input name="root" placeholder="/Users/your-name/Projects/code-arena-practice" autocomplete="off"></label><p>This records a location; it does not create, inspect, or change that folder. Choose a folder outside the reference checkout.</p><button>Save workspace location</button><p role="status" data-profile-status></p></form><details><summary>When the team repository is ready</summary><p>Bring its README and package scripts into our conversation. We will inspect its folders, owners, test commands and identity contract, then map each responsibility before moving your work.</p><p>Team instructions stay unavailable until that mapping is supplied. Practice checks will never count as team passes.</p></details></section>`;
}
export async function renderBuildOutputs({
  learningDir,
  referenceData,
  course,
  runtimeSource = "",
}) {
  const css = await readFile(
    path.join(learningDir, "assets/build-course.css"),
    "utf8"
  );
  const filesOut = new Map();
  async function page(output, body, lesson, template) {
    const prefix = output === "index.html" ? "" : "../";
    const markup = await readFile(
      path.join(learningDir, `templates/${template}`),
      "utf8"
    );
    const data = JSON.stringify({
      course,
      lessonId: lesson?.id ?? null,
      prefix,
      page: output,
      referenceRoot: process.env.COURSE_EDITOR_ROOT
        ? path.resolve(process.env.COURSE_EDITOR_ROOT)
        : path.resolve(learningDir, "../.."),
    }).replaceAll("<", "\\u003c");
    const header = `<a class="brand" href="${prefix}index.html"><span class="brand-mark">ca</span><span>CODE ARENA<small>Learn it. Build it.</small></span></a><nav aria-label="Course"><a href="${prefix}reference.html">Reference lessons</a><a href="${prefix}reference.html#build-path">Teammate repo map</a><a href="${prefix}source-map.html">Explore code</a><button type="button" data-theme-toggle>Light theme</button></nav>`;
    const workspace = `<div class="workspace-bar"><span data-workspace-label>Practice · folder not selected</span><a href="${prefix}build/workspace.html">Change workspace</a><select aria-label="Active workspace" data-workspace-select><option value="practice">Practice</option><option value="team">Team · not ready</option></select></div><p class="notice" data-storage-warning hidden role="status"></p>${course.referenceReviewRequired ? '<details class="freshness"><summary>Reference review notice</summary><p>Some reference evidence needs review. Learning progress is separate from source freshness.</p></details>' : ""}`;
    const html = markup
      .replaceAll("{{TITLE}}", h(lesson?.title ?? "Your Code Arena build path"))
      .replace("{{STYLE}}", css)
      .replace("{{HEADER}}", header)
      .replace("{{WORKSPACE}}", workspace)
      .replace("{{ROUTE}}", route(course, prefix, lesson?.milestoneId ?? "M00"))
      .replace("{{BODY}}", body)
      .replace("{{TOOLS}}", management())
      .replace("{{DATA}}", data)
      .replace("{{SCRIPT}}", runtimeSource);
    filesOut.set(path.join(learningDir, output), html);
  }
  const first = course.path.lessons.find((l) => l.status === "ready");
  await page(
    "index.html",
    `<p class="eyebrow">YOUR GUIDED BUILD PATH</p><h1>Understand one piece.<br>Build it yourself.</h1><p class="lead">From what you know in C to a working multiplayer game. Each lesson explains the idea, shows it changing, then guides one small coding step.</p><section class="continue-card"><span class="eyebrow">START WITH THE DESTINATION</span><h2 data-continue-title>${h(first?.title ?? "The first lesson is being written")}</h2><p data-continue-note>First see what the game does. You do not need your friend’s repository yet.</p>${first ? `<a class="primary" data-build-continue href="${h(first.output)}">Start learning <span>→</span></a>` : ""}</section><div class="home-points"><section><span>01</span><h3>See the idea</h3><p>Change an input and follow the values. Connect each explanation to the relevant code.</p></section><section><span>02</span><h3>Write a small part</h3><p>Know which folder and file to use, why it belongs there, and what to change.</p></section><section><span>03</span><h3>Check and connect</h3><p>Run a clear check, understand failures, then see what your new part enables.</p></section></div><aside class="notice">${course.lessons.length} of ${course.path.lessons.length} lessons are available. The full route is shown at the left; later lessons are still being written. Your game is built by you, one checked step at a time.</aside>`,
    null,
    "build-home.template.html"
  );
  for (const lesson of course.lessons) {
    const entry = course.path.lessons.find((l) => l.id === lesson.id),
      index = course.path.lessons.indexOf(entry),
      next = course.path.lessons
        .slice(index + 1)
        .find((l) => l.status === "ready");
    await page(
      entry.output,
      `<div class="lesson-intro"><p class="eyebrow">${h(lesson.milestoneId)} · ${h(course.path.milestones.find((m) => m.id === lesson.milestoneId).title)}</p><h1>${h(lesson.title)}</h1><p class="lead">${h(lesson.outcome)}</p><details><summary>Why this comes now</summary><p>${h(lesson.why)}</p><p>Needs: ${lesson.prerequisites.length ? lesson.prerequisites.map((id) => h(course.path.lessons.find((l) => l.id === id).title)).join(", ") : "No earlier lesson."}</p></details></div><nav class="step-tabs" aria-label="Lesson steps">${lesson.steps.map((s, i) => `<a href="#${h(s.id)}" data-step-link="${h(s.id)}"><span>${i + 1}</span>${h(s.phase)}</a>`).join("")}</nav><p data-prerequisite-notice class="notice" hidden></p>${lesson.steps.map((s) => stepHtml(s, lesson)).join("")}<div class="step-navigation" data-step-navigation hidden><button type="button" data-back>Previous step</button><span data-step-count></span><button type="button" data-next class="primary">Next step</button></div><div data-next-lesson hidden>${next ? `<a class="primary" href="../${h(next.output)}">Next lesson: ${h(next.title)} →</a>` : "<p>You reached the currently available lessons. Your notes and checks stay saved. The next lesson is being written.</p>"}</div>`,
      lesson,
      "build-lesson.template.html"
    );
  }
  await page(
    "build/workspace.html",
    `<p class="eyebrow">PRACTICE NOW · TEAM REPOSITORY LATER</p><h1>A clear home for your code.</h1>${workspaceForm()}`,
    null,
    "workspace.template.html"
  );
  return filesOut;
}
