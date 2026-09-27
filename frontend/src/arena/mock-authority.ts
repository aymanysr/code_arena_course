import { type MatchMode, type PlayerStatus, type RoundPhase } from "arena-model";
import { FIXTURE_PROBLEM, PLACEHOLDER_MARKERS } from "./fixture.js";
import type { SubmitReceipt } from "./transport.js";
import type { ArenaSnapshot, MatchFinalView, RevealView } from "./types.js";

const MATCH_SECONDS = 30 * 60;
const OPPONENT_SCRIPT_SCORE = 65;

type ChangeListener = () => void;

/**
 * Deterministic Match authority for the frontend fixture.
 *
 * This is deliberately not a transport: it owns fixture Match state and the
 * same phase/readiness/scoring/reveal rules that the UI exercises, but it knows
 * nothing about connection state, Socket.IO, HTTP, or subscriber delivery to
 * the React tree. The production Match authority remains server-side.
 */
export class MockMatchAuthority {
  private readonly listeners = new Set<ChangeListener>();
  private readonly mode: MatchMode;
  private roundPhase: RoundPhase = "ROUND_INTRO";
  private round = 1;
  private readonly startedAt = Date.now();
  private language = "Python";
  private tests: ArenaSnapshot["tests"];
  private youStatus: PlayerStatus = "coding";
  private opponentStatus: PlayerStatus = "coding";
  private alphaStatus: [PlayerStatus, PlayerStatus] = ["coding", "coding"];
  private youSubmissions = 0;
  private opponentSubmissions = 0;
  private teamSubmissions = 0;
  private counted: number | null = null;
  private countedGroups: RevealView["groups"] | null = null;
  private opponentCounted: number | null = null;
  private reveal: RevealView | null = null;
  private ready = { you: false, mate: false };
  /** 2v2 mock of the server doc revision (production: engine teamDocs). */
  private docRevision = 1;
  private readyRev: { you: number | null; mate: number | null } = { you: null, mate: null };
  private notice: string | null = null;
  private revision = 0;

  constructor(mode: MatchMode = "1v1") {
    this.mode = mode;
    this.tests = this.idleTests();
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): ArenaSnapshot {
    return {
      mode: this.mode,
      roundPhase: this.roundPhase,
      round: this.round,
      totalRounds: 3,
      remainingSeconds: Math.max(0, MATCH_SECONDS - Math.floor((Date.now() - this.startedAt) / 1000)),
      problem: FIXTURE_PROBLEM,
      language: this.language,
      tests: this.tests.map((test) => ({ ...test })),
      you: { name: "You", status: this.youStatus, presence: "online", submissions: this.youSubmissions },
      opponent: {
        name: "Opponent",
        status: this.opponentStatus,
        presence: "online",
        submissions: this.opponentSubmissions,
      },
      alpha: {
        id: "alpha",
        members: [
          { name: "You", status: this.alphaStatus[0], presence: "online", submissions: this.teamSubmissions },
          { name: "Mate", status: this.alphaStatus[1], presence: "online", submissions: this.teamSubmissions },
        ],
        score: this.counted,
        submissions: this.teamSubmissions,
      },
      beta: {
        id: "beta",
        members: [
          { name: "Rival 1", status: "coding", presence: "online", submissions: 1 },
          { name: "Rival 2", status: "coding", presence: "online", submissions: 1 },
        ],
        score: this.opponentCounted,
        submissions: 1,
      },
      ready: { ...this.ready },
      docRevision: this.mode === "2v2" ? this.docRevision : null,
      readyRevision: this.mode === "2v2" ? { ...this.readyRev } : null,
      reveal: this.reveal ? { ...this.reveal, groups: this.reveal.groups.map((group) => ({ ...group })) } : null,
      notice: this.notice,
      revision: this.revision,
      matchFinal: this.matchFinal(),
    };
  }

  async leave(): Promise<void> {
    // Dev seam: terminal immediately like the production forfeit path.
    this.roundPhase = "MATCH_COMPLETE";
    this.notice = "You left the match.";
    this.emit();
  }

  async setLanguage(language: string): Promise<void> {
    if (this.mode === "2v2" && language !== this.language) {
      // Mirrors the server rule (§11): team language switch bumps the doc
      // revision and invalidates both approvals.
      this.language = language;
      this.bumpDocRevisionForDev();
      return;
    }
    this.language = language;
    this.emit();
  }

  async startRound(): Promise<void> {
    if (this.roundPhase !== "ROUND_INTRO") throw new Error(`cannot start round in ${this.roundPhase}`);
    this.roundPhase = "CODING";
    this.tests = this.idleTests();
    this.youStatus = "coding";
    this.opponentStatus = "coding";
    this.alphaStatus = ["coding", "coding"];
    this.reveal = null;
    this.notice = null;
    this.ready = { you: false, mate: false };
    this.readyRev = { you: null, mate: null };
    this.docRevision = 1;
    this.emit();
  }

  async beginCoding(): Promise<void> {
    if (this.roundPhase === "CODING") return;
    if (this.roundPhase !== "ROUND_INTRO") throw new Error(`cannot begin coding in ${this.roundPhase}`);
    this.roundPhase = "CODING";
    this.emit();
  }

  async advance(): Promise<void> {
    this.nextRoundForDev();
  }

