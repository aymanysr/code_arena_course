import { describe, expect, it } from "vitest";
import { TransportSession } from "../src/arena/transport.js";

describe("TransportSession", () => {
  it("tracks connection state without notifying until the adapter publishes a change", () => {
    const session = new TransportSession("connecting");
    let notifications = 0;
    session.subscribe(() => {
      notifications += 1;
    });

    expect(session.setConnection("connecting")).toBe(false);
    expect(notifications).toBe(0);
    expect(session.setConnection("connected")).toBe(true);
    expect(session.connection()).toBe("connected");
    expect(notifications).toBe(0);

    session.notify();
    expect(notifications).toBe(1);
  });

  it("removes subscribers and delivers explicit domain/event notifications", () => {
    const session = new TransportSession("connected");
    let first = 0;
    let second = 0;
    const unsubscribeFirst = session.subscribe(() => {
      first += 1;
    });
    session.subscribe(() => {
      second += 1;
    });

    session.notify();
    unsubscribeFirst();
    session.notify();

    expect(first).toBe(1);
    expect(second).toBe(2);
  });
});
