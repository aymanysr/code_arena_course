// Exam Shell prototype contract check (repo-local adaptation of the plan's
// /private/tmp/campus-exam-shell-check.js). Throwaway prototype verification only.
// Run: NODE_PATH=<workspace-runtime-node_modules> node prototype/game-ui/checks/exam-shell-check.js
"use strict";

const fs = require("fs");
const path = require("path");

let playwright;
try {
  playwright = require("playwright-core");
} catch (firstError) {
  try {
    playwright = require("playwright");
  } catch (secondError) {
    throw new Error(
      "Playwright not found. Run with NODE_PATH pointing at the workspace runtime node_modules. " +
        `First error: ${firstError.message}`
    );
  }
}
const { chromium } = playwright;

const ROOT = path.resolve(__dirname, "..");
const FILE = `file://${path.join(ROOT, "04-live-match.html")}`;
const LOBBY = `file://${path.join(ROOT, "03-lobby.html")}`;
const SHOT_DIR = "/private/tmp/campus-equal-coding-role-screenshots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
}

// Public-pass sources: exact signature + every public marker as real code,
// no hidden edge behavior. Comments alone never satisfy the recognizer.
const PUBLIC_SOURCES = {
  "routing-interpreter": `int interpret_routes(const int *frames, int frame_count, const t_link *links, int link_count, t_request *requests)
{
    int checksum = 0;
    int best_cost = 0;
    int next_hop = 0;
    for (int i = 0; i < frame_count; i++) {
        checksum = frames[i];
        best_cost = best_cost + checksum;
        next_hop = i;
    }
    return checksum;
}`,
  "queue-scheduler": `int schedule_deliveries(const t_request *requests, int request_count, const int *capacity, t_delivery *deliveries)
{
    int priority = 0;
    int tick = 0;
    for (int i = 0; i < request_count; i++) {
        priority = i;
        tick = capacity[i];
    }
    return priority;
}`,
  "packet-decoder": `int decode_packets(const int *frames, int frame_count, t_packet *packets)
{
    int source = 0;
    int destination = 0;
    int checksum = 0;
    for (int i = 0; i < frame_count; i++) {
        source = frames[i];
        destination = source;
        checksum = source + destination;
    }
    return checksum;
}`,
  "route-planner": `int plan_routes(const t_packet *packets, int packet_count, const t_link *links, int link_count, t_route *routes)
{
    int best_cost = 0;
    int next_hop = 0;
    int tie = 0;
    for (int i = 0; i < packet_count; i++) {
        best_cost = i;
        next_hop = i;
        tie = best_cost + next_hop;
    }
    return best_cost;
}`,
  "congestion-controller": `int control_congestion(const t_route *routes, int route_count, const int *capacity, t_delivery *deliveries)
{
    int priority = 0;
    int tick = 0;
    for (int i = 0; i < route_count; i++) {
        priority = i;
        tick = capacity[i];
    }
    return priority;
}`,
};

// Hidden edge behavior: public markers plus the undisclosed edge cases.
// Appended as real code (never comments) before the final return.
const HIDDEN_LINES = {
  "routing-interpreter": "    int frame = frames[0];\n    int source = 0;\n    int destination = 1;\n    if (frame < 0) return -1;\n    if (source == destination) return -1;",
  "queue-scheduler": "    if (capacity == 0) return -1;\n    if (request_count == 0) return -1;",
  "packet-decoder": "    int frame = frames[0];\n    int packet_count = frame_count;\n    if (frame < 0) return -1;\n    if (packet_count == 0) return -1;",
  "route-planner": "    int source = 0;\n    int destination = 0;\n    if (source == destination) return -1;\n    if (link_count == 0) return -1;",
  "congestion-controller": "    if (capacity == 0) return -1;\n    if (route_count == 0) return -1;",
};

function withHidden(id) {
  return PUBLIC_SOURCES[id].replace("    return ", `${HIDDEN_LINES[id]}\n    return `);
}

async function examOf(page) {
  return page.evaluate(() => window.__MATCH_STATE__().exam);
}

async function passAllPublic(page, pairs) {
  for (const [role, id] of pairs) {
    await page.locator(`[data-action="select-role"][data-role="${role}"]`).click();
    await page.locator("#component-code").fill(PUBLIC_SOURCES[id]);
    await page.locator('[data-action="run-local-check"]').click();
  }
  await page.locator('[data-action="run-integration"]').click();
}

async function componentOf(page, id) {
  return page.evaluate((wanted) => window.__MATCH_STATE__().exam.components.find((item) => item.id === wanted), id);
}

async function errorsOf(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  return problems;
}

function desktop(browser) {
  return browser.newPage({ viewport: { width: 1440, height: 1000 } });
}
function mobile(browser) {
  return browser.newPage({ viewport: { width: 390, height: 844 } });
}

async function overflowPx(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });
}

