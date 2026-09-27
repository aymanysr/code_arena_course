# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/e2e/live-lobby.spec.ts >> Live Entry & Lobby E2E >> renders entry lobby with mode selection, quick play, and private room options
- Location: frontend/e2e/live-lobby.spec.ts:6:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Code Arena Matchmaking' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Code Arena Matchmaking' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Code Arena Matchmaking' })

```

```yaml
- alert: Live mode requested but VITE_GAME_URL is not configured.
```

# Test source

```ts
  1   | import { chromium, expect, test } from "@playwright/test";
  2   | 
  3   | const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";
  4   | 
  5   | test.describe("Live Entry & Lobby E2E", () => {
  6   |   test("renders entry lobby with mode selection, quick play, and private room options", async () => {
  7   |     const browser = await chromium.launch();
  8   |     const context = await browser.newContext();
  9   |     const page = await context.newPage();
  10  | 
  11  |     await page.goto(`${WEB}/?live=1&user=test-entry-user`);
  12  | 
  13  |     // Verify main lobby heading and elements
> 14  |     await expect(page.getByRole("heading", { name: "Code Arena Matchmaking" })).toBeVisible();
      |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  15  |     await expect(page.getByText("Player: test-entry-user")).toBeVisible();
  16  | 
  17  |     // Mode selector
  18  |     const btn1v1 = page.getByRole("button", { name: "1v1", exact: true });
  19  |     const btn2v2 = page.getByRole("button", { name: "2v2", exact: true });
  20  |     await expect(btn1v1).toBeVisible();
  21  |     await expect(btn2v2).toBeVisible();
  22  |     await expect(btn1v1).toHaveAttribute("aria-pressed", "true");
  23  | 
  24  |     // Switching mode
  25  |     await btn2v2.click();
  26  |     await expect(btn2v2).toHaveAttribute("aria-pressed", "true");
  27  |     await expect(page.getByRole("button", { name: "Find 2v2 Match" })).toBeVisible();
  28  |     await expect(page.getByRole("button", { name: "Create 2v2 Room" })).toBeVisible();
  29  | 
  30  |     // Switch back to 1v1
  31  |     await btn1v1.click();
  32  |     await expect(page.getByRole("button", { name: "Find 1v1 Match" })).toBeVisible();
  33  |     await expect(page.getByRole("button", { name: "Create 1v1 Room" })).toBeVisible();
  34  | 
  35  |     await browser.close();
  36  |   });
  37  | 
  38  |   test("private room: host creates room, guest joins by code, both ready up, and match starts", async () => {
  39  |     const browser = await chromium.launch();
  40  |     const hostContext = await browser.newContext();
  41  |     const guestContext = await browser.newContext();
  42  | 
  43  |     const hostPage = await hostContext.newPage();
  44  |     const guestPage = await guestContext.newPage();
  45  | 
  46  |     const hostId = `host-${Date.now()}`;
  47  |     const guestId = `guest-${Date.now()}`;
  48  | 
  49  |     // 1. Host creates room
  50  |     await hostPage.goto(`${WEB}/?live=1&user=${hostId}`);
  51  |     await hostPage.getByRole("button", { name: "Create 1v1 Room" }).click();
  52  | 
  53  |     // Host sees invite code and room view
  54  |     await expect(hostPage.getByText("Share this code with other players")).toBeVisible();
  55  |     const codeSpan = hostPage.locator("span.font-mono.text-base.font-bold");
  56  |     await expect(codeSpan).toBeVisible();
  57  |     const roomCode = (await codeSpan.textContent())?.trim();
  58  |     expect(roomCode).toHaveLength(6);
  59  | 
  60  |     // Host is on left side, not ready
  61  |     await expect(hostPage.getByText(`${hostId} (You)`)).toBeVisible();
  62  |     await expect(hostPage.getByText("NOT READY")).toBeVisible();
  63  | 
  64  |     // Start match is disabled
  65  |     const startBtn = hostPage.getByRole("button", { name: "Start Match" });
  66  |     await expect(startBtn).toBeDisabled();
  67  | 
  68  |     // 2. Guest joins room using the code
  69  |     await guestPage.goto(`${WEB}/?live=1&user=${guestId}`);
  70  |     await guestPage.getByPlaceholder("INVITE CODE").fill(roomCode!);
  71  |     await guestPage.getByRole("button", { name: "Join" }).click();
  72  | 
  73  |     // Guest is in room on right side
  74  |     await expect(guestPage.getByText(`${guestId} (You)`)).toBeVisible();
  75  | 
  76  |     // Host page receives real-time update: guest is now on right side!
  77  |     await expect(hostPage.getByText(guestId)).toBeVisible({ timeout: 5000 });
  78  | 
  79  |     // 3. Ready up
  80  |     // Host readies up
  81  |     await hostPage.getByRole("button", { name: "Ready Up" }).click();
  82  |     await expect(hostPage.getByRole("button", { name: "Cancel Ready" })).toBeVisible();
  83  |     // Start match still disabled (guest not ready)
  84  |     await expect(startBtn).toBeDisabled();
  85  | 
  86  |     // Guest readies up
  87  |     await guestPage.getByRole("button", { name: "Ready Up" }).click();
  88  |     await expect(guestPage.getByRole("button", { name: "Cancel Ready" })).toBeVisible();
  89  | 
  90  |     // Both ready -> Host can now click Start Match!
  91  |     await expect(startBtn).toBeEnabled({ timeout: 5000 });
  92  | 
  93  |     // 4. Host starts match
  94  |     await startBtn.click();
  95  | 
  96  |     // Both browsers transition to Arena!
  97  |     await expect(hostPage.getByRole("heading", { name: "Code Arena" })).toBeVisible({ timeout: 8000 });
  98  |     await expect(guestPage.getByRole("heading", { name: "Code Arena" })).toBeVisible({ timeout: 8000 });
  99  | 
  100 |     // Verify match URL parameter updated
  101 |     expect(hostPage.url()).toContain("match=");
  102 |     expect(guestPage.url()).toContain("match=");
  103 | 
  104 |     await browser.close();
  105 |   });
  106 | 
  107 |   test("public queue: two players join queue and are matched into a game", async () => {
  108 |     const browser = await chromium.launch();
  109 |     const p1Context = await browser.newContext();
  110 |     const p2Context = await browser.newContext();
  111 | 
  112 |     const p1Page = await p1Context.newPage();
  113 |     const p2Page = await p2Context.newPage();
  114 | 
```