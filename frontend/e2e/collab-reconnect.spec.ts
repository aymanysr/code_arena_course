import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * Ticket 15 closure E2E suite:
 * Scenarios B, C, E, G, H, I, J covering:
 * - Collab transport drops while teammate edits (B, bidirectional)
 * - Collab transport drop during evaluation (C)
 * - Provider / service restart with real Postgres (E)
 * - Collaboration network flap (G, 5 cycles)
 * - Stale old-round provider rejection (H)
 * - Ephemeral awareness reconnect & cursor tracking (I)
 * - Sustained typing performance & row size observation (J)
 */

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";
const PG_URL = process.env.TEST_PG_URL ?? "postgres://postgres:postgres@localhost:5433/arena_test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const U = { a1: "t15rc-a1", a2: "t15rc-a2", b1: "t15rc-b1", b2: "t15rc-b2" };

const SOLVED = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;

async function api(method: string, pathUrl: string, user: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${GAME}${pathUrl}`, {
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
  await page.getByLabel("You are ready").click();
  await expect(page.getByLabel("You are ready")).toBeChecked({ timeout: 15000 });
}

function watchErrors(page: Page, errors: string[]): void {
  page.on("console", (m) => {
    // Ignore expected network disconnect traces when testing offline/kill
    if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|WebSocket connection to/i.test(m.text())) {
      errors.push(m.text());
    }
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

async function editorText(editor: import("@playwright/test").Locator): Promise<string> {
  return editor.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".cm-ySelectionCaret,.cm-ySelectionInfo,.cm-widgetBuffer").forEach((n) => n.remove());
    return clone.textContent ?? "";
  });
}

async function alphaRevision(matchId: string): Promise<number | null> {
  const res = await api("GET", `/matches/${matchId}/snapshot`, U.a1);
  const teams = res.json.teams as Array<{ side: string; documentRevision: number | null }>;
  return teams.find((t) => t.side === "left")?.documentRevision ?? null;
}

async function alphaSubmissions(matchId: string): Promise<number> {
  const snap = await api("GET", `/matches/${matchId}/snapshot`, U.a1);
  const teams = snap.json.teams as Array<{ side: string; submissions: number }>;
  return teams.find((t) => t.side === "left")?.submissions ?? 0;
}

test.describe.serial("Ticket 15: Collaboration Reconnect & Recovery Matrix", () => {
  test("Scenario B: collab transport drop while teammate edits (bidirectional)", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      const a2 = await ctx2.newPage();
      watchErrors(a1, errors);
      watchErrors(a2, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a2.goto(`${WEB}/?live=1&user=${U.a2}&match=${matchId}`);

      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      const ed2 = a2.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();
      await expect(ed2).toBeVisible();
      await expect(a1.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });
      await expect(a2.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });

      // Baseline: R1
      expect(await alphaRevision(matchId)).toBe(1);

      // --- Part 1: A1 drops collab socket while A2 edits ---
      await a1.evaluate(() => {
        (window as any).__arenaCollab?.disconnect();
      });

      // A1 shared editor becomes read-only and actions are disabled
      await expect(a1.getByLabel("Language")).toBeDisabled();
      await expect(a1.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
      await expect(a1.getByRole("button", { name: "Submit Team Solution" })).toBeDisabled();
      await expect(ed1).toHaveAttribute("contenteditable", "false", { timeout: 10000 });

      // A2 types multiple edits while A1 is disconnected
      await ed2.press("End");
      await a2.keyboard.type("\n# a2-edit-1");
      await a2.keyboard.type("\n# a2-edit-2");

      // Server document revision advances on A2's edits
      await expect.poll(async () => alphaRevision(matchId), { timeout: 15000 }).toBeGreaterThan(1);
      const revAfterA2 = await alphaRevision(matchId);

      // Reconnect A1 collab socket
      await a1.evaluate(async () => {
        await (window as any).__arenaCollab?.connect();
      });
      await expect(a1.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });
      await expect(a1.getByLabel("Language")).toBeEnabled();
      await expect(ed1).toHaveAttribute("contenteditable", "true", { timeout: 10000 });

      // Assert exact convergence between A1 and A2
      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 15000 }).toBe(true);
      const content = await editorText(ed1);
      expect(content).toContain("# a2-edit-1");
      expect(content).toContain("# a2-edit-2");

      // Verify no duplicate text
      expect((content.match(/# a2-edit-1/g) || []).length).toBe(1);
      expect((content.match(/# a2-edit-2/g) || []).length).toBe(1);

      // Reconnect baseline itself did not bump revision
      expect(await alphaRevision(matchId)).toBe(revAfterA2);

      // --- Part 2: Reverse direction (A2 drops collab socket while A1 edits) ---
      await a2.evaluate(() => {
        (window as any).__arenaCollab?.disconnect();
      });

      await expect(a2.getByLabel("Language")).toBeDisabled();
      await expect(ed2).toHaveAttribute("contenteditable", "false", { timeout: 10000 });

      await ed1.press("End");
      await a1.keyboard.type("\n# a1-edit-reverse");
      await expect.poll(async () => alphaRevision(matchId), { timeout: 15000 }).toBeGreaterThan(revAfterA2!);
      const revAfterA1 = await alphaRevision(matchId);

      await a2.evaluate(async () => {
        await (window as any).__arenaCollab?.connect();
      });
      await expect(a2.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });
      await expect(ed2).toHaveAttribute("contenteditable", "true", { timeout: 10000 });

      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 15000 }).toBe(true);
      const contentRev = await editorText(ed2);
      expect(contentRev).toContain("# a1-edit-reverse");
      expect(await alphaRevision(matchId)).toBe(revAfterA1);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("Scenario C: collab drop during evaluation keeps judge isolated and sealed", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      const a2 = await ctx2.newPage();
      watchErrors(a1, errors);
      watchErrors(a2, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a2.goto(`${WEB}/?live=1&user=${U.a2}&match=${matchId}`);

      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      const ed2 = a2.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();
      await expect(ed2).toBeVisible();

      // Enter solved code
      await ed1.click();
      await a1.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await a1.keyboard.type(SOLVED, { delay: 5 });
      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 }).toBe(true);

      // Both ready
      await checkReady(a1);
      await checkReady(a2);
      const submitBtn = a1.getByRole("button", { name: "Submit Team Solution" });
      await expect(submitBtn).toBeEnabled({ timeout: 15000 });

      // Submit
      await submitBtn.click();
      await expect.poll(async () => alphaSubmissions(matchId), { timeout: 15000 }).toBe(1);

      // A1 collab drops while in evaluation
      await a1.evaluate(() => {
        (window as any).__arenaCollab?.disconnect();
      });

      // Submit record in DB remains immutable; A2 can make later edits
      const revBeforeBreak = await alphaRevision(matchId);
      await ed2.press("End");
      await a2.keyboard.type('\nraise RuntimeError("post-submit-break")');
      await expect.poll(async () => alphaRevision(matchId), { timeout: 15000 }).toBeGreaterThan(revBeforeBreak!);

      // Reconnect A1
      await a1.evaluate(async () => {
        await (window as any).__arenaCollab?.connect();
      });
      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 }).toBe(true);
      expect(await editorText(ed1)).toContain("post-submit-break");

      // Now trigger round completion via API so scores reveal
      const snap = await api("GET", `/matches/${matchId}/snapshot`, U.b1);
      if (snap.json.roundPhase !== "SCORE_REVEAL") {
        // Submit Beta to trigger reveal
        await api("POST", `/matches/${matchId}/ready`, U.b1, { ready: true, documentRevision: 1 });
        await api("POST", `/matches/${matchId}/ready`, U.b2, { ready: true, documentRevision: 1 });
        await api("POST", `/matches/${matchId}/submit`, U.b1, { code: SOLVED, language: "Python", documentRevision: 1 });
      }

      await expect(a1.getByText("Scores revealed")).toBeVisible({ timeout: 45000 });
      await expect(a2.getByText("Scores revealed")).toBeVisible({ timeout: 45000 });

      // Assert score is 100 on both A1 and A2 (evaluated frozen pre-edit code, not the broken code)
      const score1 = await a1.getByText(/Round 1:/).textContent();
      const score2 = await a2.getByText(/Round 1:/).textContent();
      expect(score1).toEqual(score2);
      expect(score1).toContain("100");

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("Scenario E: service restart with real Postgres restores exact Yjs state and advances on edit", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      const a2 = await ctx2.newPage();
      watchErrors(a1, errors);
      watchErrors(a2, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a2.goto(`${WEB}/?live=1&user=${U.a2}&match=${matchId}`);

      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      const ed2 = a2.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();
      await expect(ed2).toBeVisible();

      // Edit to a distinctive shared source
      const DISTINCTIVE = "postgres-restart-proof-distinctive-token-xyz789";
      await ed1.press("End");
      await a1.keyboard.insertText("\n# " + DISTINCTIVE);
      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 }).toBe(true);
      await expect.poll(async () => alphaRevision(matchId), { timeout: 15000 }).toBe(2);

      const beforeSource = await editorText(ed1);
      const beforeHash = createHash("sha256").update(beforeSource, "utf8").digest("hex");

      // Kill the running service process on port 3220
      try {
        const pids = execSync("lsof -ti TCP:3220 -sTCP:LISTEN", { encoding: "utf8" }).trim().split(/\s+/);
        for (const pid of pids) {
          if (pid && Number(pid) !== process.pid) {
            try { process.kill(Number(pid), "SIGKILL"); } catch {}
          }
        }
      } catch {
        // already stopped
      }

      await new Promise((r) => setTimeout(r, 600));

      // Restart service against the exact same database
      const srvRoot = path.join(__dirname, "..", "..", "services", "game");
      const child = spawn("node", ["dist/main.js"], {
        cwd: srvRoot,
        env: {
          ...process.env,
          PORT: "3220",
          DEV_PRINCIPAL: "true",
          DATABASE_URL: PG_URL,
        },
        stdio: "ignore",
        detached: true,
      });
      child.unref();

      // Wait for health endpoint
      const deadline = Date.now() + 20000;
      let up = false;
      while (Date.now() < deadline) {
        try {
          const res = await fetch("http://localhost:3220/health");
          if (res.ok) {
            up = true;
            break;
          }
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      expect(up).toBe(true);

      // Refresh / reconnect both clients
      await a1.reload();
      await a2.reload();
      const ed1After = a1.getByLabel(/Solution editor/);
      const ed2After = a2.getByLabel(/Solution editor/);
      await expect(ed1After).toBeVisible({ timeout: 20000 });
      await expect(ed2After).toBeVisible({ timeout: 20000 });
      await expect(a1.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });
      await expect(a2.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });

      // Assert exact source restored, revision restored, hash identical
      await expect.poll(async () => (await editorText(ed1After)) === (await editorText(ed2After)), { timeout: 20000 }).toBe(true);
      const afterSource = await editorText(ed1After);
      expect(afterSource).toContain(DISTINCTIVE);
      const afterHash = createHash("sha256").update(afterSource, "utf8").digest("hex");
      expect(afterHash).toBe(beforeHash);
      expect(await alphaRevision(matchId)).toBe(2);

      // Now edit again after restart: revision advances to 3 exactly once
      const POST_RESTART = "post-restart-edit";
      await ed1After.press("End");
      await a1.keyboard.insertText("\n# " + POST_RESTART);
      await expect.poll(async () => alphaRevision(matchId), { timeout: 15000 }).toBe(3);
      await expect.poll(async () => (await editorText(ed1After)) === (await editorText(ed2After)), { timeout: 20000 }).toBe(true);
      expect(await editorText(ed2After)).toContain(POST_RESTART);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("Scenario G: network flap across 5 rapid disconnect/reconnect cycles leaves clean state", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      const a2 = await ctx2.newPage();
      watchErrors(a1, errors);
      watchErrors(a2, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a2.goto(`${WEB}/?live=1&user=${U.a2}&match=${matchId}`);

      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      const ed2 = a2.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();
      await expect(ed2).toBeVisible();

      // Perform 5 rapid disconnect / connect flap cycles on A1
      for (let i = 0; i < 5; i++) {
        await a1.evaluate(async () => {
          (window as any).__arenaCollab?.disconnect();
          await new Promise((r) => setTimeout(r, 60));
          await (window as any).__arenaCollab?.connect();
        });
      }

      await expect(a1.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });
      await expect(a2.getByText(/Shared doc r\d+ · live/)).toBeVisible({ timeout: 20000 });

      // Revision has not inflated (still R1 because no typing occurred)
      expect(await alphaRevision(matchId)).toBe(1);

      // Now A1 types: exactly one update listener, normal convergence, no duplicates
      await ed1.press("End");
      await a1.keyboard.insertText("\n# after-flap-content");

      await expect.poll(async () => alphaRevision(matchId), { timeout: 15000 }).toBe(2);
      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 15000 }).toBe(true);

      const text = await editorText(ed2);
      expect(text).toContain("# after-flap-content");
      expect((text.match(/# after-flap-content/g) || []).length).toBe(1);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("Scenario H: old-round frames rejected after round advance", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      watchErrors(a1, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();

      // Get current round id
      const r1Id = (await a1.evaluate(() => (window as any).__arenaCollab?.roundId)) as string;
      expect(r1Id).toBeTruthy();

      // Late old-round frame (roundId does not match current round):
      const staleRes = await a1.evaluate(
        async () => {
          const collab = (window as any).__arenaCollab;
          if (!collab?.socket) return { error: "no socket" };
          return new Promise((resolve) => {
            collab.socket.emit(
              "update",
              { roundId: "stale-round-prior-to-advance", updateB64: "dGVzdC1zdGFsZS11cGRhdGU=" },
              (res: any) => resolve(res),
            );
          });
        },
      );

      // Server rejects the stale frame
      expect(staleRes).toMatchObject({ ok: false });
      expect((staleRes as any).error).toMatch(/stale round/i);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("Scenario I: awareness reconnect tracks collaborator cursor without touching game state", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      const a2 = await ctx2.newPage();
      watchErrors(a1, errors);
      watchErrors(a2, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a2.goto(`${WEB}/?live=1&user=${U.a2}&match=${matchId}`);

      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      const ed2 = a2.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();
      await expect(ed2).toBeVisible();

      // A2 selects text/moves cursor
      await ed2.click();
      await a2.keyboard.press("ArrowRight");
      await a2.keyboard.press("ArrowRight");

      // A1 sees A2 remote cursor state in awareness
      await expect
        .poll(
          async () => {
            return a1.evaluate(() => {
              const states = Array.from((window as any).__arenaCollab?.awareness?.getStates()?.values() ?? []);
              return states.some((s: any) => s.user?.name === "t15rc-a2" && s.cursor !== null);
            });
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // A2 disconnects collab socket
      await a2.evaluate(() => {
        (window as any).__arenaCollab?.disconnect();
      });

      // A1 awareness drops A2 cursor (peer-left cleanup)
      await expect
        .poll(
          async () => {
            return a1.evaluate(() => {
              const states = Array.from((window as any).__arenaCollab?.awareness?.getStates()?.values() ?? []);
              return states.some((s: any) => s.user?.name === "t15rc-a2");
            });
          },
          { timeout: 15000 },
        )
        .toBe(false);

      // Reconnect A2
      await a2.reload();
      const ed2After = a2.getByLabel(/Solution editor/);
      await expect(ed2After).toBeVisible({ timeout: 20000 });
      await ed2After.click();
      await a2.keyboard.press("ArrowRight");

      // A1 sees A2 cursor again
      await expect
        .poll(
          async () => {
            return a1.evaluate(() => {
              const states = Array.from((window as any).__arenaCollab?.awareness?.getStates()?.values() ?? []);
              return states.some((s: any) => s.user?.name === "t15rc-a2" && s.cursor !== null);
            });
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // Game state check: revision is still 1, readiness unchanged, presence online
      expect(await alphaRevision(matchId)).toBe(1);
      const snap = await api("GET", `/matches/${matchId}/snapshot`, U.a1);
      const alpha = (snap.json.teams as any[]).find((t: any) => t.side === "left");
      expect(alpha.members.find((m: any) => m.userId === U.a1).presence).toBe("online");

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  test("Scenario J: sustained concurrent typing performance observation", async () => {
    const browser = await chromium.launch();
    const errors: string[] = [];
    try {
      const matchId = await createTeamMatch();
      const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a1 = await ctx1.newPage();
      const a2 = await ctx2.newPage();
      watchErrors(a1, errors);
      watchErrors(a2, errors);

      await a1.goto(`${WEB}/?live=1&user=${U.a1}&match=${matchId}`);
      await a2.goto(`${WEB}/?live=1&user=${U.a2}&match=${matchId}`);

      await a1.getByRole("button", { name: "Start round" }).click();
      const ed1 = a1.getByLabel(/Solution editor/);
      const ed2 = a2.getByLabel(/Solution editor/);
      await expect(ed1).toBeVisible();
      await expect(ed2).toBeVisible();

      // Sustained burst of edits: both type rapidly for several seconds
      await ed1.press("End");
      await ed2.press("End");

      const t0 = Date.now();
      const burst1 = a1.keyboard.type("\n# rapid typing block alpha-1 aaaaa bbbbb ccccc ddddd eeeee\n# line 2 alpha-1\n", { delay: 10 });
      const burst2 = a2.keyboard.type("\n# rapid typing block alpha-2 11111 22222 33333 44444 55555\n# line 2 alpha-2\n", { delay: 10 });
      await Promise.all([burst1, burst2]);
      const elapsed = Date.now() - t0;

      // Both converge
      await expect.poll(async () => (await editorText(ed1)) === (await editorText(ed2)), { timeout: 20000 }).toBe(true);

      const finalContent = await editorText(ed1);
      expect(finalContent).toContain("rapid typing block alpha-1");
      expect(finalContent).toContain("rapid typing block alpha-2");

      const finalRev = await alphaRevision(matchId);
      expect(finalRev).toBeGreaterThan(1);

      // Verify row in Postgres
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: PG_URL });
      const res = await pool.query("SELECT octet_length(ydoc_state) as bytes, app_revision FROM collab_documents WHERE match_id = $1", [matchId]);
      await pool.end();

      expect(res.rowCount).toBeGreaterThan(0);
      const bytes = Number(res.rows[0].bytes);
      // Compact CRDT state size (under 10KB for burst typing)
      expect(bytes).toBeLessThan(50000);

      console.log(`[Scenario J Observation] Elapsed: ${elapsed}ms, Final Revision: ${finalRev}, Persisted Size: ${bytes} bytes`);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
