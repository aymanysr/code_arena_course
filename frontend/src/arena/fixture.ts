import type { ArenaProblem } from "./types.js";

/** Original fixture problem for mock-first development (mirrors the bank shape). */
export const FIXTURE_PROBLEM: ArenaProblem = {
  id: "even-ledger",
  title: "Even Ledger",
  description:
    "Given an array of integers, add the values at even indices and subtract the values at odd indices. Return the resulting total.",
  examples: [
    { id: "ex1", input: "nums = [7, 8]", expected: "-1" },
    { id: "ex2", input: "nums = [1, 2, 3]", expected: "2" },
  ],
  starters: {
    Python: "def ledger_sum(nums):\n    return 0\n",
    "C++": "int ledger_sum(std::vector<int> nums) {\n    return 0;\n}\n",
    C: "int ledger_sum(int* nums, int n) {\n    return 0;\n}\n",
  },
};

export const PLACEHOLDER_MARKERS = ["return 0", "return NULL", "return [];"];
