import { useState } from "react";

/**
 * Interactive Visualizers for each of the 14 Milestones.
 * Designed to make every concept instantly visual and intuitive.
 */

// M00: The 3 Boxes & Safe Runner
function VisualizerM00() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    { label: "1. Player Clicks Submit", desc: "Code leaves the browser and travels over HTTPS." },
    { label: "2. Server Receives Code", desc: "Main server checks the clock and puts the code in the queue. It DOES NOT run it!" },
    { label: "3. Safe Runner Executes", desc: "Isolated Docker box compiles and tests the code in a sandbox jail." },
    { label: "4. Score Returned", desc: "Runner reports passed tests back to the main server. Score is saved." },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Visual Map: The 3 Parts of the Game</span>
        <span className="text-neutral-400">Click a box to trace the flow</span>
      </div>

      {/* 3 Physical Boxes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Box 1: Browser */}
        <div
          className={`rounded-lg border p-4 transition-all ${
            activeStep === 0
              ? "border-teal-600 bg-neutral-800 text-white shadow"
              : "border-neutral-800 bg-neutral-900 text-neutral-400"
          }`}
          onClick={() => setActiveStep(0)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-600">BOX 1</span>
            <span>💻</span>
          </div>
          <div className="font-bold text-white text-sm">Player Browser</div>
          <div className="mt-1 text-neutral-400">React + CodeMirror editor</div>
          <div className="mt-3 rounded bg-neutral-900 p-2 text-neutral-300">
            Player types solution &amp; clicks submit
          </div>
        </div>

        {/* Box 2: Main Server */}
        <div
          className={`rounded-lg border p-4 transition-all ${
            activeStep === 1 || activeStep === 3
              ? "border-teal-600 bg-neutral-800 text-white shadow"
              : "border-neutral-800 bg-neutral-900 text-neutral-400"
          }`}
          onClick={() => setActiveStep(1)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-600">BOX 2</span>
            <span>🛡️</span>
          </div>
          <div className="font-bold text-white text-sm">Main Web Server</div>
          <div className="mt-1 text-neutral-400">Node.js + PostgreSQL</div>
          <div className="mt-3 rounded bg-neutral-900 p-2 text-neutral-300">
            Checks match timer, saves scores, NEVER runs untrusted code
          </div>
        </div>

        {/* Box 3: Safe Runner */}
        <div
          className={`rounded-lg border p-4 transition-all ${
            activeStep === 2
              ? "border-teal-600 bg-neutral-800 text-white shadow"
              : "border-neutral-800 bg-neutral-900 text-neutral-400"
          }`}
          onClick={() => setActiveStep(2)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-600">BOX 3</span>
            <span>📦</span>
          </div>
          <div className="font-bold text-white text-sm">Safe Code Runner</div>
          <div className="mt-1 text-neutral-400">Isolated Docker Sandbox</div>
          <div className="mt-3 rounded bg-neutral-900 p-2 text-neutral-300">
            Runs code with strict 512MB RAM &amp; 2-second time limits
          </div>
        </div>
      </div>

      {/* Interactive Step Navigator */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          {steps.map((st, idx) => (
            <button
              key={idx}
              type="button"
              className={`rounded px-3 py-1.5 transition-colors ${
                activeStep === idx
                  ? "bg-teal-700 text-white font-bold"
                  : "bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
              onClick={() => setActiveStep(idx)}
            >
              {st.label}
            </button>
          ))}
        </div>
        <p className="text-neutral-200 mt-2">{steps[activeStep]?.desc ?? ""}</p>
      </div>
    </div>
  );
}

// M01: Player & Team Layout
function VisualizerM01() {
  const [mode, setMode] = useState<"1v1" | "2v2">("1v1");

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Visual Layout: Sides and Seats</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded px-2.5 py-1 ${mode === "1v1" ? "bg-teal-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"}`}
            onClick={() => setMode("1v1")}
          >
            1v1 Duel
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 ${mode === "2v2" ? "bg-teal-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"}`}
            onClick={() => setMode("2v2")}
          >
            2v2 Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Side */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-teal-600">SIDE: "left"</span>
            <span className="rounded bg-neutral-900 px-2 py-0.5 text-neutral-400">
              {mode === "1v1" ? "1 Player" : "2 Teammates"}
            </span>
          </div>

          <div className="rounded bg-neutral-900 p-3 text-neutral-200">
            <div>👤 Player A <span className="text-neutral-500">(Seat 0)</span></div>
            <div className="text-xs text-neutral-400">userId: "user-1"</div>
          </div>

          {mode === "2v2" && (
            <div className="rounded bg-neutral-900 p-3 text-neutral-200">
              <div>👤 Player B <span className="text-neutral-500">(Seat 1)</span></div>
              <div className="text-xs text-neutral-400">userId: "user-2"</div>
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-red-700">SIDE: "right"</span>
            <span className="rounded bg-neutral-900 px-2 py-0.5 text-neutral-400">
              {mode === "1v1" ? "1 Player" : "2 Teammates"}
            </span>
          </div>

          <div className="rounded bg-neutral-900 p-3 text-neutral-200">
            <div>👤 Player C <span className="text-neutral-500">(Seat 0)</span></div>
            <div className="text-xs text-neutral-400">userId: "user-3"</div>
          </div>

          {mode === "2v2" && (
            <div className="rounded bg-neutral-900 p-3 text-neutral-200">
              <div>👤 Player D <span className="text-neutral-500">(Seat 1)</span></div>
              <div className="text-xs text-neutral-400">userId: "user-4"</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// M02: The 3 Independent Questions
function VisualizerM02() {
  const [phase, setPhase] = useState<"CODING" | "SCORE_REVEAL">("CODING");
  const [activity, setActivity] = useState<"coding" | "evaluating">("evaluating");
  const [isOnline, setIsOnline] = useState<boolean>(true);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">The 3 Independent Dials</span>
        <span className="text-neutral-400">Notice how changing Wi-Fi does NOT change the game!</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Dial 1: Match Phase */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="text-neutral-400 uppercase">1. Global Match Clock</div>
          <div className="text-base font-bold text-white">{phase}</div>
          <div className="flex gap-1 pt-2">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${phase === "CODING" ? "bg-teal-700 text-white font-bold" : "bg-neutral-900 text-neutral-400"}`}
              onClick={() => setPhase("CODING")}
            >
              CODING
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${phase === "SCORE_REVEAL" ? "bg-teal-700 text-white font-bold" : "bg-neutral-900 text-neutral-400"}`}
              onClick={() => setPhase("SCORE_REVEAL")}
            >
              REVEAL
            </button>
          </div>
        </div>

        {/* Dial 2: Player Activity */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="text-neutral-400 uppercase">2. Player Action</div>
          <div className="text-base font-bold text-teal-600">{activity}</div>
          <div className="flex gap-1 pt-2">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${activity === "coding" ? "bg-teal-700 text-white font-bold" : "bg-neutral-900 text-neutral-400"}`}
              onClick={() => setActivity("coding")}
            >
              Coding
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${activity === "evaluating" ? "bg-teal-700 text-white font-bold" : "bg-neutral-900 text-neutral-400"}`}
              onClick={() => setActivity("evaluating")}
            >
              Evaluating
            </button>
          </div>
        </div>

        {/* Dial 3: Wi-Fi Presence */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="text-neutral-400 uppercase">3. Wi-Fi Status</div>
          <div className={`text-base font-bold ${isOnline ? "text-teal-600" : "text-red-700"}`}>
            {isOnline ? "● ONLINE" : "○ OFFLINE"}
          </div>
          <div className="pt-2">
            <button
              type="button"
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-200 hover:text-white"
              onClick={() => setIsOnline(!isOnline)}
            >
              {isOnline ? "Simulate Wi-Fi Drop" : "Reconnect Wi-Fi"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 text-neutral-300">
        <span className="font-bold text-teal-600">What the server remembers: </span>
        {isOnline ? (
          <span>Player is connected. Their code is currently <strong className="text-white">{activity}</strong>.</span>
        ) : (
          <span>
            Wi-Fi dropped! Player is offline, BUT their solution is STILL safely <strong className="text-white">{activity}</strong> on the server!
          </span>
        )}
      </div>
    </div>
  );
}

// M03: Deadline Stopwatch
function VisualizerM03() {
  const [seconds, setSeconds] = useState<number>(45);
  const [message, setMessage] = useState<string>("");

  const handleTestSubmit = (submitTime: number) => {
    if (submitTime <= 60) {
      setMessage(`✓ Accepted! Submitted at ${submitTime}s (before the 60s deadline). Code is sent to the runner.`);
    } else {
      setMessage(`✘ Rejected! Submitted at ${submitTime}s (past 60s deadline). Server status is already SCORE_REVEAL.`);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">The Official Server Stopwatch</span>
        <span className="text-neutral-400">Deadline: 60 seconds</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-800 p-4">
        <div>
          <div className="text-neutral-400">Current Server Clock:</div>
          <div className="text-2xl font-bold text-white">{seconds}s / 60s</div>
          <div className="text-xs text-neutral-400">
            {seconds <= 60 ? "Status: CODING (Submissions allowed)" : "Status: SCORE_REVEAL (Locked!)"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-neutral-900 px-3 py-1.5 text-neutral-200 hover:text-white"
            onClick={() => { setSeconds(30); handleTestSubmit(30); }}
          >
            Submit at 30s
          </button>
          <button
            type="button"
            className="rounded bg-neutral-900 px-3 py-1.5 text-neutral-200 hover:text-white"
            onClick={() => { setSeconds(59); handleTestSubmit(59); }}
          >
            Submit at 59s
          </button>
          <button
            type="button"
            className="rounded bg-red-700 px-3 py-1.5 font-bold text-white hover:opacity-90"
            onClick={() => { setSeconds(61); handleTestSubmit(61); }}
          >
            Submit at 61s (Late!)
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 text-neutral-200">
          {message}
        </div>
      )}
    </div>
  );
}

// M04: Public vs Secret Vault
function VisualizerM04() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">The Two Test Vaults</span>
        <button
          type="button"
          className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-neutral-200"
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? "🔒 Lock Secret Tests (During Match)" : "🔓 Unlock (At Score Reveal)"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Public Vault */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">1. Public Example Tests</span>
            <span>👁️ Visible to Browser</span>
          </div>
          <div className="text-neutral-400">Used when player clicks "Run". No points awarded.</div>
          <div className="rounded bg-neutral-900 p-2 text-neutral-300">
            <div>• Example 1: input <code>2</code> ➔ expected <code>4</code></div>
            <div>• Example 2: input <code>5</code> ➔ expected <code>10</code></div>
          </div>
        </div>

        {/* Secret Vault */}
        <div className={`rounded-lg border p-4 space-y-2 ${revealed ? "border-teal-600 bg-neutral-800" : "border-neutral-800 bg-neutral-900"}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">2. Secret Graded Tests</span>
            <span>{revealed ? "🔓 Revealed" : "🔒 Server Safe"}</span>
          </div>
          <div className="text-neutral-400">Decides final score on "Submit". Hidden from player network tab!</div>
          <div className="rounded bg-neutral-900 p-2 text-neutral-300">
            {revealed ? (
              <>
                <div>• Hidden 1: large input <code>1000000</code></div>
                <div>• Hidden 2: negative numbers <code>-42</code></div>
                <div>• Hidden 3: edge case zero <code>0</code></div>
              </>
            ) : (
              <div className="text-neutral-500 italic">
                🔒 Hidden on server. Browser cannot inspect until round completes!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// M05: Score Calculator
function VisualizerM05() {
  const [g1Passed, setG1Passed] = useState<number>(4);
  const [g2Passed, setG2Passed] = useState<number>(2);

  // Group 1: weight 50, 4 tests
  const g1Bp = Math.floor((50 * g1Passed * 100) / 4);
  // Group 2: weight 50, 4 tests
  const g2Bp = Math.floor((50 * g2Passed * 100) / 4);
  const totalBp = g1Bp + g2Bp;
  const finalScore = Math.round(totalBp / 100);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Score Engine (Basis Points Math)</span>
        <span className="text-neutral-400">10,000 points = 100%</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 space-y-2">
          <div className="font-bold text-white">Group 1 (Weight 50)</div>
          <div className="text-neutral-400">Passed: {g1Passed} / 4 tests</div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`rounded px-2.5 py-1 ${g1Passed === n ? "bg-teal-700 text-white font-bold" : "bg-neutral-900 text-neutral-400"}`}
                onClick={() => setG1Passed(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-neutral-300">Earned: <span className="font-bold text-teal-600">{g1Bp}</span> / 5,000 bp</div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 space-y-2">
          <div className="font-bold text-white">Group 2 (Weight 50)</div>
          <div className="text-neutral-400">Passed: {g2Passed} / 4 tests</div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`rounded px-2.5 py-1 ${g2Passed === n ? "bg-teal-700 text-white font-bold" : "bg-neutral-900 text-neutral-400"}`}
                onClick={() => setG2Passed(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-neutral-300">Earned: <span className="font-bold text-teal-600">{g2Bp}</span> / 5,000 bp</div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-800 p-4">
        <div>
          <span className="text-neutral-400">Total Basis Points: </span>
          <span className="font-bold text-white">{totalBp} / 10,000</span>
        </div>
        <div className="text-lg font-bold text-teal-600">
          Official Round Score: {finalScore} / 100
        </div>
      </div>
    </div>
  );
}

// M06: Front Door Bouncer
function VisualizerM06() {
  const [testResult, setTestResult] = useState<string>("");

  const testPayload = (type: "valid" | "empty" | "bad_lang") => {
    if (type === "valid") {
      setTestResult("HTTP 200 OK: Valid submission accepted and queued.");
    } else if (type === "empty") {
      setTestResult("HTTP 400 Bad Request: Code field cannot be empty.");
    } else {
      setTestResult("HTTP 400 Bad Request: Unsupported language.");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">The Front Door Bouncer</span>
        <span className="text-neutral-400">Test incoming HTTP requests</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-neutral-200 hover:text-white"
          onClick={() => testPayload("valid")}
        >
          Send Valid Code: &#123; code: "print(1)", lang: "python" &#125;
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-neutral-200 hover:text-white"
          onClick={() => testPayload("empty")}
        >
          Send Empty Code: &#123; code: "" &#125;
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-neutral-200 hover:text-white"
          onClick={() => testPayload("bad_lang")}
        >
          Send Bad Lang: &#123; lang: "malicious" &#125;
        </button>
      </div>

      {testResult && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 text-neutral-200">
          {testResult}
        </div>
      )}
    </div>
  );
}

// M07: Transport Plug
function VisualizerM07() {
  const [plug, setPlug] = useState<"mock" | "socket">("mock");

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">The Transport Plug</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded px-2.5 py-1 ${plug === "mock" ? "bg-teal-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"}`}
            onClick={() => setPlug("mock")}
          >
            Mock Transport (Offline)
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 ${plug === "socket" ? "bg-teal-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"}`}
            onClick={() => setPlug("socket")}
          >
            Socket Transport (Online)
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
        <div className="font-bold text-white">Current Active Plug: {plug.toUpperCase()}</div>
        <p className="text-neutral-300 leading-relaxed">
          {plug === "mock"
            ? "Your React UI buttons talk to a fake local object. You can test buttons, keyboard shortcuts, and animations in 0.1 seconds without booting any servers."
            : "Your React UI buttons talk to a real WebSocket cable connecting to port 3000."}
        </p>
      </div>
    </div>
  );
}

// M08: PostgreSQL Version Locking
function VisualizerM08() {
  const [rev, setRev] = useState(1);
  const [log, setLog] = useState<string>("Match currently at revision v1.");

  const handleP1Save = () => {
    setRev(rev + 1);
    setLog(`Player 1 saved: version updated to v${rev + 1}.`);
  };

  const handleP2StaleSave = () => {
    setLog(`Player 2 tried saving with stale v${rev}! Database rejected: RevisionMismatchError.`);
  };

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Database Version Locking</span>
        <span className="text-white">Current DB Version: v{rev}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-teal-700 px-3 py-1.5 font-bold text-white hover:bg-teal-600"
          onClick={handleP1Save}
        >
          Player 1 Saves Score (Increments v{rev} ➔ v{rev + 1})
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-neutral-200 hover:text-white"
          onClick={handleP2StaleSave}
        >
          Simulate Player 2 Stale Save
        </button>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 text-neutral-300">
        {log}
      </div>
    </div>
  );
}

// M09: Stopping Frozen Code
function VisualizerM09() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready");

  const startFrozenProgram = () => {
    setRunning(true);
    setStatus("Running 'while(1){}'... CPU at 100%...");
    setTimeout(() => {
      setStatus("2000ms expired! Kernel sent SIGKILL (Signal 9)! Memory reclaimed. Verdict: TLE.");
      setRunning(false);
    }, 2000);
  };

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Process Sandbox: 2000ms Hard Limit</span>
        <span className="text-neutral-400">SIGKILL Defense</span>
      </div>

      <button
        type="button"
        disabled={running}
        className={`rounded px-4 py-2 font-bold text-white ${running ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" : "bg-red-700 hover:opacity-90"}`}
        onClick={startFrozenProgram}
      >
        {running ? "Watching Timer (2s)..." : "Run Dangerous 'while(1){}' Code"}
      </button>

      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 text-neutral-200">
        Status: {status}
      </div>
    </div>
  );
}

// M11: 2v2 Mutual Ready Console
function VisualizerM11() {
  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);

  const canSubmit = p1Ready && p2Ready;

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">2v2 Dual-Key Launch Console</span>
        <span className="text-neutral-400">Both teammates must agree</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          className={`rounded-lg border p-4 text-center ${p1Ready ? "border-teal-600 bg-neutral-800 text-teal-600 font-bold" : "border-neutral-800 bg-neutral-900 text-neutral-400"}`}
          onClick={() => setP1Ready(!p1Ready)}
        >
          <div>Teammate 1</div>
          <div className="mt-1 text-base">{p1Ready ? "✓ READY" : "○ Not ready"}</div>
        </button>

        <button
          type="button"
          className={`rounded-lg border p-4 text-center ${p2Ready ? "border-teal-600 bg-neutral-800 text-teal-600 font-bold" : "border-neutral-800 bg-neutral-900 text-neutral-400"}`}
          onClick={() => setP2Ready(!p2Ready)}
        >
          <div>Teammate 2</div>
          <div className="mt-1 text-base">{p2Ready ? "✓ READY" : "○ Not ready"}</div>
        </button>
      </div>

      <div className={`rounded-lg border p-3 text-center font-bold ${canSubmit ? "border-teal-600 bg-neutral-800 text-teal-600" : "border-neutral-800 bg-neutral-900 text-neutral-500"}`}>
        {canSubmit ? "🚀 Both Ready! Code is submitted to the judge!" : "🔒 Submission locked: Waiting for both teammates to click Ready"}
      </div>
    </div>
  );
}

// M12: Team Chat Radio
function VisualizerM12() {
  const [side, setSide] = useState<"left" | "right">("left");

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Team Radio Channels</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded px-2.5 py-1 ${side === "left" ? "bg-teal-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"}`}
            onClick={() => setSide("left")}
          >
            Listen to Team Left
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 ${side === "right" ? "bg-teal-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"}`}
            onClick={() => setSide("right")}
          >
            Listen to Team Right
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2">
        <div className="font-bold text-white">Private Radio Room: match:123:team:{side}</div>
        {side === "left" ? (
          <div className="text-neutral-300">
            <div>• <strong className="text-teal-600">Teammate A:</strong> "Let's use a hash map for O(n) lookup."</div>
            <div>• <strong className="text-teal-600">Teammate B:</strong> "Agreed, writing the loop now."</div>
          </div>
        ) : (
          <div className="text-neutral-300">
            <div>• <strong className="text-red-700">Opponent C:</strong> "Did you see the hidden test limits?"</div>
            <div>• <strong className="text-red-700">Opponent D:</strong> "Yes, keeping memory small."</div>
          </div>
        )}
      </div>
    </div>
  );
}

// M10: Live WebSocket Rooms and Auth
function VisualizerM10() {
  const [strangerStatus, setStrangerStatus] = useState<string>("");

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Live Match Room: "match:101"</span>
        <span className="text-neutral-400">WebSocket Room Security</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-teal-600 bg-neutral-800 p-4 space-y-2">
          <div className="font-bold text-teal-600">Authenticated Players in Room:</div>
          <div className="space-y-1.5 text-neutral-200">
            <div className="rounded bg-neutral-900 p-2">
              🟢 <strong>Player Left:</strong> Token matches match:101 (Connected)
            </div>
            <div className="rounded bg-neutral-900 p-2">
              🟢 <strong>Player Right:</strong> Token matches match:101 (Connected)
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-3">
          <div className="font-bold text-white">Connection Guard:</div>
          <p className="text-neutral-300">
            The server checks every player's ticket before letting them into this room.
          </p>
          <button
            type="button"
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-200 hover:text-white"
            onClick={() => setStrangerStatus("Rejected! Stranger ticket was for match:999. Access Denied (HTTP 401).")}
          >
            Simulate Stranger Trying to Enter
          </button>
          {strangerStatus && (
            <div className="rounded bg-neutral-900 p-2 text-red-700 font-semibold">
              {strangerStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// M13: Full Integration Monitor
function VisualizerM13() {
  const [checkedAll, setCheckedAll] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="font-bold text-teal-600">Full System Health Dashboard</span>
        <button
          type="button"
          className="rounded bg-teal-700 px-3 py-1 font-bold text-white hover:bg-teal-600"
          onClick={() => setCheckedAll(true)}
        >
          {checkedAll ? "✓ All Systems Verified" : "Run Full Integration Test"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          "1. Game Rules & Roster",
          "2. Countdown & Deadline",
          "3. Public vs Secret Tests",
          "4. Integer Score Math",
          "5. Database Version Lock",
          "6. 2s SIGKILL Safe Runner",
          "7. WebSocket Live Rooms",
          "8. 2v2 Shared Editor",
          "9. Private Team Chat",
        ].map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-800 p-2.5 text-neutral-200"
          >
            <span className={checkedAll ? "text-teal-600 font-bold" : "text-neutral-400"}>
              {checkedAll ? "✔ PASS" : "● READY"}
            </span>
            <span className="truncate">{item}</span>
          </div>
        ))}
      </div>

      {checkedAll && (
        <div className="rounded-lg border border-teal-600 bg-neutral-800 p-3 text-teal-600 font-bold text-center">
          🎉 All 9 subsystems verified! Monorepo tests passing with 0 errors!
        </div>
      )}
    </div>
  );
}

// Master component matching milestone ID to its interactive visualizer
export function MilestoneVisualizer({ milestoneId }: { milestoneId: string }) {
  switch (milestoneId) {
    case "M00":
      return <VisualizerM00 />;
    case "M01":
      return <VisualizerM01 />;
    case "M02":
      return <VisualizerM02 />;
    case "M03":
      return <VisualizerM03 />;
    case "M04":
      return <VisualizerM04 />;
    case "M05":
      return <VisualizerM05 />;
    case "M06":
      return <VisualizerM06 />;
    case "M07":
      return <VisualizerM07 />;
    case "M08":
      return <VisualizerM08 />;
    case "M09":
      return <VisualizerM09 />;
    case "M10":
      return <VisualizerM10 />;
    case "M11":
      return <VisualizerM11 />;
    case "M12":
      return <VisualizerM12 />;
    case "M13":
      return <VisualizerM13 />;
    default:
      return null;
  }
}
