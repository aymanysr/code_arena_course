import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BankProblem, ProblemBank } from "./engine.js";

/** File-backed bank reading the checked problem-bank records (visible + sealed hidden with expected). */
export class FileBank implements ProblemBank {
  constructor(private readonly dir?: string) {}

  loadProblem(problemVersionId: string): BankProblem {
    const base = this.dir ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "problem-bank", "problems");
    const raw = JSON.parse(readFileSync(join(base, `${problemVersionId}.json`), "utf8")) as {
      id: string;
      title: string;
      description: string;
      driver?: "snippet" | "stdio";
      entrypoint?: string | null;
      examples: Array<{ label: string; input: string; output: string; explanation?: string }>;
      starters: Record<string, string>;
      visibleTests: Array<{ id: string; input: string; expected: string }>;
      hiddenGroups: Array<{ name: string; weight: number; tests: Array<{ id: string; input: string; expected: string }> }>;
    };
    return {
      problemVersionId: raw.id,
      hiddenSuiteId: `${raw.id}:hidden:v1`,
      driver: raw.driver,
      entrypoint: raw.entrypoint ?? undefined,
      visible: raw.visibleTests.map((t) => ({ ...t })),
      hidden: raw.hiddenGroups.map((g) => ({ name: g.name, weight: g.weight, tests: g.tests.map((t) => ({ ...t })) })),
      statement: {
        title: raw.title,
        description: raw.description,
        examples: raw.examples.map((e, i) => ({ id: e.label ?? `ex${i + 1}`, input: e.input, expected: e.output })),
      },
      starters: { ...(raw.starters as BankProblem["starters"]) },
    };
  }
}
