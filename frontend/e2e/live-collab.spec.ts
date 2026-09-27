import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * Ticket 15 live proof: REAL collaborative text over the separate /collab
 * socket (CodeMirror -> y-codemirror.next -> Y.Text -> Y.Doc -> WS provider).
 * No doc-changed, no fill-into-each-editor: A1 types, A2 converges; a real
 * mid-ready edit invalidates both; submit freezes the judged source while
 * later breaking edits cannot move it. Beta stays isolated throughout.
 */

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

const U = { a1: "t15e-a1", a2: "t15e-a2", b1: "t15e-b1", b2: "t15e-b2" };

const SOLVED_TAIL = "total += v if i % 2 == 0 else -v";
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
      { userId: "t15e-b2", sideId: "right" },
    ],
    problemVersionIds: ["even-ledger", "even-ledger"],
  });
  expect(res.status).toBe(201);
  return res.json.matchId as string;
}

async function checkReady(page: Page): Promise<void> {
  await page.getByLabel("You are ready").click();
  await expect(page.getByLabel("You are ready")).toBeChecked({ timeout: 15000 });
}

function watchErrors(page: Page, errors: string[]): void {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

/** Editor text without ephemeral remote-cursor overlays (labels carry names). */
async function editorText(editor: import("@playwright/test").Locator): Promise<string | null> {
  return editor.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".cm-ySelectionCaret,.cm-ySelectionInfo,.cm-widgetBuffer").forEach((n) => n.remove());
    return clone.textContent;
  });
}
/** Alpha submissions counted so far (submit acceptance signal). */
async function alphaSubmissions(matchId: string): Promise<number> {
  const snap = await api("GET", `/matches/${matchId}/snapshot`, U.a1);
  const teams = snap.json.teams as Array<{ side: string; submissions: number }>;
  return teams.find((t) => t.side === "left")?.submissions ?? 0;
}

