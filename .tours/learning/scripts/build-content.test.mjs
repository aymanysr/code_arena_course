import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  mkdtemp,
  writeFile,
  mkdir,
  symlink,
  rm,
} from "node:fs/promises";
import os from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { buildCatalogData } from "./build-catalog.mjs";
import { loadBuildCourse } from "./build-course.mjs";
const learningDir = path.join(process.cwd(), ".tours/learning");
const coverageMap = JSON.parse(
  await readFile(path.join(learningDir, "coverage-map.json"), "utf8")
);
const referenceData = await buildCatalogData({
  repoRoot: process.cwd(),
  learningDir,
  coverageMap,
  tours: [],
});
test("the foundation entry has a usable prerequisite chain through the first run", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  for (const id of [
    "m00-destination",
    "m00-workspaces",
    "m01-tools",
    "m01-folder",
    "m01-package",
    "m01-first-run",
  ]) {
    const lesson = course.lessons.find((l) => l.id === id);
    assert.ok(lesson, `${id} has authored content`);
    for (const prereq of lesson.prerequisites)
      assert.ok(course.lessons.some((l) => l.id === prereq));
    assert.ok(lesson.steps.some((s) => s.phase === "check" && s.transfer));
    for (const step of lesson.steps.filter((s) => s.phase === "build")) {
      assert.equal(step.hints.length, 4);
      assert.ok(step.files.length);
      for (const id of step.checkIds) {
        const check = lesson.checks.find((c) => c.id === id);
        assert.ok(check?.expected && check.failure.length);
      }
    }
  }
});
test("practice configuration checks, emits and runs a module while rejecting the wrong type", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "course config "));
  try {
    for (const name of ["package.json", "tsconfig.json"])
      await writeFile(
        path.join(dir, name),
        await readFile(path.join(learningDir, "practice", name))
      );
    await mkdir(path.join(dir, "src"));
    await symlink(
      path.join(process.cwd(), "node_modules"),
      path.join(dir, "node_modules"),
      "dir"
    );
    await writeFile(
      path.join(dir, "src/helper.ts"),
      "export function twice(value:number):number {return value * 2;}"
    );
    await writeFile(
      path.join(dir, "src/demo.ts"),
      "import {twice} from './helper.js'; console.log(twice(4));"
    );
    execFileSync("npm", ["run", "typecheck"], { cwd: dir });
    execFileSync("npm", ["run", "build"], { cwd: dir });
    assert.match(
      execFileSync("npm", ["run", "demo"], { cwd: dir, encoding: "utf8" }),
      /\n8\s*$/
    );
    await writeFile(
      path.join(dir, "src/demo.ts"),
      "import {twice} from './helper.js'; console.log(twice('wrong'));"
    );
    assert.throws(() =>
      execFileSync("npm", ["run", "typecheck"], { cwd: dir, stdio: "pipe" })
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("the C-to-TypeScript path reaches an independent transfer task", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  for (const id of [
    "m02-boundary",
    "m02-types-runtime",
    "m02-records",
    "m02-modules",
    "m02-transfer",
  ])
    assert.ok(
      course.lessons.some((l) => l.id === id),
      `${id} is authored`
    );
  const task = course.lessons.find((l) => l.id === "m02-transfer");
  assert.ok(
    task.steps.some(
      (s) =>
        s.phase === "build" && s.files.some((f) => f.path === "src/limit.ts")
    )
  );
});
test("ticket 09 authors Submit scoring Reveal and deadlines", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const ids = [
    "m05-accept",
    "m05-pending",
    "m05-retry",
    "m05-score",
    "m05-reveal",
    "m05-round-reset",
    "m05-final-result",
    "m05-deadline",
    "m05-complete-match",
  ];
  for (const id of ids) {
    const lesson = course.lessons.find((l) => l.id === id);
    assert.ok(lesson, id + " is authored");
    assert.ok(
      lesson.steps.some((s) => s.phase === "check" && s.transfer),
      id + " transfer"
    );
    for (const step of lesson.steps.filter((s) => s.phase === "build")) {
      assert.equal(step.hints.length, 4);
      assert.ok(step.files.length);
      assert.ok(step.checkIds.length);
      assert.ok(step.prerequisiteCheckIds.length);
    }
  }
  const scoring = course.lessons.find((l) => l.id === "m05-score");
  assert.ok(
    scoring.checks.some(
      (c) => c.id === "m05-score-unit" && c.expected.includes("43")
    )
  );
  for (const id of ids) {
    const lesson = course.lessons.find((l) => l.id === id);
    assert.ok(
      lesson.references.length > 0,
      id + " cites at least one source span"
    );
  }
});
test("ticket 08 authors state Problem and visible Run", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const ids08 = [
    "m03-records",
    "m03-transitions",
    "m03-membership",
    "m03-clock",
    "m04-problem",
    "m04-judge-port",
    "m04-run",
  ];
  for (const id of ids08) {
    const lesson = course.lessons.find((l) => l.id === id);
    assert.ok(lesson, id + " is authored");
    assert.ok(
      lesson.references.length > 0,
      id + " cites at least one source span"
    );
  }
  const ids = [
    "m03-records",
    "m03-transitions",
    "m03-membership",
    "m03-clock",
    "m04-problem",
    "m04-judge-port",
    "m04-run",
  ];
  for (const id of ids) {
    const lesson = course.lessons.find((l) => l.id === id);
    assert.ok(lesson, id + " is authored");
    assert.ok(
      lesson.steps.some((s) => s.phase === "check" && s.transfer),
      id + " transfer"
    );
    for (const step of lesson.steps.filter((s) => s.phase === "build")) {
      assert.equal(step.hints.length, 4);
      assert.ok(step.files.length);
      assert.ok(step.checkIds.length);
      assert.ok(step.prerequisiteCheckIds.length);
    }
  }
});
test("ticket 10 authors server and screen integration", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const ids = [
    "m06-http",
    "m06-controller",
    "m06-validation",
    "m06-identity",
    "m07-browser-basics",
    "m07-react-state",
    "m07-transport",
    "m07-editor-run",
    "m07-submit-reveal",
    "m07-local-journey",
  ];
  const kinds = new Set();
  for (const id of ids) {
    const lesson = course.lessons.find((l) => l.id === id);
    assert.ok(lesson, id + " is authored");
    assert.ok(
      lesson.references.length > 0,
      id + " cites at least one source span"
    );
    assert.ok(
      lesson.steps.some((s) => s.phase === "check" && s.transfer),
      id + " transfer"
    );
    for (const step of lesson.steps.filter((s) => s.phase === "build")) {
      assert.equal(step.hints.length, 4);
      assert.ok(step.files.length);
      assert.ok(step.checkIds.length);
      assert.ok(step.prerequisiteCheckIds.length);
    }
    for (const c of lesson.checks) kinds.add(c.kind);
  }
  assert.ok(kinds.has("service"), "ticket 10 has service checks");
  assert.ok(kinds.has("browser"), "ticket 10 has browser checks");
  const files10 = course.lessons
    .filter((l) => ids.includes(l.id))
    .flatMap((l) => l.steps.flatMap((s) => s.files));
  const has = (path, action) =>
    files10.some((f) => f.path === path && f.action === action);
  assert.ok(has("package.json", "edit"), "setup edits package.json");
  assert.ok(has("tsconfig.json", "edit"), "setup edits tsconfig.json");
  assert.ok(has("vite.config.ts", "create"), "setup creates vite.config.ts");
  assert.ok(
    has("test/browser/run.mjs", "create"),
    "setup creates the browser runner"
  );
  assert.ok(
    has("test/browser/local-game.spec.ts", "create"),
    "setup creates the journey spec"
  );
  const tiling = course.lessons.filter((l) => ids.includes(l.id));
  const commands = tiling
    .flatMap((l) => l.checks.map((c) => c.command + "\n" + c.expected))
    .join("\n");
  for (const snippet of [
    "npm install",
    "test:service",
    "test:ui",
    "test:browser",
    "dev:server",
  ]) {
    assert.ok(commands.includes(snippet), "checks exercise " + snippet);
  }
});