async function smallTargets(page) {
  return page.evaluate(() => {
    const bad = [];
    const scope = document.querySelector("#game-ui") || document.querySelector("#content");
    if (!scope) return ["#game-ui/#content missing"];
    for (const element of scope.querySelectorAll("button, input, select, summary, textarea, a")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (parseFloat(style.opacity) === 0) continue; // label-proxied radios use visible 44px+ labels
      if (Math.min(rect.width, rect.height) < 44) {
        bad.push(`${element.tagName} "${(element.textContent || element.value || "").trim().slice(0, 40)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    return bad;
  });
}

async function smallText(page) {
  return page.evaluate(() => {
    const bad = [];
    const scope = document.querySelector("#game-ui") || document.querySelector("#content");
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (!parent || seen.has(parent)) continue;
      seen.add(parent);
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const size = parseFloat(getComputedStyle(parent).fontSize);
      if (size < 14) bad.push(`${parent.tagName} "${node.nodeValue.trim().slice(0, 40)}" ${size}px`);
      if (bad.length > 8) break;
    }
    return bad;
  });
}

async function focusedOutline(page) {
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab"); // previous-variant button (covered by :focus-visible rule)
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return "no-focus-target";
    const style = getComputedStyle(element);
    return `${element.tagName}#${element.id || "?"} outline:${style.outlineStyle}/${style.outlineWidth}`;
  });
}

async function assertViewportMatrix(browser, cases) {
  // Full overflow / target-size / text-size / visible-focus coverage across
  // every lobby/live variant at both required sizes. Screenshots prove
  // capture only; visual review is recorded in the compliance matrix.
  for (const { name, url, shot, click } of cases) {
    for (const [sizeName, factory] of [["desktop", desktop], ["mobile", mobile]]) {
      const page = await factory(browser);
      const problems = await errorsOf(page);
      await page.goto(url);
      if (click) await page.locator(click).click();
      assert(await overflowPx(page) <= 1, `${name} ${sizeName}: horizontal overflow`);
      const targets = await smallTargets(page);
      assert(targets.length === 0, `${name} ${sizeName}: undersized targets: ${JSON.stringify(targets)}`);
      const text = await smallText(page);
      assert(text.length === 0, `${name} ${sizeName}: text below 14px: ${JSON.stringify(text)}`);
      const focus = await focusedOutline(page);
      assert(!/no-focus-target/.test(focus) && !/none\/0px/.test(focus), `${name} ${sizeName}: no visible keyboard focus (${focus})`);
      assert((await page.locator("h1").count()) === 1, `${name} ${sizeName}: expected exactly one h1`);
      if (shot && ((sizeName === "desktop" && shot.desktop) || (sizeName === "mobile" && shot.mobile))) {
        await page.screenshot({ path: path.join(SHOT_DIR, sizeName === "desktop" ? shot.desktop : shot.mobile) });
      }
      assert(problems.length === 0, `${name} ${sizeName}: errors: ${problems.join(" | ")}`);
      await page.close();
    }
  }
}

async function main() {
  const browser = await chromium.launch();
  try {
    // ---- Task 1: blind programming-style cards in the lobby (Variant A) ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${LOBBY}?variant=A`);
      const LEAKED = ["packet_router", "Packet Decoder", "Route Planner", "Congestion Controller",
        "decode_packets", "plan_routes", "control_congestion", "0314"];
      const body = (await page.locator("body").innerText()) || "";
      for (const leaked of LEAKED) {
        assert(!body.includes(leaked), `lobby leaked subject detail: ${leaked}`);
      }
      assert(body.includes("Sequence transformation"), "sequence style card missing");
      assert(body.includes("Stateful constraints"), "stateful style card missing");
      assert(!body.includes("Deterministic search"), "2v2 must show exactly two style cards");
      assert(body.includes("Equal expected workload"), "style cards must not imply a difficulty advantage");
      assert((await page.locator('input[data-action="choose-role"]').count()) === 2, "2v2 must expose exactly two role inputs");
      for (const old of ["Code reader", "Input analyst", "Answer builder"]) {
        assert(!body.includes(old), `lobby still shows old role: ${old}`);
      }
      const startGate = page.locator('[data-action="start"]');
      assert((await startGate.getAttribute("aria-disabled")) === "true", "start must be disabled before fill+ready");
      assert(problems.length === 0, `lobby 2v2 static: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 1: 3v3 exposes all three style cards ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${LOBBY}?variant=A`);
      await page.getByText("3 vs 3", { exact: true }).click();
      const body = (await page.locator("body").innerText()) || "";
      for (const card of ["Sequence transformation", "Deterministic search", "Stateful constraints"]) {
        assert(body.includes(card), `3v3 style card missing: ${card}`);
      }
      for (const id of ["sequence", "search", "stateful"]) {
        assert((await page.locator(`input[data-action="choose-role"][value="${id}"]`).count()) === 1,
          `3v3 must expose ${id} exactly once per assignment control`);
      }
      for (const old of ["Code reader", "Input analyst", "Answer builder"]) {
        assert(!body.includes(old), `3v3 lobby still shows old role: ${old}`);
      }
      const panel = (await page.locator('section[aria-labelledby="blue-title"]').innerText()) || "";
      const coral = (await page.locator('section[aria-labelledby="coral-title"]').innerText()) || "";
      for (const [label, text] of [["blue", panel], ["coral", coral]]) {
        const order = ["Sequence transformation", "Deterministic search", "Stateful constraints"].map((name) => text.indexOf(name));
        assert(order.every((index) => index !== -1), `3v3 ${label} team must list every style card`);
        assert(order[0] < order[1] && order[1] < order[2], `3v3 ${label} team must use the same ordered role IDs`);
      }
      assert(problems.length === 0, `lobby 3v3 static: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 1: duplicate claims rejected, role change clears ready, start gated ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${LOBBY}?variant=A`);
      await page.getByRole("button", { name: /fill demo players/i }).click();
      const occupied = page.locator('input[data-action="choose-role"][value="stateful"]');
      assert(await occupied.isDisabled(), "roles taken by teammates must be unavailable");
      await page.evaluate(() => {
        document.querySelector('input[data-action="choose-role"][value="stateful"]').disabled = false;
      });
      await page.locator('label[for="a-stateful"]').click();
      assert((await page.locator('input[data-action="choose-role"][value="sequence"]').isChecked()),
        "a forced duplicate claim must not change the player's role");
      const blue = (await page.locator('section[aria-labelledby="blue-title"]').innerText()) || "";
      const coral = (await page.locator('section[aria-labelledby="coral-title"]').innerText()) || "";
      for (const [label, text] of [["blue", blue], ["coral", coral]]) {
        const seq = text.indexOf("Sequence transformation");
        const sta = text.indexOf("Stateful constraints");
        assert(seq !== -1 && sta !== -1 && seq < sta, `${label} team must carry the same ordered role IDs`);
      }
      const startGate = page.locator('[data-action="start"]');
      assert((await startGate.getAttribute("aria-disabled")) === "true", "start must stay disabled until the host is ready");
      await page.locator('[data-action="toggle-ready"]').click();
      assert((await startGate.getAttribute("aria-disabled")) === "false", "start must enable once every slot is filled and ready");
      await page.locator('[data-action="toggle-connection"]').click();
      assert((await startGate.getAttribute("aria-disabled")) === "true", "start must block while a reserved slot is disconnected");
      await page.locator('[data-action="toggle-connection"]').click();
      assert((await startGate.getAttribute("aria-disabled")) === "false", "start must recover after reconnection");
      assert(problems.length === 0, `lobby readiness: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 1: changing a claimed role clears readiness ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${LOBBY}?variant=A`);
      await page.locator('[data-action="choose-team"][data-team="coral"]').click();
      await page.locator('label[for="a-sequence"]').click();
      await page.locator('[data-action="toggle-ready"]').click();
      const assignment = page.locator('section[aria-labelledby="a-assignment-title"]');
      assert(((await assignment.innerText()) || "").includes("Ready ✓"), "player must be ready after confirming a style");
      await page.locator('label[for="a-stateful"]').click();
      assert(((await assignment.innerText()) || "").includes("Editing"), "changing a claimed style must clear readiness");
      assert(problems.length === 0, `lobby role change: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 1: live-match handoff carries teamSize + role ----
    for (const [sizeLabel, size, roleValue, roleLabel] of [["2v2", "2", "sequence", "a-sequence"], ["3v3", "3", "sequence", "a-sequence"]]) {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${LOBBY}?variant=A`);
      if (size === "3") await page.getByText("3 vs 3", { exact: true }).click();
      await page.getByRole("button", { name: /fill demo players/i }).click();
      await page.locator(`label[for="${roleLabel}"]`).click();
      await page.locator('[data-action="toggle-ready"]').click();
      await page.locator('[data-action="start"]').click();
      const href = await page.getByRole("link", { name: /open active-match prototype/i }).getAttribute("href");
      const target = new URL(href, page.url());
      assert(target.searchParams.get("teamSize") === size, `lobby must hand off teamSize=${size} (${sizeLabel})`);
      assert(target.searchParams.get("role") === roleValue, `lobby must hand off the chosen role (${sizeLabel})`);
      assert(problems.length === 0, `lobby handoff ${sizeLabel}: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 2: reveal, mapping, and ownership across all six live URLs ----
    {
      const lobbySource = fs.readFileSync(path.join(ROOT, "03-lobby.html"), "utf8");
      for (const leaked of ["packet_router", "Packet Decoder", "Route Planner", "Congestion Controller",
        "decode_packets", "plan_routes", "control_congestion", "0314"]) {
        assert(!lobbySource.includes(leaked), `lobby file leaked subject detail: ${leaked}`);
      }
      const cases = [
        { url: "?variant=A&teamSize=2&role=sequence", size: 2, active: "sequence", total: 2,
          names: ["Routing Interpreter", "Queue Scheduler"], absent: ["Packet Decoder", "Route Planner", "Congestion Controller"],
          roles: ["sequence", "stateful"], owners: ["Aimane", "Saad"],
          reveal: "Sequence transformation → Routing Interpreter" },
        { url: "?variant=A&teamSize=2&role=stateful", size: 2, active: "stateful", total: 2,
          names: ["Routing Interpreter", "Queue Scheduler"], absent: ["Packet Decoder", "Route Planner", "Congestion Controller"],
          roles: ["sequence", "stateful"], owners: ["Aimane", "Saad"],
          reveal: "Stateful constraints → Queue Scheduler" },
        { url: "?variant=A&teamSize=3&role=sequence", size: 3, active: "sequence", total: 3,
          names: ["Packet Decoder", "Route Planner", "Congestion Controller"], absent: ["Routing Interpreter", "Queue Scheduler"],
          roles: ["sequence", "search", "stateful"], owners: ["Aimane", "Yasmine", "Saad"],
          reveal: "Sequence transformation → Packet Decoder" },
        { url: "?variant=A&teamSize=3&role=search", size: 3, active: "search", total: 3,
          names: ["Packet Decoder", "Route Planner", "Congestion Controller"], absent: ["Routing Interpreter", "Queue Scheduler"],
          roles: ["sequence", "search", "stateful"], owners: ["Aimane", "Yasmine", "Saad"],
          reveal: "Deterministic search → Route Planner" },
        { url: "?variant=A&teamSize=3&role=stateful", size: 3, active: "stateful", total: 3,
          names: ["Packet Decoder", "Route Planner", "Congestion Controller"], absent: ["Routing Interpreter", "Queue Scheduler"],
          roles: ["sequence", "search", "stateful"], owners: ["Aimane", "Yasmine", "Saad"],
          reveal: "Stateful constraints → Congestion Controller" },
      ];
      // The 2v2 sequence URL doubles as the Task 2 state-shape reference below.
      for (const live of cases) {
        const page = await desktop(browser);
        const problems = await errorsOf(page);
        await page.goto(`${FILE}${live.url}`);
        const shell = page.locator('.variant-a[data-exam-shell]');
        assert(await shell.isVisible(), `${live.url}: [data-exam-shell] .variant-a not visible`);
        assert((await shell.getAttribute("data-team-size")) === String(live.size), `${live.url}: data-team-size must be ${live.size}`);
        assert(((await page.locator("#game-ui h1").count())) === 1, `${live.url}: expected exactly one h1`);
        assert(await page.getByText("42-INSPIRED SIMULATION").first().isVisible(), `${live.url}: 42-INSPIRED SIMULATION missing`);
        assert(await page.getByText("FAKE GRADER").first().isVisible(), `${live.url}: FAKE GRADER missing`);
        assert(await page.getByText("EXPLORATION ONLY — NOT PRODUCTION CODE EXECUTION").first().isVisible(), `${live.url}: exploration-only banner missing`);
        const subject = page.locator(".exam-subject");
        for (const token of ["packet_router", "four decimal digits", "(S + D + P) % 10 == C", "0314", "0-1-3"]) {
          assert(((await subject.textContent()) || "").includes(token), `${live.url}: subject missing ${token}`);
        }
        for (const name of live.names) {
          assert(await page.getByText(name, { exact: false }).first().isVisible(), `${live.url}: component missing: ${name}`);
        }
        for (const name of live.absent) {
          assert((await page.getByText(name, { exact: true }).count()) === 0, `${live.url}: wrong-pipeline component visible: ${name}`);
        }
        assert(await page.getByText(live.reveal).first().isVisible(), `${live.url}: reveal line missing: ${live.reveal}`);
        assert(await page.getByText(/generated stub/i).first().isVisible(), `${live.url}: generated-stub copy missing`);
        const team = page.locator(".exam-team");
        const teamText = (await team.textContent()) || "";
        for (const owner of live.owners) assert(teamText.includes(owner), `${live.url}: team strip missing ${owner}`);
        const opponent = page.locator('[data-exam="opponent"]');
        assert(((await opponent.textContent()) || "").includes(`Opponent components 0/${live.total}`), `${live.url}: opponent summary missing`);
        assert(((await opponent.textContent()) || "").includes("Submission hidden"), `${live.url}: opponent submission state missing`);
        assert((await opponent.locator("textarea").count()) === 0, `${live.url}: opponent strip must never expose code`);
        const editor = page.locator("#component-code");
        assert(await editor.isEditable(), `${live.url}: active role editor must be editable`);
        for (const role of live.roles.filter((id) => id !== live.active)) {
          const peer = live.names[live.roles.indexOf(role)];
          await page.getByRole("button", { name: new RegExp(peer, "i") }).first().click();
          assert(await page.locator("#component-code").isDisabled(), `${live.url}: teammate editor for ${peer} must be read-only`);
          assert(await page.getByText("Read-only teammate file").first().isVisible(), `${live.url}: read-only label missing for ${peer}`);
        }
        const exam = await page.evaluate(() => window.__MATCH_STATE__().exam);
        assert(exam.phase === "active", `${live.url}: exam.phase must be active`);
        assert(exam.teamSize === live.size, `${live.url}: exam.teamSize must be ${live.size}`);
        assert(exam.activeRole === live.active && exam.selectedRole === live.active, `${live.url}: active/selected role must be ${live.active}`);
        assert(exam.subjectVisible === true, `${live.url}: subjectVisible must be true`);
        assert(exam.opponent.completedComponents === 0 && exam.opponent.totalComponents === live.total && exam.opponent.submitted === false,
          `${live.url}: opponent state mismatch`);
        assert(exam.components.length === live.total, `${live.url}: expected ${live.total} components`);
        assert(exam.components.map((item) => item.roleId).join(",") === live.roles.join(","),
          `${live.url}: both teams must use the same ordered role IDs`);
        for (const component of exam.components) {
          assert(component.code.includes(component.signature), `${live.url}: ${component.id} starter must carry its signature`);
          assert(component.revision === 1 && component.compileStatus === "idle" && component.localStatus === "idle" &&
            component.integrationStatus === "idle" && component.diagnostics.length === 0, `${live.url}: ${component.id} must start idle`);
        }
        assert(exam.integration.status === "idle" && exam.integration.detail === "Not run" && exam.integration.revisionKey === "",
          `${live.url}: integration must start idle`);
        assert(exam.teamCases.length === 0 && exam.submissions.length === 0, `${live.url}: cases/submissions must start empty`);
        const top = await page.evaluate(() => window.__MATCH_STATE__());
        assert(top.remainingSeconds === 582 && top.cooldown === 0 && top.trace === null &&
          top.lastEvent === "Subject revealed. All component stations are active." && top.messages.length === 0,
          `${live.url}: top-level legacy fields mismatch`);
        assert(await page.getByRole("link", { name: /journey/i }).first().isVisible(), `${live.url}: Journey link missing`);
        assert(problems.length === 0, `${live.url}: errors: ${problems.join(" | ")}`);
        await page.close();
      }
    }

    // ---- Task 2: state-clone isolation and invalid-URL fallback ----
    {
      const page = await desktop(browser);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      const cloneSafe = await page.evaluate(() => {
        const first = window.__MATCH_STATE__();
        first.exam.components[0].code = "MUTATED";
        first.exam.submissions.push({ status: "fake" });
        const second = window.__MATCH_STATE__();
        return second.exam.components[0].code !== "MUTATED" && second.exam.submissions.length === 0;
      });
      assert(cloneSafe, "match state hook must return an isolated clone");
      await page.goto(`${FILE}?variant=A&teamSize=9&role=search`);
      const fallback = await page.evaluate(() => window.__MATCH_STATE__().exam);
      assert(fallback.teamSize === 2 && fallback.activeRole === "sequence",
        `invalid URL must fall back to 2v2 sequence, got ${fallback.teamSize}/${fallback.activeRole}`);
      await page.close();
    }

    // ---- Task 3: owner-only editing and component-local checks ----
    for (const team of [
      { size: 2, roles: ["sequence", "stateful"], ids: ["routing-interpreter", "queue-scheduler"] },
      { size: 3, roles: ["sequence", "search", "stateful"], ids: ["packet-decoder", "route-planner", "congestion-controller"] },
    ]) {
      for (const role of team.roles) {
        const id = team.ids[team.roles.indexOf(role)];
        const page = await desktop(browser);
        const problems = await errorsOf(page);
        await page.goto(`${FILE}?variant=A&teamSize=${team.size}&role=${role}`);
        // The untouched starter fails its local check with a labelled diagnostic, penalty-free.
        await page.locator('[data-action="run-local-check"]').click();
        let component = await componentOf(page, id);
        assert(component.compileStatus === "passed", `${id}: starter must compile (signature + return)`);
        assert(component.localStatus === "failed", `${id}: starter must fail its local check`);
        assert(component.diagnostics.length === 1 && component.diagnostics[0].startsWith("SIMULATED"),
          `${id}: starter diagnostic must be labelled SIMULATED`);
        const clean = await page.evaluate(() => {
          const top = window.__MATCH_STATE__();
          return top.cooldown === 0 && top.trace === null && top.exam.submissions.length === 0;
        });
        assert(clean, `${id}: local checks must carry no trace, cooldown, or submission`);
        // Teammate files stay visible but read-only through their tabs.
        for (const peer of team.ids.filter((item) => item !== id)) {
          await page.locator(`[data-action="select-tab"][data-component="${peer}"]`).click();
          assert(await page.locator("#component-code").isDisabled(), `${id}: teammate editor ${peer} must be disabled`);
          assert(await page.getByText("Read-only teammate file").first().isVisible(), `${id}: read-only label missing for ${peer}`);
        }
        await page.locator(`[data-action="select-tab"][data-component="${id}"]`).click();
        // A public-pass source passes only its own component.
        await page.locator("#component-code").fill(PUBLIC_SOURCES[id]);
        await page.locator('[data-action="run-local-check"]').click();
        component = await componentOf(page, id);
        assert(component.compileStatus === "passed" && component.localStatus === "passed", `${id}: public-pass source must pass`);
        for (const peer of team.ids.filter((item) => item !== id)) {
          const other = await componentOf(page, peer);
          assert(other.localStatus === "idle", `${id}: local check must not touch ${peer}`);
        }
        assert(problems.length === 0, `${id} local: errors: ${problems.join(" | ")}`);
        await page.close();
      }
    }

    // ---- Task 3: integration gating, team cases, and edit invalidation (2v2) ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      await page.locator('[data-action="run-integration"]').click();
      let exam = await examOf(page);
      assert(exam.integration.status === "blocked" && exam.integration.detail.includes("BLOCKED — compile every component"),
        "integration must block before every component compiles");
      assert(exam.submissions.length === 0, "blocked integration must carry no penalty");
      await page.locator("#component-code").fill(PUBLIC_SOURCES["routing-interpreter"]);
      await page.locator('[data-action="run-local-check"]').click();
      await page.locator('[data-action="select-role"][data-role="stateful"]').click();
      await page.locator('[data-action="run-local-check"]').click();
      await page.locator('[data-action="run-integration"]').click();
      exam = await examOf(page);
      assert(exam.integration.status === "failed" && exam.integration.detail.includes("SIMULATED contract mismatch — inspect the Queue Scheduler contract"),
        "integration must name the mismatching contract after one local pass");
      assert(exam.submissions.length === 0 && (await page.evaluate(() => window.__MATCH_STATE__())).cooldown === 0,
        "mismatch integration must carry no penalty");
      await page.locator('[data-action="select-role"][data-role="stateful"]').click();
      await page.locator("#component-code").fill(PUBLIC_SOURCES["queue-scheduler"]);
      await page.locator('[data-action="run-local-check"]').click();
      await page.locator('[data-action="run-integration"]').click();
      exam = await examOf(page);
      assert(exam.integration.status === "passed" && exam.integration.detail.includes("PASSED — pipeline contracts connected"),
        "integration must pass once every public local check passes");
      const expectedKey = exam.components.map((item) => `${item.roleId}:${item.revision}`).join("|");
      assert(exam.integration.revisionKey === expectedKey && expectedKey.includes("sequence:") && expectedKey.includes("stateful:"),
        `integration must record the joined revision key, got ${exam.integration.revisionKey}`);
      const clockBefore = await page.evaluate(() => window.__MATCH_STATE__().remainingSeconds);
      await page.locator("#team-case-input").fill("frames=0314,0325; capacity=1");
      await page.locator('[data-action="add-team-case"]').click();
      exam = await examOf(page);
      assert(exam.teamCases.length === 1 && exam.teamCases[0].input === "frames=0314,0325; capacity=1",
        "team-authored input must be stored in exam.teamCases");
      assert(((await page.locator('[data-exam="team-cases"]').innerText()) || "").includes("frames=0314,0325; capacity=1"),
        "local terminal must display the stored team case");
      assert(((await page.locator('[data-exam="integration-cases"]').innerText()) || "").includes("frames=0314,0325; capacity=1"),
        "integration terminal must display the stored team case");
      assert(exam.components.every((item) => item.localStatus === "idle" && item.integrationStatus === "idle"),
        "adding a team case must invalidate local/integration readiness");
      assert(exam.components.every((item) => item.compileStatus === "passed"),
        "adding a team case must not change compile status");
      const afterCase = await page.evaluate(() => window.__MATCH_STATE__());
      assert(afterCase.remainingSeconds === clockBefore && afterCase.cooldown === 0 && afterCase.trace === null &&
        afterCase.exam.submissions.length === 0, "adding a team case must leave clocks and penalties unchanged");
      for (const [role, id] of [["sequence", "routing-interpreter"], ["stateful", "queue-scheduler"]]) {
        await page.locator(`[data-action="select-role"][data-role="${role}"]`).click();
        await page.locator('[data-action="run-local-check"]').click();
        const component = await componentOf(page, id);
        assert(component.localStatus === "passed" && component.diagnostics[0].includes("plus 1 team"),
          `${id}: rerun must report the public example plus one team case`);
      }
      await page.locator('[data-action="run-integration"]').click();
      exam = await examOf(page);
      assert(exam.integration.status === "passed" && exam.integration.detail.includes("plus 1 team"),
        "green integration must report the public example plus every stored team input");
      await page.locator('[data-action="select-role"][data-role="sequence"]').click();
      await page.locator("#component-code").fill(`${PUBLIC_SOURCES["routing-interpreter"]}\n/* tweak */`);
      exam = await examOf(page);
      const edited = exam.components.find((item) => item.id === "routing-interpreter");
      assert(edited.compileStatus === "idle" && edited.localStatus === "idle" && edited.integrationStatus === "idle",
        "editing after green integration must reset that component to idle");
      assert(exam.integration.status === "idle",
        "editing after green integration must reset integration");
      const traceCleared = await page.evaluate(() => window.__MATCH_STATE__().trace);
      assert(traceCleared === null, "editing must clear the Failure trace");
      assert(await page.locator('[data-exam="submit"]').isDisabled(), "editing must disable Submit");
      await page.locator('[data-action="select-tab"][data-component="queue-scheduler"]').click();
      await page.evaluate(() => {
        const area = document.querySelector("#component-code");
        area.disabled = false;
        area.value = "HACKED";
        area.dispatchEvent(new Event("input", { bubbles: true }));
      });
      const peerCode = (await componentOf(page, "queue-scheduler")).code;
      assert(!peerCode.includes("HACKED"), "a teammate edit attempt must not change stored source");
      assert(problems.length === 0, `integration workflow: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 3: full public pipeline passes in 3v3 ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=3&role=sequence`);
      for (const [role, id] of [["sequence", "packet-decoder"], ["search", "route-planner"], ["stateful", "congestion-controller"]]) {
        await page.locator(`[data-action="select-role"][data-role="${role}"]`).click();
        await page.locator("#component-code").fill(PUBLIC_SOURCES[id]);
        await page.locator('[data-action="run-local-check"]').click();
      }
      await page.locator('[data-action="run-integration"]').click();
      const exam = await examOf(page);
      assert(exam.integration.status === "passed", "3v3 integration must pass once every public local check passes");
      assert(exam.components.every((item) => item.integrationStatus === "passed"), "3v3 green integration must cover every component");
      assert(problems.length === 0, `3v3 integration: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 4: hidden submission failure, cooldown, then pass (2v2) ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      await passAllPublic(page, [["sequence", "routing-interpreter"], ["stateful", "queue-scheduler"]]);
      assert(await page.locator('[data-exam="submit"]').isEnabled(), "submit must enable after green integration");
      await page.locator('[data-exam="submit"]').click();
      let exam = await examOf(page);
      assert(exam.submissions.length === 1 && exam.submissions[0].status === "failed",
        "public-pass sources must fail the hidden evaluation once");
      const trace = (await page.locator(".exam-trace").innerText()) || "";
      assert(/SIMULATED hidden evaluation/i.test(trace), "failure trace must be labelled simulated hidden evaluation");
      for (const hidden of ["frame < 0", "source == destination", "capacity == 0", "request_count == 0"]) {
        assert(!trace.includes(hidden), `failure trace must not reveal hidden detail: ${hidden}`);
      }
      assert((await page.evaluate(() => window.__MATCH_STATE__())).cooldown === 15, "failed submission must start a 15-second cooldown");
      assert(await page.getByText(/15.*cooldown|cooldown.*15/i).first().isVisible(), "cooldown copy must show 15 seconds");
      assert((await page.evaluate(() => document.activeElement && document.activeElement.id)) === "failure-trace-title",
        "focus must move to the failure trace");
      await page.locator('[data-action="select-role"][data-role="sequence"]').click();
      assert(await page.locator("#component-code").isEditable(), "editing must stay available during cooldown");
      assert(await page.locator('[data-action="run-local-check"]').isEnabled(), "local checks must stay available during cooldown");
      assert(await page.locator('[data-action="run-integration"]').isEnabled(), "integration must stay available during cooldown");
      assert(await page.locator("#team-message").isEditable(), "team chat must stay available during cooldown");
      assert(await page.locator('[data-exam="submit"]').isDisabled(), "only resubmission must be blocked during cooldown");
      const before = await page.evaluate(() => window.__MATCH_STATE__().remainingSeconds);
      await page.locator('[data-action="advance-cooldown"]').click();
      const after = await page.evaluate(() => window.__MATCH_STATE__().remainingSeconds);
      assert(before - after === 15, `match clock must lose exactly 15s, lost ${before - after}s`);
      for (const [role, id] of [["sequence", "routing-interpreter"], ["stateful", "queue-scheduler"]]) {
        await page.locator(`[data-action="select-role"][data-role="${role}"]`).click();
        await page.locator("#component-code").fill(withHidden(id));
        await page.locator('[data-action="run-local-check"]').click();
      }
      await page.locator('[data-action="run-integration"]').click();
      await page.locator('[data-exam="submit"]').click();
      exam = await examOf(page);
      assert(exam.submissions.length === 2 && exam.submissions[1].status === "passed", "hidden edge behavior must pass");
      assert(exam.phase === "finished", "exam.phase must be finished after a passed submission");
      assert(await page.getByText("SUBJECT COMPLETE").first().isVisible(), "completion heading missing");
      assert(await page.getByText(/future subject/i).first().isVisible(), "voluntary future swap copy missing");
      assert((await page.evaluate(() => document.activeElement && document.activeElement.id)) === "completion-title",
        "focus must move to the completion heading");
      assert(problems.length === 0, `2v2 submission journey: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 4: hidden submission failure, cooldown, then pass (3v3) ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=3&role=search`);
      await passAllPublic(page, [["sequence", "packet-decoder"], ["search", "route-planner"], ["stateful", "congestion-controller"]]);
      await page.locator('[data-exam="submit"]').click();
      let exam = await examOf(page);
      assert(exam.submissions.length === 1 && exam.submissions[0].status === "failed", "3v3 public-pass must fail hidden evaluation");
      assert((await page.evaluate(() => window.__MATCH_STATE__())).cooldown === 15, "3v3 failed submission must cool down 15s");
      await page.locator('[data-action="advance-cooldown"]').click();
      for (const [role, id] of [["sequence", "packet-decoder"], ["search", "route-planner"], ["stateful", "congestion-controller"]]) {
        await page.locator(`[data-action="select-role"][data-role="${role}"]`).click();
        await page.locator("#component-code").fill(withHidden(id));
        await page.locator('[data-action="run-local-check"]').click();
      }
      await page.locator('[data-action="run-integration"]').click();
      await page.locator('[data-exam="submit"]').click();
      exam = await examOf(page);
      assert(exam.submissions.length === 2 && exam.submissions[1].status === "passed" && exam.phase === "finished",
        "3v3 hidden edge behavior must pass and finish");
      assert((await page.evaluate(() => document.activeElement && document.activeElement.id)) === "completion-title",
        "3v3 focus must move to the completion heading");
      assert(problems.length === 0, `3v3 submission journey: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 4: disconnect reserves ownership and restores it (2v2) ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      const before = await componentOf(page, "routing-interpreter");
      const clockBefore = await page.evaluate(() => window.__MATCH_STATE__().remainingSeconds);
      await page.locator('[data-action="toggle-connection"][data-role="sequence"]').click();
      let component = await componentOf(page, "routing-interpreter");
      assert(component.connected === false, "toggle must mark the owner offline");
      assert(component.owner === "Aimane" && component.code === before.code && component.revision === before.revision,
        "disconnect must keep ownership and source unchanged");
      assert(await page.getByText("RESERVED · OFFLINE").first().isVisible(), "team strip must show RESERVED · OFFLINE");
      assert(await page.locator("#component-code").isDisabled(), "the editor must disable for an offline owner");
      const clockDuring = await page.evaluate(() => window.__MATCH_STATE__());
      assert(clockDuring.remainingSeconds === clockBefore && clockDuring.cooldown === 0, "disconnect must leave clocks unchanged");
      await page.locator('[data-action="run-local-check"]').click();
      component = await componentOf(page, "routing-interpreter");
      assert(component.localStatus === "idle", "local checks for the offline owner must be rejected");
      assert(((await page.evaluate(() => window.__MATCH_STATE__().lastEvent)) || "").includes("offline"),
        "rejection must name the offline reservation");
      await page.locator('[data-action="select-role"][data-role="stateful"]').click();
      await page.locator('[data-action="select-tab"][data-component="routing-interpreter"]').click();
      assert(await page.locator("#component-code").isDisabled(), "no teammate may inherit edit permission");
      await page.locator('[data-action="toggle-connection"][data-role="sequence"]').click();
      component = await componentOf(page, "routing-interpreter");
      assert(component.connected === true && component.code === before.code, "reconnect must restore the same component state");
      await page.locator('[data-action="select-role"][data-role="sequence"]').click();
      assert(await page.locator("#component-code").isEditable(), "reconnect must restore edit access");
      assert(problems.length === 0, `disconnect recovery: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 4: disconnect reserves ownership in 3v3 ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=3&role=search`);
      const before = await componentOf(page, "route-planner");
      await page.locator('[data-action="toggle-connection"][data-role="search"]').click();
      let component = await componentOf(page, "route-planner");
      assert(component.connected === false && component.owner === "Yasmine" && component.code === before.code,
        "3v3 disconnect must reserve ownership and source");
      assert(await page.locator("#component-code").isDisabled(), "3v3 editor must disable for the offline owner");
      await page.locator('[data-action="toggle-connection"][data-role="search"]').click();
      component = await componentOf(page, "route-planner");
      assert(component.connected === true && component.code === before.code, "3v3 reconnect must restore state");
      assert(await page.locator("#component-code").isEditable(), "3v3 reconnect must restore edit access");
      assert(problems.length === 0, `3v3 disconnect: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 5: security boundary + selected/historical labels ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      const liveHtml = await page.content();
      for (const forbidden of ["eval(", "new Function", "fetch(", "Worker(", "WebSocket(", "localStorage", "sessionStorage"]) {
        assert(!liveHtml.includes(forbidden), `live: forbidden primitive in page: ${forbidden}`);
      }
      assert(((await page.locator("#selected-direction").textContent()) || "").includes("Selected direction"),
        "live A must be labelled the selected direction");
      await page.goto(`${LOBBY}?variant=A`);
      const lobbyHtml = await page.content();
      for (const forbidden of ["eval(", "new Function", "fetch(", "Worker(", "WebSocket(", "localStorage", "sessionStorage"]) {
        assert(!lobbyHtml.includes(forbidden), `lobby: forbidden primitive in page: ${forbidden}`);
      }
      assert(problems.length === 0, `boundary scan: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    // ---- Task 5: B/C remain labelled historical alternatives ----

    // ---- B/C regression + keyboard guard + historical labels ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      await page.getByRole("button", { name: "Next UI variant" }).click();
      assert(new URL(page.url()).searchParams.get("variant") === "B", "switcher: A -> B did not update URL");
      assert(((await page.locator("#variant-name").textContent()) || "").includes("Focus workspace"), "switcher: B label missing");
      assert(((await page.locator("#selected-direction").textContent()) || "").includes("Historical alternative"),
        "live B must be labelled a historical alternative");
      await page.getByRole("button", { name: "Next UI variant" }).click();
      assert(new URL(page.url()).searchParams.get("variant") === "C", "switcher: B -> C did not update URL");
      await page.keyboard.press("ArrowLeft");
      assert(new URL(page.url()).searchParams.get("variant") === "B", "arrow key: C -> B failed outside inputs");

      await page.goto(`${FILE}?variant=B`);
      await page.getByText(/team chat ·/i).first().click();
      await page.getByPlaceholder(/message team/i).first().click();
      await page.keyboard.press("ArrowRight");
      assert(new URL(page.url()).searchParams.get("variant") === "B", "arrow key: must not switch while chat input focused");

      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      await page.locator("#component-code").click();
      await page.keyboard.press("ArrowRight");
      assert(new URL(page.url()).searchParams.get("variant") === "A", "arrow key: must not switch while editor focused");

      await page.goto(`${LOBBY}?variant=A`);
      await page.getByRole("button", { name: "Next lobby variant" }).click();
      assert(new URL(page.url()).searchParams.get("variant") === "B", "lobby switcher: A -> B did not update URL");
      assert(((await page.locator("#selected-direction").textContent()) || "").includes("Historical alternative"),
        "lobby B must be labelled a historical alternative");
      await page.keyboard.press("ArrowLeft");
      assert(new URL(page.url()).searchParams.get("variant") === "A", "lobby arrow key: B -> A failed");
      assert(problems.length === 0, `regression desktop: errors: ${problems.join(" | ")}`);
      await page.close();
    }
    // ---- Task 5: full lobby × live viewport matrix ----
    await assertViewportMatrix(browser, [
      { name: "lobby-a-2v2", url: `${LOBBY}?variant=A`, shot: { desktop: "lobby-a-desktop.png", mobile: "lobby-a-mobile.png" } },
      { name: "lobby-a-3v3", url: `${LOBBY}?variant=A`, click: "label[for='format-3']", shot: null },
      { name: "lobby-b", url: `${LOBBY}?variant=B`, shot: null },
      { name: "lobby-c", url: `${LOBBY}?variant=C`, shot: null },
      { name: "live-a-2v2-sequence", url: `${FILE}?variant=A&teamSize=2&role=sequence`, shot: { desktop: "live-a-2v2-desktop.png", mobile: "live-a-2v2-mobile.png" } },
      { name: "live-a-2v2-stateful", url: `${FILE}?variant=A&teamSize=2&role=stateful`, shot: null },
      { name: "live-a-3v3-sequence", url: `${FILE}?variant=A&teamSize=3&role=sequence`, shot: null },
      { name: "live-a-3v3-search", url: `${FILE}?variant=A&teamSize=3&role=search`, shot: { desktop: "live-a-3v3-desktop.png", mobile: "live-a-3v3-mobile.png" } },
      { name: "live-a-3v3-stateful", url: `${FILE}?variant=A&teamSize=3&role=stateful`, shot: null },
      { name: "live-b", url: `${FILE}?variant=B`, shot: null },
      { name: "live-c", url: `${FILE}?variant=C`, shot: null },
    ]);

    // ---- Live region: exactly one polite region page-wide ----
    {
      const page = await desktop(browser);
      await page.goto(`${FILE}?variant=A&teamSize=2&role=sequence`);
      assert((await page.locator("[aria-live='polite']").count()) === 1, "expected exactly one polite live region page-wide");
      assert((await page.locator("#live-status[aria-live='polite']").count()) === 1, "the single polite region must be #live-status");
      assert((await page.locator(".variant-a [aria-live]").count()) === 0, "exam shell must not add its own live regions (clock stays quiet)");
      await page.close();
    }

    // ---- Historical Variant B: legacy immediate Hint copy ----
    {
      const page = await desktop(browser);
      const problems = await errorsOf(page);
      await page.goto(`${FILE}?variant=B`);
      await page.getByRole("button", { name: /hint/i }).click();
      const hintCopy = (await page.locator("#hint-how").textContent()) || "";
      assert(/legacy simulation/i.test(hintCopy) && /immediately/i.test(hintCopy),
        `variant B: legacy immediate Hint behavior must be explicit: ${hintCopy}`);
      await page.getByRole("button", { name: /cancel/i }).click();
      assert(problems.length === 0, `variant B hint copy: errors: ${problems.join(" | ")}`);
      await page.close();
    }

    console.log(`EXAM SHELL CHECK: PASS (${passed} assertions)`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`EXAM SHELL CHECK: FAIL: ${error.message}`);
  process.exit(1);
});
