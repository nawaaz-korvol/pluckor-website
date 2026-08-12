---
layout: ../../layouts/Docs.astro
title: Driving it from code
kicker: reference
description: The same browser tools, without MCP. plk call for one shot, plk pipe for a persistent NDJSON session — for a Python orchestrator, a job runner, or any program that isn't an agent.
---

MCP is for agents. When the caller is a **program** — a Python orchestrator, a scheduled job, a shell script — two CLI commands give it the same tools, over the same daemon, in the same warm, logged-in browser.

```bash
plk call <tool> '<json-args>'   # one shot: the result as JSON on stdout
plk pipe                        # a persistent NDJSON session on stdin/stdout
```

Both auto-start the daemon exactly like `plk mcp`, and both resolve tools through the **same registry** the MCP proxy uses, with the same schemas, the same `tab` and `timeoutMs` params, and the same typed errors. A tool that exists for an agent exists here. There is no second tool surface to drift.

> **stdout is the machine channel.** It carries results and nothing else — every log, warning, and diagnostic goes to stderr. You can pipe stdout straight into a JSON parser.

## `plk call` — one shot

```bash
plk call navigate '{"url":"https://example.com"}'
plk call extract  '{"container":".product","fields":{"name":"h2","price":".price"}}'
plk call list_tabs
```

stdout is a single JSON document — the tool's result, verbatim:

```json
{"url":"https://example.com","finalUrl":"https://example.com/","settled":true,"onChallenge":false}
```

Exit code `0` on success. On failure, exit `1` and stdout carries a machine-readable envelope (stderr gets the human-readable line):

```json
{"ok":false,"error":{"code":"SELECTOR_NOT_FOUND","message":"no element matches #gone","retryable":true}}
```

Branch on **`error.code`**, never on the message text: `NO_TAB`, `TIMEOUT`, `NAV_TIMEOUT`, `NOT_CONNECTED`, `NO_BROWSER`, `SELECTOR_NOT_FOUND`, `UNKNOWN_COMMAND`, `BAD_MESSAGE`, and the rest of the [error codes](/docs/recovery/). `retryable` tells you whether a retry is worth attempting. A wrong tool name comes back as `UNKNOWN_COMMAND` with the real names in `error.detail.knownTools`.

### Quoting on Windows

PowerShell takes the single-quoted form above. `cmd.exe` has no single quotes — escape the inner ones:

```bat
plk call navigate "{\"url\":\"https://example.com\"}"
```

A caller that spawns the process with an **argv array** (Python's `subprocess` with a list, Node's `execFile`) has no quoting problem on any platform, and is what you should use from code.

## `plk pipe` — a persistent session

