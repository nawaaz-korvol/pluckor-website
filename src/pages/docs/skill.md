---
layout: ../../layouts/Docs.astro
title: The skill
kicker: start
description: The SKILL.md that ships with Pluckor — the workflow patterns and gotchas that make an agent reliably good at extraction.
---

The MCP server gives an agent the *tools*. The **skill** gives it the *judgment* — the golden-path loop, robust selector choices, how to tell a Cloudflare challenge from real content, and the gotchas that otherwise produce empty or garbage results.

`SKILL.md` ships **inside the `pluckor` npm package** and in the [plugin repo](https://github.com/pluckor/pluckor-plugin), which carries it in each tool's skill location. Install it alongside the MCP server — see [Getting started](/docs/getting-started/#install).

## The golden path

Almost every task follows this loop. Skipping steps is the #1 cause of empty results.

```text
navigate → wait_for_selector → get_html / run_js → (click / type) → re-extract
```

1. **`navigate` first, always.** It opens the tab, waits for load, and settles past Cloudflare interstitials. Check `{ settled, onChallenge }`.
2. **`wait_for_selector` before you extract or interact.** Pages render content asynchronously; extract too early and you get a skeleton.
3. **Extract**, then interact and re-extract as needed.

## When to use Pluckor — and when not

**Use it when** the target blocks normal scraping (Cloudflare, "Just a moment…", 403s, headless detection), needs a logged-in session, or renders content with client-side JavaScript a plain HTTP fetch won't see.

**Don't reach for it when** there's a public API or the page is static HTML a simple fetch handles — that's faster and cheaper. Pluckor opens a real browser window; use it when you actually need a browser.

## Core patterns

The skill spells these out in full; the essentials:

- **Read with `get_html`, compute with `run_js`.** `get_html` is the stealthy reader (no CDP). `run_js` is the convenient structured extractor — but it returns values *by value*, so they must be JSON-serializable.
- **Pick robust selectors.** Prefer, in order: `<script type="application/ld+json">`, `[itemprop="…"]` microdata, `data-*` attributes, stable ids — then fall back to classes. Visual class names change.
- **Act by ref, not guesswork.** When you're driving a page and don't already know solid selectors, `snapshot` first — it returns a ref-stamped map of the actionable elements (no CDP). Then `click` / `type` / `hover` / `press_key` / `select_option` by `ref` instead of a CSS selector. Refs refresh on every snapshot, so a stale ref means the page changed — snapshot again.
- **Wait, don't guess.** A skeleton or `0` results means the content is async-rendered. `wait_for_selector` for the element that signals real content, *then* extract.
- **Multi-page in one session.** The browser persists across calls, so do list pages and detail pages in the same session.
- **Recover, don't spin.** If a tool fails with `NO_BROWSER` / `NOT_CONNECTED` / a timeout, the shared daemon may be wedged or outdated — call `restart` once and retry, don't loop. See [Recovery](/docs/recovery/).

See **[Recipes](/docs/recipes/)** for worked examples of each.

## Where the skill lives

| Agent | Skill location |
|---|---|
| Claude Code | `~/.claude/skills/pluckor/SKILL.md` (or via the plugin) |
| Cursor | `.cursor/skills/pluckor/SKILL.md` |
| Codex | `~/.codex/skills/pluckor/SKILL.md` or `.agents/skills/pluckor/SKILL.md` |

The Claude Code plugin installs the skill automatically. For the others, copy `SKILL.md` from the npm package or the [plugin repo](https://github.com/pluckor/pluckor-plugin) into the location above.
