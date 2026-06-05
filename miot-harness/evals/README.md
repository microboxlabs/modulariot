# Harness evals

## What an "eval" is

The harness runs an AI agent over a configured **datasource** that answers operational questions by calling tools and reading data. An eval
suite is the agent's test harness — it feeds the agent a set of known questions and checks whether it behaved correctly (picked the right
tool, cited fresh data, refused when it should, didn't make things up). Think of it as a report card for the AI, run automatically so you
catch quality regressions before users do. The golden dataset shipped here targets the default **nexo** provider.

Two independent suites live under `evals/`. They share a directory but never
share a runner; their exit codes mean different things.

| Suite | What it measures | Entry point |
|---|---|---|
| **Golden** (this dir + `src/miot_harness/evals/run_golden.py`) | Agent quality on the datasource conversational graph — tool routing, freshness, refusals, KPI grounding, step economy. | `miot-harness-evals` |
| **Judge** (`judge_prompt.md`) | Advisory Tier-3 LLM-judge rubric scored 1–5 per axis on a real trajectory. | prompt, run out-of-band |
| **Deploy** (`deploy/`) | Operational checks that the harness packages and runs as a container. | `deploy/run-all.sh` (see `deploy/README.md`) |

## Golden suite

`miot-harness-evals` reads `evals/golden/<datasource-kind>/examples.yaml`
(default `evals/golden/nexo/examples.yaml`, override with `--yaml`) and runs
each entry through the datasource graph in one of three modes:

```bash
# YAML schema validation only — no graph runs, no LLMs.
uv run miot-harness-evals --mode static

# Scripted FakeListChatModel run — deterministic; the default.
uv run miot-harness-evals --mode fake

# Live Anthropic + live datasource. Needs MIOT_HARNESS_DATASOURCE_DSN and
# ANTHROPIC_API_KEY; refuses (exit 1) when either is missing. The provider is
# selected by MIOT_HARNESS_DATASOURCE_KIND via the registry path.
uv run miot-harness-evals --mode real
```

Results are written to `evals/results/<commit-sha>.json` (fake/static) or
`evals/results/<commit-sha>-real.json` (real, so it never clobbers the
canonical fake baseline).

### Scored axes (deterministic)

`tool_selection`, `filter_sanity`, `freshness_citation`, `refusal`,
`no_hallucination`, and `step_economy` — the over-engineering guard: the plan's
tool count must fall within each case's `[expected_min_turns, expected_max_turns]`.
`step_economy` is `null` for refusal cases (no plan is built).

`refusal` is scored only for refusals fake mode can deterministically produce —
the **structural** tenant gate. For cases whose `refusal_mechanism` is
**semantic** (prompt injection, mutation, out-of-scope, …) `refusal` is `null`
in fake mode (with a `refusal: semantic — real-mode-only` note) because a
scripted model cannot make that judgment; those are validated in real mode.

### Dataset contract (fake mode)

Fake mode is intentionally deterministic so it catches routing/structural
regressions without spending tokens. The values below (`coordinador_*` tool
names, the `mintral` tenant lock) are the **nexo** profile's, since the
shipped dataset targets the nexo provider. When authoring `examples.yaml`:

- The scripted synthesizer always emits
  `"Resultado al snapshot <ts>: 2 servicios críticos, 3 ETA en riesgo."`, so
  `expected_kpis_mentioned` must be lowercase substrings of that line.
- The fake `filter_expert` emits exactly **one** tool call, so every fake run
  produces a 1-step plan. `expected_min_turns`/`expected_max_turns` therefore
  document the *real-mode* envelope; in fake mode keep `min ≤ 1 ≤ max` for a
  green baseline. The `max` cap is the part that catches over-engineering once
  real mode lands.
- `expected_tools` may be any tool names — the fake registry now stubs every
  name in `expected_tools` verbatim (plus a `<prefix>centro_control` fallback).
  For the nexo dataset these are `coordinador_*` names. Adversarial cases use
  `[]`; an off-lock `tenant_id` (≠ `mintral` for nexo) exercises the tenant gate
  and produces the canonical `"…is mintral-only…"` refusal.
- `category: adversarial` requires `expected_refusal: true` (enforced by
  `validate_entries`).
- Every `expected_refusal: true` case must declare `refusal_mechanism:
  structural | semantic` (enforced by `validate_entries`). `structural` means a
  deterministic harness gate produces the refusal (today: a non-`mintral`
  `tenant_id` hitting the tenant gate); `semantic` means it needs a real LLM and
  is therefore `null` in fake mode.

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
