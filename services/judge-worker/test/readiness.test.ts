import { describe, expect, it } from "vitest";

const modulePath = "../src/readiness.js";

describe("DockerImageReadiness", () => {
  it("requires Docker and every configured image, then becomes ready after recovery", async () => {
    let loaded: any;
    try { loaded = await import(modulePath); } catch { loaded = null; }
    expect(loaded?.DockerImageReadiness).toBeTypeOf("function");

    let dockerAvailable = false;
    const images = new Set<string>();
    const readiness = new loaded.DockerImageReadiness({
      images: { python: "python:3.12-slim", gcc: "gcc:14-bookworm" },
      run: async (_dockerBin: string, args: string[]) => {
        if (args[0] === "info") {
          if (!dockerAvailable) throw new Error("daemon unavailable");
          return;
        }
        const image = args[2];
        if (!dockerAvailable || !images.has(image)) throw new Error("image unavailable");
      },
    });

    await expect(readiness.check()).resolves.toEqual({
      ready: false,
      docker: false,
      images: { python: false, gcc: false },
    });

    dockerAvailable = true;
    images.add("python:3.12-slim");
    await expect(readiness.check()).resolves.toEqual({
      ready: false,
      docker: true,
      images: { python: true, gcc: false },
    });

    images.add("gcc:14-bookworm");
    await expect(readiness.check()).resolves.toEqual({
      ready: true,
      docker: true,
      images: { python: true, gcc: true },
    });
  });
});
