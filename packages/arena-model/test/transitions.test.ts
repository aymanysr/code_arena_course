import { describe, expect, it } from "vitest";
import {
  ALL_ROUND_PHASES,
  STATUS_LABEL,
  type PlayerStatus,
  type RoundPhase,
  bothReady,
  canRun,
  canSideRun,
  canSideSubmit,
  canSideTransition,
  canSubmit,
  canTransition,
  isEditable,
  publishRoundReveal,
  resetReadiness,
} from "../src/index.js";

describe("round gates (only CODING permits Run/Submit/editing)", () => {
  for (const phase of ALL_ROUND_PHASES) {
    const coding = phase === "CODING";
    it(`${phase}: run ${coding ? "enabled" : "disabled"}`, () => {
      expect(canRun(phase)).toBe(coding);
    });
    it(`${phase}: editable ${coding ? "yes" : "no"}`, () => {
      expect(isEditable(phase)).toBe(coding);
    });
  }

  it("ROUND_INTRO keeps Submit disabled so Start round gates play", () => {
    expect(canSubmit("ROUND_INTRO", "1v1", { you: true, mate: true })).toBe(false);
    expect(canSubmit("ROUND_INTRO", "2v2", { you: true, mate: true })).toBe(false);
  });

  it("1v1 submit needs CODING only; 2v2 additionally needs both Ready", () => {
    expect(canSubmit("CODING", "1v1", { you: false, mate: false })).toBe(true);
    expect(canSubmit("CODING", "2v2", { you: true, mate: false })).toBe(false);
    expect(canSubmit("CODING", "2v2", { you: false, mate: true })).toBe(false);
    expect(canSubmit("CODING", "2v2", { you: true, mate: true })).toBe(true);
  });

  it("SCORE_REVEAL locks Run/Submit/editing (no post-reveal resubmit)", () => {
    expect(canRun("SCORE_REVEAL")).toBe(false);
    expect(canSubmit("SCORE_REVEAL", "1v1", { you: true, mate: true })).toBe(false);
    expect(isEditable("SCORE_REVEAL")).toBe(false);
  });
});

describe("readiness", () => {
  it("starts false/false and resets every round", () => {
    expect(resetReadiness()).toEqual({ you: false, mate: false });
  });
  it("bothReady requires both flags", () => {
    expect(bothReady({ you: true, mate: false })).toBe(false);
    expect(bothReady({ you: true, mate: true })).toBe(true);
  });
});

describe("round lifecycle transitions (global only, no side activity)", () => {
  const legal: Array<[Parameters<typeof canTransition>[0], Parameters<typeof canTransition>[1]]> = [
    ["MATCH_FOUND", "ROUND_INTRO"],
    ["ROUND_INTRO", "CODING"],
    ["SCORE_REVEAL", "ROUND_COMPLETE"],
    ["SCORE_REVEAL", "ROUND_INTRO"],
    ["SCORE_REVEAL", "MATCH_COMPLETE"],
    ["ROUND_COMPLETE", "ROUND_INTRO"],
    ["ROUND_COMPLETE", "MATCH_COMPLETE"],
  ];
  for (const [from, to] of legal) {
    it(`${from} -> ${to}`, () => expect(canTransition(from, to)).toBe(true));
  }
  const illegal: typeof legal = [
    ["ROUND_INTRO", "SCORE_REVEAL"],
    ["CODING", "ROUND_INTRO"],
    ["CODING", "ROUND_COMPLETE"],
    ["CODING", "MATCH_COMPLETE"],
    ["CODING", "SCORE_REVEAL"],
    ["SCORE_REVEAL", "CODING"],
    ["MATCH_COMPLETE", "CODING"],
  ];
  for (const [from, to] of illegal) {
    it(`rejects ${from} -> ${to}`, () => expect(canTransition(from, to)).toBe(false));
  }
});

