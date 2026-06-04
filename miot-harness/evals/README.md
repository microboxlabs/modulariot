# Harness evals

## What an "eval" is

The harness runs an AI agent ("Nexo") that answers operational questions by calling tools and reading data. An eval suite is the agent's test
harness — it feeds the agent a set of known questions and checks whether it behaved correctly (picked the right tool, cited fresh data, refused
when it should, didn't make things up). Think of it as a report card for the AI, run automatically so you catch quality regressions before
users do.

Three independent suites live under `evals/`. They share a directory but never
share a runner; their exit codes mean different things.

| Suite | What it measures | Entry point |
|---|---|---|
| **Golden** (this dir + `src/miot_harness/evals/run_golden.py`) | Agent quality on the Nexo conversational graph — tool routing, freshness, refusals, KPI grounding, step economy, cost, drift vs baseline. | `miot-harness-evals` |
| **Judge** (`judge_prompt.md`) | Advisory Tier-3 LLM-judge rubric scored 1–5 per axis on a real trajectory. | prompt, run out-of-band |
| **Deploy** (`deploy/`) | Operational checks that the harness packages and runs as a container. | `deploy/run-all.sh` (see `deploy/README.md`) |

## Golden suite — three modes

`miot-harness-evals` reads `evals/golden/nexo/examples.yaml` and runs each entry
through the Nexo graph in one of three modes:

```bash
# YAML schema validation only — no graph runs, no LLMs.
uv run miot-harness-evals --mode static

# Scripted FakeListChatModel run — deterministic; the default.
uv run miot-harness-evals --mode fake

# Live Anthropic + live Nexo DB. Requires credentials (see below).
uv run miot-harness-evals --mode real
```

- **`static`** — validate `evals/golden/nexo/examples.yaml` schema only.
  No graph runs, no LLM calls. Fastest; used in CI as a YAML linter.
- **`fake`** (default) — scripted `FakeListChatModel` per case + stub
  registry returning canned data. Deterministic; catches routing /
  structural regressions without burning real model spend.
- **`real`** — live Anthropic + live Nexo DB via the introspected
  registry. Captures real cost + drift vs the fake-mode baseline.

Both `fake` and `real` write JSON to `evals/results/<HEAD-sha>.json`
(real adds a `-real` suffix to avoid clobbering the fake baseline).

### Scored axes (deterministic)

Every case is scored on deterministic axes:

| Axis | Meaning |
|---|---|
| `tool_selection` | Did the chosen tool intersect `expected_tools`? |
| `filter_sanity` | Were any `forbidden_tools` called? |
| `freshness_citation` | Does the answer mention `refreshed_at` / "snapshot" / "hace"? |
| `refusal` | Did the run refuse cleanly when `expected_refusal: true`? |
| `no_hallucination` | Did `expected_kpis_mentioned` substrings appear? |
| `step_economy` | Was the plan's tool count within `[expected_min_turns, expected_max_turns]`? The over-engineering guard; `null` for refusal cases (no plan is built). |
| `latency_ms` | Wall-clock time per case |

`refusal` is scored only for refusals fake mode can deterministically produce —
the **structural** tenant gate. For cases whose `refusal_mechanism` is
**semantic** (prompt injection, mutation, out-of-scope, …) `refusal` is `null`
in fake mode (with a `refusal: semantic — real-mode-only` note) because a
scripted model cannot make that judgment; those are validated in real mode.

Real mode adds:

| Axis | Meaning |
|---|---|
| `cost_usd` | Total spend on this case's LLM calls |
| `tokens_input` / `tokens_output` | Per-case totals |
| `cache_hit_pct` | Prompt-cache reads as a fraction of all input tokens |
| `per_agent_costs` | `{agent_name: cost_usd}` breakdown |
| `drift` / `drift_detail` | Diff against the fake baseline |

### Dataset contract (fake mode)

Fake mode is intentionally deterministic so it catches routing/structural
regressions without spending tokens. When authoring `examples.yaml`:

- The scripted synthesizer always emits
  `"Resultado al snapshot <ts>: 2 servicios críticos, 3 ETA en riesgo."`, so
  `expected_kpis_mentioned` must be lowercase substrings of that line.
- The fake `filter_expert` emits exactly **one** tool call, so every fake run
  produces a 1-step plan. `expected_min_turns`/`expected_max_turns` therefore
  document the *real-mode* envelope; in fake mode keep `min ≤ 1 ≤ max` for a
  green baseline. The `max` cap is the part that catches over-engineering once
  real mode lands.
- `expected_tools` must be `coordinador_*` names (the fake registry only stubs
  those). Adversarial cases use `[]`; a non-`mintral` `tenant_id` exercises the
  tenant gate and produces the canonical `"…is mintral-only…"` refusal.
- `category: adversarial` requires `expected_refusal: true` (enforced by
  `validate_entries`).
- Every `expected_refusal: true` case must declare `refusal_mechanism:
  structural | semantic` (enforced by `validate_entries`). `structural` means a
  deterministic harness gate produces the refusal (today: a non-`mintral`
  `tenant_id` hitting the tenant gate); `semantic` means it needs a real LLM and
  is therefore `null` in fake mode.

## Running real mode

### Preflight

1. **Tunnel up** — Nexo lives behind a bastion. Open the tunnel via
   `db-scripts/bin/tunnel.sh` (see that repo's README) before running.
2. **Credentials** — export:
   ```
   export ANTHROPIC_API_KEY=sk-…
   export MIOT_HARNESS_NEXO_DSN=postgresql://harness:…@localhost:<tunnel-port>/coordinador
   ```
3. **Cost expectation** — ~6 LLM calls × 25 cases on a mix of Haiku
   ($0.80 / $4 per Mtok) and Sonnet ($3 / $15 per Mtok). Typical
   spend is well under $5. Agentic-mode cases (if added later) are
   pricier because the critic runs on every step.

### Cost-budget guard

The runner has a `--cost-cap <USD>` flag (default `$10`). Cumulative
real-mode cost is summed across cases as they run; when the running
total crosses the cap, the suite aborts after the current case and
records `"cost_cap_tripped": true` in the result JSON. Raise the cap
when you intentionally want a full run; the default exists to make
"oops I just spent $50 on a typo" impossible.

### Refusals

Real mode refuses to start when:
- `MIOT_HARNESS_NEXO_DSN` is unset → "real mode requires MIOT_HARNESS_NEXO_DSN; …"
- `ANTHROPIC_API_KEY` is unset → "real mode requires ANTHROPIC_API_KEY; …"
- Nexo boot reports `enabled=False` (introspection failure, no `fn_dx_*` discovered) → "Nexo boot failed: …"

Each refusal exits non-zero with the reason on stderr. Better to find
a missing credential at startup than mid-suite.

### Drift comparison

After scoring, each real-mode case is compared against the same-id
entry in a fake-mode baseline. Flipped `tool_selection` /
`filter_sanity` are surfaced as:

```json
{
  "id": "nexo-single-001-status-summary",
  "tool_selection": true,
  "drift": true,
  "drift_detail": {
    "tool_selection": {"baseline": true, "real": false}
  }
}
```

Drift is a **soft signal** — it does not fail the suite. A flipped
axis tells the reviewer "the real model diverged from the scripted
fake here, decide whether that's a regression or an improvement."

Default baseline path: `evals/results/<HEAD-sha>.json`. Override
with `--baseline <path>`.

### Reading the result

`miot-harness-evals --report <result.json>` prints a terminal-friendly
summary: total cost, per-mode rollup, drift list, and (when combined
with `--baseline`) a Δ-cost / Δ-tokens diff. The JSON file itself
remains the canonical artifact for automated diffing in CI.

## Baselines

`evals/results/BASELINES.md` records the currently-canonical fake and
real baselines and documents how to pin a new one when intentional
changes shift the score.

## Reproducibility (infrastructure noise)

Anthropic's *Quantifying infrastructure noise in agentic coding evals*
(https://www.anthropic.com/engineering/infrastructure-noise) shows that resource
configuration — CPU/RAM headroom, concurrency, even time of day — can swing
agentic benchmark scores by several percentage points, sometimes more than the
gap between top models. So a bare score is not comparable across machines.

To make runs comparable, every results file carries an `env` block recording the
Python version, platform, CPU count, the resolved model ids, and whether the run
was deterministic (`fake`) or noise-prone (`real`). When comparing two `real`
runs, match the `env` block (and the pod's resource budget) before trusting a
delta — and document the config alongside the number.

## Verified Anthropic references

Checked May 2026. Titles are all real; one URL that had been circulating
(`/engineering/quantifying-infrastructure-noise-in-agentic-coding-evals`) is
**wrong** — the article lives at `/engineering/infrastructure-noise`.

| Article | URL |
|---|---|
| Demystifying evals for AI agents | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| Quantifying infrastructure noise in agentic coding evals | https://www.anthropic.com/engineering/infrastructure-noise |
| Effective harnesses for long-running agents | https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents |
| Harness design for long-running application development | https://www.anthropic.com/engineering/harness-design-long-running-apps |

Publication dates quoted elsewhere (Jan 2026 / Nov 2025 / Mar 2026) were **not**
independently confirmed — treat them as unverified.
