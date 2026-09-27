import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import {
  attachSocketPrincipal,
  principalFromHandshake,
  requireSocketPrincipal,
  socketPrincipal,
} from "./socket-auth.js";

function fakeSocket(
  auth: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
): Socket {
  return { handshake: { auth, query }, data } as unknown as Socket;
}

describe("socket authorization context", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PRINCIPAL", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads one trusted identity from auth and accepts an equivalent query fallback", () => {
    const client = fakeSocket({ userId: "alice", matchId: "match-1" }, { userId: "alice", matchId: "match-1" });

    expect(principalFromHandshake(client, { matchIdRequired: true })).toEqual({ userId: "alice", matchId: "match-1" });
  });

  it("supports user-only lobby handshakes while requiring Match identity for Match namespaces", () => {
    const client = fakeSocket({}, { userId: "alice" });

    expect(principalFromHandshake(client)).toEqual({ userId: "alice" });
    expect(() => principalFromHandshake(client, { matchIdRequired: true })).toThrow("missing socket matchId");
  });

  it("fails closed on conflicting identity sources or disabled development auth", () => {
    expect(() => principalFromHandshake(fakeSocket({ userId: "alice" }, { userId: "mallory" }))).toThrow(
      "conflicting socket userId",
    );
    vi.stubEnv("DEV_PRINCIPAL", "false");
    expect(() => principalFromHandshake(fakeSocket({ userId: "alice" }))).toThrow("authentication required");
  });

  it("attaches and requires the verified principal without trusting raw client fields", () => {
    const client = fakeSocket();
    expect(socketPrincipal(client)).toBeNull();

    attachSocketPrincipal(client, { userId: "alice", matchId: "match-1" });
    expect(requireSocketPrincipal(client, { matchIdRequired: true })).toEqual({ userId: "alice", matchId: "match-1" });
    expect(requireSocketPrincipal(client)).toEqual({ userId: "alice", matchId: "match-1" });
  });
});