describe("side activity transitions (independent per side)", () => {
  const legal: Array<[Parameters<typeof canSideTransition>[0], Parameters<typeof canSideTransition>[1]]> = [
    ["coding", "running"],
    ["coding", "submitted"],
    ["running", "coding"],
    ["submitted", "evaluating"],
    ["submitted", "coding"],
    ["evaluating", "coding"],
    ["coding", "locked"],
    ["evaluating", "locked"],
    ["locked", "coding"],
  ];
  for (const [from, to] of legal) {
    it(`${from} -> ${to}`, () => expect(canSideTransition(from, to)).toBe(true));
  }
  const illegal: typeof legal = [
    ["running", "submitted"],
    ["running", "evaluating"],
    ["evaluating", "submitted"],
    ["evaluating", "running"],
    ["locked", "running"],
    ["locked", "submitted"],
  ];
  for (const [from, to] of illegal) {
    it(`rejects ${from} -> ${to}`, () => expect(canSideTransition(from, to)).toBe(false));
  }

  it("a side may start Run/Submit only while its own activity is coding", () => {
    for (const s of ["running", "submitted", "evaluating", "locked"] as const) {
      expect(canSideRun(s)).toBe(false);
      expect(canSideSubmit(s)).toBe(false);
    }
    expect(canSideRun("coding")).toBe(true);
    expect(canSideSubmit("coding")).toBe(true);
  });
});

describe("concurrency model (1v1 sides + 2v2 team-side compatibility)", () => {
  it("A evaluating + B coding coexist under round CODING; B keeps Run/Submit", () => {
    const round: RoundPhase = "CODING";
    let a: PlayerStatus = "coding";
    let b: PlayerStatus = "coding";
    a = "submitted";
    expect(canSideTransition("coding", a)).toBe(true);
    a = "evaluating";
    expect(canSideTransition("submitted", a)).toBe(true);
    expect(b).toBe("coding");
    expect(round).toBe("CODING");
    expect(canRun(round) && canSideRun(b)).toBe(true);
    expect(canSubmit(round, "1v1", { you: false, mate: false }) && canSideSubmit(b)).toBe(true);
    // A completes sealed: only A's activity changes, B and round untouched.
    a = "coding";
    expect(canSideTransition("evaluating", a)).toBe(true);
    expect(b).toBe("coding");
    expect(round).toBe("CODING");
  });

  it("Team Alpha evaluating + Team Beta coding coexist (same per-side mechanism)", () => {
    const round: RoundPhase = "CODING";
    const alpha: PlayerStatus = "evaluating";
    const beta: PlayerStatus = "coding";
    expect(canSideTransition("submitted", alpha)).toBe(true);
    expect(canSideTransition(beta, "running")).toBe(true);
    expect(round).toBe("CODING");
    expect(canSideRun(beta)).toBe(true);
    expect(canSideSubmit(beta)).toBe(true);
    expect(canSideSubmit(alpha)).toBe(false);
  });
});

describe("status labels (text as well as color)", () => {
  it("maps every gameplay status", () => {
    expect(STATUS_LABEL).toEqual({
      coding: "Coding",
      running: "Running",
      submitted: "Submitted",
      evaluating: "Evaluating",
      locked: "Locked in",
    });
  });
});

describe("reveal is game-owned (no generic disclosure edge)", () => {
  it("CODING -> SCORE_REVEAL is rejected generically", () => {
    expect(canTransition("CODING", "SCORE_REVEAL")).toBe(false);
  });
  it("publishRoundReveal allows CODING -> SCORE_REVEAL only with REVEAL_CONDITION_MET", () => {
    expect(publishRoundReveal("CODING", "REVEAL_CONDITION_MET")).toBe("SCORE_REVEAL");
    expect(() => publishRoundReveal("ROUND_INTRO" as never, "REVEAL_CONDITION_MET")).toThrow();
    expect(() => publishRoundReveal("CODING", "NORMAL" as never)).toThrow();
  });
});