test("ticket 10 setup matches the reference toolchain and is available in lesson order", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const lesson = (id) => course.lessons.find((item) => item.id === id);
  const allText = (item) =>
    item.steps
      .flatMap((step) => [
        ...step.explanation,
        ...step.hints,
        ...step.files.map(
          (file) => `${file.path} ${file.change} ${file.pattern}`
        ),
      ])
      .join("\n");
  const referenceLock = JSON.parse(
    await readFile(path.join(process.cwd(), "package-lock.json"), "utf8")
  );
  const referenceVersion = (name) =>
    referenceLock.packages[`node_modules/${name}`]?.version;

  const serverSetup = lesson("m06-http").steps.find(
    (step) => step.id === "m06-http-setup-scripts"
  );
  const serverSetupText = allText(lesson("m06-http"));
  assert.match(serverSetupText, /dev:server/);
  assert.match(serverSetupText, /test:service/);
  assert.doesNotMatch(
    serverSetupText,
    /vite build/,
    "M06 must work before Vite is installed in M07"
  );
  assert.ok(serverSetup, "M06 teaches its server scripts");

  const controller = lesson("m06-controller");
  const nestSetup = controller.steps.find((step) =>
    step.files.some((file) => file.path === "package.json")
  );
  assert.ok(
    nestSetup,
    "M06 installs the framework used by the reference server"
  );
  const controllerPaths = controller.steps.flatMap((step) =>
    step.files.map((file) => file.path)
  );
  for (const file of [
    "tsconfig.json",
    "src/server/game.module.ts",
    "src/server/game.controller.ts",
    "src/server/game.service.ts",
  ]) {
    assert.ok(controllerPaths.includes(file), `Nest setup teaches ${file}`);
  }
  const nestText = allText(controller);
  assert.match(
    nestText,
    /@Inject\(GameService\)/,
    "explicit injection token works in both compiled Nest and Vitest source transforms"
  );
  assert.match(
    nestText,
    /@HttpCode\(200\)/,
    "Nest preserves the teaching route documented 200 contract"
  );
  for (const id of ["m06-validation", "m06-identity"]) {
    const build = lesson(id).steps.find((step) => step.phase === "build");
    assert.ok(
      build.files.some(
        (file) =>
          file.path === "src/server/game.controller.ts" &&
          file.action === "edit"
      ),
      `${id} edits the Nest controller after migration`
    );
    assert.ok(
      !build.files.some((file) => file.path === "src/server/main.ts"),
      `${id} does not put route behavior back in main.ts`
    );
  }
  for (const name of [
    "@nestjs/common",
    "@nestjs/core",
    "@nestjs/platform-express",
    "reflect-metadata",
    "rxjs",
  ]) {
    const version = referenceVersion(name);
    assert.ok(version, `${name} has a locked reference version`);
    assert.ok(
      nestText.includes(`${name}@${version}`),
      `${name} uses the reference lockfile version ${version}`
    );
  }

  const browserSetup = lesson("m07-browser-basics");
  const browserBuildSteps = browserSetup.steps.filter(
    (step) => step.phase === "build"
  );
  const viteStep = browserBuildSteps.find((step) =>
    step.files.some((file) => file.path === "vite.config.ts")
  );
  assert.ok(viteStep, "the browser API proxy is configured");
  const viteText = allText({ steps: [viteStep] });
  assert.match(viteText, /\/practice-decision/);
  assert.match(
    viteText,
    /\/game-decision/,
    "the same-origin proxy also forwards the identity-protected game route"
  );
  const runnerIndex = browserBuildSteps.findIndex((step) =>
    step.files.some((file) => file.path === "test/browser/run.mjs")
  );
  const trioIndex = browserBuildSteps.findIndex((step) =>
    step.files.some((file) => file.path === "test/browser/trio.spec.ts")
  );
  const trioIndexAlt = browserBuildSteps.findIndex((step) =>
    step.files.some((file) => file.path === "test/browser/trio.test.ts")
  );
  const activeTrioIndex = Math.max(trioIndex, trioIndexAlt);
  assert.ok(
    runnerIndex >= 0 && activeTrioIndex >= runnerIndex,
    "the first browser runner and test are taught before the first browser check"
  );
  assert.ok(
    allText(browserSetup).includes("test:browser"),
    "the browser script exists before its first use"
  );

  const reactText =
    allText(lesson("m07-browser-basics")) +
    "\n" +
    allText(lesson("m07-react-state"));
  for (const name of [
    "react",
    "react-dom",
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "vite",
    "playwright-core",
  ]) {
    const version = referenceVersion(name);
    assert.ok(version, `${name} has a locked reference version`);
    assert.ok(
      reactText.includes(`${name}@${version}`),
      `${name} uses the reference lockfile version ${version}`
    );
  }

  const finalRunner = lesson("m07-local-journey").steps.find((step) =>
    step.files.some((file) => file.path === "test/browser/run.mjs")
  );
  assert.ok(
    finalRunner?.files.some(
      (file) => file.path === "test/browser/run.mjs" && file.action === "edit"
    ),
    "the final journey extends the already taught runner"
  );
});

