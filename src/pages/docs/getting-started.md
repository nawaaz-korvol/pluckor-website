---
layout: ../../layouts/Docs.astro
title: Getting started
kicker: start
description: Install Pluckor for your agent, run your first extraction, and understand what comes back.
---

Pluckor is an [MCP](https://modelcontextprotocol.io) server that hands an AI agent a **real Chrome** to drive. It launches Chrome for Testing with the Pluckor extension loaded, then exposes tools to navigate, read rendered HTML, run JavaScript, click, type, scroll, and wait — and returns the extracted data to the agent.

Because the page loads in a real browser on your machine — real profile, real residential IP — and reads happen through a content script (no CDP, no `navigator.webdriver`), Pluckor gets through sites that block headless browsers and Playwright, **including Cloudflare-protected pages**.

## Requirements

- **Node ≥ 20.11**
- The **first tool call downloads Chrome for Testing** (~150 MB). Later runs reuse the cache.
- A real display — a Chrome window opens on your machine. That's the point.

## Install

Pluckor has two parts: the **MCP server** (the browser tools, run via `npx -y pluckor mcp`) and a **skill** — the workflow patterns that make an agent reliably good at extraction. Set up both for your tool.

### Claude Code — one step

A [plugin](https://github.com/pluckor/pluckor-plugin) installs the server **and** the skill together:

```text
/plugin marketplace add pluckor/pluckor-plugin
/plugin install pluckor@pluckor
```

MCP-only alternative: `claude mcp add pluckor -- npx -y pluckor mcp`, then copy `SKILL.md` to `~/.claude/skills/pluckor/SKILL.md`.

### Cursor

1. Add the MCP server to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):
   ```json
   { "mcpServers": { "pluckor": { "command": "npx", "args": ["-y", "pluckor", "mcp"] } } }
   ```
2. Put `SKILL.md` at `.cursor/skills/pluckor/SKILL.md`.

### Codex

1. Register the server:
   ```bash
   codex mcp add pluckor -- npx -y pluckor mcp
   ```
2. Put `SKILL.md` at `~/.codex/skills/pluckor/SKILL.md` (personal) or `.agents/skills/pluckor/SKILL.md` (project).

### Any other MCP host

Pluckor speaks plain MCP over stdio:

```jsonc
{ "mcpServers": { "pluckor": { "command": "npx", "args": ["-y", "pluckor", "mcp"] } } }
```

## Your first extraction

Almost every task follows the same loop:

```text
navigate → wait_for_selector → get_html / run_js → (click / type) → re-extract
```

A minimal session — pull a ranked list off a Cloudflare-protected page:

```text
navigate           { "url": "https://www.g2.com/categories/mortgage-crm" }
wait_for_selector  { "selector": ".product-card" }
run_js             { "expression": "Array.from(document.querySelectorAll('.product-card')).map(c => c.querySelector('a[href*=\"/products/\"]')?.textContent.trim())" }
```

The agent gets back a JSON array of product names.

## What you get back

Every tool returns structured JSON straight to the agent — not a screenshot to interpret:

- `navigate` → `{ url, finalUrl, settled, onChallenge }`
- `get_html` → `{ html, url, truncated }`
- `run_js` → `{ value }` (must be JSON-serializable)
- `wait_for_selector` → `{ found, waitedMs }`
- `screenshot` → an image (plus `{ width, height, format, bytes }`)
- `extract` → `{ record }` or `{ records, count }` · `extract_links` → `{ links, count }`
- `capture_requests` → `{ requests, count }` · `wait_for_response` → `{ matched, url, status, waitedMs }`
- `capture_console` → `{ entries, count }`
- `press_key` → `{ pressed }` · `select_option` → `{ selected, value, label }` · `hover` → `{ hovered }`
- `go_back`/`go_forward`/`reload` → `{ url, finalUrl, settled, onChallenge }` · `wait_for_function` → `{ satisfied, value, waitedMs }`

The agent reads these values and decides the next step. There's nothing to screen-scrape on your end.

## Next steps

- **[The skill →](/docs/skill/)** — the patterns that make extraction reliable.
- **[Tools →](/docs/tools/)** — the full reference for the twenty browser tools.
- **[The plk CLI →](/docs/plk/)** — keep the browser warm and log in once.
- **[Recovery →](/docs/recovery/)** — when the browser gets stuck, one `restart` brings it back.
- **[Recipes →](/docs/recipes/)** — real end-to-end extractions.