  async run(input: { code: string; language: string }): Promise<{ ok: true }> {
    this.requireSideAction(this.youStatus, "run");
    this.youStatus = "running";
    this.tests = this.tests.map((test) => ({ ...test, status: "running" as const }));
    this.emit();
    await Promise.resolve();
    const solved = !this.isPlaceholder(input.code);
    this.tests = this.tests.map((test, index) => ({
      ...test,
      status: (solved ? "passed" : "failed") as "passed" | "failed",
      output: solved ? FIXTURE_PROBLEM.examples[index]?.expected ?? "" : "0",
      ms: 1 + index,
    }));
    this.youStatus = "coding";
    this.emit();
    return { ok: true };
  }

  async submit(input: { code: string; language: string; documentRevision?: number }): Promise<SubmitReceipt> {
    if (this.mode === "2v2") {
      const revisionIsReady = this.readyRev.you === this.docRevision && this.readyRev.mate === this.docRevision;
      if (!(this.ready.you && this.ready.mate && revisionIsReady)) {
        throw new Error("team submit requires both teammates ready on the current revision");
      }
      if (input.documentRevision !== undefined && input.documentRevision !== this.docRevision) {
        throw new Error("stale document revision");
      }
    }
    const solo = this.mode === "1v1";
    this.requireSideAction(solo ? this.youStatus : this.alphaStatus[0], "submit");
    if (solo) this.youStatus = "submitted";
    else this.alphaStatus = ["submitted", "submitted"];
    this.emit();
    await Promise.resolve();
    if (solo) this.youStatus = "evaluating";
    else this.alphaStatus = ["evaluating", "evaluating"];
    this.emit();
    await Promise.resolve();
    const score = this.isPlaceholder(input.code) ? 0 : 100;
    this.counted = score;
    this.countedGroups = [{ name: "Basic", weight: 100, earned: score }];
    if (solo) {
      this.youSubmissions += 1;
      this.youStatus = "coding";
      if (this.opponentCounted === null) {
        this.opponentCounted = OPPONENT_SCRIPT_SCORE;
        this.opponentSubmissions = 1;
      }
    } else {
      this.teamSubmissions += 1;
      this.alphaStatus = ["coding", "coding"];
      if (this.opponentCounted === null) this.opponentCounted = OPPONENT_SCRIPT_SCORE;
    }
    this.emit();
    return { ok: true, round: this.round };
  }

  async setReady(value: boolean): Promise<void> {
    this.ready = { ...this.ready, you: value };
    this.readyRev = { ...this.readyRev, you: value ? this.docRevision : null };
    this.emit();
  }

  /** Dev-only: script the teammate's readiness (another player does this for real). */
  setMateReadyForDev(value: boolean): void {
    this.ready = { ...this.ready, mate: value };
    this.readyRev = { ...this.readyRev, mate: value ? this.docRevision : null };
    if (value) this.alphaStatus = [this.alphaStatus[0], "coding"];
    this.emit();
  }

  /** Dev-only: simulate a shared-document edit (production: Yjs update in 15). */
  bumpDocRevisionForDev(): void {
    this.docRevision += 1;
    this.ready = { you: false, mate: false };
    this.readyRev = { you: null, mate: null };
    this.emit();
  }

  /** Dev-only: the game-owned reveal action (production: server event). */
  publishRevealForDev(): void {
    if (this.roundPhase !== "CODING" || this.counted === null || !this.countedGroups) {
      throw new Error("nothing counted to reveal");
    }
    this.roundPhase = "SCORE_REVEAL";
    this.youStatus = "locked";
    this.opponentStatus = "locked";
    this.alphaStatus = ["locked", "locked"];
    this.reveal = {
      roundScore: this.counted,
      groups: this.countedGroups.map((group) => ({ ...group })),
      totals: { you: this.counted, opponent: this.opponentCounted ?? 0 },
    };
    this.emit();
  }

  /** Dev-only: advance after reveal (production: server round rotation). */
  nextRoundForDev(): void {
    if (this.roundPhase !== "SCORE_REVEAL") throw new Error(`cannot advance from ${this.roundPhase}`);
    if (this.round >= 3) {
      this.roundPhase = "MATCH_COMPLETE";
    } else {
      this.round += 1;
      this.roundPhase = "ROUND_INTRO";
    }
    this.reveal = null;
    this.counted = null;
    this.countedGroups = null;
    this.opponentCounted = null;
    this.youStatus = "coding";
    this.opponentStatus = "coding";
    this.alphaStatus = ["coding", "coding"];
    this.youSubmissions = 0;
    this.opponentSubmissions = 0;
    this.teamSubmissions = 0;
    this.tests = this.idleTests();
    this.ready = { you: false, mate: false };
    this.readyRev = { you: null, mate: null };
    this.docRevision = 1;
    this.emit();
  }

  private matchFinal(): MatchFinalView | null {
    if (this.roundPhase !== "MATCH_COMPLETE") return null;
    const you = this.counted ?? 0;
    const opponent = this.opponentCounted ?? 0;
    return {
      you,
      opponent,
      outcome: you > opponent ? "You win the match." : you < opponent ? "Opponent wins the match." : "The match is a draw.",
    };
  }

  private idleTests(): ArenaSnapshot["tests"] {
    return FIXTURE_PROBLEM.examples.map((example) => ({ id: example.id, status: "idle" as const, output: null, ms: null }));
  }

  private isPlaceholder(code: string): boolean {
    return PLACEHOLDER_MARKERS.some((marker) => code.includes(marker));
  }

  private requireSideAction(status: PlayerStatus, action: string): void {
    if (this.roundPhase !== "CODING") throw new Error(`${action} rejected in ${this.roundPhase}`);
    if (status !== "coding") throw new Error(`${action} rejected while ${status}`);
  }

  private emit(): void {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
}
