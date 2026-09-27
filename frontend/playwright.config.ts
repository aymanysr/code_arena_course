import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 240000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://localhost:4173",
  },
});
