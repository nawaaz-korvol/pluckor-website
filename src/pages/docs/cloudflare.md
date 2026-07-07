---
layout: ../../layouts/Docs.astro
title: Cloudflare & stealth
kicker: concepts
description: How Pluckor gets through Cloudflare-style interstitials, how to tell a challenge from real content, and where the hard boundary is.
---

Most anti-bot walls are tuned to catch *how* automation drives a browser. Pluckor isn't driving a robot — it's a real browser on your machine, reading from the inside. That gets through most of it. Here's what to expect.

## Passive, managed & JS challenges

The "Just a moment…" interstitials — passive, managed, and JavaScript challenges — clear on their own in a real browser. `navigate` waits them out and returns `settled: true`. You usually don't have to do anything special beyond letting it settle.

## Telling a challenge from real content

If a read looks wrong — suspiciously small, or missing the content you expect — you may still be on the interstitial. Check for these tells:

- The page **title** is a challenge title, not the site's.
- A `#challenge-form` element is present.
- A script from `challenges.cloudflare.com/.../challenge-platform` is loaded.
- `window._cf_chl_opt` is defined.

If any are present, you're still on the bot-check. Give it a moment — `wait_for_selector` for an element that only exists on the real page — then re-read.

```jsonc
// after navigate, confirm you're past the wall before extracting
wait_for_selector { "selector": ".product-card", "timeoutMs": 12000 }
```

## The hard boundary: interactive Turnstile

The **interactive Turnstile** — the checkbox you physically click — is a hard boundary. A CDP-dispatched click can be detected, so don't try to bot through it — hand it to a human with [`wait_for_human`](/docs/tools/#wait_for_human). It focuses the window, fires a system notification, and shows an on-page banner with your `reason`, then **blocks until the challenge clears** (auto-detected) — a person clicks it once in the live window and the agent continues. No CDP.

The same tool clears a **login or 2FA** wall: pass `until` with a selector that only appears once the human is through (e.g. `wait_for_human { reason: "log in", until: "#dashboard" }`).

## Fingerprint discipline

Reads leave **no automation fingerprint** — they're content-script and tab APIs, no CDP. The interaction tools attach `chrome.debugger`, which shows Chrome's "started debugging this browser" infobar and is a small detection surface.

- **Prefer reads.** `navigate`, `get_html`, `wait_for_selector` are free of CDP.
- **Escalate only when you must interact.** `run_js`, `click`, `type` are worth it — just don't reach for them by default.
- **On the most aggressively-monitored targets, favor `get_html` + parse over `run_js`.** Same data, no debugger attach.

See [How it works](/docs/how-it-works/#reads-vs-interactions) for why this split exists.