test("ticket 10 keeps Vitest rooted at the project after Vite moves to the client folder", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const lesson = course.lessons.find(
    (item) => item.id === "m07-browser-basics"
  );
  const builds = lesson.steps.filter((step) => step.phase === "build");
  const fileStep = (file) =>
    builds.findIndex((step) => step.files.some((item) => item.path === file));
  const viteIndex = fileStep("vite.config.ts");
  const vitestIndex = fileStep("vitest.config.ts");
  const runnerIndex = fileStep("test/browser/run.mjs");
  assert.ok(vitestIndex >= 0, "a separate Vitest config is taught");
  assert.ok(
    viteIndex < vitestIndex && vitestIndex < runnerIndex,
    "Vitest root is set after Vite root and before later test commands"
  );
  const step = builds[vitestIndex];
  assert.match(step.explanation.join("\n"), /Vitest.*root|root.*Vitest/i);
  assert.ok(
    step.files.some(
      (file) => file.path === "vitest.config.ts" && file.action === "create"
    )
  );
  assert.ok(step.checkIds.includes("m07-vitest-root"));
  const check = lesson.checks.find((item) => item.id === "m07-vitest-root");
  assert.ok(check?.command.includes("test:service"));
  assert.match(check.expected, /test\/service\.test\.ts/);
});

