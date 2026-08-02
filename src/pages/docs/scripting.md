---
layout: ../../layouts/Docs.astro
title: Scripting
kicker: reference
description: Replay a known workflow in one call — and know when it breaks. run_script, five layers of assertions, and a halt → fix → resume loop that hands the agent the yoke.
---

Once a workflow is *known*, an agent shouldn't re-derive it every time. **`run_script`** replays an ordered list of tool-call steps in **one call** — no model turn per step — and each step can carry an **effect contract** that says what it was supposed to cause.

Three tools make up the feature, and they sit alongside the [browser tools](/docs/tools/) rather than replacing them: a script step *is* an ordinary tool call.

| Tool | Use it to… |
|---|---|
| `run_script` | Replay a script in one call — with assertions, secrets, and resume-from-a-fault |
| `record_start` | Start capturing your live tool calls into a draft script |
| `record_stop` | Stop and get the draft back, with candidate assertions inferred from what changed |

## A script

A script is `{ version, name?, steps }`. Each step is a serialized tool call — `{ tool, params }` — plus optional `label`, `pre` guards, an `expect` effect contract, and `onError`.

```jsonc
{ "version": 1, "name": "login-and-extract", "steps": [
  { "tool": "navigate", "params": { "url": "https://example.com/login" },
    "expect": [ { "assert": "url", "path": "/login" } ] },

  { "tool": "type", "params": { "selector": "input[name=\"username\"]", "text": "${SECRET:user}" } },
  { "tool": "type", "params": { "selector": "input[name=\"password\"]", "text": "${SECRET:pass}" } },

  { "tool": "click", "params": { "selector": "button[type=submit]" }, "label": "submit login",
    "expect": [
      { "assert": "network",  "method": "POST", "url": "**/login", "status": 302 },
      { "assert": "url",      "pathEquals": "/" },
      { "assert": "selector", "selector": "a[href='/logout']", "state": "present" }
    ] },

  { "tool": "extract", "params": { "container": ".row", "fields": { "title": "h3" } },
    "expect": [ { "assert": "count", "selector": ".row", "min": 1 } ] }
] }
```

```jsonc
run_script { "script": { … }, "secrets": { "user": "…", "pass": "…" } }
```

**Credentials never live in the script.** Write `${SECRET:name}` in `params` and pass the values in `secrets` at call time; substitution happens in memory, so a saved script is safe to commit.

## Two channels, joined but never blended

The result keeps your **data** and the **verdicts** apart — a script that returns rows and a script that certifies a state transition are the same call, and neither contaminates the other.

```jsonc
{
  "outcome": "completed",          // or completed_with_warnings / completed_with_errors / halted
  "data":       [ { "i": 4, "tool": "extract", "result": { "records": [ … ], "count": 12 } } ],
  "assertions": [ { "i": 3, "phase": "expect", "assert": "network", "expected": …, "actual": …, "pass": true, "disposition": "halt" } ],
  "steps":      [ { "i": 0, "tool": "navigate", "ok": true, "ms": 812 }, … ]
}
```

- **`data`** — the results of value-producing steps (`extract`, `get_html`, `run_js`, `snapshot`, `capture_requests`, `get_*`, …).
- **`assertions`** — one verdict per check, with what was expected, what was actually observed, and the disposition.
- **`steps`** — a per-step trace: ok, timing, and any error.

## Assertions — five layers

An assertion picks the layer that is **the truth** for that step. Pick the strongest one that fits; one strong signal beats ten weak ones.

| `assert` | Checks | Fields |
|---|---|---|
| `network` | A request actually fired, and what the server said | `method`, `url` (glob), `status`, `settleMs`, `resourceTypes` |
| `url` | Where the page ended up | `path`, `pathEquals`, `hash`, `query`, `contains`, `equals` |
| `selector` | An element's presence | `selector`, `state`: `present` / `absent` / `visible` |
| `text` | What an element says | `selector`, `contains`, `equals`, `matches` |
| `count` | How many matched | `selector`, `min`, `max`, `equals` |

Put them on a step as **`pre`** (guards, checked *before* the action runs) or **`expect`** (the effect contract, checked *after*).

### Why `network` is the strongest signal

`network` is the **contract between client and server** — the layer where the state change actually happens. A DOM check only sees what the page chose to render, and pages lie: a checkout that renders a cheerful **"Success!"** over a `402` passes every selector and text assertion you can write. The `network` assertion sees the `402`.

```jsonc
{ "assert": "network", "method": "POST", "url": "**/checkout", "status": 200 }
```

Two practical notes, learned by running it:

- **Classic form logins are `POST → 302`, not `200`.** Assert the status that *actually* fires — record it rather than guessing.
- Correlation is "what fired *because of this step*" — the engine diffs the passive network buffer around the step. You just declare `{ method, url-glob, status }`.

### Dispositions — `onFail`

Every assertion carries an `onFail`:

| `onFail` | Meaning |
|---|---|
| `halt` | **Default.** A critical contract — stop the run and hand back a failure payload. |
| `warn` | Soft / best-effort. Record the miss and keep going. |
| `retry` | Flaky or timing-sensitive. **Re-check the effect** a few times (`retry: { max, delayMs }`) before escalating. |

`retry` is a *safe re-check*: it re-evaluates the assertion, it **never re-runs the step**. A flaky contract can't turn into a second click.

## The recovery loop — halt, fix, resume from the fault

A failed `halt` contract stops the run and hands back a **`failure` payload**: the failing contract plus a **page snapshot** (url, title, structure) captured at the point of divergence.

