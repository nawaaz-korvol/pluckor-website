---
layout: ../../layouts/Docs.astro
title: How it works
kicker: concepts
description: Brain, medium, hands — the agent decides, the bridge carries the message, a real Chrome does the reaching. And why that beats headless.
---

Pluckor is three parts in one loop: the **agent** (brain), the **bridge** (medium), and a **real Chrome** (hands).

```text
agent  ── MCP/stdio ──▶  plk mcp (proxy)
                              │  WebSocket (control · :9235)
                              ▼
                      plk daemon ──▶ Chrome for Testing + Pluckor extension
                          │                      │
                          │  WebSocket (:9234)   │ content script (reads, no CDP)
                          └────────────────────▶ │ chrome.debugger (run_js/click/type)
                                                 ▼
                                            the live page
```

The agent calls a tool → the proxy forwards it to the daemon → the daemon drives the extension → the extension acts on the page and sends the result back the same way. Everything binds to `127.0.0.1`; the browser is never exposed off-box.

## Reads vs. interactions

This split is the heart of Pluckor's stealth:

- **Reads** — `navigate`, `get_html`, `get_markdown`, `wait_for_selector`, `snapshot`, `extract`, `extract_links`, `wait_for_response`, `capture_console`, `select_option`, `go_back`, `go_forward`, `reload`, `get_cookies`, `set_cookie`, `get_local_storage`, `set_local_storage`, `capture_requests` (metadata) — run through `chrome.tabs`, `chrome.webRequest`, and a content script. **No CDP. No `navigator.webdriver`.** There is essentially no automation fingerprint on a read.
- **Interactions** — `run_js`, `click`, `type`, `press_key`, `hover`, `wait_for_function`, `scroll` (gesture) — attach `chrome.debugger` (CDP) **only while they run**, then detach. Clicks and typing are trusted (`isTrusted = true`), so JS handlers accept them.
- **`screenshot`** captures the page as an image and spans both — its default viewport and `scroll` (stitched) modes stay no-CDP; `fullPage` and element capture use CDP.

Prefer reads; escalate to interactions only when you must. On the most aggressively-monitored targets, favor `get_html` + parse over `run_js`.

## Why Chrome for Testing, not your everyday Chrome

- Chrome 137+ **removed the `--load-extension` flag** in branded Chrome, so the bridge can't auto-load an unpacked extension into the Chrome in your dock. Chrome for Testing is the same Chromium engine with the flag intact.
- It's **fingerprint-identical** to normal Chrome in headful mode — same user agent, same rendering stack. Detectability comes from *how* a browser is driven (CDP, automation flags, a throwaway profile), not from the binary. Pluckor launches Chrome for Testing with **no** automation flags and drives reads from inside the browser.

## Why not headless?

Headless works technically — but the user agent becomes `HeadlessChrome/…`, which is the single clearest bot-detection tell. Running headless to beat Cloudflare or DataDome is self-defeating. The differentiated thing is precisely the **local, headful, real browser** — a window that opens on your machine, with your profile and your residential IP.

## Everything is local

The daemon runs a single browser on fixed local ports (`:9234`, `:9235`), both bound to `127.0.0.1`. Concurrent agent sessions share the one browser rather than each launching their own. Nothing is reachable from another machine.

## Recovering the daemon

Because the daemon is long-lived and shared, it can outlast an upgrade or wedge. A dropped control socket reconnects on its own; a stale or **outdated** daemon is replaced with a single `restart` — from the [CLI](/docs/plk/#recovering-a-stale-or-outdated-daemon) or the [`restart` tool](/docs/tools/#management). See [Recovering a stuck browser](/docs/recovery/).
