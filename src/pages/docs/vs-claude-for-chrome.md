---
layout: ../../layouts/Docs.astro
title: Pluckor vs. Claude for Chrome
kicker: concepts
description: Claude for Chrome puts Claude inside your browser; Pluckor hands your agent its own separate, scraping-grade browser as an MCP tool. Complementary, not competitors.
---

Short version: **Claude for Chrome puts Claude inside _your_ browser. Pluckor hands _your agent_ its own separate browser as a tool.** One is an assistant experience in the browser you already use; the other is developer infrastructure — an MCP tool surface any agent programs against. They're complementary, not competitors.

## The differences that matter

| | Claude for Chrome | Pluckor |
|---|---|---|
| **Whose browser** | _Your_ everyday Chrome — your real profile, tabs, logins | A _separate, dedicated_ Chrome for Testing it launches and owns (its own persistent profile) |
| **What it is** | A Claude product feature — you pairing with Claude in your session | An open-source MCP server (npm) — a building block you wire into an agent |
| **Who drives it** | Claude, specifically | _Any_ MCP agent/model — Claude Code, Cursor, Codex, your own harness |
| **Primary job** | General browsing & task assistance on the sites you're using | Data extraction / automation — especially getting _through_ anti-bot |
| **Anti-bot posture** | Operates your real session; not built to evade site defenses | The whole moat: reads run via content-script/tab APIs with **no CDP, no automation fingerprint** — engineered to get past Cloudflare and headless/Playwright blockers |
| **Isolation & scale** | Your one browser | Separate profiles, isolated tabs/lanes, and fully separate _instances_ (`PLUCKOR_INSTANCE`) — fleets of agents, no collisions |
| **Where it runs / who owns it** | Anthropic-hosted product, in your daily browser | [Self-hosted](/docs/deployment/), `127.0.0.1`-only — you own the browser and the data |

## When to reach for which

- **Claude for Chrome** — "Help me _in my browser_": summarize what's on screen, fill this form in my logged-in session, drive a task across my open tabs. Human-in-the-loop, your real accounts.
- **Pluckor** — "Give my _agent_ a browser as a tool": scrape a Cloudflare-gated catalog, extract structured data at scale, run many agents against many sites in isolated sessions — programmatic, disposable, repeatable.

Two pieces of Pluckor's design carry most of this distinction. The [reads-vs-interactions split](/docs/how-it-works/#reads-vs-interactions) is why reads leave essentially no automation fingerprint — no CDP, no `navigator.webdriver` — which is what gets Pluckor past [Cloudflare and headless blockers](/docs/cloudflare/). And [separate instances](/docs/tools/#separate-browsers) plus [isolated tabs](/docs/tools/#multiple-tabs) are what let fleets of agents run side by side without colliding.

## The takeaway

They solve different problems. Claude for Chrome is about _you + Claude in your session_. Pluckor is about handing an autonomous agent a clean, scraping-grade browser it can drive over MCP — with the fingerprint discipline, structured-extraction tools, and multi-agent isolation a data/automation workload needs and a personal-assistant experience doesn't.

The soundbite: **"Claude for Chrome automates _your_ browsing; Pluckor is a browser your agent can automate."**
