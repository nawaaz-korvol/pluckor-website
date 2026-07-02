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
plk status         # is it running? is the control channel up?
plk logs --tail    # follow the daemon log
plk stop           # close the browser and stop the daemon
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
