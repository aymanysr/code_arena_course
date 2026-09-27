import { chromium, expect, test } from "@playwright/test";

const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

test.describe("Live Entry & Lobby E2E", () => {
  test("renders entry lobby with mode selection, quick play, and private room options", async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${WEB}/?live=1&user=test-entry-user`);

    // Verify main lobby heading and elements
    await expect(page.getByRole("heading", { name: "Code Arena Matchmaking" })).toBeVisible();
    await expect(page.getByText("Player: test-entry-user")).toBeVisible();

    // Mode selector
    const btn1v1 = page.getByRole("button", { name: "1v1", exact: true });
    const btn2v2 = page.getByRole("button", { name: "2v2", exact: true });
    await expect(btn1v1).toBeVisible();
    await expect(btn2v2).toBeVisible();
    await expect(btn1v1).toHaveAttribute("aria-pressed", "true");

    // Switching mode
    await btn2v2.click();
    await expect(btn2v2).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Find 2v2 Match" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create 2v2 Room" })).toBeVisible();

    // Switch back to 1v1
    await btn1v1.click();
    await expect(page.getByRole("button", { name: "Find 1v1 Match" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create 1v1 Room" })).toBeVisible();

    await browser.close();
  });

  test("private room: host creates room, guest joins by code, both ready up, and match starts", async () => {
    const browser = await chromium.launch();
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    const hostId = `host-${Date.now()}`;
    const guestId = `guest-${Date.now()}`;

    // 1. Host creates room
    await hostPage.goto(`${WEB}/?live=1&user=${hostId}`);
    await hostPage.getByRole("button", { name: "Create 1v1 Room" }).click();

    // Host sees invite code and room view
    await expect(hostPage.getByText("Share this code with other players")).toBeVisible();
    const codeSpan = hostPage.locator("span.font-mono.text-base.font-bold");
    await expect(codeSpan).toBeVisible();
    const roomCode = (await codeSpan.textContent())?.trim();
    expect(roomCode).toHaveLength(6);

    // Host is on left side, not ready
    await expect(hostPage.getByText(`${hostId} (You)`)).toBeVisible();
    await expect(hostPage.getByText("NOT READY")).toBeVisible();

    // Start match is disabled
    const startBtn = hostPage.getByRole("button", { name: "Start Match" });
    await expect(startBtn).toBeDisabled();

    // 2. Guest joins room using the code
    await guestPage.goto(`${WEB}/?live=1&user=${guestId}`);
    await guestPage.getByPlaceholder("INVITE CODE").fill(roomCode!);
    await guestPage.getByRole("button", { name: "Join" }).click();

    // Guest is in room on right side
    await expect(guestPage.getByText(`${guestId} (You)`)).toBeVisible();

    // Host page receives real-time update: guest is now on right side!
    await expect(hostPage.getByText(guestId)).toBeVisible({ timeout: 5000 });

    // 3. Ready up
    // Host readies up
    await hostPage.getByRole("button", { name: "Ready Up" }).click();
    await expect(hostPage.getByRole("button", { name: "Cancel Ready" })).toBeVisible();
    // Start match still disabled (guest not ready)
    await expect(startBtn).toBeDisabled();

    // Guest readies up
    await guestPage.getByRole("button", { name: "Ready Up" }).click();
    await expect(guestPage.getByRole("button", { name: "Cancel Ready" })).toBeVisible();

    // Both ready -> Host can now click Start Match!
    await expect(startBtn).toBeEnabled({ timeout: 5000 });

    // 4. Host starts match
    await startBtn.click();

    // Both browsers transition to Arena!
    await expect(hostPage.getByRole("heading", { name: "Code Arena", exact: true })).toBeVisible({ timeout: 8000 });
    await expect(guestPage.getByRole("heading", { name: "Code Arena", exact: true })).toBeVisible({ timeout: 8000 });

    // Verify match URL parameter updated
    expect(hostPage.url()).toContain("match=");
    expect(guestPage.url()).toContain("match=");

    await browser.close();
  });

  test("public queue: two players join queue and are matched into a game", async () => {
    const browser = await chromium.launch();
    const p1Context = await browser.newContext();
    const p2Context = await browser.newContext();

    const p1Page = await p1Context.newPage();
    const p2Page = await p2Context.newPage();

    const p1Id = `qp1-${Date.now()}`;
    const p2Id = `qp2-${Date.now()}`;

    // Player 1 joins queue
    await p1Page.goto(`${WEB}/?live=1&user=${p1Id}`);
    await p1Page.getByRole("button", { name: "Find 1v1 Match" }).click();
    await expect(p1Page.getByText("Finding 1v1 Opponent…")).toBeVisible();
    await expect(p1Page.getByRole("button", { name: "Cancel Search" })).toBeVisible();

    // Player 2 joins queue
    await p2Page.goto(`${WEB}/?live=1&user=${p2Id}`);
    await p2Page.getByRole("button", { name: "Find 1v1 Match" }).click();

    // Both players match and enter Arena!
    await expect(p1Page.getByRole("heading", { name: "Code Arena", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(p2Page.getByRole("heading", { name: "Code Arena", exact: true })).toBeVisible({ timeout: 10000 });

    // Verify both are in the same match
    const p1Match = new URL(p1Page.url()).searchParams.get("match");
    const p2Match = new URL(p2Page.url()).searchParams.get("match");
    expect(p1Match).toBeTruthy();
    expect(p2Match).toBeTruthy();
    expect(p1Match).toBe(p2Match);
    await p1Page.getByRole("button", { name: "Start round", exact: true }).click();
    await p1Page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(p1Page.getByText("Not run").first()).not.toBeVisible();
    await Promise.all([
      p1Page.getByRole("button", { name: "Submit", exact: true }).click(),
      p2Page.getByRole("button", { name: "Submit", exact: true }).click(),
    ]);
    await expect(p1Page.getByText("Scores revealed")).toBeVisible();
    await expect(p2Page.getByText("Scores revealed")).toBeVisible();
    console.log(JSON.stringify({ entry: "1v1 queue", users: [p1Id, p2Id], matchId: p1Match }));

    await browser.close();
  });
});

test("queued player matched while offline recovers the same Arena on reload", async ({ browser, request }) => {
  const user = `offline-${Date.now()}`;
  const page = await browser.newPage();
  await page.goto(`${WEB}/?live=1&user=${user}`);
  await page.getByRole("button", { name: "Find 1v1 Match" }).click();
  await expect(page.getByRole("button", { name: "Cancel Search" })).toBeVisible();
  await page.close();
  const game = process.env.E2E_GAME_URL ?? "http://localhost:3220";
  await request.post(`${game}/lobby/queue`, {
    headers: { "x-dev-user-id": `${user}-opponent` }, data: { mode: "1v1" },
  });
  const recovered = await browser.newPage();
  await recovered.goto(`${WEB}/?live=1&user=${user}`);
  await expect(recovered).toHaveURL(/match=/);
  await expect(recovered.getByRole("heading", { name: "Code Arena", exact: true })).toBeVisible();
  await recovered.close();
});

for (const entry of ["queue", "private"] as const) {
  test(`2v2 ${entry}: four players enter one Arena with isolated collaboration and chat`, async ({ browser, request }) => {
    const users = [0, 1, 2, 3].map(i => `${entry}-${Date.now()}-${i}`);
    const pages = await Promise.all(users.map(() => browser.newPage()));
    const game = process.env.E2E_GAME_URL ?? "http://localhost:3220";
    let code = "";
    for (let i = 0; i < 4; i++) {
      const p = pages[i]!;
      await p.goto(`${WEB}/?live=1&user=${users[i]}`);
      await p.getByRole("button", { name: "2v2", exact: true }).click();
      if (entry === "queue") {
        await p.getByRole("button", { name: "Find 2v2 Match" }).click();
        if (i < 3) await expect(p.getByRole("button", { name: "Cancel Search" })).toBeVisible();
      } else if (i === 0) {
        await p.getByRole("button", { name: "Create 2v2 Room" }).click();
        code = (await p.locator("span.font-mono.text-base.font-bold").textContent())!.trim();
      } else {
        await p.getByPlaceholder("INVITE CODE").fill(code);
        await p.getByRole("button", { name: "Join", exact: true }).click();
        await expect(p.getByRole("button", { name: "Ready Up" })).toBeVisible();
      }
    }
    if (entry === "private") {
      const overflow = await request.post(`${game}/lobby/rooms/join`, { headers: { "x-dev-user-id": `extra-${Date.now()}` }, data: { code } });
      expect(overflow.status()).toBe(409);
      for (const p of pages) {
        await p.getByRole("button", { name: "Ready Up" }).click();
        await expect(p.getByRole("button", { name: "Cancel Ready" })).toBeVisible();
      }
      await pages[0]!.getByRole("button", { name: "Start Match", exact: true }).click();
    }
    for (const p of pages) await expect(p.getByRole("heading", { name: "Code Arena", exact: true })).toBeVisible();
    const matchId = new URL(pages[0]!.url()).searchParams.get("match");
    expect(matchId).toBeTruthy();
    for (const p of pages) expect(new URL(p.url()).searchParams.get("match")).toBe(matchId);
    for (let i = 0; i < 4; i++) {
      const res = await request.get(`${game}/matches/${matchId}/snapshot`, { headers: { "x-dev-user-id": users[i]! } });
      const snap = await res.json();
      expect(snap.roundPhase).toBe("MATCH_FOUND");
    }
    await pages[0]!.getByRole("button", { name: "Start round", exact: true }).click();
    for (const p of pages) await expect(p.getByText(/Shared doc r1 · live/)).toBeVisible();
    for (const [author, teammate, opponent, marker] of [[0, 1, 2, "alpha-only"], [2, 3, 0, "beta-only"]] as const) {
      const editor = pages[author]!.getByLabel(/Solution editor/);
      await editor.fill(`# ${marker}`);
      await expect(pages[teammate]!.getByLabel(/Solution editor/)).toContainText(marker);
      await expect(pages[opponent]!.getByLabel(/Solution editor/)).not.toContainText(marker);
      await pages[author]!.getByRole("textbox", { name: "Team message" }).fill(marker);
      await pages[author]!.getByRole("button", { name: "Send team message" }).click();
      await expect(pages[teammate]!.getByLabel("Team chat").getByRole("listitem").filter({ hasText: marker })).toBeVisible();
      await expect(pages[opponent]!.getByLabel("Team chat").getByRole("listitem").filter({ hasText: marker })).not.toBeVisible();
    }
    for (const p of pages.slice(0, 2)) {
      await p.getByLabel("You are ready").click();
      await expect(p.getByLabel("You are ready")).toBeChecked();
    }
    await expect(pages[0]!.getByRole("button", { name: "Submit Team Solution" })).toBeEnabled();
    console.log(JSON.stringify({ entry, users, matchId, teams: [users.slice(0, 2), users.slice(2)] }));
    await Promise.all(pages.map(p => p.close()));
  });
}

