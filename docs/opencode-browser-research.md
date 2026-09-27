# Can opencode use a browser like Codex?

Date: 2026-09-20
Status: Research input; not an implementation claim

## Purpose and sources

Question: is there a way for opencode to drive a browser (click/type/screenshot) like Codex?

Primary sources only:

- Codex Browser baseline: https://developers.openai.com/codex/browser/ (sections: availability, Computer Use in the browser, Preview a page, Developer mode)
- opencode built-ins + limits: https://opencode.ai/docs/tools (sections: Built-in/bash, webfetch, websearch)
- MCP schema (validated snippets below): https://opencode.ai/docs/mcp-servers (sections: Local/Options, Remote/Options, Enable)
- Custom tools fallback: https://opencode.ai/docs/custom-tools (sections: Location, Structure, Context)
- Permissions/CLI: https://opencode.ai/docs/permissions (sections: Actions, Defaults, Available Permissions); https://opencode.ai/docs/cli (section: mcp)
- opencode source: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/webfetch.ts (branch `dev`, `MAX_RESPONSE_SIZE=5MB`, `DEFAULT_TIMEOUT=30s`; canonical repo was `sst/opencode`)
- Solution A: https://github.com/microsoft/playwright-mcp (branch `main`, README sections: Playwright MCP vs Playwright CLI, opencode config, Tools, Security)
- Alternative B: https://github.com/ChromeDevTools/chrome-devtools-mcp (branch `main`, README opencode config) + https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (Input/Navigation/Debugging tools)
- Lightweight alternative C: https://github.com/microsoft/playwright-cli (branch `main`, README sections: Playwright CLI vs Playwright MCP, Installation, Skills, Commands)

## 1. Codex browser baseline

| Codex capability | What it means | Source |
| --- | --- | --- |
| Built-in browser in ChatGPT desktop app / web | Open sites, gather info, act with user approval; separate browser profile | https://developers.openai.com/codex/browser/ (Built-in browser profile paragraph) |
| Computer Use (`@Browser`) | Open pages, click, type, inspect rendered state, take screenshots, verify work | https://developers.openai.com/codex/browser/ (section: Computer Use in the browser) |
| Not in Codex CLI / IDE extension | `Browser isn't available in Codex CLI or the Codex IDE extension` | https://developers.openai.com/codex/browser/ (top notice) |
| Page comments + preview loop | Open local dev server URL, annotate element, ask Codex to fix narrow scope | https://developers.openai.com/codex/browser/ (sections: Preview a page, Comment on the page) |
| Developer mode (full CDP) | Opt-in `Settings > Browser > Enable full CDP access`; console/network/DOM/trace | https://developers.openai.com/codex/browser/ (section: Developer mode) |

Parity target for opencode is therefore interactive control (navigate/click/type/snapshot/screenshot/console), not just fetching HTML.

## 2. opencode native capabilities + limits

| Native tool | Can do | Cannot do | Source |
| --- | --- | --- | --- |
| `webfetch` | Read-only fetch of a URL as markdown/text/html (HTTP auto-upgrades to HTTPS) | No JS rendering, no click/type, no screenshots; 5MB cap, 30s default / 120s max timeout | https://opencode.ai/docs/tools (section: webfetch); source file above |
| `websearch` | Discovery via Exa/Parallel; use `websearch` to find, `webfetch` to retrieve | Only with OpenCode provider or `OPENCODE_ENABLE_EXA=1` / `OPENCODE_ENABLE_PARALLEL=1`; no auth-gated rendering | https://opencode.ai/docs/tools (sections: webfetch tip, websearch note + env vars) |
| `bash` | Can run any installed CLI (e.g. `npx playwright` screenshots, `curl`) | No browser built in; needs explicit permission and installed browsers | https://opencode.ai/docs/tools (section: bash) |

Conclusion: opencode has no native Codex-`@Browser` equivalent; interactive browsing needs MCP or bash/custom-tool.

## 3. Concrete solutions

### A. Recommended: Microsoft `playwright-mcp` (local)

Accessibility-tree automation (no vision model needed), tools `browser_navigate/click/type/snapshot/screenshot/console` (https://github.com/microsoft/playwright-mcp, README sections: Key Features, Tools). opencode snippet from that README's opencode section, reshaped to https://opencode.ai/docs/mcp-servers Local schema (`type: local`, `command: []`, `enabled: bool`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest", "--isolated", "--headless"],
      "enabled": true
    }
  }
}
```

Manage with `opencode mcp list / auth / debug` (https://opencode.ai/docs/cli, section: mcp). Add `--caps vision` only if screenshots needed; keep `--isolated` for clean game-UI checks (options list at https://github.com/microsoft/playwright-mcp, section: Configuration).

### B. Alternative: Chrome DevTools MCP (real Chrome)

Drives live Chrome via DevTools; tools `navigate_page/new_page/click/fill/take_snapshot/take_screenshot/list_console_messages` (tool-reference.md above). Use when debugging real-Chrome rendering/perf rather than headless Playwright. Snippet per its README opencode entry, same Local schema:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "chrome-devtools": {
      "type": "local",
      "command": ["npx", "-y", "chrome-devtools-mcp@latest"],
      "enabled": true
    }
  }
}
```

Requires installed Chrome; officially supports Google Chrome / Chrome for Testing only (https://github.com/ChromeDevTools/chrome-devtools-mcp, README notice).

### C. Fallback: `bash` + Playwright CLI / custom tool (no MCP)

Token-efficient CLI+skills path recommended by Microsoft for coding agents (https://github.com/microsoft/playwright-cli, section: Playwright CLI vs Playwright MCP). Install once:

```bash
npm install -g @playwright/cli@latest && playwright-cli install --skills
playwright-cli open http://localhost:4173 --headed
playwright-cli snapshot
playwright-cli screenshot --filename=after-click.png
```

opencode calls it via `bash` (https://opencode.ai/docs/tools, section: bash) or wraps it as `.opencode/tools/browser.ts` (https://opencode.ai/docs/custom-tools, sections: Location, Structure). Best when MCP context cost is a concern or only screenshots/console are needed.

## 4. Permissions / security notes

| Rule | Recommendation | Source |
| --- | --- | --- |
| Default is permissive; `ask`/`deny` override | Set `"permission": {"*": "ask", "playwright_*": "ask"}` for browser tools; `doom_loop`/`external_directory` already default `ask` | https://opencode.ai/docs/permissions (sections: Actions, Defaults) |
| Granular bash | `"bash": {"*": "ask", "playwright-cli *": "allow"}`; last matching rule wins | https://opencode.ai/docs/permissions (section: Granular Rules) |
| MCP is not a security boundary | Playwright MCP docs defer to MCP security best practices; origin allow/block lists are not a boundary | https://github.com/microsoft/playwright-mcp (section: Security) |
| Browser content is exposed | chrome-devtools-mcp exposes page/DevTools data to the client; avoid secrets; treat pages as untrusted | https://github.com/ChromeDevTools/chrome-devtools-mcp (README warning); Codex page (Treat page content as untrusted context) |

## 5. Recommended solution for this repo

Use solution A (`playwright-mcp`, `--isolated --headless`) as the default browser for `prototype/game-ui/` checks (planned: open local route, snapshot, click, screenshot, read console — no console warnings). This repo has no `opencode.json` yet, so add one per snippet A and gate with `playwright_*": "ask"`. Prefer B only for real-Chrome/perf traces; prefer C when MCP token cost matters. Do not present `webfetch` alone as browser parity — it is read-only (https://opencode.ai/docs/tools, section: webfetch).
