import { chromium, expect, test, type Page } from "@playwright/test";

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";
const CHROMIUM_ARGS = process.env.E2E_IGNORE_TLS === "true" ? ["--ignore-certificate-errors"] : [];

const SOLVED = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;
const STARTER = `def ledger_sum(nums):
    return 0
`;

const HIDDEN_MARKERS = ["1000000000", '"b1"', '"n1"', '"e1"'];
// NOTE: hidden group display names ("Basic", "Negatives and zeros", "Bounds")
// are intentionally visible — they are the scoring breakdown, not test data.
// Sealed = hidden test ids/inputs/expected outputs, asserted above.

async function api(method: string, path: string, user: string, body?: unknown): Promise<{ status: number; json: never }> {
  const res = await fetch(`${GAME}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-user-id": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as never };
}

async function createMatch(): Promise<string> {
  const res = await api("POST", "/matches", "e2e-a", {
    mode: "1v1",
    participants: [
      { userId: "e2e-a", sideId: "left" },
      { userId: "e2e-b", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
  });
  expect(res.status).toBe(201);
  return (res.json as { matchId: string }).matchId;
}

function watchErrors(page: Page, errors: string[]): void {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

function clockSeconds(text: string | null): number {
  const m = /(\d+):(\d+)/.exec(text ?? "");
  if (!m) throw new Error(`unparseable clock: ${text}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

async function clockOf(page: Page): Promise<number> {
  return clockSeconds(await page.getByLabel(/Match clock/).textContent());
}

for (const width of [1440, 1024, 768, 320]) {
  test(`live 1v1 duel at ${width}px (two clients, sealed, reveal, 3 rounds)`, async () => {
    const browser = await chromium.launch({ args: CHROMIUM_ARGS });
    const errors: string[] = [];
    try {
      const matchId = await createMatch();
      const ctxA = await browser.newContext({ viewport: { width, height: 900 } });
      const ctxB = await browser.newContext({ viewport: { width, height: 900 } });
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();
      watchErrors(pageA, errors);
      watchErrors(pageB, errors);

      await pageA.goto(`${WEB}/?live=1&user=e2e-a&match=${matchId}`);
      await pageB.goto(`${WEB}/?live=1&user=e2e-b&match=${matchId}`);
      await expect(pageA.getByRole("button", { name: "Start round" })).toBeVisible();
      await expect(pageB.getByRole("button", { name: "Start round" })).toBeVisible();

      await pageA.getByRole("button", { name: "Start round" }).click();
      await expect(pageA.getByLabel(/Solution editor/)).toBeVisible();
      await expect(pageA.getByText("Not run").first()).toBeVisible();
      const t1 = await clockOf(pageA);

      // A runs visible tests; B follows into CODING via socket (no second
      // Start click: the button vanishes once the round starts server-side).
      await pageA.getByLabel(/Solution editor/).fill(SOLVED);
      await pageA.getByRole("button", { name: "Run", exact: true }).click();
      await expect(pageB.getByLabel(/Solution editor/)).toBeVisible();
      await expect(pageA.getByText("Passed").first()).toBeVisible({ timeout: 20000 });

      // Concurrent submits: A solved, B starter. Sealed first.
      await pageB.getByLabel(/Solution editor/).fill(STARTER);
      await Promise.all([
        pageA.getByRole("button", { name: "Submit", exact: true }).click(),
        pageB.getByRole("button", { name: "Submit", exact: true }).click(),
      ]);
      await expect(pageA.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
      await expect(pageB.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
      await expect(pageA.getByText("Basic")).toBeVisible();
      for (const page of [pageA, pageB]) {
        const html = await page.content();
        for (const marker of HIDDEN_MARKERS) expect(html).not.toContain(marker);
      }

      // Rounds 2-3: abbreviated but complete (start, submit both, reveal, advance).
      for (let round = 2; round <= 3; round++) {
        await pageA.getByRole("button", { name: "Next round" }).click();
        await expect(pageA.getByRole("button", { name: "Start round" })).toBeVisible();
        await pageA.getByRole("button", { name: "Start round" }).click();
        await expect(pageA.getByText("Not run").first()).toBeVisible();
        await pageA.getByLabel(/Solution editor/).fill(SOLVED);
        await pageB.getByLabel(/Solution editor/).fill(STARTER);
        await Promise.all([
          pageA.getByRole("button", { name: "Submit", exact: true }).click(),
          pageB.getByRole("button", { name: "Submit", exact: true }).click(),
        ]);
        await expect(pageA.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
        if (round < 3) {
          const tLater = await clockOf(pageA);
          expect(tLater).toBeLessThan(t1);
        }
      }

      await pageA.getByRole("button", { name: "See final result" }).click();
      await expect(pageA.getByText("Match complete after 3 rounds")).toBeVisible({ timeout: 20000 });
      await expect(pageA.getByText(/Final — you 300 · opponent 84/)).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
}
