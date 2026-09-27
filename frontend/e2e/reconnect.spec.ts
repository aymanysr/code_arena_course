import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

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

async function createMatch(): Promise<string> {
  const res = await api("POST", "/matches", "rc-a", {
    mode: "1v1",
    participants: [
      { userId: "rc-a", sideId: "left" },
      { userId: "rc-b", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger", "even-ledger"],
  });
  expect(res.status).toBe(201);
  return res.json.matchId as string;
}

async function serverSnapshot(matchId: string, user: string): Promise<any> {
  const res = await api("GET", `/matches/${matchId}/snapshot`, user);
  expect(res.status).toBe(200);
  return res.json;
}

function watchErrors(page: Page, errors: string[]): void {
  page.on("console", (m) => {
    // The scenarios deliberately cut the network; Chromium logs the killed
    // fetch itself. That environmental noise is ignored — app pageerrors and
    // every other console error still fail the run.
    if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

function clockSeconds(text: string | null): number {
  const m = /(\d+):(\d+)/.exec(text ?? "");
  if (!m) throw new Error(`unparseable clock: ${text}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * CodeMirror renders the document as .cm-line divs (not a textarea value),
 * so draft assertions read rendered text. The distinctive tail proves the
 * draft survived; exact trailing-newline equality is incidental to the
 * textarea era and not asserted.
 */
async function editorText(page: Page): Promise<string> {
  return (await page.getByLabel(/Solution editor/).innerText()) ?? "";
}

async function openDuel(matchId: string): Promise<{ ctxA: BrowserContext; ctxB: BrowserContext; pageA: Page; pageB: Page; errors: string[]; close: () => Promise<void> }> {
  const browser = await chromium.launch();
  const errors: string[] = [];
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  watchErrors(pageA, errors);
  watchErrors(pageB, errors);
  await pageA.goto(`${WEB}/?live=1&user=rc-a&match=${matchId}`);
  await pageB.goto(`${WEB}/?live=1&user=rc-b&match=${matchId}`);
  await expect(pageA.getByRole("button", { name: "Start round" })).toBeVisible();
  await pageA.getByRole("button", { name: "Start round" }).click();
  await expect(pageA.getByLabel(/Solution editor/)).toBeVisible();
  await expect(pageB.getByLabel(/Solution editor/)).toBeVisible();
  return { ctxA, ctxB, pageA, pageB, errors, close: () => browser.close() };
}

test("A: transport drop preserves round, timer, draft; actions resume after", async () => {
  const matchId = await createMatch();
  const { ctxA, pageA, pageB, errors, close } = await openDuel(matchId);
  try {
    await pageA.getByLabel(/Solution editor/).fill(SOLVED);
    const t1 = clockSeconds(await pageA.getByLabel(/Match clock/).textContent());
    await ctxA.setOffline(true);
    await expect(pageA.getByText("Reconnecting")).toBeVisible({ timeout: 15000 });
    // Opponent unaffected while A is dark.
    await pageB.getByLabel(/Solution editor/).fill(STARTER);
    await pageB.getByRole("button", { name: "Run", exact: true }).click();
    await expect(pageB.getByText("Passed").first()).toBeVisible({ timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3000));
    await ctxA.setOffline(false);
    await expect(pageA.getByText("Connected")).toBeVisible({ timeout: 20000 });
    // Same round, draft intact, timer moved on.
    await expect(pageA.getByText("Round 1/3")).toBeVisible();
    expect(await editorText(pageA)).toContain("return total");
    const t2 = clockSeconds(await pageA.getByLabel(/Match clock/).textContent());
    expect(t2).toBeLessThan(t1);
    // Actions work afterward.
    await pageA.getByRole("button", { name: "Run", exact: true }).click();
    await expect(pageA.getByText("Passed").first()).toBeVisible({ timeout: 20000 });
    await Promise.all([
      pageA.getByRole("button", { name: "Submit", exact: true }).click(),
      pageB.getByRole("button", { name: "Submit", exact: true }).click(),
    ]);
    await expect(pageA.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
    expect(errors).toEqual([]);
  } finally {
    await close();
  }
});

test("B: submit lands while offline; sealed until reveal; correct score after", async () => {
  const matchId = await createMatch();
  const { ctxA, pageA, pageB, errors, close } = await openDuel(matchId);
  try {
    await pageA.getByLabel(/Solution editor/).fill(SOLVED);
    const submitted = pageA.waitForRequest("**/submit");
    await pageA.getByRole("button", { name: "Submit", exact: true }).click();
    await submitted;
    await ctxA.setOffline(true);
    // Server completes the evaluation with nobody watching.
    let snap: any = null;
    for (let i = 0; i < 40; i++) {
      snap = await serverSnapshot(matchId, "rc-a");
      if ((snap.sides.left.submissions ?? 0) >= 1) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(snap.sides.left.submissions).toBe(1);
    expect(snap.roundPhase).toBe("CODING");
    await ctxA.setOffline(false);
    await expect(pageA.getByText("Connected")).toBeVisible({ timeout: 20000 });
    await expect(pageA.getByText("Round 1/3")).toBeVisible();
    // Still sealed: no scores anywhere on A's screen.
    const html = await pageA.content();
    expect(html).not.toContain("100 / 100");
    await pageB.getByLabel(/Solution editor/).fill(STARTER);
    await pageB.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(pageA.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
    await expect(pageA.getByText("Round 1: 100 / 100")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await close();
  }
});

test("C: reveal published while offline renders on reconnect", async () => {
  const matchId = await createMatch();
  const { ctxA, pageA, pageB, errors, close } = await openDuel(matchId);
  try {
    await pageA.getByLabel(/Solution editor/).fill(SOLVED);
    await pageB.getByLabel(/Solution editor/).fill(STARTER);
    const sentA = pageA.waitForRequest("**/submit");
    const sentB = pageB.waitForRequest("**/submit");
    await pageA.getByRole("button", { name: "Submit", exact: true }).click();
    await pageB.getByRole("button", { name: "Submit", exact: true }).click();
    await sentA;
    await sentB;
    await ctxA.setOffline(true);
    let snap: any = null;
    for (let i = 0; i < 40; i++) {
      snap = await serverSnapshot(matchId, "rc-a");
      if (snap.roundPhase === "SCORE_REVEAL") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(snap.roundPhase).toBe("SCORE_REVEAL");
    await ctxA.setOffline(false);
    await expect(pageA.getByText("Connected")).toBeVisible({ timeout: 20000 });
    await expect(pageA.getByText("Scores revealed")).toBeVisible({ timeout: 30000 });
    await expect(pageA.getByText("Round 1: 100 / 100")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await close();
  }
});

test("D: hard reload resumes authoritative state plus local draft", async () => {
  const matchId = await createMatch();
  const { pageA, errors, close } = await openDuel(matchId);
  try {
    await pageA.getByLabel(/Solution editor/).fill(SOLVED);
    await pageA.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(async () => {
      const snap = await serverSnapshot(matchId, "rc-a");
      expect(snap.sides.left.submissions).toBe(1);
    }).toPass({ timeout: 15000 });
    await pageA.reload();
    await expect(pageA.getByLabel(/Solution editor/)).toBeVisible({ timeout: 15000 });
    await expect(pageA.getByText("Round 1/3")).toBeVisible();
    // Draft survived the reload; counted submission survived with it.
    expect(await editorText(pageA)).toContain("return total");
    const snap = await serverSnapshot(matchId, "rc-a");
    expect(snap.sides.left.submissions).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await close();
  }
});
