---
layout: ../../layouts/Docs.astro
title: Tools
kicker: reference
description: The seven tools Pluckor exposes — what each does, its parameters, what it returns, and when to reach for it.
---

Pluckor exposes seven tools. Three are **reads** that run through a content script with no CDP and no automation fingerprint; four are **interactions** that attach `chrome.debugger` only while they run.

| Tool | Kind | Use it to… |
|---|---|---|
| `navigate` | read | Load a page and settle past interstitials |
| `get_html` | read | Read the rendered DOM, stealthily |
| `wait_for_selector` | read | Wait out async content |
| `run_js` | CDP | Extract structured data / read computed state |
| `click` | CDP | Trusted click |
| `type` | CDP | Trusted text entry |
| `scroll` | CDP | Scroll for lazy-load / infinite feeds |

## navigate

Load a URL. Opens or repoints the controlled tab, waits for load, and settles past Cloudflare-style interstitials automatically.

```jsonc
navigate { "url": "https://example.com", "settleMs": 8000 }
// → { url, finalUrl, settled, onChallenge }
```

- **Always call this first.** Calling `get_html` / `run_js` before `navigate` fails with `NO_TAB`.
- Check the return: `onChallenge: true` means you're still on a bot-check — give it a moment and re-read.

## get_html

Rendered HTML of the whole page or a single selector. **No CDP, no fingerprint** — the stealthiest reader.

```jsonc
get_html { "selector": "main" }
// → { html, url, truncated }
```

- Returns `truncated: true` for very large pages (~32 MB cap).
- On the most aggressively-monitored targets, prefer `get_html` + parse over `run_js`.

## wait_for_selector

Wait until a selector appears (optionally visible), or time out. Read-only — no CDP.

```jsonc
wait_for_selector { "selector": ".product-card", "timeoutMs": 12000, "visible": true }
// → { found, waitedMs }
```

Modern pages render content, ratings, and prices asynchronously *after* load. Wait for a selector that only exists once the real content is there, then extract.

## run_js

Evaluate a JavaScript expression in the page and get its JSON value back. The convenient structured extractor. Uses CDP (shows the debugger infobar).

```jsonc
run_js { "expression": "document.title", "awaitPromise": true }
// → { value }
```

- The return value **must be JSON-serializable** — you can't return a DOM node. Return `.textContent`, `.outerHTML`, or plain objects.
- If you build the expression by stringifying a **compiled** function (TS/esbuild), prepend `const __name=(f)=>f;` — see [Recipes](/docs/recipes/#the-__name-gotcha).

## click

A trusted click (`isTrusted = true`) at an element's center. For buttons, links, and checkboxes.

```jsonc
click { "selector": "button[type=submit]" }
// → { clicked }
```

## type

Trusted text entry that fires real input events — React and Vue see it. Replaces the field's contents unless `clear: false`.

```jsonc
type { "selector": "input[name=q]", "text": "mortgage crm", "clear": true }
// → { typed, into }
```

## scroll

Scroll the page for lazy-loaded content and infinite feeds. `wheel` mode by default (no CDP); `gesture` mode for momentum scrolling.

```jsonc
scroll { "y": 2000, "mode": "wheel" }
// → { scrolled, mode }
```

## Reads vs. interactions

Reads (`navigate`, `get_html`, `wait_for_selector`) leave **no automation fingerprint** — they use tab and content-script APIs only. The interaction tools (`run_js`, `click`, `type`, and `scroll` in `gesture` mode) attach `chrome.debugger`, which shows Chrome's "started debugging this browser" infobar during the call and is a small detection surface.

**Prefer reads; escalate to interactions only when you must.** See [Cloudflare & stealth](/docs/cloudflare/) for fingerprint discipline.
