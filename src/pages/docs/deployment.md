---
layout: ../../layouts/Docs.astro
title: Deployment
kicker: reference
description: Run Pluckor on a server or in a container — headful under Xvfb — and drive it from an agent elsewhere over an authenticated control channel.
---

Pluckor runs a **real, headful Chrome** — never headless (headless has a detectable fingerprint, which defeats the point). By default the browser and the agent's `plk mcp` proxy share one machine over `127.0.0.1`. You can also run the browser **as a service**: put it on a server or in a container and drive it from an agent running elsewhere.

## Why run it as a service

- **Browser-as-a-service.** One warm, logged-in, always-on browser — or a pool — that many agents attach to. No Chrome install per agent, no ~150 MB re-download, no cold start, no re-clearing Cloudflare each run. With [lanes and instances](/docs/tools/#multiple-tabs), one host serves many isolated agents.
- **Decouple *where the agent runs* from *where the browsing happens*.** The agent can be a CI job, a serverless function, or a laptop; the browser runs on a box you chose — so page requests originate from **that** box's IP, region, and network. For a tool built to look like a real browser on a real IP, being able to *place* that IP is the point.
- **Centralized login.** The profile keeps cookies and logins. Log in once on the server (including painful 2FA / SSO), and every agent reuses that authenticated session — no agent ever handles credentials.
- **Isolation.** The browser touches untrusted web content and runs CDP; sandbox it in a container, reachable only over an authenticated port.
- **Scale & orchestration.** Run browser containers as pods, scale the fleet independently of the agents, spin ephemeral ones up in CI and tear them down. The "browser pool" pattern — with Pluckor's no-CDP-on-reads [moat](/docs/cloudflare/) that headless grids don't have.

If you just run an agent on your laptop, you need none of this — the default (loopback, no token) is simpler and unchanged.

## Headless Linux & containers

Pluckor's headful Chrome needs a display. On a server or container with no screen, give it a **virtual display (Xvfb)** and keep Chrome headful:

```bash
Xvfb :99 -screen 0 1920x1080x24 & export DISPLAY=:99
```

- **`PLUCKOR_CHROME_FLAGS`** — append host-specific Chrome flags. In a container you'll want `--no-sandbox --disable-dev-shm-usage`.
- **Build for `linux/amd64`.** On Linux, Chrome for Testing is amd64-only — there is no arm64 build — so on Apple Silicon / arm hosts build and run the image with `--platform linux/amd64`.
- Install Chrome's shared libraries (`libnss3`, `libgbm1`, `libatk-bridge2.0-0`, fonts, …) and `unzip`.

A ready-to-adapt **Dockerfile** and entrypoint live in the repo under [`apps/bridge/examples/docker/`](https://github.com/pluckor/pluckor/tree/main/apps/bridge/examples/docker). Verified end-to-end: headful Chrome under Xvfb drives a page inside the container.

## Driving it from outside the container

By default the control channel is `127.0.0.1`-only, so the daemon + browser and the `plk mcp` proxy must share one loopback. To keep the **browser in the container** and drive it from an agent **on the host** (or another machine), expose the control port **with a token**:

| Env var | Side | Purpose |
|---|---|---|
| `PLUCKOR_CONTROL_BIND` | daemon | Bind address of the control server (default `127.0.0.1`). Set `0.0.0.0` to expose. |
| `PLUCKOR_CONTROL_TOKEN` | both | Control-channel auth. **Required** once exposed — the daemon refuses to start off-loopback without it. |
| `PLUCKOR_CONTROL_HOST` | client | Address the proxy dials (default `127.0.0.1` — the published port; or a remote host / IP). |
| `PLUCKOR_ATTACH` | client | Attach to an already-running daemon without spawning a local one (auto-on when `PLUCKOR_CONTROL_HOST` is remote). |

In the container — start the daemon inside (entrypoint runs Xvfb, then `plk start`) and publish the control port to the host's loopback:

```bash
docker run -d --platform linux/amd64 \
  -e PLUCKOR_CONTROL_BIND=0.0.0.0 \
  -e PLUCKOR_CONTROL_TOKEN="a-strong-secret" \
  -p 127.0.0.1:9235:9235 \
  my-pluckor
```

On the host (or wherever the agent runs), point the MCP server at it:

```jsonc
{
  "mcpServers": {
    "pluckor": {
      "command": "pluckor", "args": ["mcp"],
      "env": {
        "PLUCKOR_CONTROL_HOST": "127.0.0.1",
        "PLUCKOR_CONTROL_TOKEN": "a-strong-secret",
        "PLUCKOR_ATTACH": "1"
      }
    }
  }
}
```

The agent always drives the page from *outside* it (tool calls, never code in the page). This just lets the whole Pluckor unit live in a container while the agent runs elsewhere.

## Security

The control channel is the steering wheel of the browser, so treat it like one:

- **A token is mandatory off loopback.** With `PLUCKOR_CONTROL_BIND` set to anything non-loopback, the daemon **refuses to start** unless `PLUCKOR_CONTROL_TOKEN` is set. Unauthenticated and wrong-token connections are rejected.
- **Don't put the raw port on the public internet.** Publish it to the host's loopback (`-p 127.0.0.1:9235:9235`), keep it on a trusted network, or tunnel it (SSH / WireGuard). The token is the gate, not a substitute for network hygiene.
- **On a Linux host, `--network host`** shares the host's loopback with the container, so you can keep the daemon loopback-bound (no exposed port, no token) and the host proxy still reaches it.

See [Configuration](/docs/configuration/) for the full env-var reference and [How it works](/docs/how-it-works/) for the control channel in context.