test("private membership survives reload and offline match start", async ({ browser, request }) => {
  const game = process.env.E2E_GAME_URL ?? "http://localhost:3220";
  const host = `resume-host-${Date.now()}`;
  const guest = `resume-guest-${Date.now()}`;
  const hostPage = await browser.newPage();
  const guestPage = await browser.newPage();
  await hostPage.goto(`${WEB}/?live=1&user=${host}`);
  await hostPage.getByRole("button", { name: "Create 1v1 Room" }).click();
  const code = (await hostPage.locator("span.font-mono.text-base.font-bold").textContent())!.trim();
  await guestPage.goto(`${WEB}/?live=1&user=${guest}`);
  await guestPage.getByPlaceholder("INVITE CODE").fill(code);
  await guestPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guestPage.getByRole("button", { name: "Ready Up" })).toBeVisible();
  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "Ready Up" })).toBeVisible();
  await guestPage.getByRole("button", { name: "Ready Up" }).click();
  await expect(guestPage.getByRole("button", { name: "Cancel Ready" })).toBeVisible();
  await guestPage.close();
  await hostPage.getByRole("button", { name: "Ready Up" }).click();
  await hostPage.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(hostPage).toHaveURL(/match=/);
  const recovered = await browser.newPage();
  await recovered.goto(`${WEB}/?live=1&user=${guest}`);
  await expect(recovered).toHaveURL(/match=/);
  expect(new URL(recovered.url()).searchParams.get("match")).toBe(new URL(hostPage.url()).searchParams.get("match"));
  const invalid = await request.post(`${game}/lobby/rooms/join`, { headers: { "x-dev-user-id": `invalid-${Date.now()}` }, data: { code: "INVALID" } });
  expect(invalid.status()).toBe(404);
  await hostPage.close();
  await recovered.close();
});
