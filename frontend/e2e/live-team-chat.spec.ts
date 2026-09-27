import { chromium, expect, test, type Page } from "@playwright/test";

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

const U = { a1: "t16e-a1", a2: "t16e-a2", b1: "t16e-b1", b2: "t16e-b2" };

const SOLVED = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
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

function watchErrors(page: Page, errors: string[]): void {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

async function editorText(editor: import("@playwright/test").Locator): Promise<string | null> {
  return editor.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".cm-ySelectionCaret,.cm-ySelectionInfo,.cm-widgetBuffer").forEach((n) => n.remove());
    return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

async function checkReady(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const cb = page.getByLabel("You are ready");
        if (await cb.isChecked()) return true;
        await cb.click().catch(() => {});
        return await cb.isChecked();
      },
      { timeout: 15000, intervals: [300, 500, 1000] },
    )
    .toBe(true);
}

test("Ticket 16 four-client proof: team chat isolation, contextual pings, readiness separation, Yjs separation, and reconnect", async () => {
  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    const matchId = await createTeamMatch();
    const pages: Record<string, Page> = {};

    for (const [key, user] of Object.entries(U)) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      watchErrors(page, errors);
      await page.goto(`${WEB}/?live=1&user=${user}&match=${matchId}`);
      pages[key] = page;
    }

    const a1 = pages.a1!;
    const a2 = pages.a2!;
    const b1 = pages.b1!;
    const b2 = pages.b2!;

    await a1.getByRole("button", { name: "Start round" }).click();

    for (const p of [a1, a2, b1, b2]) {
      await expect(p.getByLabel("Team chat")).toBeVisible({ timeout: 20000 });
      await expect(p.getByLabel("Solution editor")).toBeVisible();
    }

    // 1. A1 sends "check the empty case"
    const a1ChatInput = a1.getByRole("textbox", { name: "Team message" });
    await a1ChatInput.fill("check the empty case");
    await a1.getByRole("button", { name: "Send team message" }).click();

    // A1 and A2 see it
    await expect(a1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "check the empty case" })).toBeVisible({ timeout: 10000 });
    await expect(a2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "check the empty case" })).toBeVisible({ timeout: 10000 });

    // Beta (B1, B2) does NOT see Alpha's chat
    await expect(b1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "check the empty case" })).not.toBeVisible();
    await expect(b2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "check the empty case" })).not.toBeVisible();

    // 2. B1 sends "watch overflow"
    const b1ChatInput = b1.getByRole("textbox", { name: "Team message" });
    await b1ChatInput.fill("watch overflow");
    await b1.getByRole("button", { name: "Send team message" }).click();

    // B1 and B2 see it
    await expect(b1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "watch overflow" })).toBeVisible({ timeout: 10000 });
    await expect(b2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "watch overflow" })).toBeVisible({ timeout: 10000 });

    // Alpha (A1, A2) does NOT see Beta's chat
    await expect(a1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "watch overflow" })).not.toBeVisible();
    await expect(a2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "watch overflow" })).not.toBeVisible();

    // 3. A2 sends quick ping: CHECK_EDGE_CASE
    await a2.getByRole("button", { name: "Ping: Check edge case" }).click();

    // A1 sees friendly ping rendering
    await expect(a1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Check edge case" })).toBeVisible({ timeout: 10000 });
    await expect(a1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "[PING]" })).toBeVisible();

    // Beta does NOT see Alpha's ping
    await expect(b1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Check edge case" })).not.toBeVisible();
    await expect(b2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Check edge case" })).not.toBeVisible();

    // 4. B2 sends quick ping: READY
    await b2.getByRole("button", { name: "Ping: Ready?" }).click();

    // B1 sees friendly ping
    await expect(b1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Ready?" })).toBeVisible({ timeout: 10000 });

    // Alpha does NOT see Beta's ping
    await expect(a1.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Ready?" })).not.toBeVisible();

    // CRITICAL: The READY ping must NOT mark B2 ready authoritatively
    await expect(b2.getByLabel("You are ready")).not.toBeChecked();

    // 5. Reconnect proof: A2 reloads and reconnects
    await a2.reload();
    await expect(a2.getByLabel("Team chat")).toBeVisible({ timeout: 20000 });
    await expect(a2.getByLabel(/Solution editor/)).toBeVisible({ timeout: 20000 });
    await expect(a2.getByText(/Shared doc r/i)).toBeVisible({ timeout: 20000 });

    // A2 restores recent team chat history on rejoin
    await expect(a2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "check the empty case" })).toBeVisible({ timeout: 10000 });
    await expect(a2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Check edge case" })).toBeVisible();

    // A2 STILL does not see Beta's messages
    await expect(a2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "watch overflow" })).not.toBeVisible();
    await expect(a2.getByLabel("Team chat").getByRole("listitem").filter({ hasText: "Ready?" })).not.toBeVisible();

    // 6. Normal collaborative editing continues unhindered
    const ed1 = a1.getByLabel(/Solution editor/);
    await ed1.click();
    await a1.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await a1.keyboard.type(SOLVED, { delay: 5 });

    // Verify Yjs text converges to A2
    const ed2 = a2.getByLabel(/Solution editor/);
    await expect(ed2).toContainText("def ledger_sum", { timeout: 20000 });
    await expect
      .poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 })
      .toBe(true);

    // Mark both Alpha players ready
    await checkReady(a1);
    await checkReady(a2);

    // Submit button is now enabled for Alpha ("Submit Team Solution")
    const submitBtn = a1.getByRole("button", { name: "Submit Team Solution" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // Verify submission is accepted
    await expect(a1.getByText(/Submissions:\s*1/i)).toBeVisible({ timeout: 15000 });
  } finally {
    await browser.close();
  }
});

test("1v1 proof: TeamChat component does not render in 1v1 match", async () => {
  const browser = await chromium.launch();
  try {
    const res = await api("POST", "/matches", "duel-1", {
      mode: "1v1",
      participants: [
        { userId: "duel-1", sideId: "left" },
        { userId: "duel-2", sideId: "right" },
      ],
      problemVersionIds: ["even-ledger"],
    });
    expect(res.status).toBe(201);
    const matchId = res.json.matchId as string;

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${WEB}/?live=1&user=duel-1&match=${matchId}`);

    await page.getByRole("button", { name: "Start round" }).click();
    await expect(page.getByLabel("Solution editor")).toBeVisible({ timeout: 20000 });

    // Team chat must NOT render in 1v1
    await expect(page.getByLabel("Team chat")).not.toBeVisible();
  } finally {
    await browser.close();
  }
});
