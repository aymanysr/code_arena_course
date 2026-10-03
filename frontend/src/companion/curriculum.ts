import type { MilestoneGuide } from "./types.js";

export const MILESTONES: MilestoneGuide[] = [
  {
    id: "M00",
    act: "Part 1: The Core Game Loop",
    title: "How the 3 Parts of the Game Talk to Each Other",
    subtitle: "The Player Screen, the Main Server, and the Safe Code Runner.",
    category: "Big Picture",
    prerequisites: [],
    theWhat:
      "Code Arena is split into 3 separate programs: 1) The Player Screen in the browser, 2) The Main Server that manages matches and scores, and 3) A Safe Code Runner box (Docker container) that runs player code without danger.",
    theWhy:
      "If someone writes bad code like an infinite loop `while(1){}` or dangerous code, you cannot run it on your main server or it will freeze your whole computer. You must send it to an isolated runner box.",
    keyInvariant:
      "Rule: The main web server NEVER runs player code itself. It only asks the runner box to test it.",
    catastrophicFailureIfOmitted:
      "If you run player code directly on your main server, one player submitting `while(1){}` will freeze the server for everybody playing.",
    scaffold: {
      folderPath: "packages/arena-model/src",
      createCommand: "mkdir -p packages/arena-model/src && touch packages/arena-model/src/events.ts",
      targetFile: "packages/arena-model/src/events.ts",
      purpose: "Define the job contract passed between main server and code runner",
      starterBoilerplate: `// packages/arena-model/src/events.ts
export interface SubmitJobPayload {
  matchId: string;
  userId: string;
  code: string;
  language: "python" | "typescript" | "cpp";
}

export interface RunnerVerdict {
  passed: boolean;
  status: "ACCEPTED" | "TLE" | "RTE" | "WRONG_ANSWER";
  runtimeMs: number;
}`
    },
    snippets: [
      {
        title: "The 2 Separate Containers in docker-compose.yml",
        filePath: "docker-compose.yml",
        lines: "14-36",
        language: "json",
        whyItMatters: "Shows how the main game server and the code runner are kept in separate containers with memory and CPU limits.",
        code: `services:
  game:
    build: { context: ., dockerfile: services/game/Dockerfile }
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgresql://arena:arena@postgres:5432/arena
      - JUDGE_WORKER_URL=http://judge-worker:4000
    depends_on: [postgres, judge-worker]

  judge-worker:
    build: { context: ., dockerfile: services/judge-worker/Dockerfile }
    privileged: true
    cpus: "2.0"
    mem_limit: "512M"
    # Strict CPU and memory limits protect your machine`
      }
    ],
    cBridge: {
      cConcept: "Running a child process with fork() and execve()",
      tsConcept: "Sending jobs to an isolated Docker container",
      cComparison:
        "In C on Linux, you create a child process with fork(), restrict its CPU with setrlimit(), and run it with execve().",
      whyDiffer:
        "In modern web apps, we run a dedicated runner container that listens for test jobs over HTTP and isolates untrusted code automatically."
    },
    testGuide: {
      terminalCommand: "npm run lint && npm test --workspace=arena-model",
      testFile: "packages/arena-model/test/events.test.ts",
      whatItAsserts: "Checks that messages passed between server and runner have the correct fields.",
      commonFailure: {
        symptom: "Missing package or build error.",
        diagnostic: "Run 'npm run build --workspace=arena-model' first.",
        fix: "Compile arena-model before running tests that depend on it."
      }
    },
    dataFlow: [
      { actor: "Player Screen", action: "Player clicks 'Submit'", payload: "{ matchId, code, language }", invariant: "Browser never runs the tests" },
      { actor: "Main Server", action: "Puts job in queue", payload: "Push to job queue", invariant: "Checks if time is still remaining" },
      { actor: "Code Runner", action: "Runs tests in safe box", payload: "Compile and execute", invariant: "Kills program if it takes over 2s" },
      { actor: "Main Server", action: "Saves score", payload: "Writes points to database", invariant: "Shows scores on screen" }
    ]
  },
  {
    id: "M01",
    act: "Part 1: The Core Game Loop",
    title: "Setting Up Players and Teams",
    subtitle: "Creating simple data cards for who is playing and which side they are on.",
    category: "Game Basics",
    prerequisites: ["M00"],
    theWhat:
      "We define the basic shapes of our game data: who is playing, which side they belong to ('left' or 'right'), and whether the game is a 1v1 duel or a 2v2 team battle.",
    theWhy:
      "Before writing any game rules or timers, we need clean shapes for our data so every file agrees on what a player and a match look like.",
    keyInvariant:
      "Rule: Keep these data shapes pure and simple. Never mix web server or database code into them.",
    catastrophicFailureIfOmitted:
      "If you mix web server code into your game data, you won't be able to use the same data on the player's screen.",
    scaffold: {
      folderPath: "packages/arena-model/src",
      createCommand: "mkdir -p packages/arena-model/src && touch packages/arena-model/src/model.ts",
      targetFile: "packages/arena-model/src/model.ts",
      purpose: "Define basic player, side, and match mode types",
      starterBoilerplate: `// packages/arena-model/src/model.ts
export type MatchMode = "1v1" | "2v2";

export type SideId = "left" | "right";

export interface PlayerAssignment {
  userId: string;
  side: SideId;
  seat: 0 | 1; // 0 for primary player, 1 for teammate in 2v2
}`
    },
    snippets: [
      {
        title: "Player and Side Definitions in model.ts",
        filePath: "packages/arena-model/src/model.ts",
        lines: "1-15",
        language: "typescript",
        whyItMatters: "Simple types defining who is on the left side and who is on the right side.",
        code: `export type MatchMode = "1v1" | "2v2";

export type SideId = "left" | "right";

export interface PlayerAssignment {
  userId: string;
  side: SideId;
  seat: 0 | 1; // seat 0 is player 1, seat 1 is teammate in 2v2
}`
      }
    ],
    cBridge: {
      cConcept: "typedef enum and typedef struct",
      tsConcept: "type unions and interface",
      cComparison:
        "In C, you write `typedef enum { LEFT, RIGHT } Side;` and `struct Player { char id[32]; Side side; };`.",
      whyDiffer:
        "TypeScript string types (`'left' | 'right'`) print readable text in logs and JSON automatically without extra conversion helper functions."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-model",
      testFile: "packages/arena-model/test/transitions.test.ts",
      whatItAsserts: "Verifies that player sides and match modes are valid.",
      commonFailure: {
        symptom: "Type error: Type '\"top\"' is not assignable to type 'SideId'.",
        diagnostic: "SideId can only be 'left' or 'right'.",
        fix: "Use 'left' or 'right' instead of custom names."
      }
    },
    dataFlow: [
      { actor: "Lobby System", action: "Assign Seats", payload: "Player 1 to left side, Player 2 to right side", invariant: "Every match has exactly two sides" }
    ]
  },
  {
    id: "M02",
    act: "Part 1: The Core Game Loop",
    title: "The 3 Independent Questions",
    subtitle: "Match Phase, Player Action, and Internet Connection.",
    category: "Game Basics",
    prerequisites: ["M01"],
    theWhat:
      "The game always tracks 3 separate questions: 1) What round is the game in? (Match Phase) 2) What is the player doing? (coding, running, submitted) 3) Is their internet connected? (online or offline).",
    theWhy:
      "Never mix up internet connection with game status. If a player's Wi-Fi drops for 1 second while their code is being tested, they are still 'submitted'. Do not erase their work!",
    keyInvariant:
      "Rule: Losing Wi-Fi only marks the player 'offline'. It NEVER deletes their code or changes their game status.",
    catastrophicFailureIfOmitted:
      "A player submits the winning answer, their Wi-Fi blinks for half a second, the server marks them 'idle', and their score is wiped out.",
    scaffold: {
      folderPath: "packages/arena-model/src",
      createCommand: "touch packages/arena-model/src/model.ts",
      targetFile: "packages/arena-model/src/model.ts",
      purpose: "Add RoundPhase, PlayerStatus, and Presence to model.ts",
      starterBoilerplate: `// Append to packages/arena-model/src/model.ts:

// 1. Where is the match clock right now?
export type RoundPhase =
  | "MATCH_FOUND"
  | "ROUND_INTRO"
  | "CODING"
  | "SCORE_REVEAL"
  | "ROUND_COMPLETE"
  | "MATCH_COMPLETE";

// 2. What is this specific player doing?
export type PlayerStatus =
  | "coding"
  | "running"
  | "submitted"
  | "evaluating"
  | "locked";

// 3. Is their network socket connected?
export type Presence = "online" | "offline";`
    },
    snippets: [
      {
        title: "The 3 Independent States in model.ts",
        filePath: "packages/arena-model/src/model.ts",
        lines: "23-41",
        language: "typescript",
        whyItMatters: "Separates match timer status, player coding activity, and internet connection.",
        code: `// 1. Where is the match clock?
export type RoundPhase =
  | "MATCH_FOUND"
  | "ROUND_INTRO"
  | "CODING"
  | "SCORE_REVEAL"
  | "ROUND_COMPLETE"
  | "MATCH_COMPLETE";

// 2. What is the player doing right now?
export type PlayerStatus =
  | "coding"
  | "running"
  | "submitted"
  | "evaluating"
  | "locked";

// 3. Is their network connected?
export type Presence = "online" | "offline";`
      }
    ],
    cBridge: {
      cConcept: "Separate flags in a struct",
      tsConcept: "Separate union fields on a state object",
      cComparison:
        "In C: `struct PlayerState { uint8_t game_status; uint8_t wifi_status; };`.",
      whyDiffer:
        "TypeScript gives clear English names to states and checks that you handle all cases in your code."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-model -- -t 'transitions'",
      testFile: "packages/arena-model/test/transitions.test.ts",
      whatItAsserts: "Verifies that disconnecting does not erase player code or score.",
      commonFailure: {
        symptom: "Test 'disconnect preserves evaluating state' fails.",
        diagnostic: "Your disconnect code is modifying player activity.",
        fix: "Only change presence to 'offline'; leave player status as 'submitted' or 'evaluating'."
      }
    },
    dataFlow: [
      { actor: "Network Socket", action: "Wi-Fi disconnects", payload: "presence = 'offline'", invariant: "player activity stays 'evaluating'" }
    ]
  },
  {
    id: "M03",
    act: "Part 1: The Core Game Loop",
    title: "The Clock and Round Rules",
    subtitle: "Setting the timer and making sure late answers are rejected.",
    category: "Game Rules",
    prerequisites: ["M02"],
    theWhat:
      "A referee function that checks the time and moves the game forward: Lobby ➔ Round Starts ➔ Coding ➔ Score Reveal. It checks the official server time against the deadline.",
    theWhy:
      "Players cannot be trusted to say what time it is. The server's clock is the only official clock. When the clock hits 0, coding stops immediately.",
    keyInvariant:
      "Rule: Time moves forward only. Once the round ends and scores are revealed, nobody can submit new code.",
    catastrophicFailureIfOmitted:
      "If the server trusts the player's clock, someone can change their computer's time to yesterday and submit after everyone else is done.",
    scaffold: {
      folderPath: "packages/arena-game/src",
      createCommand: "mkdir -p packages/arena-game/src && touch packages/arena-game/src/round-lifecycle.ts",
      targetFile: "packages/arena-game/src/round-lifecycle.ts",
      purpose: "Referee class that enforces deadlines and round transitions",
      starterBoilerplate: `// packages/arena-game/src/round-lifecycle.ts
export interface MatchRecord {
  roundPhase: string;
  deadlineAt: number;
}

export class RoundLifecycle {
  evaluateDeadline(match: MatchRecord, now: number): boolean {
    // If clock reached the deadline, transition to SCORE_REVEAL
    if (match.roundPhase === "CODING" && now >= match.deadlineAt) {
      match.roundPhase = "SCORE_REVEAL";
      return true; // time expired
    }
    return false;
  }
}`
    },
    snippets: [
      {
        title: "Checking the Clock in round-lifecycle.ts",
        filePath: "packages/arena-game/src/round-lifecycle.ts",
        lines: "57-78",
        language: "typescript",
        whyItMatters: "Checks if time is up and moves the round to Score Reveal.",
        code: `export class RoundLifecycle {
  startRound(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "ROUND_INTRO")) {
      throw new IllegalStateError(\`cannot start round in \${match.roundPhase}\`);
    }
    match.roundPhase = "ROUND_INTRO";
  }

  evaluateDeadline(match: MatchRecord, now: number): boolean {
    // If time is up, move to SCORE_REVEAL immediately
    if (match.roundPhase === "CODING" && now >= match.deadlineAt) {
      match.roundPhase = "SCORE_REVEAL";
      return true; // time expired!
    }
    return false;
  }
}`
      }
    ],
    cBridge: {
      cConcept: "State machine with switch-case",
      tsConcept: "State transition checker function",
      cComparison:
        "In C, you write `switch(current_state) { case CODING: if (time >= deadline) next = REVEAL; }`.",
      whyDiffer:
        "TypeScript enforces state names so you can never spell a state name wrong by mistake."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-game -- test/round-lifecycle.test.ts",
      testFile: "packages/arena-game/test/round-lifecycle.test.ts",
      whatItAsserts: "Verifies that submissions sent after the deadline are rejected.",
      commonFailure: {
        symptom: "IllegalStateError was not thrown on late submission.",
        diagnostic: "Check your evaluateDeadline function.",
        fix: "Ensure roundPhase is updated to 'SCORE_REVEAL' once now >= deadlineAt."
      }
    },
    dataFlow: [
      { actor: "Server Clock", action: "Tick past deadline", payload: "now >= deadlineAt", invariant: "Round moves to SCORE_REVEAL" },
      { actor: "Late Player", action: "Sends code after clock hit 0", payload: "Submit request", invariant: "Server rejects: time is up" }
    ]
  },
  {
    id: "M04",
    act: "Part 1: The Core Game Loop",
    title: "Problems: Public Tests vs Secret Tests",
    subtitle: "Letting players test examples without leaking the graded answers.",
    category: "Problems & Tests",
    prerequisites: ["M03"],
    theWhat:
      "Every problem has 2 sets of tests: 1) Public Example Tests (visible on screen), and 2) Secret Hidden Tests (kept safe on the server).",
    theWhy:
      "'Run' only tests public examples and never gives points. 'Submit' tests secret tests and decides the score. Secret tests must stay hidden so players cannot cheat.",
    keyInvariant:
      "Rule: Never send the secret test cases to the browser before the round ends.",
    catastrophicFailureIfOmitted:
      "If secret tests are sent to the browser, a player can open developer tools, read the answers, and write a fake solution.",
    scaffold: {
      folderPath: "packages/problem-bank/problems",
      createCommand: "mkdir -p packages/problem-bank/problems && touch packages/problem-bank/problems/double-it.json",
      targetFile: "packages/problem-bank/problems/double-it.json",
      purpose: "Create your first practice problem file with public examples and secret tests",
      starterBoilerplate: `{
  "id": "double-it",
  "title": "Double the Number",
  "prompt": "Write a function solve(n) that returns n multiplied by 2.",
  "starterCode": {
    "python": "def solve(n):\\n    return n * 2",
    "typescript": "export function solve(n: number): number {\\n  return n * 2;\\n}"
  },
  "visibleTests": [
    { "id": "v1", "input": "2", "expected": "4" },
    { "id": "v2", "input": "5", "expected": "10" }
  ],
  "hiddenTestGroups": [
    {
      "name": "Secret Edge Cases",
      "weight": 100,
      "tests": [
        { "input": "0", "expected": "0" },
        { "input": "-5", "expected": "-10" }
      ]
    }
  ]
}`
    },
    snippets: [
      {
        title: "Stripping Secret Tests in file-bank.ts",
        filePath: "packages/arena-game/src/file-bank.ts",
        lines: "22-45",
        language: "typescript",
        whyItMatters: "Removes hidden test groups before sending problem description to the player.",
        code: `export interface ProblemDefinition {
  id: string;
  title: string;
  prompt: string;
  starterCode: Record<string, string>;
  visibleTests: Array<{ id: string; input: string; expected: string }>;
  hiddenTestGroups: Array<{ name: string; weight: number; tests: any[] }>;
}

export function toPublicProblem(problem: ProblemDefinition) {
  // Strip hiddenTestGroups so the player cannot inspect them!
  const { hiddenTestGroups, ...publicData } = problem;
  return publicData;
}`
      }
    ],
    cBridge: {
      cConcept: "Public header (.h) vs Private source (.c)",
      tsConcept: "Excluding secret fields from public objects",
      cComparison:
        "In C, you put visible declarations in `problem.h` and keep secret test arrays static inside `problem.c`.",
      whyDiffer:
        "In TypeScript, we use object destructuring (`const { secret, ...safe } = data`) to remove private fields."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-game -- test/compiled-bank.test.ts",
      testFile: "packages/arena-game/test/compiled-bank.test.ts",
      whatItAsserts: "Verifies that public problems sent to players never contain secret test cases.",
      commonFailure: {
        symptom: "Security test fails: 'hiddenTestGroups found in public payload'.",
        diagnostic: "You sent the full problem object to the browser.",
        fix: "Call toPublicProblem() before sending data to the client."
      }
    },
    dataFlow: [
      { actor: "Server", action: "Send Problem to Browser", payload: "toPublicProblem()", invariant: "Zero secret tests in data" },
      { actor: "Player", action: "Clicks 'Run Tests'", payload: "Test visible examples", invariant: "Score does not change" }
    ]
  },
  {
    id: "M05",
    act: "Part 1: The Core Game Loop",
    title: "Calculating Points (Fair Math with No Decimals)",
    subtitle: "Using whole numbers so every computer calculates the exact same score.",
    category: "Scores",
    prerequisites: ["M04"],
    theWhat:
      "Calculate points for passed tests (0 to 100 points) and break ties using total time taken.",
    theWhy:
      "Computers sometimes calculate decimal numbers like 0.1 + 0.2 as 0.30000000000000004. Different computers get tiny rounding differences. Using whole numbers (basis points) ensures 100% fair and identical scores everywhere.",
    keyInvariant:
      "Rule: All score calculations use whole numbers only. We only round once at the very end.",
    catastrophicFailureIfOmitted:
      "Two players tie, but a tiny computer decimal error gives one player 79.9999 and the other 80.0000, unfairly giving the win to the wrong person.",
    scaffold: {
      folderPath: "packages/arena-model/src",
      createCommand: "touch packages/arena-model/src/scoring.ts",
      targetFile: "packages/arena-model/src/scoring.ts",
      purpose: "Whole number scoring math using basis points",
      starterBoilerplate: `// packages/arena-model/src/scoring.ts
export function groupEarnedBp(weight: number, passed: number, total: number): number {
  if (total <= 0 || passed < 0) return 0;
  // Integer arithmetic: multiply first, then floor divide
  return Math.floor((weight * passed * 100) / total);
}

export function roundScoreFromBp(basisPoints: number): number {
  return Math.round(basisPoints / 100);
}`
    },
    snippets: [
      {
        title: "Whole-Number Score Math in scoring.ts",
        filePath: "packages/arena-model/src/scoring.ts",
        lines: "42-59",
        language: "typescript",
        whyItMatters: "Calculates scores using pure integers so results are 100% consistent on all devices.",
        code: `export function groupEarnedBp(weight: number, passed: number, total: number): number {
  if (!Number.isInteger(weight) || weight < 0) throw new RangeError("bad weight");
  if (!Number.isInteger(total) || total <= 0) throw new RangeError("bad total");
  if (!Number.isInteger(passed) || passed < 0 || passed > total) throw new RangeError("bad passed");
  
  // Multiply first, then use integer floor division
  return Math.floor((weight * passed * 100) / total);
}

export function roundScoreBp(groups: GroupCounts[]): number {
  return groups.reduce((sum, g) => sum + groupEarnedBp(g.weight, g.passed, g.total), 0);
}`
      }
    ],
    cBridge: {
      cConcept: "Fixed-point math with uint32_t",
      tsConcept: "Integer math with Math.floor()",
      cComparison:
        "In C, you multiply by 10,000 to keep everything as an integer and avoid floating-point math bugs.",
      whyDiffer:
        "JavaScript numbers are double floats by default, so we call `Math.floor()` on whole numbers to act like C integers."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-model -- test/scoring.test.ts",
      testFile: "packages/arena-model/test/scoring.test.ts",
      whatItAsserts: "Verifies score calculations and tie-breaking order.",
      commonFailure: {
        symptom: "Test fails with decimal drift (e.g. 79.999 instead of 80).",
        diagnostic: "Floating point division was used without Math.floor.",
        fix: "Use groupEarnedBp integer math formula."
      }
    },
    dataFlow: [
      { actor: "Code Runner", action: "Reports 3 of 4 tests passed", payload: "weight: 50, passed: 3, total: 4", invariant: "earnedBp = floor(50*3*100/4) = 3750" },
      { actor: "Scoring Engine", action: "Sums points", payload: "Total = 8750 / 10000", invariant: "Final score = 88 / 100" }
    ]
  },
  {
    id: "M06",
    act: "Part 2: Backend & Database",
    title: "Checking Input at the Front Door",
    subtitle: "Verifying every player request before it touches game code.",
    category: "Web Server",
    prerequisites: ["M05"],
    theWhat:
      "The web server front door (API routes). When someone clicks Run or Submit, check that the message has valid code, language, and match ID.",
    theWhy:
      "Never trust data sent from the internet. Someone might send an empty message or bad data that could crash the server.",
    keyInvariant:
      "Rule: If a message is missing code or has invalid data, reject it immediately with a 400 Bad Request error.",
    catastrophicFailureIfOmitted:
      "A player sends an empty message, the server tries to read `code.length` and crashes the entire website with an unhandled error.",
    scaffold: {
      folderPath: "services/game/src/game",
      createCommand: "mkdir -p services/game/src/game && touch services/game/src/game/game.controller.ts",
      targetFile: "services/game/src/game/game.controller.ts",
      purpose: "HTTP controller receiving Run and Submit requests",
      starterBoilerplate: `// services/game/src/game/game.controller.ts
export class GameController {
  async handleSubmit(matchId: string, body: { code: string; language: string }) {
    if (!body.code || typeof body.code !== "string" || body.code.trim().length === 0) {
      throw new Error("HTTP 400: Code cannot be empty");
    }
    // Forward to game engine
    return { status: "accepted", matchId };
  }
}`
    },
    snippets: [
      {
        title: "Validating Requests in game.controller.ts",
        filePath: "services/game/src/game/game.controller.ts",
        lines: "28-48",
        language: "typescript",
        whyItMatters: "Stops bad or empty submissions before they can cause damage.",
        code: `export class GameController {
  @Post("/matches/:id/submit")
  async submitCode(
    @Param("id") matchId: string,
    @Body() body: SubmitDto,
    @Headers("authorization") authHeader: string
  ) {
    const userId = extractUserId(authHeader);
    // Reject empty code immediately
    if (!body.code || typeof body.code !== "string") {
      throw new BadRequestException("Code cannot be empty");
    }
    const result = await this.gameService.submitSolution(matchId, userId, body);
    return { status: "accepted", submissionId: result.id };
  }
}`
      }
    ],
    cBridge: {
      cConcept: "Buffer length and null-check validation",
      tsConcept: "Schema validation & guard clauses",
      cComparison:
        "In C, you check `if (buf == NULL || strlen(buf) == 0) return ERROR;`.",
      whyDiffer:
        "In TypeScript web servers, validation libraries check objects automatically and return HTTP 400 error codes."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-game -- test/run-path.test.ts",
      testFile: "packages/arena-game/test/run-path.test.ts",
      whatItAsserts: "Verifies that empty or invalid requests return HTTP 400.",
      commonFailure: {
        symptom: "Server crashed with TypeError: Cannot read property 'code'.",
        diagnostic: "Missing validation check on body.",
        fix: "Check body.code before calling game service."
      }
    },
    dataFlow: [
      { actor: "Bad Player", action: "Sends empty body {}", payload: "POST /submit", invariant: "Rejected with HTTP 400" },
      { actor: "Normal Player", action: "Sends valid code", payload: "POST /submit", invariant: "Accepted and enqueued" }
    ]
  },
  {
    id: "M07",
    act: "Part 2: Backend & Database",
    title: "Connecting the Screen to the Game",
    subtitle: "Making the screen work both offline for quick testing and online with real servers.",
    category: "Screen & Network",
    prerequisites: ["M06"],
    theWhat:
      "Build the screen (problem description, code editor, and test result box) talking to a clean 'Transport' plug.",
    theWhy:
      "If the screen is hardwired to a real server, you can't test your buttons without starting 5 backend programs. A plug allows you to test your UI instantly offline.",
    keyInvariant:
      "Rule: The screen components only talk to the Transport plug, never directly to raw network sockets.",
    catastrophicFailureIfOmitted:
      "To test whether a button lights up, you have to boot a database and backend server every single time, making development painfully slow.",
    scaffold: {
      folderPath: "frontend/src/arena",
      createCommand: "mkdir -p frontend/src/arena && touch frontend/src/arena/transport.ts",
      targetFile: "frontend/src/arena/transport.ts",
      purpose: "Clean plug interface connecting React UI to mock state or real WebSockets",
      starterBoilerplate: `// frontend/src/arena/transport.ts
export interface ArenaTransport {
  connect(): Promise<void>;
  disconnect(): void;
  sendRun(code: string, language: string): Promise<any>;
  sendSubmit(code: string, language: string): Promise<any>;
}`
    },
    snippets: [
      {
        title: "The Transport Plug in transport.ts",
        filePath: "frontend/src/arena/transport.ts",
        lines: "12-32",
        language: "typescript",
        whyItMatters: "Allows swapping between instant offline mock mode and real live game mode.",
        code: `export interface ArenaTransport {
  connect(): Promise<void>;
  disconnect(): void;
  getState(): ArenaState;
  subscribe(listener: (state: ArenaState) => void): () => void;
  sendRun(code: string, language: string): Promise<RunResult>;
  sendSubmit(code: string, language: string): Promise<SubmitResult>;
  setReady(ready: boolean): void;
}`
      }
    ],
    cBridge: {
      cConcept: "Function pointer struct (VTable)",
      tsConcept: "TypeScript interface implementation",
      cComparison:
        "In C, `struct Transport { int (*send_run)(...); int (*send_submit)(...); };`.",
      whyDiffer:
        "TypeScript interfaces have zero runtime cost and let you swap real sockets for fake testing objects easily."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-frontend -- test/mock-transport.test.ts",
      testFile: "frontend/test/mock-transport.test.ts",
      whatItAsserts: "Verifies the screen works 100% offline without needing any backend server.",
      commonFailure: {
        symptom: "Test error: 'Connection refused'.",
        diagnostic: "A component tried to connect to a real WebSocket during tests.",
        fix: "Use MockArenaTransport instead of SocketArenaTransport in tests."
      }
    },
    dataFlow: [
      { actor: "Player", action: "Types code in editor", payload: "Code text", invariant: "Local editor buffer updates" },
      { actor: "Player", action: "Clicks 'Run'", payload: "Calls transport.sendRun()", invariant: "Delegated to active transport" }
    ]
  },
  {
    id: "M08",
    act: "Part 2: Backend & Database",
    title: "Saving Matches in the Database Without Clashing",
    subtitle: "Version numbers that stop two players from overwriting each other's score.",
    category: "Database",
    prerequisites: ["M07"],
    theWhat:
      "Save matches to PostgreSQL with a version number (revision) that goes up by 1 on every save.",
    theWhy:
      "If both players submit at the exact same millisecond, two server threads try to save at the same time. The version number makes sure the second save doesn't overwrite the first one's score.",
    keyInvariant:
      "Rule: Every database update checks 'WHERE version = expected_version'.",
    catastrophicFailureIfOmitted:
      "Player 1 submits and gets 100 points. Player 2 submits a millisecond later with 50 points. The server overwrites the record, and Player 1's score is lost forever.",
    scaffold: {
      folderPath: "packages/arena-game/src",
      createCommand: "touch packages/arena-game/src/postgres-store.ts",
      targetFile: "packages/arena-game/src/postgres-store.ts",
      purpose: "PostgreSQL save function with optimistic version check",
      starterBoilerplate: `// packages/arena-game/src/postgres-store.ts
export class PostgresStore {
  constructor(private pool: any) {}

  async commitMatch(matchId: string, expectedRevision: number, matchData: any) {
    const nextRevision = expectedRevision + 1;
    const query = \`UPDATE matches 
      SET state = $1, revision = $2 
      WHERE id = $3 AND revision = $4 
      RETURNING revision\`;
    const res = await this.pool.query(query, [JSON.stringify(matchData), nextRevision, matchId, expectedRevision]);
    if (res.rowCount === 0) {
      throw new Error("RevisionMismatchError: State was modified by another player!");
    }
    return nextRevision;
  }
}`
    },
    snippets: [
      {
        title: "Version Checking in postgres-store.ts",
        filePath: "packages/arena-game/src/postgres-store.ts",
        lines: "22-44",
        language: "typescript",
        whyItMatters: "Prevents simultaneous saves from clashing and erasing scores.",
        code: `export class PostgresStore implements MatchStore {
  async commitMatch(matchId: string, expectedRev: number, record: MatchRecord): Promise<number> {
    const nextRev = expectedRev + 1;
    // Only update IF the version in the database matches what we read!
    const res = await this.pool.query(
      \`UPDATE matches 
       SET state = $1, revision = $2, updated_at = NOW() 
       WHERE id = $3 AND revision = $4 
       RETURNING revision\`,
      [JSON.stringify(record), nextRev, matchId, expectedRev]
    );
    if (res.rowCount === 0) {
      throw new RevisionMismatchError(matchId, expectedRev);
    }
    return nextRev;
  }
}`
      }
    ],
    cBridge: {
      cConcept: "Atomic Compare-And-Swap (CAS)",
      tsConcept: "SQL WHERE version = expected check",
      cComparison:
        "In C multithreading, you use `atomic_compare_exchange(&val, &old, new)`.",
      whyDiffer:
        "In web databases, we check the version column in our SQL UPDATE query."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-game -- test/persistence.test.ts",
      testFile: "packages/arena-game/test/persistence.test.ts",
      whatItAsserts: "Verifies that conflicting simultaneous updates throw RevisionMismatchError.",
      commonFailure: {
        symptom: "Test 'rejects stale revision' did not throw.",
        diagnostic: "Missing AND revision = $expected in your SQL UPDATE.",
        fix: "Add revision condition to your query."
      }
    },
    dataFlow: [
      { actor: "Save 1", action: "Saves version 1 -> 2", payload: "WHERE version = 1", invariant: "Success: saved" },
      { actor: "Save 2", action: "Tries version 1 -> 2", payload: "WHERE version = 1", invariant: "Rejected: version already changed to 2" }
    ]
  },
  {
    id: "M09",
    act: "Part 3: Running Untrusted Code",
    title: "Stopping Frozen Code with Force Kill (SIGKILL)",
    subtitle: "Killing infinite loops and fork bombs after 2 seconds.",
    category: "Code Runner",
    prerequisites: ["M08"],
    theWhat:
      "A runner queue that runs player code in a safe box, watches the clock, and stops it if it takes more than 2 seconds.",
    theWhy:
      "If a player writes `while(1){}`, normal stop requests (`SIGINT` or `SIGTERM`) can be ignored by the program. The operating system kernel only guarantees stopping frozen code when you send `SIGKILL` (signal 9).",
    keyInvariant:
      "Rule: Any program taking more than 2000 milliseconds is immediately terminated with SIGKILL and marked Time Limit Exceeded (TLE).",
    catastrophicFailureIfOmitted:
      "A player writes `while(1){}`. The process runs forever in the background, maxing out your CPU at 100% until the machine overheats or shuts down.",
    scaffold: {
      folderPath: "services/judge-worker/src",
      createCommand: "mkdir -p services/judge-worker/src && touch services/judge-worker/src/job-queue.ts",
      targetFile: "services/judge-worker/src/job-queue.ts",
      purpose: "Safe runner queue that terminates frozen processes with SIGKILL after 2s",
      starterBoilerplate: `// services/judge-worker/src/job-queue.ts
import { spawn } from "node:child_process";

export function runSandboxedCode(command: string, args: string[], timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    const timer = setTimeout(() => {
      // Force kill frozen code with signal 9!
      child.kill("SIGKILL");
      reject(new Error("TLE: Time Limit Exceeded"));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(\`Process exited with code \${code}\`);
    });
  });
}`
    },
    snippets: [
      {
        title: "Bounded Job Queue in job-queue.ts",
        filePath: "services/judge-worker/src/job-queue.ts",
        lines: "40-62",
        language: "typescript",
        whyItMatters: "Limits how many programs run at once so the server never runs out of memory.",
        code: `export class BoundedJobQueue {
  private active = 0;
  private readonly waiting: Job<unknown>[] = [];

  async run<T>(work: () => Promise<T>): Promise<T> {
    // If queue is full, reject immediately
    if (this.waiting.length >= this.options.maxQueueSize) {
      throw new QueueFullError();
    }
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({ work, resolve, reject, state: "queued" });
      this.drain();
    });
  }
}`
      }
    ],
    cBridge: {
      cConcept: "kill(pid, SIGKILL)",
      tsConcept: "childProcess.kill('SIGKILL')",
      cComparison:
        "In C, `kill(pid, 9)` forces the kernel to instantly terminate the process and reclaim its memory.",
      whyDiffer:
        "Node.js `childProcess.kill('SIGKILL')` sends the same signal 9 under the hood."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=judge-worker -- test/job-queue.test.ts",
      testFile: "services/judge-worker/test/job-queue.test.ts",
      whatItAsserts: "Verifies queue limits and that timeouts kill the frozen process.",
      commonFailure: {
        symptom: "Test timed out after 5000ms.",
        diagnostic: "Child process ignored termination signal.",
        fix: "Send SIGKILL instead of SIGTERM when timer expires."
      }
    },
    dataFlow: [
      { actor: "Runner", action: "Starts player code", payload: "Process ID 4120", invariant: "Starts 2000ms timer" },
      { actor: "Timer", action: "Timer hits 2 seconds", payload: "kill(4120, 'SIGKILL')", invariant: "Kernel frees memory; result = TLE" }
    ]
  },
  {
    id: "M10",
    act: "Part 4: Live Multiplayer",
    title: "Live Rooms and Who Is Online",
    subtitle: "Sending live updates instantly through WebSockets instead of slow page refreshes.",
    category: "Live Connections",
    prerequisites: ["M09"],
    theWhat:
      "A live connection server (Socket.IO). When players join, put them into a private game room and tell everyone who is online.",
    theWhy:
      "Reloading web pages to check for new scores is slow and clunky. Live connections let both players see updates the exact second they happen.",
    keyInvariant:
      "Rule: Check the player's secret ticket (token) when they connect. Never let strangers into another match's room.",
    catastrophicFailureIfOmitted:
      "Strangers can listen in to other matches and copy code while opponents are typing.",
    scaffold: {
      folderPath: "services/game/src/game",
      createCommand: "touch services/game/src/game/socket-auth.ts",
      targetFile: "services/game/src/game/socket-auth.ts",
      purpose: "Checks connection ticket before admitting player socket to the match room",
      starterBoilerplate: `// services/game/src/game/socket-auth.ts
export function checkPlayerToken(token: string, matchId: string) {
  // Verify token matches the requested matchId
  if (!token || !token.includes(matchId)) {
    return { authorized: false };
  }
  return { authorized: true, userId: "player-1" };
}`
    },
    snippets: [
      {
        title: "Checking Connection Tickets in socket-auth.ts",
        filePath: "services/game/src/game/socket-auth.ts",
        lines: "15-38",
        language: "typescript",
        whyItMatters: "Makes sure only authorized players can enter the live match room.",
        code: `export function authorizeSocketConnection(
  token: string,
  matchId: string
): { authorized: boolean; userId?: string } {
  const claims = verifyJwt(token);
  // Reject if token is missing or for a different match!
  if (!claims || claims.matchId !== matchId) {
    return { authorized: false };
  }
  return { authorized: true, userId: claims.sub };
}`
      }
    ],
    cBridge: {
      cConcept: "Socket multiplexing with epoll",
      tsConcept: "Socket.IO event rooms",
      cComparison:
        "In C, you listen on file descriptors and broadcast to client sockets in a loop.",
      whyDiffer:
        "Socket.IO manages rooms, reconnections, and heartbeats for you automatically."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=services/game -- test/socket-auth.test.ts",
      testFile: "services/game/src/game/socket-auth.test.ts",
      whatItAsserts: "Verifies that invalid connection tokens are rejected.",
      commonFailure: {
        symptom: "Socket connected with invalid token.",
        diagnostic: "Token match ID was not checked against the URL match ID.",
        fix: "Check claims.matchId === matchId."
      }
    },
    dataFlow: [
      { actor: "Player", action: "Connects with secret ticket", payload: "io('/game', { token })", invariant: "Server checks ticket" },
      { actor: "Server", action: "Puts player in room", payload: "socket.join('match:123')", invariant: "Broadcasts: player is online" }
    ]
  },
  {
    id: "M11",
    act: "Part 4: Live Multiplayer",
    title: "2v2 Teammates: Typing Together & Agreeing to Submit",
    subtitle: "Shared coding buffer and a mutual ready button for teammates.",
    category: "Teammates",
    prerequisites: ["M10"],
    theWhat:
      "In 2v2 games, both teammates type into the same editor at the same time. Submitting requires BOTH teammates to click Ready.",
    theWhy:
      "If one teammate could click Submit alone, they might submit while the other teammate was in the middle of typing a line. Both players must agree before spending a submission attempt.",
    keyInvariant:
      "Rule: A team can only submit if both Player 1 is ready AND Player 2 is ready.",
    catastrophicFailureIfOmitted:
      "One teammate accidentally clicks submit too early, testing broken unfinished code and wasting the team's chance.",
    scaffold: {
      folderPath: "packages/arena-game/src",
      createCommand: "touch packages/arena-game/src/collab.ts",
      targetFile: "packages/arena-game/src/collab.ts",
      purpose: "Mutual readiness consensus check for 2v2 teammates",
      starterBoilerplate: `// packages/arena-game/src/collab.ts
export function canSubmitTeam(readiness: Record<string, boolean>, teamIds: string[]): boolean {
  if (teamIds.length !== 2) return false;
  // Both teammates must be ready
  return teamIds.every((id) => readiness[id] === true);
}`
    },
    snippets: [
      {
        title: "Both Players Must Be Ready in collab.ts",
        filePath: "packages/arena-game/src/collab.ts",
        lines: "35-52",
        language: "typescript",
        whyItMatters: "Blocks submission until both teammates confirm ready = true.",
        code: `export function canSubmitTeam(
  readiness: Record<string, boolean>,
  teamPlayerIds: string[]
): boolean {
  if (teamPlayerIds.length !== 2) return false;
  // Both teammates must have ready === true!
  return teamPlayerIds.every((id) => readiness[id] === true);
}

export function handlePlayerKeystroke(doc: Y.Doc, updateBytes: Uint8Array): void {
  // Merges keystrokes from both players seamlessly
  Y.applyUpdate(doc, updateBytes);
}`
      }
    ],
    cBridge: {
      cConcept: "Shared memory with two-phase commit lock",
      tsConcept: "CRDT byte updates & readiness barrier",
      cComparison:
        "In C, you map shared memory `shmget()` and lock it with semaphores.",
      whyDiffer:
        "CRDTs (Yjs) merge text changes automatically without needing lock files."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=arena-game -- test/team-collaboration.test.ts",
      testFile: "packages/arena-game/test/team-collaboration.test.ts",
      whatItAsserts: "Verifies that one player cannot submit alone without their partner.",
      commonFailure: {
        symptom: "Submission happened when only 1 player was ready.",
        diagnostic: "Your check allowed 1 player to trigger submit.",
        fix: "Require teamPlayerIds.every(id => readiness[id] === true)."
      }
    },
    dataFlow: [
      { actor: "Teammate 1", action: "Clicks 'Ready to Submit'", payload: "ready = true", invariant: "Screen tells partner to confirm" },
      { actor: "Teammate 2", action: "Clicks 'Ready to Submit'", payload: "ready = true", invariant: "Both ready -> code is tested" }
    ]
  },
  {
    id: "M12",
    act: "Part 4: Live Multiplayer",
    title: "Secret Team Chat (Teammates Only)",
    subtitle: "Private messaging between teammates that opponents can never see.",
    category: "Teammates",
    prerequisites: ["M11"],
    theWhat:
      "A live chat box where teammates can discuss strategy in private during 2v2 games.",
    theWhy:
      "Opponents must never see your team's strategy. Messages sent by Team Left must only reach Team Left.",
    keyInvariant:
      "Rule: Messages are sent only to the team's private room. Opponents receive zero chat packets.",
    catastrophicFailureIfOmitted:
      "The opposing team can read your tactical messages and steal your ideas.",
    scaffold: {
      folderPath: "services/game/src/game",
      createCommand: "touch services/game/src/game/team-chat.gateway.ts",
      targetFile: "services/game/src/game/team-chat.gateway.ts",
      purpose: "Broadcasts chat strictly to match:ID:team:SIDE",
      starterBoilerplate: `// services/game/src/game/team-chat.gateway.ts
export class TeamChatGateway {
  sendTeamMessage(server: any, matchId: string, side: "left" | "right", userId: string, text: string) {
    const roomName = \`match:\${matchId}:team:\${side}\`;
    server.to(roomName).emit("team_message", { sender: userId, text, timestamp: Date.now() });
  }
}`
    },
    snippets: [
      {
        title: "Sending Messages to Team Room in team-chat.gateway.ts",
        filePath: "services/game/src/game/team-chat.gateway.ts",
        lines: "20-42",
        language: "typescript",
        whyItMatters: "Sends chat only to the private room for that team.",
        code: `export class TeamChatGateway {
  handleTeamMessage(client: Socket, message: string) {
    const { matchId, side, userId } = client.data;
    const cleanText = message.slice(0, 500); // limit message length
    
    // Broadcast ONLY to this side's private room
    this.server.to(\`match:\${matchId}:team:\${side}\`).emit("chat_message", {
      sender: userId,
      side,
      text: cleanText,
      timestamp: Date.now()
    });
  }
}`
      }
    ],
    cBridge: {
      cConcept: "Multicast network socket groups",
      tsConcept: "Socket.IO room isolation",
      cComparison:
        "In C, you join a specific multicast group IP address so only group members get messages.",
      whyDiffer:
        "Socket.IO manages room routing in memory with simple room names like `match:1:team:left`."
    },
    testGuide: {
      terminalCommand: "npm test --workspace=services/game -- test/team-chat.test.ts",
      testFile: "services/game/src/game/team-chat.test.ts",
      whatItAsserts: "Verifies that opponents never receive messages sent by the other team.",
      commonFailure: {
        symptom: "Opponent received chat message in test.",
        diagnostic: "Server broadcast to the whole match instead of the team room.",
        fix: "Emit to match:id:team:side."
      }
    },
    dataFlow: [
      { actor: "Player 1 (Left)", action: "Sends 'Use binary search'", payload: "Chat packet", invariant: "Delivered only to Player 2 (Left)" },
      { actor: "Player 3 (Right)", action: "Listens for messages", payload: "None", invariant: "Opponent receives 0 packets" }
    ]
  },
  {
    id: "M13",
    act: "Part 4: Live Multiplayer",
    title: "Final Test: The Whole Game Working Together",
    subtitle: "Testing the entire game from lobby to final victory screen.",
    category: "Big Picture",
    prerequisites: ["M12"],
    theWhat:
      "Run the full test suite across the whole repository to verify that all 13 pieces work smoothly together.",
    theWhy:
      "Testing small pieces in isolation is great, but we must make sure the full flow works from match start to round 3 winner.",
    keyInvariant:
      "Rule: Every test in the project passes with 0 errors and 0 warnings.",
    catastrophicFailureIfOmitted:
      "Small hidden timing bugs only show up when everything runs together, causing games to freeze at round 3.",
    scaffold: {
      folderPath: ".",
      createCommand: "npm test --workspaces --if-present",
      targetFile: "package.json",
      purpose: "Final monorepo build and verification command",
      starterBoilerplate: `// In root package.json scripts:
"test": "npm test --workspaces --if-present",
"lint": "npm run lint --workspaces --if-present"`
    },
    snippets: [
      {
        title: "Testing the Entire Repo in package.json",
        filePath: "package.json",
        lines: "14-22",
        language: "json",
        whyItMatters: "Runs tests and type checks across all packages in one command.",
        code: `{
  "scripts": {
    "build": "npm run build --workspace=arena-model && npm run build --workspace=arena-frontend",
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  }
}`
      }
    ],
    cBridge: {
      cConcept: "Makefile with check / test targets",
      tsConcept: "npm test --workspaces",
      cComparison:
        "In C projects, `make test` runs all unit tests across all source folders.",
      whyDiffer:
        "In Node monorepos, `npm test --workspaces` runs all test runners across every folder at once."
    },
    testGuide: {
      terminalCommand: "npm test && npm run lint",
      testFile: "packages/arena-game/test/lifecycle-1v1.test.ts",
      whatItAsserts: "Verifies the full 3-round game from match start to victory celebration.",
      commonFailure: {
        symptom: "Game hangs at the end of Round 3.",
        diagnostic: "Check match completion transition in round-lifecycle.ts.",
        fix: "Ensure roundPhase transitions to MATCH_COMPLETE after the final reveal."
      }
    },
    dataFlow: [
      { actor: "Game Engine", action: "Round 3 finishes", payload: "Scores tallied", invariant: "match.roundPhase = MATCH_COMPLETE" },
      { actor: "Players", action: "See Winner Screen", payload: "Winner announced", invariant: "Game ends cleanly" }
    ]
  }
];
