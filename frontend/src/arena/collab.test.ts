import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CollabClient, colorForUser } from "./collab.js";

// ponytail: server-free checks for the provider's local invariants —
// baseline merge, duplicate idempotence, cursor/awareness mapping. Socket
// round-trips and convergence are proven engine-side + service-side.

function stateB64(text: string): string {
  const doc = new Y.Doc();
  if (text) doc.getText("source").insert(0, text);
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
}

function client(): CollabClient {
  return new CollabClient({ baseUrl: "http://localhost:1", userId: "u1", matchId: "m1", displayName: "U1" });
}

describe("colorForUser", () => {
  it("is deterministic and distinguishes users", () => {
    expect(colorForUser("user-a1")).toBe(colorForUser("user-a1"));
    expect(colorForUser("user-a1")).not.toBe(colorForUser("user-b1"));
  });
});

describe("CollabClient baseline", () => {
  it("applies the sync baseline as the source of truth", () => {
    const c = client();
    c.applySync({ roomId: "r", roundId: "rd1", side: "left", stateB64: stateB64("hello"), source: "hello", revision: 1, language: "Python" });
    expect(c.getSource()).toBe("hello");
    expect(c.revision).toBe(1);
    expect(c.language).toBe("Python");
    expect(c.roundId).toBe("rd1");
  });

  it("remote frames merge idempotently (duplicate replay changes nothing)", () => {
    const c = client();
    // A genuine frame: same history + one appended edit (fresh docs with
    // equal text but different item ids would union — that is CRDT-correct).
    const history = new Y.Doc();
    history.getText("source").insert(0, "base");
    const baseline = Buffer.from(Y.encodeStateAsUpdate(history)).toString("base64");
    c.applySync({ roomId: "r", roundId: "rd1", side: "left", stateB64: baseline, source: "base", revision: 1, language: "Python" });
    history.getText("source").insert(4, "-edited");
    const frame = Buffer.from(Y.encodeStateAsUpdate(history)).toString("base64");
    c.applyRemoteUpdate(frame);
    expect(c.getSource()).toBe("base-edited");
    c.applyRemoteUpdate(frame);
    expect(c.getSource()).toBe("base-edited");
  });
});

describe("CollabClient awareness (ephemeral, never the document)", () => {
  it("maps teammate cursors into awareness with a visible identity", () => {
    const c = client();
    c.applySync({ roomId: "r", roundId: "rd1", side: "left", stateB64: stateB64("hello world"), source: "hello world", revision: 1, language: "Python" });
    c.applyPeerCursor({ userId: "mate", clientId: 12345, anchor: 2, head: 5, displayName: "Mate", color: "#abc" });
    const states = c.awareness.getStates();
    const state = states.get(12345) as { user: { name: string; color: string }; cursor: { anchor: object; head: object } };
    expect(state.user).toMatchObject({ name: "Mate", color: "#abc" });
    // Relative positions (y-codemirror.next's rendering shape), not offsets.
    expect(state.cursor.anchor).toMatchObject({ assoc: expect.any(Number) });
    expect(state.cursor.head).toMatchObject({ assoc: expect.any(Number) });
    expect(c.getSource()).toBe("hello world");
  });

  it("ignores its own clientId and clears departed peers", () => {
    const c = client();
    const before = c.awareness.getStates().get(c.doc.clientID);
    c.applyPeerCursor({ userId: "u1", clientId: c.doc.clientID, anchor: 0, head: 1, displayName: "U1", color: null });
    // Own id never becomes a remote cursor: constructor local state untouched.
    expect(c.awareness.getStates().get(c.doc.clientID)).toEqual(before);
    c.applyPeerCursor({ userId: "mate", clientId: 999, anchor: 0, head: 0, displayName: null, color: null });
    expect(c.awareness.getStates().has(999)).toBe(true);
    c.removePeer("mate");
    expect(c.awareness.getStates().has(999)).toBe(false);
  });

  it("buffers local cursor offline without throwing", () => {
    const c = client();
    expect(() => c.setLocalCursor(3, 7)).not.toThrow();
    const local = c.awareness.getLocalState() as { cursor: { anchor: object; head: object } };
    expect(local.cursor.anchor).toMatchObject({ assoc: expect.any(Number) });
    expect(local.cursor.head).toMatchObject({ assoc: expect.any(Number) });
  });
});
