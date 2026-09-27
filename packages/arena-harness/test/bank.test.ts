import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BANK_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "problem-bank", "problems");
const SCHEMA_REQUIRED = ["id", "title", "difficulty", "tags", "description", "examples", "constraints", "starters", "visibleTests", "hiddenGroups", "provenance"];

describe("problem-bank validation (CI gate, checkpoint 2)", () => {
  it("every record carries schema keys, starters, weights summing to 100, and provenance", async () => {
    const files = (await readdir(BANK_DIR)).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = JSON.parse(await readFile(join(BANK_DIR, file), "utf8"));
      for (const key of SCHEMA_REQUIRED) {
        expect(raw, `${file} missing ${key}`).toHaveProperty(key);
      }
      for (const lang of ["C++", "Python", "C"]) {
        expect(raw.starters, `${file} missing ${lang} starter`).toHaveProperty(lang);
      }
      const total = raw.hiddenGroups.reduce((s: number, g: { weight: number }) => s + g.weight, 0);
      expect(total, `${file} weights sum to ${total}, want 100`).toBe(100);
      expect(["original", "compatibly-licensed"]).toContain(raw.provenance.origin);
      expect(raw.visibleTests.length).toBeGreaterThan(0);
      if (raw.driver !== undefined) {
        expect(raw.driver, `${file} bad driver`).toMatch(/^(snippet|stdio)$/);
      }
      if (raw.entrypoint !== undefined && raw.entrypoint !== null) {
        expect(typeof raw.entrypoint, `${file} bad entrypoint`).toBe("string");
      }
      for (const g of raw.hiddenGroups) {
        expect(g.tests.length, `${file} group ${g.name} has no tests`).toBeGreaterThan(0);
      }
    }
  });
});
