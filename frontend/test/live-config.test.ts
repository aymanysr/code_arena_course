import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App, GAME_URL } from "../src/App.js";

describe("live configuration boundary", () => {
  it("GAME_URL does not silently default to localhost in production/test build", () => {
    if (!process.env.VITE_GAME_URL) {
      expect(GAME_URL).toBeUndefined();
    }
  });

  it("live mode without VITE_GAME_URL fails visibly and does not fall back to mock or localhost", () => {
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = {
      location: new URL("http://localhost:4173/?live=1&match=test-match"),
    };

    try {
      const html = renderToStaticMarkup(React.createElement(App));
      // Must fail visibly
      expect(html).toContain("Live mode requested but VITE_GAME_URL is not configured.");
      expect(html).toContain('role="alert"');
      // Must not silently connect to localhost or render mock mode buttons
      expect(html).not.toContain("Mock controls");
      expect(html).not.toContain("Mode (mock)");
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as unknown as { window?: unknown }).window;
      } else {
        (globalThis as unknown as { window: unknown }).window = prevWindow;
      }
    }
  });

  it("mock mode remains accessible when live query parameter is not present", () => {
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = {
      location: new URL("http://localhost:4173/"),
    };

    try {
      const html = renderToStaticMarkup(React.createElement(App));
      expect(html).toContain('role="group" aria-label="Mode (mock)"');
      expect(html).not.toContain("Live mode requested");
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as unknown as { window?: unknown }).window;
      } else {
        (globalThis as unknown as { window: unknown }).window = prevWindow;
      }
    }
  });
});