test("ticket 11 covers durable storage and the isolated Judge with distinct environment gates", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const ids = [
    "m08-store-port",
    "m08-postgres",
    "m08-transactions",
    "m08-claims",
    "m08-events",
    "m08-recovery",
    "m09-isolation",
    "m09-provider",
    "m09-case-runner",
    "m09-worker",
    "m09-replace-fake",
  ];
  const byId = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
  for (const id of ids) {
    const lesson = byId.get(id);
    assert.ok(lesson, id + " has authored content");
    assert.ok(
      lesson.references.length > 0,
      id + " cites a validated reference span"
    );
    assert.ok(lesson.checks.length > 0, id + " names its check");
    for (const step of lesson.steps.filter((item) => item.phase === "build")) {
      assert.equal(step.hints.length, 4, id + " gives four Build hints");
      assert.ok(
        step.files.length && step.checkIds.length,
        id + " gives path and check"
      );
    }
  }
  const kinds = (id) => new Set(byId.get(id).checks.map((check) => check.kind));
  assert.ok(kinds("m08-store-port").has("unit"));
  for (const id of [
    "m08-postgres",
    "m08-transactions",
    "m08-claims",
    "m08-events",
    "m08-recovery",
  ])
    assert.ok(kinds(id).has("database"), id + " has a database gate");
  for (const id of ["m09-case-runner", "m09-replace-fake"])
    assert.ok(kinds(id).has("judge"), id + " has a real-Judge gate");
  assert.ok(
    kinds("m09-provider").has("unit"),
    "provider selection is checked as configuration, not as real code execution"
  );
  assert.ok(
    kinds("m09-worker").has("worker"),
    "worker checks keep their own kind"
  );
  const m08Text = JSON.stringify(byId.get("m08-postgres"));
  assert.match(m08Text, /TEST_PG_URL/);
  assert.match(m08Text, /test:db/);
  const m09Text =
    JSON.stringify(byId.get("m09-provider")) +
    JSON.stringify(byId.get("m09-worker"));
  assert.match(m09Text, /JUDGE_BACKEND/);
  assert.match(m09Text, /JUDGE_WORKER_TOKEN/);
  const envIgnoreCommand =
    "git check-ignore -q .env && ! git check-ignore -q .env.example";
  assert.equal(
    byId
      .get("m08-postgres")
      .checks.find((check) => check.id === "m08-postgres-env").command,
    envIgnoreCommand
  );
  assert.equal(
    byId
      .get("m09-provider")
      .checks.find((check) => check.id === "m09-provider-env").command,
    envIgnoreCommand
  );
  assert.doesNotMatch(
    JSON.stringify(byId.get("m08-postgres")),
    /JUDGE_BACKEND|JUDGE_WORKER_TOKEN/,
    "Judge settings are introduced in M09"
  );
  const runnerText = JSON.stringify(byId.get("m09-case-runner"));
  for (const status of [
    "compile_error",
    "runtime_error",
    "time_limit_exceeded",
    "memory_limit_exceeded",
    "output_limit_exceeded",
  ])
    assert.ok(runnerText.includes(status), "runner teaches " + status);
  assert.match(
    runnerText,
    /expected output.*trusted|trusted.*expected output/i,
    "hidden expected output stays in trusted code"
  );
  for (const status of ["process_limit_exceeded"])
    assert.ok(runnerText.includes(status), "runner teaches " + status);
  assert.ok(
    byId
      .get("m09-case-runner")
      .steps.some((step) =>
        step.files.some(
          (file) => file.path === "package.json" && file.action === "edit"
        )
      ),
    "test:judge is configured before it is used"
  );
  assert.ok(
    byId
      .get("m09-worker")
      .steps.some((step) =>
        step.files.some(
          (file) => file.path === "package.json" && file.action === "edit"
        )
      ),
    "test:worker is configured before it is used"
  );
  assert.ok(
    byId
      .get("m09-case-runner")
      .checks.some((check) => check.id === "m09-case-runner-script")
  );
  assert.ok(
    byId
      .get("m09-worker")
      .checks.some((check) => check.id === "m09-worker-scripts")
  );
  const fixture = JSON.parse(
    await readFile(
      path.join(learningDir, "scripts/fixtures/task11-blocked-evidence.json"),
      "utf8"
    )
  );
  assert.equal(fixture.expectedLessonGate, "pending");
  assert.ok(
    fixture.entries.some(
      (entry) => entry.kind === "unit" && entry.result === "passed"
    )
  );
  assert.ok(
    fixture.entries.some(
      (entry) => entry.kind === "database" && entry.result === "blocked"
    )
  );
});

