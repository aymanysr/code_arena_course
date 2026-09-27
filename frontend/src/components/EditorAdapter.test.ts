import { describe, expect, it } from "vitest";
import { resolveEditorLanguage } from "./EditorAdapter.js";

// ponytail: one runnable check for the only branching logic in the seam —
// language routing. Everything else is CodeMirror behavior covered by e2e.
describe("resolveEditorLanguage", () => {
  it("routes C++ and C to the shared cpp grammar", () => {
    expect(resolveEditorLanguage("C++")).toBe("cpp");
    expect(resolveEditorLanguage("C")).toBe("cpp");
  });

  it("routes Python to python", () => {
    expect(resolveEditorLanguage("Python")).toBe("python");
  });

  it("falls back to plain for unknown languages", () => {
    expect(resolveEditorLanguage("Rust")).toBe("plain");
    expect(resolveEditorLanguage("")).toBe("plain");
  });
});
