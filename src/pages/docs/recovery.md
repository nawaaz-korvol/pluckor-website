---
layout: ../../layouts/Docs.astro
title: Recovering a stuck browser
kicker: reference
description: When the daemon goes stale, outdated, or its browser dies, one restart brings it back — and the agent knows to do it.
---

The browser lives in a long-running **daemon** that's shared across sessions. It can go bad: it may be an **older version** than your tools after an upgrade, it may be wedged, or its browser may have died. Pluckor recovers instead of getting stuck — a dropped connection reconnects on its own, and a single `restart` replaces a stale or outdated daemon.

## The signal

A browser tool fails with one of `NO_BROWSER`, `NOT_CONNECTED`, `CONNECTION_LOST`, `TIMEOUT`, or `NAV_TIMEOUT`. The error text itself tells the agent to call `restart` and retry — so an agent following [the skill](/docs/skill/) recovers on its own instead of burning turns.

## The move

1. Call **`restart`** — it bounces the daemon: stops the running one (even if its pid file is stale or it's an older version), starts a fresh one, and reconnects.
2. **Retry** the tool that failed, once.

Optionally call **`status`** first to confirm the diagnosis — `outdated: true`, or `daemon: null` / `controlReachable: false`.

```jsonc
status  {}
// → { proxyVersion, controlReachable, daemon: { version, extensionConnected, … }, outdated }

restart {}
// → { restarted: true, daemon: { version, extensionConnected, … } }
```

## What heals on its own vs. what needs a restart

- **A dropped control socket → auto-reconnects** on the next tool call. Nothing to do.
- **A still-running-but-stale or outdated daemon → an explicit `restart`.** Because the browser is **shared** across every session on the machine, Pluckor won't silently bounce it — you (or the agent) ask for it.

## One restart is the whole fix

`restart` + one retry is the entire recovery. If it *still* fails after that, the problem is the page or target — not the daemon — so stop and diagnose rather than restart-looping.

## From the command line

The same recovery is available in the [`plk` CLI](/docs/plk/#recovering-a-stale-or-outdated-daemon):

```bash
plk status    # daemon: running (pid …) · control: reachable · v0.3.0 · browser: connected
plk restart   # stop the real daemon — even with a stale pid or old version — and start fresh
```

`plk status` flags an `OUTDATED` daemon and a `daemon: stopped · control: reachable` line — a stale pid file while a daemon still holds the control port, the classic stuck state. Both `plk stop` and `plk restart` treat the control port, not the pid file, as the source of truth, so they stop even that stale-pid daemon (fixed in 0.3.0); `restart` then starts a fresh one.
