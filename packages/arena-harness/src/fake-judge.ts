import type {
  HiddenGroup,
  HiddenGroupVerdict,
  JudgeLimits,
  JudgePort,
  VisibleCase,
  VisibleVerdict,
} from "./judge-port.js";

/**
 * FakeJudge: fixture-only stand-in for the isolated judge.
 *
 * Visible runs return the fixture's expected outputs (the mock player's code
 * is "executed" by stipulation). Hidden evaluation awards full marks unless
 * the code still contains the starter placeholder, in which case every group
 * earns 0. This heuristic is deliberately crude and documented: it exists to
 * prove the game-loop path, and the real judge (06) replaces this class
 * without touching any test.
 *
 * `failNext` injects one transport-level failure for failure-capture tests.
 */
export class FakeJudge implements JudgePort {
  private failNextMessage: string | null = null;

  constructor(private readonly placeholderMarkers: string[] = ["return 0", "return NULL", "return [];"]) {}

  failNext(message: string): void {
    this.failNextMessage = message;
  }

  private takeFailure(): void {
    if (this.failNextMessage) {
      const message = this.failNextMessage;
      this.failNextMessage = null;
      throw new Error(message);
    }
  }

  isPlaceholder(code: string): boolean {
    return this.placeholderMarkers.some((m) => code.includes(m));
  }

  async runVisible(
    code: string,
    _language: string,
    tests: VisibleCase[],
    _limits: JudgeLimits,
  ): Promise<VisibleVerdict[]> {
    this.takeFailure();
    const placeholder = this.isPlaceholder(code);
    return tests.map((t, i) => {
      const output = placeholder ? "0" : t.expected;
      return { id: t.id, output, ms: 1 + i, passed: output === t.expected };
    });
  }

  async evaluateHidden(
    code: string,
    _language: string,
    groups: HiddenGroup[],
    _limits: JudgeLimits,
  ): Promise<{ groups: HiddenGroupVerdict[] }> {
    this.takeFailure();
    const solved = !this.isPlaceholder(code);
    return {
      groups: groups.map((g) => ({ name: g.name, weight: g.weight, earned: solved ? g.weight : 0 })),
    };
  }
}
