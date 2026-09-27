/** Harness fixtures: mock player/session, micro-problems, mock opponent plan. */

export interface MockPlayer {
  id: string;
  name: string;
}

export interface MockSession {
  player: MockPlayer;
  token: string;
}

export function mockSession(name = "you"): MockSession {
  return { player: { id: `player-${name}`, name }, token: "mock-token" };
}

export interface FixtureVisibleTest {
  id: string;
  input: string;
  expected: string;
}

export interface FixtureHiddenTest {
  id: string;
  input: string;
}

export interface FixtureHiddenGroup {
  name: string;
  weight: number;
  tests: FixtureHiddenTest[];
}

export interface FixtureProblem {
  problemId: string;
  title: string;
  visible: FixtureVisibleTest[];
  hidden: FixtureHiddenGroup[];
}

/** Round 1 reuses the real bank record so the harness proves bank integration. */
export async function loadBankProblem(problemId: string): Promise<FixtureProblem> {
  const { readFile } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const bankDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "problem-bank", "problems");
  const raw = JSON.parse(await readFile(join(bankDir, `${problemId}.json`), "utf8"));
  return {
    problemId: raw.id,
    title: raw.title,
    visible: raw.visibleTests,
    hidden: raw.hiddenGroups.map((g: { name: string; weight: number; tests: Array<{ id: string; input: string }> }) => ({
      name: g.name,
      weight: g.weight,
      tests: g.tests.map((t) => ({ id: t.id, input: t.input })),
    })),
  };
}

/** Rounds 2-3: intentionally boring original micro-problems (pipeline > design). */
export function microProblems(): FixtureProblem[] {
  return [
    {
      problemId: "head-or-zero",
      title: "Head or Zero",
      visible: [{ id: "ex1", input: "nums = [7,8]", expected: "7" }],
      hidden: [{ name: "Basic", weight: 100, tests: [{ id: "h1", input: "nums = []" }] }],
    },
    {
      problemId: "list-length",
      title: "List Length",
      visible: [{ id: "ex1", input: "nums = [1,2,3]", expected: "3" }],
      hidden: [{ name: "Basic", weight: 100, tests: [{ id: "h1", input: "nums = []" }] }],
    },
  ];
}

/** Scripted opponent round scores (sum/time/subs) for final-result tests. */
export interface OpponentRound {
  score: number;
  scoringTimeMs: number;
  submissions: number;
}

export const SHUTOUT_OPPONENT: OpponentRound[] = [
  { score: 0, scoringTimeMs: 1000, submissions: 1 },
  { score: 0, scoringTimeMs: 1000, submissions: 1 },
  { score: 0, scoringTimeMs: 1000, submissions: 1 },
];

/** Correct mock-player solution text (no starter placeholder inside). */
export const SOLVED_CODE = "def solve(nums):\n    total = 0\n    for i, v in enumerate(nums):\n        total += v if i % 2 == 0 else -v\n    return total\n";
