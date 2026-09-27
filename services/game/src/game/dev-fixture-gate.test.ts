import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { GameController } from "./game.controller.js";

// ponytail: direct POST /matches is a dev/E2E fixture. This pins that it
// only delegates when the DEV_PRINCIPAL seam is on; with real auth (seam
// off) it 404s even for an authenticated principal.
describe("dev-only POST /matches fixture gate (ticket 17 §34)", () => {
  const body = {
    mode: "1v1" as const,
    participants: [
      { userId: "u1", sideId: "left" },
      { userId: "u2", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger"],
  };
  const req = { principal: { userId: "u1" } } as never;

  it("delegates to the game service when DEV_PRINCIPAL=true", () => {
    process.env.DEV_PRINCIPAL = "true";
    try {
      const controller = new GameController({ createMatch: () => ({ matchId: "m1" }) } as never);
      expect(controller.create(req, body)).toEqual({ matchId: "m1" });
    } finally {
      delete process.env.DEV_PRINCIPAL;
    }
  });

  it("throws 404 when DEV_PRINCIPAL is off, even with a principal", () => {
    delete process.env.DEV_PRINCIPAL;
    const controller = new GameController({ createMatch: () => ({ matchId: "m1" }) } as never);
    expect(() => controller.create(req, body)).toThrow(NotFoundException);
  });
});
