import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * Ticket 14 four-client proof WITHOUT Yjs collaboration: authoritative team
 * state, presence, readiness, revision-gated team submit, independent team
 * activity, sealed evaluation, team reveal, round reset. Shared-text
 * convergence is explicitly NOT claimed here (ticket 15).
 */

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

const U = { a1: "t14e-a1", a2: "t14e-a2", b1: "t14e-b1", b2: "t14e-b2" };

const SOLVED = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;
const STARTER = `def ledger_sum(nums):
    return 0
`;

async function api(method: string, path: string, user: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${GAME}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-user-id": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function createTeamMatch(): Promise<string> {
  const res = await api("POST", "/matches", U.a1, {
    mode: "2v2",
    participants: [
      { userId: U.a1, sideId: "left" },
      { userId: U.a2, sideId: "left" },
      { userId: U.b1, sideId: "right" },
      { userId: U.b2, sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger"],
  });
  expect(res.status).toBe(201);
  return res.json.matchId as string;
}

async function checkReady(page: Page): Promise<void> {
  // The checkbox is controlled by the authoritative snapshot: click, then
  // wait for the server round-trip (socket ack + snapshot refresh) to flip it.
  await page.getByLabel("You are ready").click();
  await expect(page.getByLabel("You are ready")).toBeChecked({ timeout: 15000 });
}

/** Current authoritative team-doc revision for Alpha (ready-gate input). */
async function alphaRevision(matchId: string): Promise<number | null> {
  const res = await api("GET", `/matches/${matchId}/snapshot`, U.a1);
  const teams = res.json.teams as Array<{ side: string; documentRevision: number | null }>;
  return teams.find((t) => t.side === "left")?.documentRevision ?? null;
}

function watchErrors(page: Page, errors: string[]): void {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

test("2v2 ticket-14 proof: teams, readiness, revision gate, independent submit, reveal, reset", async () => {
  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    const matchId = await createTeamMatch();
    const pages: Record<keyof typeof U, Page> = {} as Record<keyof typeof U, Page>;
    for (const [key, user] of Object.entries(U) as Array<[keyof typeof U, string]>) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      watchErrors(page, errors);
      await page.goto(`${WEB}/?live=1&user=${user}&match=${matchId}`);
      pages[key] = page;
    }
    const { a1, a2, b1, b2 } = pages;

    await a1.getByRole("button", { name: "Start round" }).click();
    for (const p of [a1, a2, b1, b2]) await expect(p.getByLabel(/Solution editor/)).toBeVisible();

    // Team membership + presence visible on every client.
    await expect(a1.getByText(U.a1).first()).toBeVisible();
    await expect(a1.getByText(U.a2).first()).toBeVisible();
    await expect(a1.getByText(U.b1).first()).toBeVisible();
    await expect(b1.getByText(U.b1).first()).toBeVisible();
    await expect(b1.getByText(U.a1).first()).toBeVisible();

    // Readiness: one ready is not enough; both enables team submit.
    const submitA1 = a1.getByRole("button", { name: "Submit Team Solution" });
    await expect(submitA1).toBeDisabled();
    await checkReady(a1);
    await expect(a1.getByText("Waiting for teammate readiness")).toBeVisible();
    await expect(submitA1).toBeDisabled();
    await checkReady(a2);
    await expect(a1.getByText("Both teammates ready.")).toBeVisible({ timeout: 15000 });
    await expect(a2.getByText("Both teammates ready.")).toBeVisible({ timeout: 15000 });
    await expect(submitA1).toBeEnabled();
    await expect(a2.getByRole("button", { name: "Submit Team Solution" })).toBeEnabled();

    // Shared-doc edit invalidates BOTH approvals; submit gates off.
    await a1.getByLabel(/Solution editor/).fill(SOLVED);
    await expect.poll(async () => alphaRevision(matchId), { timeout: 20000 }).toBe(2);
    await expect(a1.getByText("Waiting for teammate readiness")).toBeVisible({ timeout: 15000 });
    await expect(submitA1).toBeDisabled();

    // Re-ready on the new revision; Alpha submits solved (sealed, team-owned).
    // Ticket 15 order matters: the shared text goes in FIRST (a real Yjs
    // edit that bumps the revision), THEN both approve the CURRENT revision.
    // Typing between ready and submit would invalidate and stale the submit.
    await checkReady(a1);
    await checkReady(a2);
    await expect(submitA1).toBeEnabled({ timeout: 15000 });
    await submitA1.click();

    // Beta works independently while Alpha's evaluation is in flight/sealed.
    await b1.getByLabel(/Solution editor/).fill(STARTER);
    await b1.getByRole("button", { name: "Run", exact: true }).click();
    await checkReady(b1);
    await checkReady(b2);
    await expect(b1.getByText("Both teammates ready.")).toBeVisible({ timeout: 15000 });
    await b1.getByRole("button", { name: "Submit Team Solution" }).click();

    // One immutable team reveal reaches all four; teammates see equal scores.
    for (const p of [a1, a2, b1, b2]) {
      await expect(p.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
    }
    const scoreA1 = await a1.getByText(/Round 1:/).textContent();
    const scoreA2 = await a2.getByText(/Round 1:/).textContent();
    const scoreB1 = await b1.getByText(/Round 1:/).textContent();
    const scoreB2 = await b2.getByText(/Round 1:/).textContent();
    expect(scoreA1).toEqual(scoreA2);
    expect(scoreB1).toEqual(scoreB2);
    expect(scoreA1).toContain("100");

    // Round reset: readiness cleared, submit gated again.
    await a1.getByRole("button", { name: "Next round" }).click();
    await expect(a1.getByRole("button", { name: "Start round" })).toBeVisible();
    await a1.getByRole("button", { name: "Start round" }).click();
    for (const p of [a1, a2]) {
      await expect(p.getByText("Waiting for teammate readiness")).toBeVisible({ timeout: 15000 });
      await expect(p.getByRole("button", { name: "Submit Team Solution" })).toBeDisabled();
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