test("ticket 12 authors Lobby, live presence, team readiness, and chat lessons", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const ids = [
    "m10-invite",
    "m10-start",
    "m10-socket-auth",
    "m10-presence",
    "m10-reconnect",
    "m10-two-clients",
    "m11-document",
    "m11-ready",
    "m11-round-lifetime",
    "m11-four-clients",
    "m12-chat",
    "m12-sidecars",
    "m12-live-chat",
  ];
  const byId = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
  for (const id of ids) {
    const lesson = byId.get(id);
    assert.ok(lesson, `${id} has authored content`);
    assert.ok(lesson.references.length > 0, `${id} cites source evidence`);
    assert.ok(
      lesson.steps.some(
        (step) => step.phase === "see" && step.visual?.frames?.length >= 2
      ),
      `${id} has a state or message-flow visual`
    );
    assert.ok(lesson.checks.length > 0, `${id} names a check`);
    for (const step of lesson.steps.filter((item) => item.phase === "build")) {
      assert.equal(
        step.hints.length,
        4,
        `${id} has four clues for each code change`
      );
      assert.ok(
        step.files.length && step.checkIds.length,
        `${id} names the path and check for each code change`
      );
    }
  }
  assert.ok(
    byId.get("m10-two-clients").checks.some((check) => check.kind === "browser")
  );
  assert.ok(
    byId
      .get("m11-four-clients")
      .checks.some((check) => check.kind === "browser")
  );
  assert.ok(
    byId.get("m12-live-chat").checks.some((check) => check.kind === "browser")
  );
  assert.ok(
    byId
      .get("m10-presence")
      .checks.some((check) => check.id === "m10-presence-multi-socket")
  );
  assert.ok(
    byId
      .get("m11-ready")
      .checks.some((check) => check.id === "m11-ready-revision")
  );
  assert.ok(
    byId
      .get("m12-sidecars")
      .checks.some((check) => check.id === "m12-sidecars-canceled-factory")
  );

  const socket = byId.get("m10-socket-auth");
  const socketText = JSON.stringify(socket);
  const socketBuilds = socket.steps.filter((step) => step.phase === "build");
  const stepIndex = (file) =>
    socketBuilds.findIndex((step) =>
      step.files.some((item) => item.path === file)
    );
  const packageIndex = stepIndex("package.json");
  const principalIndex = stepIndex("src/server/socket-auth.ts");
  const gatewayIndex = stepIndex("src/server/match.gateway.ts");
  assert.ok(
    packageIndex >= 0 &&
      packageIndex < principalIndex &&
      principalIndex < gatewayIndex,
    "socket packages come before identity and gateway code"
  );
  for (const dependency of [
    "@nestjs/websockets@11.2.6",
    "@nestjs/platform-socket.io@11.2.6",
    "socket.io@4.8.3",
    "socket.io-client@4.8.3",
  ]) {
    assert.ok(
      socketText.includes(dependency),
      "M10 teaches reviewed dependency " + dependency
    );
  }
  assert.ok(
    socket.checks.some(
      (check) => check.id === "m10-socket-deps" && check.kind === "integration"
    ),
    "socket dependency versions have an integration check"
  );
  const gateway = socket.steps.find((step) =>
    step.files.some((file) => file.path === "src/server/match.gateway.ts")
  );
  assert.match(
    gateway.explanation.join(" "),
    /membership.*Only after it succeeds, join/i,
    "gateway checks membership before joining its room"
  );
  assert.ok(gateway.checkIds.includes("m10-socket-auth-unit"));

  const presence = byId.get("m10-presence");
  const presenceGateway = presence.steps.find((step) =>
    step.files.some((file) => file.path === "src/server/match.gateway.ts")
  );
  assert.ok(
    presenceGateway,
    "M10 wires first-open/last-close Presence into the gateway"
  );
  assert.match(
    presenceGateway.explanation.join(" "),
    /first open.*last socket disconnects/i
  );
  assert.ok(presenceGateway.checkIds.includes("m10-presence-multi-socket"));

  const chat = byId.get("m12-chat");
  const chatClient = chat.steps.find((step) =>
    step.files.some((file) => file.path === "src/client/chat-client.ts")
  );
  assert.ok(chatClient, "M12 teaches the browser-side chat client");
  assert.ok(
    chat.checks.some(
      (check) => check.id === "m12-chat-client-unit" && check.kind === "unit"
    )
  );
  assert.ok(chatClient.checkIds.includes("m12-chat-client-unit"));
});

