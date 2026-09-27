/**
 * JudgePort: the seam the real judge (06) implements. Tests target this
 * interface, so swapping FakeJudge for the isolated judge changes no test.
 * Limits mirror ADR-0003 (CPU/time/memory/output/process + isolation).
 */

export interface JudgeLimits {
  cpuMs: number;
  wallMs: number;
  memoryMb: number;
  outputBytes: number;
  processes: number;
}

export const DEFAULT_LIMITS: JudgeLimits = {
  cpuMs: 2000,
  wallMs: 2000,
  memoryMb: 256,
  outputBytes: 65536,
  processes: 16,
};

export interface VisibleCase {
  id: string;
  input: string;
  expected: string;
}

export interface VisibleVerdict {
  id: string;
  output: string;
  ms: number;
  passed: boolean;
}

export interface HiddenGroup {
  name: string;
  weight: number;
  /** Sealed inputs only: expected values never travel to the judge caller. */
  tests: Array<{ id: string; input: string }>;
}

export interface HiddenGroupVerdict {
  name: string;
  weight: number;
  earned: number;
}

export interface JudgePort {
  runVisible(
    code: string,
    language: string,
    tests: VisibleCase[],
    limits: JudgeLimits,
  ): Promise<VisibleVerdict[]>;
  evaluateHidden(
    code: string,
    language: string,
    groups: HiddenGroup[],
    limits: JudgeLimits,
  ): Promise<{ groups: HiddenGroupVerdict[] }>;
}
