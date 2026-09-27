import { describe, expect, it } from "vitest";
import { TeamChatClient } from "./chat.js";

describe("TeamChatClient local invariants", () => {
  it("deduplicates messages and pings by ID", () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    let notifyCount = 0;
    client.subscribe(() => {
      notifyCount++;
    });

    client.applyIncomingEntry({
      id: "msg-1",
      matchId: "m1",
      sideId: "left",
      senderUserId: "u1",
      text: "hello team",
      timestamp: 1000,
      type: "text",
    });

    expect(client.getMessages().length).toBe(1);
    expect(notifyCount).toBe(1);

    // Replay duplicate msg-1 (e.g. from history + broadcast race)
    client.applyIncomingEntry({
      id: "msg-1",
      matchId: "m1",
      sideId: "left",
      senderUserId: "u1",
      text: "hello team",
      timestamp: 1000,
      type: "text",
    });

    expect(client.getMessages().length).toBe(1);
    expect(notifyCount).toBe(1); // not re-notified
  });

  it("handles contextual pings with correct type and payload", () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    client.applyIncomingEntry({
      id: "ping-1",
      matchId: "m1",
      sideId: "left",
      senderUserId: "u2",
      ping: "CHECK_EDGE_CASE",
      timestamp: 2000,
      type: "ping",
    });

    const entries = client.getMessages();
    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe("ping");
    if (entries[0].type === "ping") {
      expect(entries[0].ping).toBe("CHECK_EDGE_CASE");
      expect(entries[0].senderUserId).toBe("u2");
    }
  });

  it("disconnect cleans up subscribers and resets state", () => {
    const client = new TeamChatClient({
      baseUrl: "http://localhost:3220",
      userId: "u1",
      matchId: "m1",
    });

    client.disconnect();
    expect(client.status).toBe("disconnected");
  });
});