test("ticket 13 teaches repo inspection, safe mapping, operations, TLS, parity, and handover", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const ids = [
    "m13-inspect-team",
    "m13-map-rule",
    "m13-integrate",
    "m13-compose",
    "m13-tls",
    "m13-parity",
    "m13-handover",
  ];
  const byId = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
  for (const id of ids) {
    const lesson = byId.get(id);
    assert.ok(lesson, `${id} has authored content`);
    assert.ok(lesson.references.length, `${id} cites a validated source span`);
    assert.ok(
      lesson.steps.some(
        (step) => step.phase === "see" && step.visual?.frames?.length >= 2
      ),
      `${id} shows the relationship visually`
    );
    assert.ok(
      lesson.checks.length,
      `${id} explains its check and failure case`
    );
    for (const step of lesson.steps.filter((item) => item.phase === "build")) {
      assert.equal(
        step.hints.length,
        4,
        `${id} gives four clues for each small change`
      );
      assert.ok(
        step.files.length && step.checkIds.length,
        `${id} names the file and check`
      );
    }
  }
  const mapRule = byId.get("m13-map-rule");
  const mappedPaths = mapRule.steps
    .filter((step) => step.phase === "build")
    .flatMap((step) => step.files.map((file) => file.path));
  assert.ok(mappedPaths.includes("src/submit-window.ts"));
  assert.ok(mappedPaths.includes("test/submit-window.test.ts"));
  assert.match(
    JSON.stringify(byId.get("m13-inspect-team")),
    /identity|authentication/i
  );
  assert.match(JSON.stringify(byId.get("m13-compose")), /health|readiness/i);
  assert.match(JSON.stringify(byId.get("m13-tls")), /WSS|WebSocket.*TLS/i);
  assert.match(
    JSON.stringify(byId.get("m13-parity")),
    /2v2.*reconnect|reconnect.*2v2/i
  );
  assert.match(
    JSON.stringify(byId.get("m13-handover")),
    /AI.*disclosure|AI-use/i
  );
  const tlsText = JSON.stringify(byId.get("m13-tls"));
  assert.match(tlsText, /certificate/i);
  assert.match(tlsText, /verification/i);
  assert.doesNotMatch(
    tlsText,
    /NODE_TLS_REJECT_UNAUTHORIZED=0|rejectUnauthorized:\s*false/
  );
});

