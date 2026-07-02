---
layout: ../../layouts/Docs.astro
title: Configuration
kicker: reference
description: Environment variables, the persistent profile, and the local ports Pluckor binds.
---

Pluckor works with zero configuration. Two environment variables let you relocate its files if you need to.

## Environment variables

| Env var | Default | Purpose |
|---|---|---|
| `PLUCKOR_HOME` | `~/.pluckor-bridge` | Persistent Chrome profile **and** the Chrome for Testing download cache. |
| `PLUCKOR_EXTENSION_DIST` | *(bundled)* | Override the extension directory. Advanced — the extension ships inside the package. |

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

The first tool call downloads **Chrome for Testing** (~150 MB) into `<PLUCKOR_HOME>`. Later runs reuse it with no network round-trip. If a cached build exists, Pluckor uses it as-is — it won't reach out to check for a newer one on every launch.

## Ports & network posture

The daemon and MCP proxy communicate over WebSockets bound to `127.0.0.1` only:

- **9234** — the bridge server the extension dials into.
- **9235** — the control channel the MCP proxy connects to.

Nothing binds to a public interface. The browser is never reachable off-box. See [How it works](/docs/how-it-works/) for the full picture.
