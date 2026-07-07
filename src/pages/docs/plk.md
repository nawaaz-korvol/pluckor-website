---
layout: ../../layouts/Docs.astro
title: The plk CLI
kicker: reference
description: A warm, shared browser. The plk daemon keeps Chrome alive between sessions so you can log in once and let every agent reuse it.
---

Under the hood there are two pieces: a **daemon** that owns the browser, and the **MCP server** the agent connects to. The daemon means the browser stays warm between sessions, multiple agents can share it, and you can log into sites and watch what's happening.

`pluckor` and `plk` are the same CLI — `pluckor mcp` ≡ `plk mcp`.

## Commands

```bash
plk start          # launch the browser daemon in the background
plk start --tail   # …and follow its logs live
plk status         # running? reachable? which version? browser connected?
plk logs --tail    # follow the daemon log
plk stop           # close the browser and stop the daemon
plk restart        # stop then start — recovers a stale or outdated daemon
plk mcp            # the MCP server the agent spawns (auto-starts the daemon)
```

## You don't have to run `plk start`

`plk mcp` auto-starts the daemon on first use, so an agent can just call tools and everything comes up. But starting it yourself unlocks four things:

- **Log in once.** Run `plk start`, log into the sites you care about in the window that opens; every agent session reuses those sessions.
- **Keep it warm.** No relaunch between agent sessions.
- **Share it.** Multiple concurrent MCP sessions drive the same browser.
- **Watch it.** `plk logs --tail` shows every navigation and tool call.

## The login-once flow

The cleanest way to extract from sites behind a login:

1. `plk start` — a real Chrome window opens.
2. Log into the target site by hand, like a person.
3. Point your agent at Pluckor and extract. The cookies persist in `~/.pluckor-bridge/profile`, so every later session inherits the login.

> The profile persists across runs — cookies and logins survive. See [Configuration](/docs/configuration/) to relocate or reset it.

## One browser per machine

The daemon runs a **single** browser on a fixed local port. Concurrent agent sessions share it — they don't each launch their own. Everything binds to `127.0.0.1`; the browser is never exposed off-box. See [How it works](/docs/how-it-works/) for the full topology.

## Recovering a stale or outdated daemon

Because the daemon is long-lived, it can outlast the tools that talk to it — most often after you **upgrade Pluckor**, when a fresh `npx pluckor mcp` finds an older daemon still running. It can also wedge or lose its browser. The tells: `plk status` shows `OUTDATED`, or a `daemon: stopped · control: reachable` line (a stale pid file while a daemon still holds the port), or browser tools fail with `NO_BROWSER` / `NOT_CONNECTED`.

```bash
plk status    # daemon: running (pid …) · control: reachable · v0.3.0 · browser: connected
plk restart   # stop the real daemon — even with a stale pid or old version — and start fresh
```

`plk restart` is a robust `plk stop` followed by a fresh start. Both treat the **control port**, not the pid file, as the source of truth, so they stop the *real* daemon even behind a stale pid (fixed in 0.3.0); what `restart` adds is starting a clean daemon afterward — which is what actually recovers an outdated or wedged one. The same bounce is exposed as the [`restart` MCP tool](/docs/tools/#management), so an agent can recover itself; see [Recovering a stuck browser](/docs/recovery/).

> Because the browser is shared, `restart` bounces it for **every** session on the machine.