test("advanced persistence and Judge build hints teach the local pattern", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  for (const lesson of course.lessons.filter((item) =>
    [
      "m08-store-port",
      "m08-postgres",
      "m08-transactions",
      "m08-claims",
      "m08-events",
      "m08-recovery",
      "m09-isolation",
      "m09-provider",
      "m09-case-runner",
      "m09-worker",
      "m09-replace-fake",
    ].includes(item.id)
  )) {
    for (const step of lesson.steps.filter((item) => item.phase === "build")) {
      assert.equal(step.hints.length, 4, step.id);
      assert.equal(
        new Set(step.hints).size,
        4,
        step.id + " has four useful, distinct hints"
      );
      assert.doesNotMatch(
        step.hints.join(" "),
        /Name the one responsibility this file owns|Follow the matching reference span|Keep the data boundary visible|Run the named check and read its first useful error/,
        step.id + " no longer uses generic scaffolding"
      );
    }
  }
  const claims = course.lessons.find((item) => item.id === "m08-claims");
  assert.match(
    claims.steps.find((step) => step.id === "m08-claims-pool").hints.join(" "),
    /advisory|session|unlock/i
  );
  const runner = course.lessons.find((item) => item.id === "m09-case-runner");
  assert.match(
    runner.steps
      .find((step) => step.id === "m09-case-runner-runner")
      .hints.join(" "),
    /spawn|timeout|stdout|status/i
  );
});

test("2v2 course teaches authenticated Yjs transport before the four-client check", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  const lesson = course.lessons.find((item) => item.id === "m11-document");
  const text = JSON.stringify(lesson);
  for (const file of [
    "src/server/collab.gateway.ts",
    "src/client/collab-provider.ts",
    "test/collaboration-transport.test.ts",
  ])
    assert.ok(text.includes(file), file + " is guided before live multiplayer");
  assert.match(text, /trusted principal|authenticated principal/i);
  assert.match(text, /remote update|remote-update/i);
  const builds = lesson.steps.filter((step) => step.phase === "build");
  const fileStep = (path) =>
    builds.findIndex((step) => step.files.some((file) => file.path === path));
  assert.ok(
    fileStep("test/collaboration-transport.test.ts") <
      fileStep("src/server/collab.gateway.ts"),
    "gateway test is authored before gateway code"
  );
  assert.ok(
    fileStep("test/collaboration-provider.test.ts") <
      fileStep("src/client/collab-provider.ts"),
    "provider test is authored before provider code"
  );
  assert.ok(
    fileStep("test/collaboration-editor.test.ts") <
      fileStep("src/client/collaboration-editor.ts"),
    "editor test is authored before binding code"
  );
  assert.ok(
    lesson.steps
      .filter((step) => step.phase === "build")
      .some((step) =>
        step.files.some((file) => file.path === "src/client/collab-provider.ts")
      )
  );
});

test("live team transfer tasks change the input and name the expected result", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  for (const lesson of course.lessons.filter((item) =>
    /^m1[0-2]-/.test(item.id)
  )) {
    const transfer = lesson.steps.find(
      (step) => step.phase === "check"
    ).transfer;
    assert.ok(transfer, lesson.id + " has a transfer");
    assert.notEqual(
      transfer.trim(),
      lesson.outcome.trim(),
      lesson.id + " transfer is an independent changed case"
    );
    assert.match(
      transfer,
      /changed|when |after |if |instead|late |full |second |third /i,
      lesson.id + " names a changed case"
    );
  }
});

test("scoring and deadline visuals use traces instead of the seconds-left boundary widget", async () => {
  const course = await loadBuildCourse(learningDir, referenceData);
  for (const [lessonId, stepId] of [
    ["m05-score", "m05-score-see"],
    ["m05-deadline", "m05-deadline-see"],
  ]) {
    const step = course.lessons
      .find((item) => item.id === lessonId)
      .steps.find((item) => item.id === stepId);
    assert.equal(step.visual.kind, "trace", stepId);
  }
});
