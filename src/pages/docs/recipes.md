---
layout: ../../layouts/Docs.astro
title: Recipes
kicker: guides
description: Worked extractions — a Cloudflare-protected list-to-detail crawl, forms, robust selectors, and the gotchas that bite everyone once.
---

Real patterns, end to end. Each assumes the [golden path](/docs/skill/#the-golden-path): `navigate → wait_for_selector → extract`.

## List → detail, through Cloudflare

The session behind the homepage terminal: pull a ranked product list off a Cloudflare-gated G2 category, then walk each product's detail page for a precise rating and review count. One browser, one persistent session.

**1 — Navigate and settle.** `navigate` waits out the Cloudflare challenge and reports `settled`.

```jsonc
navigate { "url": "https://www.g2.com/categories/mortgage-crm" }
```

**2 — Wait for real content.** The cards render asynchronously.

```jsonc
wait_for_selector { "selector": ".product-card" }
```

**3 — Extract the ranked list.** Prefer stable data over visual classes. G2 hides a rounded rating in a `stars-N` class (N = rating × 2) and product metadata in a `data-event-options` JSON blob:

```js
Array.from(document.querySelectorAll('.product-card')).map((card, i) => {
  const link = card.querySelector('a[href*="/products/"]');
  const stars = card.querySelector('[class*="stars-"]');
  const n = stars ? (stars.className.match(/stars-(\d+)/) || [])[1] : null;
  return {
    rank: i + 1,
    name: link?.getAttribute('title')?.trim(),
    href: link?.getAttribute('href'),
    cardRating: n ? Number(n) / 2 : null,
  };
});
```

**4 — Walk detail pages in the same session.** For each product URL, `navigate` in, wait for the microdata, and pull the precise numbers:

```js
// on each detail page — schema.org microdata is stabler than visible text
const content = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
({
  ratingValue: parseFloat(content('[itemprop="ratingValue"]')),
  reviewCount: parseInt((content('[itemprop="reviewCount"]') || '').replace(/,/g, ''), 10),
});
```

Detail pages often hold fields the list omits — full review counts, pricing, precise ratings. The browser persists across calls, so this is all one session.

## Pick robust selectors

Visual class names change; structured data doesn't. Prefer, in order:

1. `<script type="application/ld+json">` — parse the JSON.
2. `[itemprop="…"]` microdata.
3. `data-*` attributes.
4. Stable ids.
5. …then fall back to classes.

## Forms

`navigate` → `wait_for_selector` for the field → `type` → `click` the submit → `wait_for_selector` for the result → extract. `click` and `type` are trusted, so they pass most JS handlers.

```jsonc
type  { "selector": "input[name=q]", "text": "mortgage crm" }
click { "selector": "button[type=submit]" }
wait_for_selector { "selector": ".results" }
```

## Lazy-loaded & infinite feeds

Scroll to trigger loading, then re-extract. Repeat until the count stops growing.

```jsonc
scroll { "y": 2000 }
wait_for_selector { "selector": ".item:nth-child(40)" }
```

## The `__name` gotcha

`run_js` returns values **by value** — they must be JSON-serializable. You can't return a DOM node; return `.textContent`, `.outerHTML`, or plain objects.

And if you build a `run_js` expression by stringifying a **compiled** function (TypeScript / esbuild / tsx), the compiler may inject a `__name` helper reference that doesn't exist in the page — you'll get `ReferenceError: __name is not defined`. Either write the expression as plain JS, or prepend the shim:

```js
(() => { const __name = (f) => f; return (/* your compiled fn */)(); })()
```

## Gotchas checklist

- **Navigate first**, or you get `NO_TAB`.
- **Wait for async content** before extracting — skeletons are the usual failure.
- **`run_js` returns JSON only** — no DOM nodes.
- **Large pages truncate** at ~32 MB (`get_html` sets `truncated: true`).
- **A visible Chrome window opens** — that's expected, not a bug.
- **Interactive Turnstile needs a human** — see [Cloudflare & stealth](/docs/cloudflare/#the-hard-boundary-interactive-turnstile).