test("2v2 ticket-15 proof: real shared text, readiness bridge, frozen submit, isolation", async () => {
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
    for (const p of [a1, a2, b1]) {
      await expect(p.getByLabel(/Solution editor/)).toBeVisible();
      // Both transports live: game socket + shared-doc socket.
      await expect(p.getByText(/Shared doc r1 · live/)).toBeVisible({ timeout: 20000 });
    }

    // A1 replaces the starter with solved source through REAL keystrokes.
    const ed1 = a1.getByLabel(/Solution editor/);
    await ed1.click();
    await a1.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await a1.keyboard.type(SOLVED, { delay: 5 });

    // A2 converges with ZERO local input: identical team source.
    const ed2 = a2.getByLabel(/Solution editor/);
    await expect(ed2).toContainText(SOLVED_TAIL, { timeout: 20000 });
    await expect
      .poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 })
      .toBe(true);

    // Reverse direction: A2 edits the Alpha source, A1 converges.
    await ed2.press("End");
    await a2.keyboard.type("\n# a2 was here");
    await expect
      .poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 })
      .toBe(true);
    await expect(ed1).toContainText("# a2 was here", { timeout: 20000 });

    // Beta ISOLATION plus Beta CONVERGENCE: B1 types, B2 sees it, and
    // Alpha's solved text never enters the Beta document.
    const edB1 = b1.getByLabel(/Solution editor/);
    const edB2 = b2.getByLabel(/Solution editor/);
    await expect(edB1).not.toContainText(SOLVED_TAIL);
    await edB1.click();
    await b1.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await b1.keyboard.type(SOLVED, { delay: 5 });
    await expect(edB2).toContainText(SOLVED_TAIL, { timeout: 20000 });
    await expect
      .poll(async () => (await editorText(edB1)) === (await editorText(edB2)), { timeout: 20000 })
      .toBe(true);

    // Both ready -> team submit enables (revision-bound).
    const submitA1 = a1.getByRole("button", { name: "Submit Team Solution" });
    await expect(submitA1).toBeDisabled();
    await checkReady(a1);
    await checkReady(a2);
    await expect(a1.getByText("Both teammates ready.")).toBeVisible({ timeout: 15000 });
    await expect(submitA1).toBeEnabled();

    // A REAL mid-ready edit invalidates BOTH approvals; submit gates off.
    await ed1.press("End");
    await a1.keyboard.type("\n# real shared edit");
    await expect(a1.getByLabel("You are ready")).not.toBeChecked({ timeout: 15000 });
    await expect(a2.getByLabel("You are ready")).not.toBeChecked({ timeout: 15000 });
    await expect(a1.getByText("Waiting for teammate readiness")).toBeVisible({ timeout: 15000 });
    await expect(a2.getByText("Waiting for teammate readiness")).toBeVisible({ timeout: 15000 });
    await expect(submitA1).toBeDisabled();
    await expect.poll(async () => editorText(ed2), { timeout: 15000 }).toContain("# real shared edit");

    // Re-ready on the new revision and submit the team solution.
    await checkReady(a1);
    await checkReady(a2);
    await expect(submitA1).toBeEnabled({ timeout: 15000 });
    await submitA1.click();

    // Wait for ACCEPTANCE (counted attempt), then break the live doc: the
    // judge must still score the frozen pre-edit source (100), proving the
    // submission snapshot is immutable.
    await expect
      .poll(async () => alphaSubmissions(matchId), { timeout: 20000 })
      .toBeGreaterThan(0);
    await expect(a1.getByText("Coding · online").first()).toBeVisible({ timeout: 20000 });
    await ed1.press("End");
    await a1.keyboard.type('\nraise Boom("post-submit")');

    // Beta submits its own converged solved source independently: both
    // sides counted -> game-owned auto-reveal. Independent team execution.
    await checkReady(b1);
    await checkReady(b2);
    await expect(b1.getByText("Both teammates ready.")).toBeVisible({ timeout: 15000 });
    await b1.getByRole("button", { name: "Submit Team Solution" }).click();

    // Sealed team reveal on both Alpha clients with the frozen score.
    for (const p of [a1, a2]) {
      await expect(p.getByText("Scores revealed")).toBeVisible({ timeout: 60000 });
    }
    const scoreA1 = await a1.getByText(/Round 1:/).textContent();
    const scoreA2 = await a2.getByText(/Round 1:/).textContent();
    expect(scoreA1).toEqual(scoreA2);
    expect(scoreA1).toContain("100");
    // Independent Beta result sealed too (solved -> 100, no cross-team leak).
    const scoreB1 = await b1.getByText(/Round 1:/).textContent();
    const scoreB2 = await b2.getByText(/Round 1:/).textContent();
    expect(scoreB1).toEqual(scoreB2);
    expect(scoreB1).toContain("100");

    // Hard refresh restores the SHARED doc from the server (no stale draft).
    await a2.reload();
    await expect(a2.getByLabel(/Solution editor/)).toBeVisible();
    await expect(a2.getByLabel(/Solution editor/)).toContainText('raise Boom("post-submit")', { timeout: 20000 });

    // Next round: fresh Y.Doc, starter source, revision reset, no old text.
    await a1.getByRole("button", { name: "Next round" }).click();
    await expect(a1.getByRole("button", { name: "Start round" })).toBeVisible();
    await a1.getByRole("button", { name: "Start round" }).click();
    for (const [p, ed] of [[a1, ed1], [a2, a2.getByLabel(/Solution editor/)]] as const) {
      await expect(p.getByText(/Shared doc r1 · live/)).toBeVisible({ timeout: 20000 });
      await expect(p.getByText("Waiting for teammate readiness")).toBeVisible({ timeout: 15000 });
      await expect(p.getByRole("button", { name: "Submit Team Solution" })).toBeDisabled();
      await expect(ed).not.toContainText(SOLVED_TAIL);
      await expect(ed).not.toContainText('raise Boom("post-submit")');
    }

    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
