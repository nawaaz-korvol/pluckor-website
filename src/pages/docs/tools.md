---
layout: ../../layouts/Docs.astro
title: Tools
kicker: reference
description: The thirty-three browser tools Pluckor exposes — what each does, what it returns, when to reach for it — plus the status and restart management tools.
---

Pluckor exposes **thirty-three browser tools** — **reads** that run through a content script with no CDP and no automation fingerprint, and **interactions** that attach `chrome.debugger` only while they run (`screenshot` and `capture_requests` span both, by mode). Two more **management** tools — [`status` and `restart`](#management) — act on the daemon itself so an agent can recover a stuck browser.

Every tool also accepts an optional **`timeoutMs`** (milliseconds) to override its default time budget — raise it for a slow page or a long script, or lower it to fail fast. Every tool also takes an optional **`tab`** handle to target one of your open tabs (omit it for your default tab) — see [Multiple tabs](#multiple-tabs).

| Tool | Kind | Use it to… |
|---|---|---|
| `navigate` | read | Load a page and settle past interstitials |
| `get_html` | read | Read the rendered DOM, stealthily |
| `get_markdown` | read | Clean, token-efficient Markdown of the page's main content |
| `wait_for_selector` | read | Wait out async content |
| `snapshot` | read | Map the page's actionable elements as refs, to act without guessing selectors |
| `run_js` | CDP | Extract structured data / read computed state |
| `click` | CDP | Trusted click |
| `type` | CDP | Trusted text entry |
| `scroll` | CDP | Scroll for lazy-load / infinite feeds |
| `screenshot` | read/CDP | See the page as an image — viewport, a long shot, or an element |
| `extract` | read | Structured data from a field→selector map (+ `container` for a listing) |
| `extract_links` | read | Harvest deduped, absolute links for list→detail crawls |
| `capture_requests` | read/CDP | Inspect network traffic (no CDP) or record response bodies (CDP) |
| `wait_for_response` | read | Wait until a matching request completes |
| `wait_for_network_idle` | read | Block until the page's network goes quiet |
| `wait_for_human` | read | Hand off to a human for an interactive Turnstile, login, or 2FA (No CDP) |
| `capture_console` | read | Read the page's console output + uncaught errors |
| `press_key` | CDP | Press a key — Enter to submit, Escape, Tab, arrows, or a char |
| `select_option` | read | Choose an option in a native `<select>` |
| `hover` | CDP | Reveal menus / tooltips by hovering |
| `go_back` | read | Navigate back in history and wait for load |
| `go_forward` | read | Navigate forward in history and wait for load |
| `reload` | read | Reload the tab (optional `bypassCache`) and wait for load |
| `wait_for_function` | CDP | Poll a JS expression until it's truthy |
| `get_cookies` | read | Read cookies for the page |
| `set_cookie` | read | Set a cookie (persists in the profile) |
| `get_local_storage` | read | Read the page's localStorage |
| `set_local_storage` | read | Write a localStorage item |
| `download` | read | Download a URL to disk and get the file path |
| `save_pdf` | CDP | Render the current page to a PDF on disk |
| `open_tab` | read | Open a new tab and get a handle to drive it |
| `list_tabs` | read | List your open tabs (handle, url, title, which is default) |
| `close_tab` | read | Close one of your tabs by its handle |

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

## get_markdown

Clean, token-efficient Markdown of the page's **main content**. **No CDP, no fingerprint** — a content-script DOM walk. For *reading* an article, post, or doc, not for pulling fields (use `extract` / `get_html` for that).

```jsonc
get_markdown { }                          // the whole main-content root
get_markdown { "selector": ".article" }   // convert a specific subtree
get_markdown { "maxChars": 20000 }        // cap the output
// → { markdown, url, title, chars, truncated, root }
```

- **Auto-detects the main-content root** — `<article>` / `<main>` when present, else the densest block of text, skipping nav, aside, footer, and hidden chrome. The chosen root comes back as `root`.
- Serializes headings, paragraphs, lists, links, images, code, blockquotes, and tables to Markdown.
- Typically **~10× smaller than the raw HTML** for an article/post/doc — the token-efficient way to hand page prose to the agent.
- `selector` converts that subtree instead of auto-detecting; `maxChars` caps the output (sets `truncated: true` when it clips).

## wait_for_selector

Wait until a selector appears (optionally visible), or time out. Read-only — no CDP.

```jsonc
wait_for_selector { "selector": ".product-card", "timeoutMs": 12000, "visible": true }
// → { found, waitedMs }
```

Modern pages render content, ratings, and prices asynchronously *after* load. Wait for a selector that only exists once the real content is there, then extract.

## snapshot

Walk the DOM and return a compact, indented, ref-stamped map of the page's **actionable elements** — links, buttons, inputs, selects — with heading and landmark context. **No CDP, no fingerprint** (a content-script DOM walk). Act by `ref` instead of guessing a CSS selector.

```jsonc
snapshot { "selector": "form", "maxChars": 8000 }
// → { tree, count, url, title, truncated }
//
//   heading "Sign in"
//     [e3] textbox "Email"
//     [e4] textbox "Password"
//     [e7] button  "Sign in"
```

- Each actionable element is stamped `data-plk-ref="eN"`; feed that `ref` to `click` / `type` / `hover` / `press_key` / `select_option` in place of a `selector`.
- **Refs are re-minted on every snapshot.** After a navigation or a re-render an old ref goes stale — a gone ref means the page changed, so `snapshot` again.
- `selector` scopes the walk to a subtree; `maxChars` caps the returned tree (sets `truncated: true` when it clips).
- Cheaper and far more reliable than dumping `get_html` and guessing a selector. When you already have a robust selector (an id, `data-*`, microdata), a plain `selector` is still fine and skips the snapshot.

## run_js

Evaluate a JavaScript expression in the page and get its JSON value back. The convenient structured extractor. Uses CDP (shows the debugger infobar).

```jsonc
run_js { "expression": "document.title", "awaitPromise": true }
// → { value }
```

- The return value **must be JSON-serializable** — you can't return a DOM node. Return `.textContent`, `.outerHTML`, or plain objects.
- If you build the expression by stringifying a **compiled** function (TS/esbuild), prepend `const __name=(f)=>f;` — see [Recipes](/docs/recipes/#the-__name-gotcha).
- Pass `captureConsole: true` to also get the script's own `console.*` output and any thrown error — `{ value, logs, error }`.

## click

A trusted click (`isTrusted = true`) at an element's center. For buttons, links, and checkboxes. Target by CSS `selector` or a snapshot `ref`.

```jsonc
click { "selector": "button[type=submit]" }
// → { clicked }
```

## type

Trusted text entry that fires real input events — React and Vue see it. Replaces the field's contents unless `clear: false`. Target by CSS `selector` or a snapshot `ref`.

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

## wait_for_network_idle

Block until the page's network goes quiet — the "data has finished loading" wait for SPA/XHR pages when you don't know a specific request ([`wait_for_response`](#wait_for_response)) or element ([`wait_for_selector`](#wait_for_selector)) to wait on. No CDP — it reads the same passive `webRequest` buffer as `capture_requests`.

```jsonc
wait_for_network_idle { }                                  // quiet = 0 in-flight for 500ms
wait_for_network_idle { "idleMs": 1000, "threshold": 2, "timeoutMs": 20000 }
// → { idle, inFlight, waitedMs }
```

- Waits until no more than `threshold` requests are in flight (default `0`) for `idleMs` continuous milliseconds (default `500`), or gives up at `timeoutMs`.
- Long-poll, SSE, and socket requests older than 30s are ignored, so a persistent stream can't hold the page "busy" forever.
- Returns `{ idle, inFlight, waitedMs }` — `idle` is `false` when it timed out with requests still pending.

## wait_for_human

Hand the wheel to a person in the visible browser window for a wall the agent can't clear — an **interactive Cloudflare Turnstile** (the checkbox you physically click), a **login**, or a **2FA** step. Blocks until it resolves — a Cloudflare challenge clears (auto-detected) or an optional `until` CSS selector appears — or times out (default 3 min). **No CDP.**

```jsonc
wait_for_human { }                                             // interactive Turnstile — resolves when the challenge clears
wait_for_human { "reason": "log in to your account", "until": "#dashboard" }  // login / 2FA — resolves when the element appears
// → { resolved, reason, waitedMs, onChallenge }
```

- **Resolves on** either signal: a Cloudflare challenge clearing (auto-detected, the same probe `navigate` uses) **or** the `until` selector appearing. Pass `until` for a login / 2FA — a selector that only exists once the human is through (e.g. the dashboard element).
- **Alerts the human three ways** the moment it's called — it focuses and flashes the window, fires a system notification, and shows an on-page banner with your `reason`. All three clear on return.
- **No CDP.** Detection is a content-script poll (`chrome.scripting`); the alerts use `chrome.windows` and `chrome.notifications` — no `chrome.debugger`, no automation fingerprint.
- Returns `{ resolved, reason, waitedMs, onChallenge }` — `resolved` is `false` when it timed out before the human got through.

## capture_console

Read the page's own console output and uncaught errors — no CDP.

```jsonc
capture_console { }                  // everything logged since the page loaded
capture_console { "level": "error" } // just errors + uncaught exceptions
// → { entries: [ { level, text, t } ], count }
```

- Buffered by a content-script hook installed at page load — no CDP, no fingerprint (the page can see the hook).
- For a *specific script's* output, use `run_js` with `captureConsole: true` instead — it returns `{ value, logs, error }`.

## press_key

Press a key with a trusted keyboard event (CDP) — Enter to submit a search, Escape, Tab, arrows, or a single character. An optional CSS `selector` or snapshot `ref` focuses the target first.

```jsonc
press_key { "key": "Enter", "selector": "input[name=q]" }  // focus + submit
press_key { "key": "Escape" }                              // dismiss a modal
// → { pressed }
```

## select_option

Choose an option in a native `<select>` dropdown by value, label, or index — firing `input`/`change` so React and Vue register it. No CDP (`type` can't drive a native select). Target by CSS `selector` or a snapshot `ref`.

```jsonc
select_option { "selector": "#country", "label": "Germany" }
// → { selected, value, label }
```

## hover

Move the mouse over an element (CDP) to reveal dropdown menus, tooltips, or hover-lazy content. Target by CSS `selector` or a snapshot `ref`.

```jsonc
hover { "selector": ".menu-trigger" }
// → { hovered }
```

## go_back / go_forward / reload

Move through the tab's history or refresh — each waits for load and settles past interstitials. No CDP.

```jsonc
go_back { }                    // → { url, finalUrl, settled, onChallenge }
go_forward { }
reload { "bypassCache": true } // hard reload
```

## wait_for_function

Poll a JS expression until it's truthy (or time out) — for a condition a selector can't express.

```jsonc
wait_for_function { "expression": "window.dataReady === true", "timeoutMs": 10000 }
// → { satisfied, value, waitedMs }
```

## get_cookies / set_cookie

Read or set cookies for the current page (or an explicit `url`) — via the persistent profile, no CDP. Inspect a session or pull an auth cookie.

```jsonc
get_cookies { "name": "session" }              // → { cookies, count }
set_cookie { "name": "token", "value": "…" }   // → { set, name }
```

## get_local_storage / set_local_storage

Read or write the page origin's localStorage — no CDP.

```jsonc
get_local_storage { }                               // → { items, count }
set_local_storage { "key": "flag", "value": "1" }   // → { set, key }
```

## download

Download a URL straight to disk — the "Download CSV/PDF/export" button target, or a media file — and get the file path back. No CDP.

```jsonc
download { "url": "https://example.com/report.csv", "filename": "reports/q3.csv" }
// → { path, filename, url, mime, bytes }
```

- `filename` is a name (or subfolder path) **relative to the download folder** — absolute paths aren't allowed. The returned `path` is the file's actual location.
- Reach for it when the data you want is behind a download button rather than in the DOM.

## save_pdf

Render the **current page** to a PDF and save it to disk, returning the path (CDP). Navigate first.

```jsonc
save_pdf { "filename": "invoice.pdf", "landscape": false, "printBackground": true }
// → { path, filename, bytes }
```

- `filename` is **relative to the download folder** (no absolute paths); defaults to `page.pdf`.
- `landscape` and `printBackground` tune the render — turn on `printBackground` to keep background colors and images.

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

## Multiple tabs

The daemon owns **one shared browser**, but tabs are **isolated per connection**. Each `plk mcp` process is a **lane** with its own default tab — so **multiple agents** (or an orchestrator's subagents) share the one warm, logged-in browser without colliding. No setup; existing single-tab code just works, targeting your default tab.

A **single agent** can also drive several tabs at once: [`open_tab`](#open_tab--list_tabs--close_tab) returns a `tab` handle, and every tool accepts an optional **`tab`** to target that tab (omit it for your default). Handles and default tabs are **lane-scoped** — a connection only ever sees and drives its own tabs.

```jsonc
open_tab { "url": "https://example.com/list" }   // → { tab: "t2", url, finalUrl, settled, onChallenge, isLaneDefault }
extract  { "container": ".row", "fields": { … }, "tab": "t2" }
navigate { "url": "https://example.com/item/1", "tab": "t3" }
list_tabs {}                                      // → { tabs, count } — your tabs only
close_tab { "tab": "t2" }                          // → { closed, tab }
```

It's all **No CDP** — new tabs and the tab index are managed through `chrome.tabs`, no `chrome.debugger`. For fully separate *browsers* (different profiles/logins), run separate daemons; not needed for the shared-browser cases above.

### open_tab / list_tabs / close_tab

- **`open_tab { url? }`** — open a new tab (optionally loading `url`) and get a handle to drive it. → `{ tab, url, finalUrl, settled, onChallenge, isLaneDefault }`. No CDP.
- **`list_tabs`** — list your open tabs (handle, url, title, active, which is the lane default). → `{ tabs, count }`. Lane-scoped — you only see your own. No CDP.
- **`close_tab { tab }`** — close one of your tabs by its handle. → `{ closed, tab }`. No CDP.

## Reads vs. interactions

Reads (`navigate`, `get_html`, `get_markdown`, `wait_for_selector`, `snapshot`, `extract`, `extract_links`, `wait_for_response`, `wait_for_network_idle`, `wait_for_human`, `capture_console`, `select_option`, `go_back`, `go_forward`, `reload`, `get_cookies`, `set_cookie`, `get_local_storage`, `set_local_storage`, `download`, `open_tab`, `list_tabs`, `close_tab`, `capture_requests` metadata, and `screenshot`'s viewport and `scroll` modes) leave **no automation fingerprint** — they use tab and content-script APIs only. The interaction tools (`run_js`, `click`, `type`, `press_key`, `hover`, `wait_for_function`, `save_pdf`, `scroll` in `gesture` mode, `screenshot`'s `fullPage`/`selector` modes, and `capture_requests`'s body-recording session) attach `chrome.debugger`, which shows Chrome's "started debugging this browser" infobar during the call and is a small detection surface.

**Prefer reads; escalate to interactions only when you must.** See [Cloudflare & stealth](/docs/cloudflare/) for fingerprint discipline.
