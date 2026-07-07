---
layout: ../../layouts/Docs.astro
title: Tools
kicker: reference
description: The twelve browser tools Pluckor exposes — what each does, what it returns, when to reach for it — plus the status and restart management tools.
---

Pluckor exposes **twelve browser tools** — **reads** that run through a content script with no CDP and no automation fingerprint, and **interactions** that attach `chrome.debugger` only while they run (`screenshot` and `capture_requests` span both, by mode). Two more **management** tools — [`status` and `restart`](#management) — act on the daemon itself so an agent can recover a stuck browser.

Every tool also accepts an optional **`timeoutMs`** (milliseconds) to override its default time budget — raise it for a slow page or a long script, or lower it to fail fast.

| Tool | Kind | Use it to… |
|---|---|---|
| `navigate` | read | Load a page and settle past interstitials |
| `get_html` | read | Read the rendered DOM, stealthily |
| `wait_for_selector` | read | Wait out async content |
| `run_js` | CDP | Extract structured data / read computed state |
| `click` | CDP | Trusted click |
| `type` | CDP | Trusted text entry |
| `scroll` | CDP | Scroll for lazy-load / infinite feeds |
| `screenshot` | read/CDP | See the page as an image — viewport, a long shot, or an element |
| `extract` | read | Structured data from a field→selector map (+ `container` for a listing) |
| `extract_links` | read | Harvest deduped, absolute links for list→detail crawls |
| `capture_requests` | read/CDP | Inspect network traffic (no CDP) or record response bodies (CDP) |
| `wait_for_response` | read | Wait until a matching request completes |

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

## screenshot

Capture the page as an image a vision-capable agent can *see* — returned as an image plus `{ width, height, format, bytes }`.

```jsonc
screenshot { }                     // visible viewport — no CDP, no fingerprint
screenshot { "scroll": true }      // full page, scroll-and-stitch — no CDP, loads lazy content
screenshot { "fullPage": true }    // full page, one CDP shot — exact
screenshot { "selector": "table" } // one element — CDP clip
// → image + { width, height, format, bytes }
```

- **Default (viewport)** and **`scroll: true`** leave **no CDP fingerprint**; `fullPage: true` and `selector` use CDP.
- **Two ways to a long screenshot:** `scroll` stitches viewport slices — it forces lazy content to load, but repeats any `position: fixed`/sticky header — while `fullPage` renders the whole page in one shot: exact, no duplication, but it can miss lazy content.
- JPEG and downscaled by default to keep vision-token cost down; pass `format: "png"` or `quality` to override.

## extract

Turn the page into structured JSON — declaratively, no code, **no CDP**. Give a `fields` map (name → selector, or `{ selector, attr, html }`); add a `container` to get one record per matching element.

```jsonc
// one record from the page
extract {
  "fields": { "title": "h1", "price": "[itemprop=price]", "img": { "selector": "img", "attr": "src" } }
}
// → { record: { title, price, img } }

// a whole listing — one record per card
extract {
  "container": ".product-card",
  "fields": { "name": ".title", "url": { "selector": "a", "attr": "href" } }
}
// → { records: [ … ], count }
```

- A field is a **selector** (its trimmed text) or **`{ selector, attr, html }`**. `href`/`src` attributes come back **absolute**.
- Prefer `extract` over `run_js` to pull data — it's declarative *and* fingerprint-free.

## extract_links

Harvest links for the **list → detail crawl** — absolute, deduped URLs.

```jsonc
extract_links { "within": ".results", "pattern": "/products/", "limit": 50 }
// → { links: ["https://…/products/abc", … ], count }
```

- `pattern` is a substring the URL must contain, `within` scopes to a container, `selector` defaults to `a[href]`, `limit` caps the count.

## capture_requests

The data you want is often in the **JSON the page already fetched** (past Cloudflare) — grab it instead of scraping the DOM.

```jsonc
// recent request metadata — no CDP (URLs, status, headers, timing, errors)
capture_requests { "status": ">=400" }    // what failed
capture_requests { "pattern": "/api/" }   // what it fetched

// grab a response BODY — a short CDP recording:
capture_requests { "record": true, "pattern": "/api/" }   // start
//   …navigate / click the thing that fires the request…
capture_requests { "stop": true }          // → { requests: [ { url, status, body, … } ] }
```

- **Metadata is no-CDP** (a rolling `webRequest` buffer); **bodies need the CDP recording window** (`record` → act → `stop`).
- Filter by `pattern`, `status` (`"failed"` / `200` / `">=400"`), `resourceTypes` (default xhr/fetch — a status query widens to all), `methods`, `limit`, `maxBodyBytes`.

## wait_for_response

Block until a request whose URL contains `pattern` completes — a smarter "is the data here yet?" than `wait_for_selector` for API-driven pages. No CDP.

```jsonc
wait_for_response { "pattern": "/api/results", "timeoutMs": 15000 }
// → { matched, url, status, method, waitedMs }
```

## Management

Two tools act on the **daemon** itself rather than the page, so an agent — or you — can recover a stuck, stale, or outdated browser without restarting your MCP host.

| Tool | Use it to… | Returns |
|---|---|---|
| `status` | Check daemon health — proxy vs daemon version, whether the daemon is **outdated**, browser connected, control reachable | `{ proxyVersion, controlReachable, daemon, outdated }` |
| `restart` | Bounce the daemon — stop it (even a stale-pid or outdated one), start a fresh one, and reconnect | `{ restarted, daemon }` |

```jsonc
status  {}
// → { proxyVersion, controlReachable, daemon, outdated }

restart {}
// → { restarted: true, daemon }
```

If a browser tool fails with `NO_BROWSER`, `NOT_CONNECTED`, `CONNECTION_LOST`, or a timeout, call `restart` and retry once — the error text says so. A dropped connection reconnects on its own; `restart` is for a daemon that's wedged or an **older version** than the one you just installed. See **[Recovering a stuck browser](/docs/recovery/)**.

## Reads vs. interactions

Reads (`navigate`, `get_html`, `wait_for_selector`, `extract`, `extract_links`, `wait_for_response`, `capture_requests` metadata, and `screenshot`'s viewport and `scroll` modes) leave **no automation fingerprint** — they use tab and content-script APIs only. The interaction tools (`run_js`, `click`, `type`, `scroll` in `gesture` mode, `screenshot`'s `fullPage`/`selector` modes, and `capture_requests`'s body-recording session) attach `chrome.debugger`, which shows Chrome's "started debugging this browser" infobar during the call and is a small detection surface.

**Prefer reads; escalate to interactions only when you must.** See [Cloudflare & stealth](/docs/cloudflare/) for fingerprint discipline.
