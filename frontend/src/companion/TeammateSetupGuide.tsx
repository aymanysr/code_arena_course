import { useState } from "react";

export function TeammateSetupGuide() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Saved checklist in localStorage so the user can track what they've done in their repo
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("code_arena_teammate_setup_checklist");
      return saved
        ? JSON.parse(saved)
        : {
            "git-branch": false,
            "workspaces-check": false,
            "folders-created": false,
            "configs-added": false,
            "deps-installed": false,
            "auth-seam-wired": false,
            "db-seam-wired": false,
            "docker-added": false,
          };
    } catch {
      return {};
    }
  });

  const toggleCheck = (id: string) => {
    setChecklist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("code_arena_teammate_setup_checklist", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const completedChecks = Object.values(checklist).filter(Boolean).length;
  const totalChecks = 8;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const copyBtn = (id: string, text: string) => (
    <button
      type="button"
      className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 font-mono text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
      onClick={() => handleCopy(id, text)}
    >
      {copiedId === id ? "✓ Copied" : "📋 Copy"}
    </button>
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-teal-700 px-2.5 py-0.5 font-mono text-xs font-bold text-white uppercase">
              Teammate Repo Guide
            </span>
            <span className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 font-mono text-xs text-neutral-300">
              42 Network FT Transcendence
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-neutral-400">Setup Progress:</span>
            <span className="rounded bg-neutral-800 px-2.5 py-1 font-bold text-teal-600">
              {completedChecks} / {totalChecks} Steps Done
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Pulling Your Teammate's Repo: The Complete Setup Guide
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            Imagine this scenario: you just ran <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-teal-600 font-mono text-xs">git clone</code> on your teammate's FT Transcendence repository.
            You have your IDE open. Now you need to create the game module without stepping on their code, breaking their build, or waiting for them to finish their parts.
            Follow these exact steps from Day 0.
          </p>
        </div>

        {/* Quick Progress Bar */}
        <progress
          value={completedChecks}
          max={totalChecks}
          className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800 accent-teal-600"
        />
      </div>

      {/* Interactive Quick Checklist */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">CHECKLIST</span>
            <span className="text-white text-base font-sans">Your Repo Onboarding Checklist</span>
          </div>
          <span className="font-mono text-xs text-neutral-400">Click to check off as you work</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 font-mono text-xs">
          {[
            { id: "git-branch", label: "1. Create branch: git checkout -b feat/game-arena" },
            { id: "workspaces-check", label: "2. Check root package.json has packages/* workspaces" },
            { id: "folders-created", label: "3. Run mkdir to scaffold packages/ and services/" },
            { id: "configs-added", label: "4. Add package.json & tsconfig.json in arena-model" },
            { id: "deps-installed", label: "5. Run npm install from repo root to link packages" },
            { id: "auth-seam-wired", label: "6. Wire Auth Seam with mock fallback (no blocker)" },
            { id: "db-seam-wired", label: "7. Add arena_ prefixed PostgreSQL table migration" },
            { id: "docker-added", label: "8. Add judge-worker container to docker-compose.yml" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleCheck(item.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                checklist[item.id]
                  ? "border-teal-700 bg-neutral-800 text-white"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
                checklist[item.id] ? "border-teal-600 bg-teal-700 text-white" : "border-neutral-700 bg-neutral-800"
              }`}>
                {checklist[item.id] ? "✓" : ""}
              </span>
              <span className={checklist[item.id] ? "line-through text-neutral-400" : ""}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* STEP 0: Git Branch & Safety */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 0</span>
            <span className="text-white text-base font-sans">Git Branch &amp; Teammate Hygiene (Never Code on Main)</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          The number one mistake 42 students make is cloning their teammate's repository and editing directly on <code className="text-teal-600 font-mono">main</code> or <code className="text-teal-600 font-mono">master</code>.
          Always create your own dedicated game branch immediately.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs text-neutral-400">
            <span>Run these commands in your IDE terminal right after cloning:</span>
            {copyBtn("git-commands", "git checkout -b feat/game-arena\ngit status")}
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 font-mono text-xs text-teal-600 overflow-x-auto">
            <code>git checkout -b feat/game-arena</code>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2 font-mono text-xs">
          <div className="font-bold text-white">Check .gitignore for safety:</div>
          <p className="text-neutral-300">
            Make sure your teammate's <code className="text-teal-600">.gitignore</code> ignores built artifacts so you do not accidentally commit thousands of compiler files:
          </p>
          <div className="flex items-center justify-between rounded bg-neutral-900 p-3 text-neutral-200">
            <pre className="overflow-x-auto">{`node_modules/
dist/
build/
.env
*.log`}</pre>
            {copyBtn("gitignore", "node_modules/\ndist/\nbuild/\n.env\n*.log")}
          </div>
        </div>
      </section>

      {/* STEP 1: Monorepo Workspaces in package.json */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 1</span>
            <span className="text-white text-base font-sans">Register Game Workspaces in Root package.json</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Open the root <code className="text-teal-600 font-mono">package.json</code>. In FT Transcendence, having an organized monorepo makes grading easy for 42 evaluators.
          Ensure the <code className="text-white">"workspaces"</code> array tells npm to look inside <code className="text-teal-600">packages/*</code>:
        </p>

        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-white font-bold">
            <span>Root package.json configuration:</span>
            {copyBtn(
              "root-pkg-workspaces",
              `{\n  "name": "ft-transcendence",\n  "private": true,\n  "workspaces": [\n    "packages/*",\n    "services/*",\n    "frontend"\n  ],\n  "scripts": {\n    "dev:game": "npm run dev --workspace=arena-game",\n    "test:game": "npm test --workspace=arena-model && npm test --workspace=arena-game",\n    "build:game": "npm run build --workspace=arena-model"\n  }\n}`
            )}
          </div>
          <pre className="overflow-x-auto rounded bg-neutral-900 p-3 text-neutral-200 leading-relaxed">{`{
  "name": "ft-transcendence",
  "private": true,
  "workspaces": [
    "packages/*",
    "services/*",
    "frontend"
  ],
  "scripts": {
    "dev:game": "npm run dev --workspace=arena-game",
    "test:game": "npm test --workspace=arena-model && npm test --workspace=arena-game",
    "build:game": "npm run build --workspace=arena-model"
  }
}`}</pre>
          <p className="text-neutral-400 text-xs">
            💡 <strong>Why this matters:</strong> Once added, typing <code className="text-teal-600">npm install</code> once at the root automatically connects your game packages!
          </p>
        </div>
      </section>

      {/* STEP 2: Create the Game Folders */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 2</span>
            <span className="text-white text-base font-sans">Scaffold the Game Folders (1-Shot Command)</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Keep your game files completely isolated inside <code className="text-teal-600 font-mono">packages/</code> and <code className="text-teal-600 font-mono">services/</code>.
          Because you use distinct folders, your teammate can push their code without ever causing a git merge conflict with yours!
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs text-neutral-400">
            <span>Run this one-line command in your repo root:</span>
            {copyBtn(
              "mkdir-all",
              "mkdir -p packages/arena-model/src packages/arena-model/test packages/arena-game/src packages/arena-game/test packages/problem-bank/problems services/judge-worker/src frontend/src/arena"
            )}
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 font-mono text-xs text-teal-600 overflow-x-auto">
            <code>mkdir -p packages/arena-model/src packages/arena-model/test packages/arena-game/src packages/arena-game/test packages/problem-bank/problems services/judge-worker/src frontend/src/arena</code>
          </div>
        </div>

        {/* Directory Map */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 font-mono text-xs pt-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="font-bold text-teal-600">packages/arena-model/</div>
            <div className="text-neutral-400 text-xs">
              <strong>Zero dependencies.</strong> Holds MatchMode, RoundPhase, PlayerStatus, and pure scoring math. Shared by backend & frontend.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="font-bold text-teal-600">packages/arena-game/</div>
            <div className="text-neutral-400 text-xs">
              <strong>The Game Referee.</strong> Round lifecycle machine, database store, problem loader, and 2v2 mutual readiness.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="font-bold text-teal-600">packages/problem-bank/</div>
            <div className="text-neutral-400 text-xs">
              <strong>Challenge JSONs.</strong> Holds coding problems, starter boilerplate code, public test cases, and secret test cases.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="font-bold text-teal-600">services/judge-worker/</div>
            <div className="text-neutral-400 text-xs">
              <strong>Safe Docker Runner.</strong> Bounded queue with 2s SIGKILL timeout. Executes untrusted user code safely.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="font-bold text-teal-600">frontend/src/arena/</div>
            <div className="text-neutral-400 text-xs">
              <strong>Game UI Screen.</strong> CodeMirror editor, timer display, test output terminal, and WebSocket connection.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="font-bold text-teal-600">test/</div>
            <div className="text-neutral-400 text-xs">
              <strong>Automated Tests.</strong> Unit tests for transitions, scoring invariants, and timeout safety for 42 evaluation.
            </div>
          </div>
        </div>
      </section>

      {/* STEP 3: Config Files (package.json and tsconfig.json) */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 3</span>
            <span className="text-white text-base font-sans">Starter Config Files (Copy &amp; Paste Ready)</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300">
          Create these two initial configuration files in <code className="text-teal-600 font-mono">packages/arena-model/</code> so TypeScript compiles your types:
        </p>

        {/* File 1: packages/arena-model/package.json */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-white">packages/arena-model/package.json</span>
            {copyBtn(
              "model-pkg-content",
              `{\n  "name": "arena-model",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "main": "dist/index.js",\n  "types": "dist/index.d.ts",\n  "scripts": {\n    "build": "tsc",\n    "test": "vitest run"\n  }\n}`
            )}
          </div>
          <pre className="overflow-x-auto rounded bg-neutral-900 p-3 font-mono text-xs text-neutral-200 leading-relaxed">{`{
  "name": "arena-model",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}`}</pre>
        </div>

        {/* File 2: packages/arena-model/tsconfig.json */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-white">packages/arena-model/tsconfig.json</span>
            {copyBtn(
              "model-tsconfig-content",
              `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "declaration": true,\n    "outDir": "./dist",\n    "strict": true,\n    "skipLibCheck": true\n  },\n  "include": ["src/**/*"]\n}`
            )}
          </div>
          <pre className="overflow-x-auto rounded bg-neutral-900 p-3 font-mono text-xs text-neutral-200 leading-relaxed">{`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}`}</pre>
        </div>
      </section>

      {/* STEP 4: Dependencies to Install */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 4</span>
            <span className="text-white text-base font-sans">Dependencies: What Packages to Install</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Here is the exact list of dependencies needed for the game, cleanly categorized. Run these commands from your repository root:
        </p>

        <div className="space-y-3 font-mono text-xs">
          {/* Frontend deps */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-white font-bold">
              <span>1. Code Editor &amp; Sockets for Frontend:</span>
              {copyBtn("deps-fe", "npm install --workspace=frontend @codemirror/state @codemirror/view @codemirror/theme-one-dark yjs socket.io-client")}
            </div>
            <code className="block rounded bg-neutral-900 p-2 text-teal-600">
              npm install --workspace=frontend @codemirror/state @codemirror/view @codemirror/theme-one-dark yjs socket.io-client
            </code>
            <p className="text-neutral-400 text-xs">
              Powers the live in-browser code editor, dark syntax theme, and real-time socket updates.
            </p>
          </div>

          {/* Backend deps */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-white font-bold">
              <span>2. Database &amp; WebSockets for Game Engine:</span>
              {copyBtn("deps-be", "npm install --workspace=packages/arena-game pg socket.io")}
            </div>
            <code className="block rounded bg-neutral-900 p-2 text-teal-600">
              npm install --workspace=packages/arena-game pg socket.io
            </code>
            <p className="text-neutral-400 text-xs">
              <code className="text-white">pg</code> for PostgreSQL match persistence; <code className="text-white">socket.io</code> for real-time game broadcasts.
            </p>
          </div>

          {/* Root Dev deps */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-white font-bold">
              <span>3. Dev &amp; Testing Tools (Root):</span>
              {copyBtn("deps-root", "npm install -D vitest typescript @types/node")}
            </div>
            <code className="block rounded bg-neutral-900 p-2 text-teal-600">
              npm install -D vitest typescript @types/node
            </code>
            <p className="text-neutral-400 text-xs">
              Enables blazing-fast unit tests to prove 42 compliance during defense.
            </p>
          </div>
        </div>
      </section>

      {/* STEP 5: The 4 Teammate Integration Seams (The No-Blocker Architecture) */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 5</span>
            <span className="text-white text-base font-sans">Connecting the 4 Teammate Seams (Never Wait for Them)</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          In 42 group projects, teammates work at different speeds. If your teammate is still working on 42 OAuth login or PostgreSQL tables,
          <strong> you must never be blocked!</strong> We use the <em>Seam Pattern</em> so you can develop and test 100% of the game offline, then connect with 1 line of code.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 font-mono text-xs">
          {/* Seam 1: Auth */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="font-bold text-teal-600">Seam 1: 42 OAuth User Seam</div>
            <p className="text-neutral-300 leading-relaxed text-xs">
              The game only needs to know: <code className="text-white">&#123; userId, username &#125;</code>.
              Use a mock fallback until teammate finishes their JWT extractor:
            </p>
            <div className="rounded bg-neutral-900 p-2 text-neutral-200">
              <pre className="overflow-x-auto">{`// Auth Middleware Seam
export function getGameUser(req) {
  // If teammate finished OAuth:
  if (req.headers.authorization) {
    return verify42Jwt(req.headers.authorization);
  }
  // While teammate is still coding:
  return { userId: "dev-42", username: "marvin" };
}`}</pre>
            </div>
            <div className="flex justify-end pt-1">
              {copyBtn("auth-seam-code", `export function getGameUser(req) {\n  if (req.headers.authorization) {\n    return verify42Jwt(req.headers.authorization);\n  }\n  return { userId: "dev-42", username: "marvin" };\n}`)}
            </div>
          </div>

          {/* Seam 2: Database */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="font-bold text-teal-600">Seam 2: Database Seam (Table Prefix)</div>
            <p className="text-neutral-300 leading-relaxed text-xs">
              To prevent overwriting your teammate's user tables, prefix all game tables with <code className="text-white">arena_</code>:
            </p>
            <div className="rounded bg-neutral-900 p-2 text-neutral-200">
              <pre className="overflow-x-auto">{`CREATE TABLE IF NOT EXISTS arena_matches (
  id VARCHAR(64) PRIMARY KEY,
  mode VARCHAR(16) NOT NULL,
  phase VARCHAR(32) NOT NULL,
  scores JSONB NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);`}</pre>
            </div>
            <div className="flex justify-end pt-1">
              {copyBtn("db-seam-sql", `CREATE TABLE IF NOT EXISTS arena_matches (\n  id VARCHAR(64) PRIMARY KEY,\n  mode VARCHAR(16) NOT NULL,\n  phase VARCHAR(32) NOT NULL,\n  scores JSONB NOT NULL,\n  revision INT NOT NULL DEFAULT 1,\n  created_at TIMESTAMP DEFAULT NOW()\n);`)}
            </div>
          </div>

          {/* Seam 3: WebSockets */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="font-bold text-teal-600">Seam 3: WebSocket Namespace</div>
            <p className="text-neutral-300 leading-relaxed text-xs">
              Teammate may have a chat socket. Keep the game isolated by attaching to the <code className="text-white">/arena</code> namespace:
            </p>
            <div className="rounded bg-neutral-900 p-2 text-neutral-200">
              <pre className="overflow-x-auto">{`// Attach to teammate's existing HTTP server:
const arenaIo = io.of("/arena");
arenaIo.on("connection", (socket) => {
  socket.on("join-match", (matchId) => {
    socket.join(matchId);
  });
});`}</pre>
            </div>
          </div>

          {/* Seam 4: Frontend Routing */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
            <div className="font-bold text-teal-600">Seam 4: Frontend Router Plug</div>
            <p className="text-neutral-300 leading-relaxed text-xs">
              In your teammate's React router or navigation bar, simply add one route:
            </p>
            <div className="rounded bg-neutral-900 p-2 text-neutral-200">
              <pre className="overflow-x-auto">{`// In teammate's App.tsx or Router:
import { ArenaPage } from "./arena/ArenaPage";

<Route path="/arena" element={<ArenaPage />} />`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* STEP 6: Docker Compose & 42 Subject Compliance */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 6</span>
            <span className="text-white text-base font-sans">Docker Compose (42 Evaluator Defense)</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          For the 42 FT Transcendence defense, the evaluator will run <code className="text-teal-600 font-mono">docker-compose up --build</code>.
          Add the judge worker service to your teammate's <code className="text-teal-600 font-mono">docker-compose.yml</code> with strict resource limits:
        </p>

        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-white">Add this snippet into docker-compose.yml:</span>
            {copyBtn(
              "docker-compose-snippet",
              `  judge-worker:\n    build:\n      context: .\n      dockerfile: services/judge-worker/Dockerfile\n    privileged: true\n    cpus: "1.0"\n    mem_limit: "256M"\n    restart: unless-stopped\n    networks:\n      - transcendence-net`
            )}
          </div>
          <pre className="overflow-x-auto rounded bg-neutral-900 p-3 font-mono text-xs text-neutral-200 leading-relaxed">{`  judge-worker:
    build:
      context: .
      dockerfile: services/judge-worker/Dockerfile
    privileged: true
    cpus: "1.0"
    mem_limit: "256M"
    restart: unless-stopped
    networks:
      - transcendence-net`}</pre>
          <p className="text-neutral-400 text-xs">
            🛡️ <strong>Why this passes 42 evaluation:</strong> If a user inputs an infinite loop or fork bomb, the Docker container enforces a 256MB memory cap and the judge worker kills it with SIGKILL after 2 seconds.
          </p>
        </div>
      </section>

      {/* STEP 7: Day-by-Day Implementation Roadmap */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-600">
            <span className="rounded bg-neutral-800 px-2 py-0.5">STEP 7</span>
            <span className="text-white text-base font-sans">Your Day-by-Day Milestone Roadmap</span>
          </div>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-teal-600">Day 1: Milestones M00, M01 &amp; M02 (Domain Types)</span>
              <span className="text-neutral-400">Zero dependencies</span>
            </div>
            <div className="text-neutral-300">
              Create <code className="text-white">packages/arena-model/src/model.ts</code>. Define MatchMode, RoundPhase, PlayerStatus, and Presence. Run <code className="text-teal-600">npm test --workspace=arena-model</code>.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-teal-600">Day 2: Milestones M03 &amp; M05 (State Referee &amp; Scoring)</span>
              <span className="text-neutral-400">Pure math &amp; clock</span>
            </div>
            <div className="text-neutral-300">
              Create <code className="text-white">round-lifecycle.ts</code> and <code className="text-white">scoring.ts</code>. Implement the deadline check and integer basis points calculation.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-teal-600">Day 3: Milestones M04 &amp; M07 (Problems &amp; React Screen)</span>
              <span className="text-neutral-400">Offline Mock First</span>
            </div>
            <div className="text-neutral-300">
              Add problem JSON files in <code className="text-white">packages/problem-bank/</code>. Create the React screen with CodeMirror and the MockTransport plug.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-teal-600">Day 4: Milestones M06 &amp; M08 (API Route &amp; Database)</span>
              <span className="text-neutral-400">PostgreSQL</span>
            </div>
            <div className="text-neutral-300">
              Create the POST <code className="text-white">/api/matches/:id/submit</code> route and write the PostgreSQL update with revision check <code className="text-white">WHERE revision = expected</code>.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-teal-600">Day 5: Milestones M10, M11 &amp; M12 (WebSockets &amp; 2v2 Collab)</span>
              <span className="text-neutral-400">Multiplayer</span>
            </div>
            <div className="text-neutral-300">
              Set up Socket.IO rooms for matches and team chat. Wire up Yjs for the 2v2 shared editor and the mutual readiness check.
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3.5 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-teal-600">Day 6: Milestones M09 &amp; M13 (Docker Judge &amp; Final Monorepo Test)</span>
              <span className="text-neutral-400">Safety &amp; Compliance</span>
            </div>
            <div className="text-neutral-300">
              Add the safe Judge Worker container with 2s SIGKILL timeout. Run <code className="text-teal-600">npm test</code> across workspaces to verify 42 subject compliance!
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
