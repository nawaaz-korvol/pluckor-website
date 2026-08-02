---
layout: ../../layouts/Docs.astro
title: Configuration
kicker: reference
description: Environment variables, the persistent profile, and the local ports Pluckor binds.
---

Pluckor works with zero configuration. Environment variables let you relocate its files, run multiple isolated instances, or change the ports it binds.

## Environment variables

| Env var | Default | Purpose |
|---|---|---|
| `PLUCKOR_INSTANCE` | *(none)* | Run a **separate, isolated instance** — its own browser, profile, logins, ports, and token. A name or number. See [Separate browsers](/docs/tools/#separate-browsers). |
| `PLUCKOR_HOME` | `~/.pluckor-bridge`<br>(`-<instance>` when set) | The instance's home: persistent Chrome profile, daemon pid/log, and auth token. |
| `PLUCKOR_WS_PORT` | `9234` (`+2N` per instance) | Override the bridge WebSocket port. |
| `PLUCKOR_CONTROL_PORT` | `9235` (`+2N` per instance) | Override the control-channel port. |
| `PLUCKOR_TOKEN` | *(auto)* | Override the localhost auth token. Non-default instances get their own random token so they can't cross-connect. |
| `PLUCKOR_CACHE_DIR` | `~/.pluckor-bridge/cache` | Chrome for Testing download cache — **shared** across instances, so a second instance doesn't re-download Chrome. |
| `PLUCKOR_EXTENSION_DIST` | *(bundled)* | Override the extension directory. Advanced — the extension ships inside the package. |
| `PLUCKOR_CHROME_FLAGS` | *(none)* | Extra Chrome flags appended at launch, e.g. `--no-sandbox --disable-dev-shm-usage` in a container. See [Deployment](/docs/deployment/). |
| `PLUCKOR_CONTROL_BIND` | `127.0.0.1` | Bind address of the daemon's control server; `0.0.0.0` to expose it (with a token). See [Deployment](/docs/deployment/). |
| `PLUCKOR_CONTROL_HOST` | `127.0.0.1` | Address the client/proxy dials to reach the daemon (a published port, or a remote host). |
| `PLUCKOR_CONTROL_TOKEN` | *(none)* | Auth token for the control channel; **required** when bound off-loopback. |
| `PLUCKOR_ATTACH` | *(off)* | Client attaches to an already-running daemon instead of spawning a local one. |
| `PLUCKOR_NO_FEEDBACK` | *(unset)* | Set to `1` to remove the optional [agent-feedback request](#agent-feedback). |

Set them in your MCP host config's `env` block, or export them before `plk start`:

```jsonc
{
  "mcpServers": {
    "pluckor": {
      "command": "npx",
      "args": ["-y", "pluckor", "mcp"],
      "env": { "PLUCKOR_HOME": "/data/pluckor" }
    }
  }
}
```

## The persistent profile

The Chrome profile lives at `<PLUCKOR_HOME>/profile`. Cookies and logins survive across runs — that's what makes the [login-once flow](/docs/plk/#the-login-once-flow) work. To start clean, stop the daemon and delete that directory.

## First run & the Chrome cache

The first tool call downloads **Chrome for Testing** (~150 MB) into the shared cache (`~/.pluckor-bridge/cache`, or `PLUCKOR_CACHE_DIR`). Later runs — and other instances — reuse it with no network round-trip. If a cached build exists, Pluckor uses it as-is; it won't reach out to check for a newer one on every launch.

## Ports & network posture

The daemon and MCP proxy communicate over WebSockets bound to `127.0.0.1` only:

- **9234** — the bridge server the extension dials into.
- **9235** — the control channel the MCP proxy connects to.

These are the **default instance's** ports. A named or numbered `PLUCKOR_INSTANCE` derives its own pair (an integer `N` → `+2N`; a name → a stable hash), or set `PLUCKOR_WS_PORT` / `PLUCKOR_CONTROL_PORT` explicitly. Nothing binds to a public interface — the browser is never reachable off-box. See [How it works](/docs/how-it-works/) for the full picture.

The control port can be deliberately exposed off-loopback with `PLUCKOR_CONTROL_BIND` plus a `PLUCKOR_CONTROL_TOKEN` to drive a containerized or remote browser — see [Deployment](/docs/deployment/).

## Agent feedback

Pluckor is driven by agents, so the ones best placed to notice that a tool is
buggy, confusingly named, or missing something are the agents using it — and they
have no way to tell us. At startup the MCP server therefore *invites* the agent to
open an issue at [pluckor-feedbacks](https://github.com/pluckor/pluckor-feedbacks)
when it hits a bug, an awkward edge, a docs gap, or wishes a capability existed.

It's a request, never a requirement. The wording explicitly ranks it below the
user's actual task, and tells the agent not to put credentials, personal data, or
scraped page content into an issue.

```bash
PLUCKOR_NO_FEEDBACK=1     # omit the request entirely
```

The request is sent as MCP server `instructions`, not baked into the skill — only
the server can read the environment, so the opt-out is real rather than advisory.
With the flag set, nothing about feedback reaches the agent at all.
