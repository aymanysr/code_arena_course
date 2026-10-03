import type { ReferenceFileSummary } from "./types.js";

export const REFERENCE_FILES: ReferenceFileSummary[] = [
  {
    filePath: "packages/arena-model/src/model.ts",
    subsystem: "Game Basics",
    purpose: "Defines the core game data: 1v1 vs 2v2, round timer steps, player actions (coding/running/submitted), and online status.",
    keyExports: ["MatchMode", "RoundPhase", "PlayerStatus", "Presence", "Readiness", "bothReady()", "resetReadiness()"],
    invariants: [
      "RoundPhase is the single official clock for the whole match (Intro -> Coding -> Reveal -> Done).",
      "PlayerStatus is independent: Player 1 running code never freezes Player 2.",
      "Losing Wi-Fi (offline) never deletes submitted code or resets player status."
    ],
    snippet: `export type MatchMode = "1v1" | "2v2";

export type RoundPhase =
  | "MATCH_FOUND"
  | "ROUND_INTRO"
  | "CODING"
  | "SCORE_REVEAL"
  | "ROUND_COMPLETE"
  | "MATCH_COMPLETE";

export type PlayerStatus =
  | "coding"
  | "running"
  | "submitted"
  | "evaluating"
  | "locked";

export type Presence = "online" | "offline";

export interface Readiness {
  you: boolean;
  mate: boolean;
}

export function bothReady(r: Readiness): boolean {
  return r.you && r.mate;
}`
  },
  {
    filePath: "packages/arena-model/src/scoring.ts",
    subsystem: "Game Basics",
    purpose: "Calculates player scores (0 to 100) using whole numbers to prevent decimal math drift between different computers.",
    keyExports: ["roundScoreBp", "roundScoreFromBp", "groupEarnedBp", "matchSum", "compareSides"],
    invariants: [
      "No decimal calculations: scores are calculated in whole numbers (basis points) and rounded once at the very end.",
      "Points are earned for each passed test group: earned = floor(weight * passed * 100 / total).",
      "Tie-break rules are fair: higher score wins, then faster elapsed time, then fewer attempts."
    ],
    snippet: `export interface GroupCounts {
  weight: number;
  passed: number;
  total: number;
}

export function groupEarnedBp(weight: number, passed: number, total: number): number {
  if (!Number.isInteger(weight) || weight < 0) throw new RangeError("invalid weight");
  if (!Number.isInteger(total) || total <= 0) throw new RangeError("invalid total");
  if (!Number.isInteger(passed) || passed < 0 || passed > total) throw new RangeError("invalid passed");
  return Math.floor((weight * passed * 100) / total);
}

export function roundScoreBp(groups: GroupCounts[]): number {
  return groups.reduce((s, g) => s + groupEarnedBp(g.weight, g.passed, g.total), 0);
}`
  },
  {
    filePath: "packages/arena-game/src/round-lifecycle.ts",
    subsystem: "Game Engine",
    purpose: "The official referee that checks the timer, rejects late answers, and shows scores when time is up.",
    keyExports: ["RoundLifecycle", "SealedVerdict", "ScoredVerdict", "FinalResult"],
    invariants: [
      "Pure game rules: does not need a database or network to be tested.",
      "Official server clock: if current time >= deadline, transitions immediately to SCORE_REVEAL and rejects new submissions.",
      "Reveals freeze code: once scores are revealed, nobody can change their code for that round."
    ],
    snippet: `export class RoundLifecycle {
  startRound(match: MatchRecord): void {
    if (!canTransition(match.roundPhase, "ROUND_INTRO")) {
      throw new IllegalStateError(\`cannot start round in \${match.roundPhase}\`);
    }
    match.roundPhase = "ROUND_INTRO";
    match.sides.forEach((side) => {
      match.currentRound.activities[side] = "coding";
    });
  }

  evaluateDeadline(match: MatchRecord, now: number): boolean {
    if (match.roundPhase === "CODING" && now >= match.deadlineAt) {
      match.roundPhase = "SCORE_REVEAL";
      return true;
    }
    return false;
  }
}`
  },
  {
    filePath: "packages/arena-game/src/postgres-store.ts",
    subsystem: "Game Engine",
    purpose: "Saves matches to PostgreSQL with version numbers so two simultaneous player submissions never overwrite each other.",
    keyExports: ["PostgresStore", "RevisionMismatchError"],
    invariants: [
      "Version check: every save checks 'WHERE id = $1 AND revision = expectedRevision'.",
      "Simultaneous saves fail safely: if another player saved first, the second save stops immediately instead of destroying data.",
      "Saves the full match data cleanly as JSON in PostgreSQL."
    ],
    snippet: `export class PostgresStore implements MatchStore {
  async commitMatch(matchId: string, expectedRevision: number, record: MatchRecord): Promise<number> {
    const nextRevision = expectedRevision + 1;
    const res = await this.pool.query(
      \`UPDATE matches 
       SET state = $1, revision = $2, updated_at = NOW() 
       WHERE id = $3 AND revision = $4 
       RETURNING revision\`,
      [JSON.stringify(record), nextRevision, matchId, expectedRevision]
    );
    if (res.rowCount === 0) {
      throw new RevisionMismatchError(matchId, expectedRevision);
    }
    return nextRevision;
  }
}`
  },
  {
    filePath: "services/judge-worker/src/job-queue.ts",
    subsystem: "Code Runner",
    purpose: "Safely runs player code, limits how many jobs run at once, and forces frozen code (infinite loops) to stop after 2s.",
    keyExports: ["BoundedJobQueue", "QueueFullError", "QueueWaitTimeoutError", "QueueExecutionTimeoutError"],
    invariants: [
      "Frozen code is killed with SIGKILL (signal 9) so it cannot ignore the stop command.",
      "Queue capacity: rejects incoming jobs if too many players submit at the exact same second.",
      "Protects server memory: keeps worker slots occupied until the frozen process is truly stopped."
    ],
    snippet: `export class BoundedJobQueue {
  private active = 0;
  private readonly waiting: Job<unknown>[] = [];

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.waiting.length >= this.options.maxQueueSize) {
      throw new QueueFullError();
    }
    return new Promise<T>((resolve, reject) => {
      this.enqueue({ work, resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.options.concurrency && this.waiting.length > 0) {
      const job = this.waiting.shift()!;
      this.active++;
      this.executeJob(job);
    }
  }
}`
  },
  {
    filePath: "packages/arena-game/src/collab.ts",
    subsystem: "Game Engine",
    purpose: "Lets 2v2 teammates type in the same editor at the same time, and requires both teammates to agree before submitting.",
    keyExports: ["CollabSession", "applyUpdate", "setPlayerReady", "canSubmitTeam"],
    invariants: [
      "Shared typing: merges keystrokes from both teammates so neither overwrites the other.",
      "Both must agree: Player 1 cannot submit alone. Player 2 must also click Ready.",
      "Locks the editor while tests are being run."
    ],
    snippet: `export function canSubmitTeam(readiness: Record<string, boolean>, teamPlayerIds: string[]): boolean {
  if (teamPlayerIds.length !== 2) return false;
  return teamPlayerIds.every((id) => readiness[id] === true);
}

export function handlePlayerKeystroke(doc: Y.Doc, updateBytes: Uint8Array): void {
  Y.applyUpdate(doc, updateBytes);
}`
  },
  {
    filePath: "services/game/src/game/game.controller.ts",
    subsystem: "Web Server",
    purpose: "The main server endpoints that receive Run and Submit clicks and check that data is valid.",
    keyExports: ["GameController"],
    invariants: [
      "Checks input at the door: rejects empty code or bad data with HTTP 400 Bad Request.",
      "Secret tests are kept secret: Run endpoints only execute public example tests.",
      "Ignores accidental double-clicks using submission tickets."
    ],
    snippet: `export class GameController {
  @Post("/matches/:id/submit")
  async submitCode(@Param("id") matchId: string, @Body() body: SubmitDto) {
    const validated = SubmitSchema.parse(body);
    const result = await this.gameService.submitSolution(matchId, validated);
    return { status: "accepted", submissionId: result.id };
  }
}`
  },
  {
    filePath: "frontend/src/arena/transport.ts",
    subsystem: "Screen & Network",
    purpose: "A clean plug that connects the screen to either fake offline test state or real live server connections.",
    keyExports: ["ArenaTransport", "ArenaState", "TransportListener"],
    invariants: [
      "The screen never imports raw WebSockets directly. It only talks to this clean plug.",
      "Lets you test your screen completely offline without running a backend server."
    ],
    snippet: `export interface ArenaTransport {
  connect(): Promise<void>;
  disconnect(): void;
  getState(): ArenaState;
  subscribe(listener: (state: ArenaState) => void): () => void;
  sendRun(code: string, language: string): Promise<RunResult>;
  sendSubmit(code: string, language: string): Promise<SubmitResult>;
  setReady(ready: boolean): void;
}`
  }
];