```jsonc
{
  "outcome": "halted",
  "haltedAt": 3,
  "failure": {
    "haltedAt": 3,
    "failedAssertion": { "i": 3, "phase": "expect", "assert": "network", "expected": { "status": 302 }, "actual": { "status": 401 } },
    "snapshot": { "url": "…", "title": "…", "treePreview": "…" }
  },
  "data": [ … ], "assertions": [ … ], "steps": [ … ]
}
```

That's a full situational packet, not an error string. The agent patches the offending step and calls:

```jsonc
run_script { "script": { …patched… }, "from": 3 }
```

`from` **resumes from the fault, not from the top.**

> This is a **safety** property before it is a speed one. The steps before the halt already ran, and their side effects are real — the session is set, the form was submitted. A rerun from step 0 re-fires them: double-login, double-submit, double-charge.

**The safe-resume rule the engine enforces:** a **mutating** step (`click`, `type`, `press_key`, `select_option`, `set_cookie`, `set_local_storage`) at the resume boundary is **never silently re-fired**. Its state contracts are re-checked instead, and if they still fail the run hands back to the agent — *you* decide whether the mutation must be redone. Read-only and idempotent steps (`navigate`, `wait_*`, `extract`, `get_*`) re-run fine.

Autopilot handles the cruise. When the weather turns, it hands the agent the yoke — with every instrument already lit.

### Fix the run, then fix the script

Resuming keeps *this* run alive. Write the same fix back into the saved script so the next run doesn't hit the same drift.

## Record it instead of writing it

You don't have to hand-write a script. Record the workflow **by doing it**:

```text
record_start  →  do the workflow normally  →  record_stop
```

`record_stop` returns a **draft script**: your steps, plus **candidate assertions inferred from what actually changed** — the real status a request returned (a `302`, not a guessed `200`), the URL it landed on, how many rows an `extract` came back with. Password fields are auto-redacted to `${SECRET:…}`, so the draft is never a credential leak.

Candidates come back marked `candidate: true`. **Curate before you save:**

- **Trim** the exploratory reads and dead ends you did to orient yourself.
- **Accept or edit** each candidate — drop the `candidate` flag, choose its `onFail`.
- **Add explicit waits.** This is the #1 replay footgun: your thinking time between live calls let pages settle, and replay runs at machine speed with **no pauses**. Add `wait_for_selector` / `wait_for_network_idle` steps where the live run relied on an implicit delay. The recorder captures the waits you *issued*; it doesn't invent new ones.
- **Use durable selectors.** [`snapshot`](/docs/tools/#snapshot) refs (`e5`) are re-minted every snapshot — they are **not replayable**. Store stable CSS/attribute selectors (`input[name="username"]`, `a[href="/logout"]`) instead.

## Deliberately linear

Scripts have **no loops, no branching, and no data flowing between steps**. That is a design choice, not a gap.

A script is the part of the job that is already *decided*. The moment a workflow needs a judgement call — "if logged out, register instead", "read these URLs and act on each" — that's a **decision**, and decisions belong to the agent, which is the thing that can actually make one. Keeping scripts dumb is what keeps them cheap, deterministic, and safe to replay; keeping the decisions in the agent is what keeps them correct.

So: the script does the deterministic 95%. A branch point is where it hands control back, and an assertion is how it knows it has reached one.

## Assertions are CDP-free

Every assertion layer reads the page through **`chrome.scripting`** and the **passive network buffer** — never `chrome.debugger`. Guarding a scripted workflow therefore adds **no automation fingerprint**, which matters most on exactly the protected sites where a guarantee is worth having. Assert freely.

The url and the element facts for a step come from a **single** page execution, so a verdict is never assembled from two different documents.

(The steps themselves keep their usual posture — a `click` or `run_js` step attaches CDP because that tool does. See [reads vs. interactions](/docs/how-it-works/#reads-vs-interactions).)

## Open your own tab

Tab ownership is sharper for a script than for a one-off call. A `run_script` is a multi-step sequence over one tab, so another agent navigating that tab mid-run doesn't corrupt a single read — it invalidates **every remaining step, and the assertion verdicts along with them**, which will happily certify the intruder's page.

Call [`open_tab`](/docs/tools/#open_tab--list_tabs--close_tab) first and pass its handle in every step's `params.tab`; keep using that one tab; never drive a tab you didn't open (another agent's, or one the human has open); `close_tab` everything you opened; and on any `NO_TAB` open a new tab rather than borrowing an existing one. See [Multiple tabs](/docs/tools/#multiple-tabs) for the full rule and why collisions are silent.

## What not to put in a script

- ❌ `if`/`else` or loops. A branch is a handoff.
- ❌ A whole-DOM hash or exact bytes — that's coincidence, not contract. It flaps, then gets disabled.
- ❌ Snapshot `ref`s. They die on the next snapshot.
- ❌ A from-scratch rerun of a side-effecting script as a "retry". Resume from the fault.
- ❌ Ten assertions on one step. One strong signal.
- ❌ Inlined credentials. Use `${SECRET:…}`.
- ❌ A tab you didn't open, when other agents may be active.

## The full authoring guide ships with the package

`docs/scripting-agent-guide.md` is bundled in the `pluckor` npm package and referenced from [the skill](/docs/skill/), so it's in front of the driving agent in any chat where Pluckor is installed — the complete playbook for choosing an assertion layer, working the halt → fix → resume loop, and the anti-patterns above.
