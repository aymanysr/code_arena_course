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
const ACTS = [
  {
    num: "1",
    title: "The Core Game Loop",
    goal: "Build a pure TypeScript match engine & scoring simulator in Node.",
    milestones: ["M00", "M01", "M02", "M03", "M04", "M05"],
  },
  {
    num: "2",
    title: "Full-Stack & Persistence",
    goal: "Expose Fastify REST APIs, connect PostgreSQL, and render the React editor.",
    milestones: ["M06", "M07", "M08"],
  },
  {
    num: "3",
    title: "Real-Time Multiplayer",
    goal: "Live WebSockets, presence, Yjs collaborative CRDTs, and Docker sandbox.",
    milestones: ["M09", "M10", "M11", "M12"],
  },
  {
    num: "4",
    title: "Production Parity & Handover",
    goal: "Docker Compose multi-service topology, TLS proxy, and 42 subject compliance.",
    milestones: ["M13"],
  },
];

function route(course, prefix, current) {
  return `<details class="route" open><summary>Your build route <span>4 Acts · 14 milestones</span></summary><nav aria-label="Build route">${course.path.milestones
    .map(
      (m, i) => {
        const act = ACTS.find((a) => a.milestones.includes(m.id));
        const isFirstInAct = act && act.milestones[0] === m.id;
        const actHeader = isFirstInAct
          ? `<div class="act-header" role="presentation"><span class="act-badge">Act ${act.num}</span><strong>${h(act.title)}</strong><small>${h(act.goal)}</small></div>`
          : "";
        return `${actHeader}<details ${m.id === current ? "open" : ""}><summary><span class="route-number">${String(i).padStart(2, "0")}</span>${h(m.title)}</summary><p>${h(m.enables)}</p><ol>${m.lessonIds
          .map((id) => {
            const l = course.path.lessons.find((l) => l.id === id);
            return `<li>${l.status === "ready" ? `<a href="${prefix}${h(l.output)}">${h(l.title)}</a>` : `<span>${h(l.title)} <small>Being written</small></span>`}</li>`;
          })
          .join("")}</ol></details>`;
      }
    )
    .join("")}</nav></details>`;
}
function visual(v, stepId) {
  if (!v) return "";
  return `<div class="visual" data-visual><p class="eyebrow">SEE THE CONNECTION</p><h3>${h(v.title)}</h3><div class="frame-values" data-frame-values>${v.frames[0].values.map((x) => `<div><small>${h(x.label)}</small><strong>${h(x.value)}</strong></div>`).join("")}</div><pre class="trace-code" aria-label="Code or action trace">${v.code.map((line, i) => `<code data-line="${i + 1}" class="${v.frames[0].codeLines.includes(i + 1) ? "highlight" : ""}"><span>${i + 1}</span>${h(line)}</code>`).join("")}</pre><p data-frame-explanation>${h(v.frames[0].explanation)}</p><div class="frame-controls">${v.frames.map((f) => `<button type="button" data-frame="${h(f.id)}" aria-pressed="${f === v.frames[0]}">${h(f.label)}</button>`).join("")}</div>${v.kind === "boundary" ? `<form data-boundary><label>Seconds left <input name="seconds" type="number" value="0" required></label><label for="${h(stepId)}-operator">Comparison</label><select id="${h(stepId)}-operator" name="operator"><option value=">">greater than zero (&gt;)</option><option value=">=">zero or more (&gt;=)</option><option value="<">less than zero (&lt;)</option></select><button>Check this choice</button><p role="status" data-boundary-feedback>Try 12, 0, and −2. This is a teaching example, not full Submit authorization.</p></form>` : ""}</div>`;
}
function files(step, lesson, referenceData) {
  const available = new Set(
    (referenceData.files ?? []).map((file) => file.path)
  );
  const cited = new Set(
    (lesson.references ?? []).map((reference) => reference.path)
  );
  return `<div data-file-guidance>${step.files
    .map((f) => {
      const sourceLink =
        f.workspace === "reference" &&
        available.has(f.path) &&
        !cited.has(f.path)
          ? `<a class="file-reference-link" href="../source-map.html?file=${encodeURIComponent(f.path)}" target="_blank" rel="noopener" aria-label="Open this reference file in the code browser, in a new tab">Open this reference file in the code browser · opens in a new tab</a>`
          : "";
      return `<article class="file-card"><p class="eyebrow">${h(f.workspace === "reference" ? "Reference · read only" : f.action)}</p><h3><code>${h(f.path)}</code></h3><p>${h(f.owner)}</p><p>${h(f.change)}</p><p class="muted">Pattern: ${h(f.pattern)}</p>${sourceLink}</article>`;
    })
    .join("")}</div>`;
}
function referenceAssignments(lesson) {
  const result = new Map(lesson.steps.map((step) => [step.id, []]));
  const order = ["see", "understand", "orient", "try", "build", "check"];
  for (const reference of lesson.references ?? []) {
    const matches = lesson.steps.filter((step) =>
      [
        step.title,
        step.question,
        ...step.explanation,
        step.next,
        step.transfer ?? "",
        ...step.files.map((file) => file.path),
      ].some((value) => value.includes(reference.path))
    );
    matches.sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
    const owner =
      matches[0] ??
      lesson.steps.find((step) => step.phase === "see") ??
      lesson.steps[0];
    if (owner) result.get(owner.id).push(reference);
  }
  return result;
}
function referenceMarkup(references) {
  if (!references.length) return "";
  return `<aside class="reference-code" aria-label="Cited reference code"><p class="eyebrow">REFERENCE CODE · READ ONLY</p><p>Compare this example with the step, then write your own version in Practice.</p><ul>${references.map((reference) => `<li><a href="../source-map.html?file=${encodeURIComponent(reference.path)}&amp;line=${reference.startLine}&amp;end=${reference.endLine}" target="_blank" rel="noopener" aria-label="Open reference code in ${h(reference.path)}, lines ${reference.startLine} to ${reference.endLine}, in a new tab"><code>${h(reference.path)}</code><span>Lines ${reference.startLine}–${reference.endLine} · opens in a new tab</span></a></li>`).join("")}</ul></aside>`;
}
function stepHtml(step, lesson, referenceMap, referenceData) {
  return `<section data-build-step="${h(step.id)}" id="${h(step.id)}"><div class="step-heading"><p class="eyebrow">${h(step.phase)} / ${h(step.title)}</p><h2 tabindex="-1">${h(step.question)}</h2></div><div class="step-layout ${step.visual ? "with-visual" : ""}"><div class="explanation">${step.explanation.map((p) => `<p>${h(p)}</p>`).join("")}${step.vocabulary.length ? `<dl class="vocabulary">${step.vocabulary.map((v) => `<dt>${h(v.term)}</dt><dd>${h(v.meaning)}</dd>`).join("")}</dl>` : ""}${step.transfer ? `<aside class="transfer"><h3>Try a changed case</h3><p>${h(step.transfer)}</p></aside>` : ""}${files(step, lesson, referenceData)}${referenceMarkup(referenceMap.get(step.id) ?? [])}${
    step.checkIds.length
      ? `<div data-check-guidance>${step.checkIds
          .map((id) => {
            const c = lesson.checks.find((c) => c.id === id);
            return `<article class="check-card"><p class="eyebrow">${c.kind === "explain" ? "Explain in your own words" : "Check your work"}</p><pre>${h(c.command)}</pre><p>${h(c.expected)}</p></article>`;
          })
          .join("")}</div>`
      : ""
  }<details class="help"><summary>Need a hint?</summary><p class="help-instructions">Open Hint 1 and try again. Open the next hint only if you still need help.</p>${step.hints.map((hint, i) => `<details><summary>Hint ${i + 1} · ${["Restate the goal", "Find the value", "Compare an example", "Walk through it"][i] ?? "More help"}</summary><p>${h(hint)}</p></details>`).join("")}</details></div>${visual(step.visual, step.id)}</div><details class="notes"><summary>Answer or notes for this step</summary><p class="note-instructions">Write your answer or question here. Click Save note to keep it in this browser. It is not graded or sent.</p><label>Your answer or question<textarea data-step-note maxlength="10000" rows="3"></textarea></label><button type="button" data-save-note>Save note</button><p data-note-status role="status"></p></details><p class="connection">Next connection · ${h(step.next)}</p></section>`;
}
function management() {
  return `<details class="progress-tools"><summary>Progress & backup</summary><p>Reading, attempts, and checks you report are separate. This browser cannot see your editor or run your terminal.</p><button type="button" data-export>Export progress</button><label class="file-label">Import a progress file <input type="file" data-import accept="application/json,.json"></label><p data-import-preview role="status"></p><button type="button" data-confirm-import hidden>Replace with imported progress</button><button type="button" data-cancel-import hidden>Cancel import</button><button type="button" data-reset>Reset this workspace’s progress</button><div data-reset-confirm hidden><p>Clear notes, position, attempts, and reported checks for this workspace? Other workspaces stay saved.</p><button type="button" data-confirm-reset>Yes, reset this workspace</button><button type="button" data-cancel-reset>Keep my progress</button></div><button type="button" data-replace-corrupt hidden>Replace corrupt saved progress with this session</button><p>Reference-reading history uses its original separate activity record.</p></details>`;
}
function workspaceForm() {
  return `<section class="workspace-editor" aria-labelledby="workspace-heading"><h2 id="workspace-heading">Choose where you will write</h2><p>The reference game is for reading. Your practice folder is where you build now. A team folder becomes useful after you and your teammate inspect how their project is organized.</p><div class="workspace-flow" aria-label="Reference code informs your practice; inspected team code receives your mapped work"><article><span>READ</span><strong>Reference game</strong><small>Examples and source links</small></article><b aria-hidden="true">→</b><article><span>BUILD</span><strong>Practice folder</strong><small>Your working code</small></article><b aria-hidden="true">→</b><article><span>MAP LATER</span><strong>Team repository</strong><small>Only after inspection</small></article></div><form data-profile-form><fieldset><legend>Workspace</legend><label for="workspace-kind">Where are you working?</label><select id="workspace-kind" name="kind"><option value="practice">Practice folder</option><option value="team">Team repository</option></select><label for="workspace-root"><span data-root-label>Practice root folder</span></label><input id="workspace-root" name="root" type="text" placeholder="/Users/your-name/Projects/code-arena-practice" autocomplete="off" aria-describedby="workspace-root-help"><p id="workspace-root-help">This saves the folder path in this browser. It does not create, inspect, or change the folder. Choose a folder outside the reference checkout.</p></fieldset><fieldset data-team-mapping hidden><legend>Map one team file</legend><p>First inspect the real team folders and package scripts with your teammate. Enter the paths and commands they confirm. This page cannot read the repository or run a command.</p><label for="mapping-filter">Find a course file or responsibility</label><input id="mapping-filter" type="search" data-mapping-filter placeholder="Type a role or path, such as test.http"><label for="mapping-candidate">Course file and responsibility</label><select id="mapping-candidate" name="mappingCandidate" data-mapping-candidate><option value="">Choose a course file to map</option></select><div class="mapping-context" data-mapping-context aria-live="polite"><p>Choose a file to compare its source notes, practice path, and checks.</p></div><label for="mapping-target">Path in the team repository</label><input id="mapping-target" name="targetPath" type="text" autocomplete="off" placeholder="For example: services/api/src/rules.ts"><label for="mapping-action">What will your team do with this file?</label><select id="mapping-action" name="action"><option value="reuse">Use an existing team file</option><option value="create">Create a new team file</option><option value="extend">Add to an existing team file</option></select><label for="mapping-reason">Why does this file belong there?</label><textarea id="mapping-reason" name="reason" rows="3" maxlength="10000" aria-describedby="mapping-reason-help"></textarea><p id="mapping-reason-help">Name the owner or responsibility you confirmed. Do not guess a path or owner.</p><label for="mapping-check">Course check to map (optional)</label><select id="mapping-check" name="checkId" data-team-check><option value="">Do not map a team check yet</option></select><label for="mapping-command">Team command for this check</label><input id="mapping-command" name="command" type="text" autocomplete="off" placeholder="Read the team package scripts first"><label for="mapping-cwd">Folder to run the team check from</label><input id="mapping-cwd" name="cwd" type="text" value="." autocomplete="off"><label for="mapping-dependency">What must exist first? (optional)</label><input id="mapping-dependency" name="dependency" type="text" autocomplete="off" placeholder="For example: database service is running"><p>Saved team checks start as <strong>unverified</strong>. A practice pass never counts as a team pass.</p></fieldset><button type="submit" class="primary">Preview this map</button><section class="mapping-review" data-profile-preview hidden aria-live="polite" aria-labelledby="mapping-review-heading"></section><button type="button" data-save-profile hidden>Save this workspace map</button><p role="status" data-profile-status aria-live="polite"></p></form><details><summary>When the team repository is ready</summary><p>Ask your teammate for the README, folder tree and package scripts. Then confirm which owner handles the rule, where its tests live, and what command checks it.</p><p>Until those details are mapped, the team view will name what is missing and hide team commands. Practice remains available.</p></details></section>`;
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
    const editorRoot = process.env.COURSE_EDITOR_ROOT?.trim();
    const data = JSON.stringify({
      course,
      lessonId: lesson?.id ?? null,
      prefix,
      page: output,
      referenceRoot: editorRoot
        ? path.resolve(editorRoot)
        : path.resolve(learningDir, "../.."),
    }).replaceAll("<", "\\u003c");
    const header = `<a class="brand" href="${prefix}index.html"><span class="brand-mark">ca</span><span>CODE ARENA<small>Learn it. Build it.</small></span></a><nav aria-label="Course"><a href="${prefix}reference.html">Reference walkthroughs</a><a href="${prefix}reference.html#build-path">Teammate repo map</a><a href="${prefix}source-map.html">Browse all code</a><button type="button" data-theme-toggle>Light theme</button></nav>`;
    const workspace = `<div class="workspace-bar"><span data-workspace-label>Practice folder · not selected</span><a href="${prefix}build/workspace.html">Choose a folder</a><select aria-label="Coding destination" data-workspace-select><option value="practice">Practice</option><option value="team">Team · set up later</option></select><details class="workspace-help"><summary>What is Practice or Team?</summary><p>Practice is a separate folder for your learning code. Team is your teammate’s project after you inspect it together. This page saves a folder path; it cannot open, create, or inspect that folder.</p></details></div><p class="notice" data-storage-warning hidden role="status"></p>${course.referenceReviewRequired ? '<details class="freshness"><summary>Reference review notice</summary><p>Some reference evidence needs review. Learning progress is separate from source freshness.</p></details>' : ""}`;
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
  const readyCount = course.path.lessons.filter(
    (l) => l.status === "ready"
  ).length;
  await page(
    "index.html",
    `<p class="eyebrow">YOUR GUIDED BUILD PATH · 4 ACTS</p><h1>Understand one piece.<br>Build it yourself.</h1><p class="lead">From what you know in C to a working multiplayer game. The course is structured into 4 sequential Acts—from local state machines to full-stack persistence, live WebSockets, and production parity.</p><div class="acts-roadmap"><section class="act-card"><span class="act-badge">ACT 1 · M00–M05</span><h3>The Core Game Loop</h3><p>Build a pure TypeScript match engine &amp; scoring simulator runnable in Node.</p><ul><li>Destination &amp; Monorepo boundary</li><li>C to TypeScript &amp; Unit Testing</li><li>Match State Machine &amp; Clock</li><li>Visible Run, Scoring &amp; Deadlines</li></ul></section><section class="act-card"><span class="act-badge">ACT 2 · M06–M08</span><h3>Full-Stack &amp; Persistence</h3><p>Expose Fastify REST APIs, connect PostgreSQL, and render the React editor.</p><ul><li>Fastify Controller &amp; Zod Validation</li><li>React UI, CodeMirror &amp; Transport</li><li>PostgreSQL Store, Claims &amp; Recovery</li></ul></section><section class="act-card"><span class="act-badge">ACT 3 · M09–M12</span><h3>Real-Time Multiplayer Engine</h3><p>WebSockets, live presence, Yjs collaborative CRDTs, and Docker sandbox.</p><ul><li>Isolated C++/Python Judge Worker</li><li>WebSocket Auth, Lobby &amp; Presence</li><li>2v2 Collaborative Yjs Editing</li><li>Match &amp; Team Chat (Redis Pub/Sub)</li></ul></section><section class="act-card"><span class="act-badge">ACT 4 · M13</span><h3>Production Parity &amp; Handover</h3><p>Docker Compose topology, TLS proxy, and 42 subject compliance.</p><ul><li>Service Composition &amp; Orchestration</li><li>Self-Signed TLS &amp; Reverse Proxy</li><li>Parity Matrix &amp; Project Handover</li></ul></section></div><aside class="notice"><h2>Before you code</h2><p>Start at M00. This course is not a jump straight into a big app. First you learn the destination, then the rules, then the smallest building step.</p><ul><li><strong>Reference game:</strong> read only. Use it to see how the real behavior works.</li><li><strong>Practice folder:</strong> write your own small version here as you learn.</li><li><strong>Team repo:</strong> inspect this later, after your teammate confirms the real folders, scripts, and commands.</li></ul><p>Do not treat the team repo as ready just because the reference game is open. The browser can save a path; it cannot inspect your teammate’s folder or prove a command works.</p></aside><section class="continue-card"><span class="eyebrow">START WITH THE DESTINATION</span><h2 data-continue-title>${h(first?.title ?? "The first lesson is being written")}</h2><p data-continue-note>First see what the game does. You do not need your friend’s repository yet.</p>${first ? `<a class="primary" data-build-continue href="${h(first.output)}">Start learning <span>→</span></a>` : ""}</section><div class="home-points"><section><span>01</span><h3>See the idea</h3><p>Change an input and follow the values. Connect each explanation to the relevant code.</p></section><section><span>02</span><h3>Write a small part</h3><p>Know which folder and file to use, why it belongs there, and what to change.</p></section><section><span>03</span><h3>Check and connect</h3><p>Run a clear check, understand failures, then see what your new part enables.</p></section></div><aside class="notice">${readyCount} of ${course.path.lessons.length} lessons are available. The full route is shown at the left; ${readyCount < course.path.lessons.length ? "later lessons are still being written" : "all lessons are ready to explore"}. Your game is built by you, one checked step at a time.</aside>`,
    null,
    "build-home.template.html"
  );
  for (const lesson of course.lessons) {
    const referencesByStep = referenceAssignments(lesson);
    const entry = course.path.lessons.find((l) => l.id === lesson.id),
      index = course.path.lessons.indexOf(entry),
      next = course.path.lessons
        .slice(index + 1)
        .find((l) => l.status === "ready");
    await page(
      entry.output,
      `<div class="lesson-intro"><p class="eyebrow">${h(lesson.milestoneId)} · ${h(course.path.milestones.find((m) => m.id === lesson.milestoneId).title)}</p><h1>${h(lesson.title)}</h1><p class="lead">${h(lesson.outcome)}</p><details><summary>Why this comes now</summary><p>${h(lesson.why)}</p><p>Needs: ${lesson.prerequisites.length ? lesson.prerequisites.map((id) => h(course.path.lessons.find((l) => l.id === id).title)).join(", ") : "No earlier lesson."}</p></details></div><nav class="step-tabs" aria-label="Lesson steps">${lesson.steps.map((s, i) => `<a href="#${h(s.id)}" data-step-link="${h(s.id)}"><span>${i + 1}</span>${h(s.phase)}</a>`).join("")}</nav><p data-prerequisite-notice class="notice" hidden></p>${lesson.steps.map((s) => stepHtml(s, lesson, referencesByStep, referenceData)).join("")}<div class="step-navigation" data-step-navigation hidden><button type="button" data-back>Previous step</button><span data-step-count></span><button type="button" data-next class="primary">Next step</button></div><div data-next-lesson hidden>${next ? `<a class="primary" href="../${h(next.output)}">Next lesson: ${h(next.title)} →</a>` : readyCount === course.path.lessons.length ? "<p>You reached the end of the guided route. Your notes and checks stay saved.</p>" : "<p>You reached the currently available lessons. Your notes and checks stay saved. The next lesson is being written.</p>"}</div>`,
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