`call` opens a daemon connection per invocation, and each invocation gets a fresh [lane](/docs/tools/#multiple-tabs) — so a fresh default tab, with none of the previous call's page state. `pipe` keeps **one session open**: one JSON request per line in, one JSON response per line out, with the connection, its tabs, and their logged-in state alive until stdin closes.

This is the mode to build an orchestrator on.

```jsonc
// stdin — one request per line
{"id":1,"tool":"open_tab","args":{"url":"https://example.com/list"}}
{"id":2,"tool":"extract","args":{"tab":"t2","container":".row","fields":{"title":"h2"}}}
```

```jsonc
// stdout — one response per line
{"id":1,"ok":true,"result":{"tab":"t2","finalUrl":"https://example.com/list","settled":true}}
{"id":2,"ok":true,"result":{"records":[{"title":"…"}]}}
```

A failure is the same envelope, per request — the session carries on:

```json
{"id":2,"ok":false,"error":{"code":"NO_TAB","message":"tab t2 was closed — open_tab or navigate again","retryable":true}}
```

### The rules that make it safe to lean on

- **Requests are not serialized.** They are dispatched as they arrive. Ten tabs can be navigating and extracting **at once** through one session — see [Concurrency](#concurrency) below.
- **Responses arrive in completion order.** Correlate by `id`. Never by position.
- **A malformed line costs that line, not the session.** It gets one `{"id":null,"ok":false,"error":{"code":"BAD_MESSAGE",…}}` and the session keeps going. Blank lines are ignored.
- **In-flight calls are drained** when stdin closes, so a response is never lost to a race with shutdown.
- **One session is one lane.** Every request in the session shares one default tab, so `open_tab` first and pass that `tab` handle on every call rather than relying on the default. This is the same [tab-ownership discipline](/docs/tools/#multiple-tabs) that applies to agents.

### An orchestrator, in Python

```python
import json, subprocess

proc = subprocess.Popen(
    ["plk", "pipe"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE,
    text=True, bufsize=1,
)

def send(req_id, tool, args):
    proc.stdin.write(json.dumps({"id": req_id, "tool": tool, "args": args}) + "\n")

# fire several requests, then read responses as they complete
send(1, "open_tab", {"url": "https://example.com/a"})
send(2, "open_tab", {"url": "https://example.com/b"})

pending = {1, 2}
while pending:
    resp = json.loads(proc.stdout.readline())
    pending.discard(resp["id"])          # correlate by id, not by order
    if not resp["ok"]:
        print("failed:", resp["error"]["code"], resp["error"]["message"])

proc.stdin.close()
```

Read stdout on its own thread (or with `asyncio`) if you want to keep firing requests while earlier ones are still running — which is the whole point of the mode.

## Concurrency

**There is no global lock and no queue.** The daemon handles each control call independently, the control channel correlates by id, and the extension dispatches per command — so parallel work across tabs really is parallel.

Measured through one `plk pipe` session, ten tabs:

| Operation | Wall time | Sum of durations | Speed-up |
|---|---|---|---|
| 10 × `navigate` | 15.8 s | 157 s | **9.9×** |
| 10 × `extract` | 14 ms | 135 ms | **9.6×** |
| 10 × `get_markdown` | 21 ms | 179 ms | **8.5×** |

Ten parallel navigations finish in the wall time of **one**. Fan out per tab and let the responses land as they will.

Two things to know before you fan out:

- **Give every parallel worker its own tab.** Open it with `open_tab` and pass the handle on every call. Two workers sharing a tab will navigate it out from under each other, silently.
- **Don't run two CDP tools on the *same* tab at once.** `run_js`, `click`, `type`, `press_key`, `hover`, `save_pdf`, and `fullPage`/element `screenshot` attach `chrome.debugger` for the duration of the call; two of them overlapping on one tab can have the first one's detach land while the second is still running. Across *different* tabs there is no interaction. Sequence CDP calls per tab; fan out across tabs.
- **The default viewport `screenshot` activates its tab** (it captures the visible tab), so parallel screenshots across tabs compete for window focus and effectively serialize. Everything else — including all the no-CDP reads — is genuinely parallel.

## Replaying a script, and resuming a halted one

The [scripting](/docs/scripting/) tools are callable here too — for most orchestrators `run_script` *is* the reason to open a session. Rather than reimplementing a workflow as your own step loop, replay a curated script and let its assertion contracts tell you when the page changed underneath you.

```jsonc
// stdin — replay, with credentials supplied at call time
{"id":1,"tool":"run_script","args":{"script":{"version":1,"steps":["…"]},"secrets":{"password":"…"}}}

// stdout — it halted at step 2, with the failing contract and a page snapshot
{"id":1,"ok":true,"result":{"outcome":"halted","haltedAt":2,"failure":{"…":"…"}}}
```

Patch the step the `failure` payload blames, then resume from exactly there — the **halt → patch → resume** loop:

```jsonc
{"id":2,"tool":"run_script","args":{"script":{"version":1,"steps":["…patched…"]},"from":2}}
{"id":2,"ok":true,"result":{"outcome":"completed","startedAt":2,"data":["…"]}}
```

- **Safe resume.** A mutating step (`click`, `type`, …) at the `from` boundary is **not** re-fired; its state contracts are re-checked instead. Resuming can't double-submit an order or a payment.
- **`secrets` fills `${SECRET:name}`** in step params, so credentials never live in the stored script. The values reach the page and nothing else — they appear in no result, no stdout line, and no stderr line, so a whole response is safe to log.
- **No overall time budget.** A script is many calls, so the per-call `timeoutMs + 15_000` rule doesn't apply to it: each *step* carries its own, exactly as under MCP. A long replay is never cut short by the front end.
- **`record_start` / `record_stop` need `pipe`, not `call`.** A draft accumulates across requests, so one-shot mode could only discard it, and returns a typed error saying so. Recording also assumes *sequential* requests — don't fan out while one is open.

The usual division of labour: an agent records and curates the script once, over MCP, where it can see the page; your program replays it forever. See [Scripting](/docs/scripting/) for how to author one — especially how to write contracts that fail *usefully*, which is what decides whether your orchestrator recovers unattended or has to wake someone.

## What isn't here

**Daemon management stays on the CLI it already had** — [`plk status`, `plk restart`, `plk logs`](/docs/plk/) — rather than being tools you call. If a run starts failing with `NOT_CONNECTED` or `NO_BROWSER`, shell out to `plk restart` and reconnect; see [Recovery](/docs/recovery/).
