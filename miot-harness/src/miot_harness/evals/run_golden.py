"""Golden eval runner for the datasource conversational graph.

Reads `evals/golden/<datasource_kind>/examples.yaml`, runs each entry
through the graph in one of three modes:

  static — validate YAML schema only (no graph runs, no LLMs).
  fake   — use FakeListChatModel scripted to emit each entry's first
           expected_tool; stub registry returns canned data. Default;
           catches routing / structural regressions deterministically.
  real   — use real Anthropic + the live datasource. Requires env vars.

For each entry, scores deterministic axes:
  - tool_selection      did the chosen tool intersect expected_tools?
  - filter_sanity       were any forbidden_tools called?
  - freshness_citation  did the answer mention refreshed_at?
  - refusal             did the run refuse cleanly when expected?
  - no_hallucination    did expected KPI substrings appear?
  - step_economy        was the plan within [min_turns, max_turns]? (the
                        over-engineering guard — too many tool calls fails it)
  - latency_ms always; cost / tokens / cache / drift vs the fake-mode
    baseline are captured in real mode from usage.recorded events

Output: JSON to `evals/results/<commit-sha-or-timestamp>.json`, including an
`env` block (python / platform / cpu / model ids) so runs are comparable
across machines — see evals/README.md on infrastructure noise.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import platform
import subprocess
import sys
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml
from langchain_core.language_models import FakeListChatModel
from pydantic import BaseModel

from miot_harness.config import HarnessSettings, get_settings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.datasource.registry import resolve as resolve_datasource
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import build_data_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry, build_default_registry

logger = logging.getLogger(__name__)


def _active_profile() -> DataSourceProfile:
    """Profile of the datasource under test, per MIOT_HARNESS_DATASOURCE_KIND.

    The golden dataset, the fake stubs, and the refusal scoring must all
    derive from the SAME provider — resolving it here keeps the runner
    datasource-agnostic (registry resolution instantiates the provider
    without connecting to anything).
    """
    return resolve_datasource(get_settings().datasource_kind).profile


def default_fallback_tool(profile: DataSourceProfile) -> str:
    """The always-registered fallback tool for refusal cases (empty
    expected_tools): centro_control under the profile's tool prefix."""
    return profile.tool_prefix + "centro_control"


_REQUIRED_FIELDS = (
    "id",
    "question",
    "tenant_id",
    "category",
    "expected_tools",
    "forbidden_tools",
    "expected_kpis_mentioned",
    "expected_freshness_cited",
    "expected_refusal",
    "expected_min_turns",
    "expected_max_turns",
)


@dataclass
class EvalScore:
    id: str
    category: str
    tool_selection: bool | None
    filter_sanity: bool | None
    freshness_citation: bool | None
    refusal: bool | None
    no_hallucination: bool | None
    step_economy: bool | None
    latency_ms: float | None
    notes: str = ""
    # Real-mode cost capture — populated from the graph's usage.recorded
    # events. None on fake mode (FakeListChatModel has no telemetry).
    cost_usd: float | None = None
    tokens_input: int | None = None
    tokens_output: int | None = None
    cache_hit_pct: float | None = None
    per_agent_costs: dict[str, float] | None = None
    # Drift vs the fake-mode baseline for the same commit. Populated by
    # _annotate_drift in real mode only; None when no baseline was
    # available or when the case wasn't in the baseline.
    drift: bool | None = None
    drift_detail: dict[str, Any] | None = None


def validate_entries(entries: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for i, e in enumerate(entries):
        for field in _REQUIRED_FIELDS:
            if field not in e:
                errors.append(f"entry[{i}] missing required field: {field}")
        if "id" in e:
            if e["id"] in seen_ids:
                errors.append(f"entry[{i}] duplicate id: {e['id']}")
            seen_ids.add(e["id"])
        if e.get("category") == "adversarial" and not e.get("expected_refusal", False):
            errors.append(f"entry[{i}] ({e.get('id')}): adversarial without expected_refusal")
        if e.get("expected_refusal"):
            mech = e.get("refusal_mechanism")
            if mech not in ("structural", "semantic"):
                errors.append(
                    f"entry[{i}] ({e.get('id')}): expected_refusal requires "
                    f"refusal_mechanism in (structural, semantic), got {mech!r}"
                )
    return errors


def _build_fake_registry(entry: dict[str, Any], profile: DataSourceProfile) -> ToolRegistry:
    """Build a stub registry with one tool per entry's expected_tools."""

    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = profile.source_label

    async def _check(ctx: HarnessContext, inp: BaseModel) -> PermissionResult:
        if ctx.tenant_id != profile.tenant_lock:
            return PermissionResult.deny(f"{profile.tenant_lock}-only")
        return PermissionResult.allow()

    refreshed = datetime.now(UTC)

    async def _call(ctx: HarnessContext, inp: BaseModel, progress: Callable[..., None]) -> _Out:
        return _Out(
            rows=[{"n_criticos": 2, "n_eta_riesgo": 3, "refreshed_at_servicios": refreshed}],
            refreshed_at=refreshed,
        )

    def _stub(tool_name: str) -> HarnessTool[_In, _Out]:
        return HarnessTool(
            name=tool_name,
            description="[Layer L1] eval-stub",
            input_model=_In,
            output_model=_Out,
            check_permission=_check,
            call=_call,
        )

    registry = ToolRegistry()
    expected = entry.get("expected_tools") or []
    # Build a stub for EVERY expected tool name verbatim — no prefix filter,
    # so the registry mirrors whatever the dataset asks for.
    for tool_name in expected:
        registry.register(_stub(tool_name))
    # Always register the fallback tool so empty expected_tools (refusal
    # cases) still resolve.
    fallback = default_fallback_tool(profile)
    if fallback not in registry.names():
        registry.register(_stub(fallback))
    return registry


def _fake_models(entry: dict[str, Any], profile: DataSourceProfile) -> dict[str, Any]:
    expected = entry.get("expected_tools") or [default_fallback_tool(profile)]
    chosen = expected[0]
    return {
        "filter_expert": FakeListChatModel(
            responses=[
                json.dumps(
                    {
                        "intent": "fetch eval",
                        "tool": chosen,
                        "args": {},
                        "rationale": "scripted",
                    }
                ),
            ]
        ),
        "domain_analyst": FakeListChatModel(
            responses=[
                json.dumps({"verdict": "ready", "reasoning": "evidence ok"}),
            ]
        ),
        "synthesizer": FakeListChatModel(
            responses=[
                (
                    f"Resultado al snapshot {datetime.now(UTC).isoformat()}: "
                    "2 servicios críticos, 3 ETA en riesgo."
                ),
            ]
        ),
        "critic": FakeListChatModel(responses=[]),
        "summarizer": FakeListChatModel(responses=[]),
    }


async def _run_one_fake(entry: dict[str, Any]) -> EvalScore:
    settings = HarnessSettings()
    profile = _active_profile()
    registry = _build_fake_registry(entry, profile)
    graph = build_data_graph(
        registry=registry,
        settings=settings,
        models=_fake_models(entry, profile),
        profile=profile,
    )
    ctx = HarnessContext(thread_id="t", tenant_id=entry["tenant_id"], user_id="u")

    initial: dict[str, Any] = {
        "user_message": entry["question"],
        "ctx": ctx,
        "evidence": [],
        "turn_count": 0,
    }
    t0 = time.perf_counter()
    final = await graph.ainvoke(initial)
    latency_ms = (time.perf_counter() - t0) * 1000
    return _score(entry, final, latency_ms, profile=profile)


def _aggregate_usage(
    events: list[Any],
) -> tuple[float | None, int | None, int | None, float | None, dict[str, float] | None]:
    """Aggregate `usage.recorded` events from a graph run.

    The AgentTelemetryCallback (observability/callbacks.py) emits one
    per LLM call with `{agent, model, input_tokens, output_tokens,
    cache_read_input_tokens, cache_creation_input_tokens, cost_usd?}`
    in `data`. Returns (total_cost, total_in, total_out, cache_hit_pct,
    per_agent_costs) or all-None when no usage events were emitted
    (fake mode, or a refusal-only run with zero LLM calls).
    """
    usage_events = [e for e in events if getattr(e, "type", None) == "usage.recorded"]
    if not usage_events:
        return (None, None, None, None, None)

    total_cost = 0.0
    total_in = 0
    total_out = 0
    total_cache_read = 0
    has_cost = False
    per_agent: dict[str, float] = {}

    for evt in usage_events:
        d = getattr(evt, "data", None) or {}
        total_in += int(d.get("input_tokens", 0) or 0)
        total_out += int(d.get("output_tokens", 0) or 0)
        total_cache_read += int(d.get("cache_read_input_tokens", 0) or 0)
        if "cost_usd" in d:
            has_cost = True
            cost = float(d["cost_usd"])
            total_cost += cost
            agent = str(d.get("agent", "unknown"))
            per_agent[agent] = per_agent.get(agent, 0.0) + cost

    # FakeListChatModel goes through the same callback but reports
    # zero-token responses. Treat all-zero + no cost as "no signal"
    # rather than booking cache_hit_pct=0% for a model that never
    # touched a cache.
    if total_in == 0 and total_out == 0 and not has_cost:
        return (None, None, None, None, None)

    # cache_hit_pct: cache reads as a fraction of all input tokens
    # charged (cache reads + uncached input). 0% when LLM calls
    # exercised inputs but never read from cache.
    cache_total = total_cache_read + total_in
    cache_hit_pct = (total_cache_read / cache_total * 100.0) if cache_total > 0 else 0.0

    return (
        total_cost if has_cost else None,
        total_in,
        total_out,
        cache_hit_pct,
        per_agent or None,
    )


def _score(
    entry: dict[str, Any],
    final: dict[str, Any],
    latency_ms: float,
    *,
    profile: DataSourceProfile,
    mode: str = "fake",
) -> EvalScore:
    """Deterministic scoring shared by fake and real modes — identical rules
    applied to the same final-state shape. `mode` only gates the semantic-
    refusal axis: the scripted FakeListChatModel cannot produce a semantic
    refusal, so that axis scores None in fake mode."""
    plan = final.get("plan")
    plan_tools = [s.tool for s in plan.steps] if plan is not None else []
    answer = (final.get("answer") or "").lower()
    expected_tools = set(entry.get("expected_tools") or [])
    forbidden = set(entry.get("forbidden_tools") or [])

    refusal_expected = bool(entry.get("expected_refusal"))
    # "<lock>-only" is the tenant-gate refusal (profile-derived); "no puedo
    # responder" is the synthesizer's literal copy, not a domain name, so it
    # stays hardcoded.
    answer_is_refusal = f"{profile.tenant_lock}-only" in answer or "no puedo responder" in answer

    cost_usd, tok_in, tok_out, cache_pct, per_agent = _aggregate_usage(final.get("_events") or [])

    if not refusal_expected:
        refusal_score: bool | None = None
        notes = ""
    elif mode == "fake" and entry.get("refusal_mechanism") == "semantic":
        # The scripted FakeListChatModel cannot produce a semantic refusal;
        # this axis is only meaningful in real mode.
        refusal_score = None
        notes = "refusal: semantic — real-mode-only"
    else:
        # structural (e.g. tenant gate) — deterministic in fake mode;
        # in real mode both mechanisms score against the live answer.
        refusal_score = answer_is_refusal == refusal_expected
        notes = ""

    return EvalScore(
        id=entry["id"],
        category=entry.get("category", ""),
        tool_selection=(any(t in expected_tools for t in plan_tools) if expected_tools else None),
        filter_sanity=(not any(t in forbidden for t in plan_tools)),
        freshness_citation=("refreshed" in answer or "snapshot" in answer or "hace" in answer)
        if not refusal_expected
        else None,
        refusal=refusal_score,
        no_hallucination=all(
            sub.lower() in answer for sub in (entry.get("expected_kpis_mentioned") or [])
        )
        if not refusal_expected
        else None,
        step_economy=(
            entry.get("expected_min_turns", 0)
            <= len(plan_tools)
            <= entry.get("expected_max_turns", len(plan_tools))
        )
        if not refusal_expected
        else None,
        latency_ms=latency_ms,
        notes=notes,
        cost_usd=cost_usd,
        tokens_input=tok_in,
        tokens_output=tok_out,
        cache_hit_pct=cache_pct,
        per_agent_costs=per_agent,
    )


def _real_models(settings: HarnessSettings) -> dict[str, Any]:
    """Per-agent live chat models for real mode (built once per suite)."""
    from miot_harness.agents.chat_models import get_chat_model

    synth_budget = (
        settings.agents_synthesizer_thinking_budget if settings.agents_synthesizer_stream else None
    )
    return {
        "filter_expert": get_chat_model(settings.agents_filter_expert_model),
        "domain_analyst": get_chat_model(settings.agents_analyst_model),
        "synthesizer": get_chat_model(
            settings.agents_synthesizer_model, thinking_budget_tokens=synth_budget
        ),
        "critic": get_chat_model(settings.agents_critic_model),
        "summarizer": get_chat_model(settings.agents_summarizer_model),
    }


async def _build_real_setup(
    settings: HarnessSettings,
) -> tuple[ToolRegistry, Any, dict[str, Any]]:
    """Boot the configured datasource provider and build live models.

    Returns (registry, provider, models). The connection pool is owned by
    the provider now (not returned directly) — the caller closes it via
    `await provider.close()`.
    """
    # Fail-fast on missing credentials with a clear message rather than
    # discovering the misconfiguration mid-suite or auth-failing per case.
    if not settings.datasource_dsn:
        raise RuntimeError(
            "real mode requires MIOT_HARNESS_DATASOURCE_DSN (datasource credentials)"
        )
    # Only required when the configured model mix actually uses Anthropic —
    # mirrors get_chat_model's "claude-*" provider dispatch.
    agent_models = (
        settings.agents_filter_expert_model,
        settings.agents_analyst_model,
        settings.agents_synthesizer_model,
        settings.agents_critic_model,
        settings.agents_summarizer_model,
    )
    if any(m.startswith("claude-") for m in agent_models) and not settings.anthropic_api_key:
        raise RuntimeError(
            "real mode requires ANTHROPIC_API_KEY (the configured agent models include claude-*)"
        )

    registry = build_default_registry()
    provider = resolve_datasource(settings.datasource_kind)
    boot = await provider.boot(registry, settings)
    if not boot.enabled:
        await provider.close()
        raise RuntimeError(f"Datasource boot failed: {boot.reason}")
    return registry, provider, _real_models(settings)


async def _run_one_real(
    entry: dict[str, Any],
    registry: ToolRegistry,
    provider: Any,
    models: dict[str, Any],
    settings: HarnessSettings,
) -> EvalScore:
    graph = build_data_graph(
        registry=registry,
        settings=settings,
        models=models,
        profile=provider.profile,
    )
    ctx = HarnessContext(thread_id="t", tenant_id=entry["tenant_id"], user_id="u")
    initial: dict[str, Any] = {
        "user_message": entry["question"],
        "ctx": ctx,
        "evidence": [],
        "turn_count": 0,
    }
    t0 = time.perf_counter()
    final = await graph.ainvoke(initial)
    latency_ms = (time.perf_counter() - t0) * 1000
    return _score(entry, final, latency_ms, profile=provider.profile, mode="real")


_DRIFT_AXES = ("tool_selection", "filter_sanity")


def _load_baseline(path: Path) -> dict[str, dict[str, Any]]:
    """Load a fake-mode result JSON and index its `scored` list by `id`.
    Returns an empty dict when the file doesn't exist or is unreadable —
    drift comparison silently degrades to "no baseline".
    """
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.warning("baseline %s could not be parsed", path)
        return {}
    return {entry["id"]: entry for entry in raw.get("scored", []) if "id" in entry}


def _annotate_drift(scored: list[EvalScore], baseline: dict[str, dict[str, Any]]) -> None:
    """Compute drift fields on each EvalScore in-place by comparing the
    real-mode result against the baseline (fake-mode) result for the
    same case id.

    Drift is a soft signal — a flipped axis doesn't make the suite
    fail, it just surfaces "the real model picked a different tool
    than the scripted fake did, look at it." Cases missing from the
    baseline are left with drift=None.
    """
    for score in scored:
        ref = baseline.get(score.id)
        if ref is None:
            continue
        flipped: dict[str, Any] = {}
        for axis in _DRIFT_AXES:
            ref_v = ref.get(axis)
            cur_v = getattr(score, axis)
            if ref_v != cur_v:
                flipped[axis] = {"baseline": ref_v, "real": cur_v}
        score.drift = bool(flipped)
        score.drift_detail = flipped or None


def _print_report(
    payload: dict[str, Any],
    *,
    baseline_payload: dict[str, Any] | None = None,
) -> None:
    """Print a human-readable summary of a run result: cost totals + per-mode
    split + drift list + (optional) diff vs a baseline run.

    Designed for terminal review during PR rollout — not a machine-readable
    contract. The JSON file remains the authoritative artifact.
    """
    mode = payload.get("mode", "?")
    sha = payload.get("commit", "?")
    print(f"=== eval report — mode={mode} commit={sha} ===")
    total = payload.get("total_cost_usd")
    tokens = payload.get("total_tokens")
    cache = payload.get("cache_hit_pct")
    if total is not None:
        print(f"Total cost: ${total:.4f}")
    else:
        print("Total cost: — (no LLM telemetry captured)")
    if tokens is not None:
        print(f"Total tokens: {tokens:,}")
    if cache is not None:
        print(f"Cache hit pct (avg): {cache:.1f}%")
    cost_by_mode = payload.get("cost_by_mode") or {}
    if cost_by_mode:
        per_mode = ", ".join(f"{k}=${v:.4f}" for k, v in cost_by_mode.items())
        print(f"Cost by mode: {per_mode}")

    drifts = [s for s in payload.get("scored", []) if s.get("drift") is True]
    if drifts:
        print(f"\nDrift vs baseline: {len(drifts)} cases flipped")
        for d in drifts:
            axes = ", ".join((d.get("drift_detail") or {}).keys())
            print(f"  - {d['id']}: {axes}")
    elif mode == "real":
        print("\nDrift vs baseline: none")

    if baseline_payload is not None:
        base_cost = baseline_payload.get("total_cost_usd") or 0.0
        base_tokens = baseline_payload.get("total_tokens") or 0
        if total is not None:
            delta_cost = total - base_cost
            print(f"\nΔ cost vs baseline: ${delta_cost:+.4f}")
        if tokens is not None and base_tokens:
            print(f"Δ tokens vs baseline: {tokens - base_tokens:+,}")


def _commit_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


async def run_golden(
    yaml_path: Path,
    out_dir: Path,
    *,
    mode: str = "fake",
    baseline_path: Path | None = None,
    cost_cap_usd: float = 10.0,
) -> dict[str, Any]:
    raw = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{yaml_path} must contain a YAML list at top level")
    entries: list[dict[str, Any]] = raw

    errors = validate_entries(entries)
    if errors:
        return {
            "mode": "static",
            "valid": False,
            "errors": errors,
            "scored": [],
        }

    if mode == "static":
        return {"mode": "static", "valid": True, "errors": [], "scored": []}

    if mode not in ("fake", "real"):
        raise NotImplementedError(f"mode {mode!r} not yet supported (static|fake|real).")

    settings = HarnessSettings()

    def _error_score(entry: dict[str, Any], exc: Exception) -> EvalScore:
        logger.exception("eval entry %s raised", entry.get("id"))
        return EvalScore(
            id=entry.get("id", "?"),
            category=entry.get("category", ""),
            tool_selection=False,
            filter_sanity=False,
            freshness_citation=False,
            refusal=False,
            no_hallucination=False,
            step_economy=False,
            latency_ms=None,
            notes=f"runner_error: {exc}",
        )

    scored: list[EvalScore] = []
    accumulated_cost = 0.0
    cost_cap_tripped = False
    if mode == "fake":
        for entry in entries:
            try:
                scored.append(await _run_one_fake(entry))
            except Exception as exc:  # noqa: BLE001
                scored.append(_error_score(entry, exc))
    else:  # real — build the live setup once, then run each entry against it
        registry, provider, models = await _build_real_setup(settings)
        try:
            for entry in entries:
                try:
                    scored.append(await _run_one_real(entry, registry, provider, models, settings))
                except Exception as exc:  # noqa: BLE001
                    scored.append(_error_score(entry, exc))
                    continue
                # Cost-budget guard: when accumulated real-mode cost
                # exceeds the cap, abort the rest of the suite. The
                # default $10 cap is sized to make a footgun obvious
                # (e.g. accidentally running real mode against Sonnet
                # on every case), not to actually limit ops budgets.
                last_cost = scored[-1].cost_usd
                if last_cost is not None:
                    accumulated_cost += last_cost
                    if accumulated_cost > cost_cap_usd:
                        cost_cap_tripped = True
                        logger.warning(
                            "cost cap $%.2f exceeded ($%.4f spent); aborting suite after case %s",
                            cost_cap_usd,
                            accumulated_cost,
                            scored[-1].id,
                        )
                        break
        finally:
            await provider.close()

    out_dir.mkdir(parents=True, exist_ok=True)
    sha = _commit_sha()
    # Real-mode results land at `<sha>-real.json` so they don't clobber the
    # canonical fake-mode baseline at `<sha>.json`.
    out_path = out_dir / (f"{sha}-real.json" if mode == "real" else f"{sha}.json")

    # Drift annotation — real mode only. Default baseline path is the
    # same-commit fake-mode result; CI / local users can pass an
    # explicit one. Missing file = silently skip (drift fields stay None).
    if mode == "real":
        baseline_resolved = baseline_path or (out_dir / f"{sha}.json")
        _annotate_drift(scored, _load_baseline(baseline_resolved))

    # Cost rollup. Only meaningful in real mode — fake mode's
    # cost_usd is always None and the totals collapse to None / 0.
    case_costs = [s.cost_usd for s in scored if s.cost_usd is not None]
    total_cost = sum(case_costs) if case_costs else None
    total_tokens = sum((s.tokens_input or 0) + (s.tokens_output or 0) for s in scored) or None
    cache_pcts = [s.cache_hit_pct for s in scored if s.cache_hit_pct is not None]
    avg_cache_hit = (sum(cache_pcts) / len(cache_pcts)) if cache_pcts else None
    # Per-mode rollup: today every case in the YAML routes through the
    # data graph (canned). Until multi-route eval seeds exist, the
    # rollup just attributes the whole spend to canned.
    cost_by_mode = {"canned": total_cost} if total_cost is not None else {}
    payload = {
        "mode": mode,
        "valid": True,
        "errors": [],
        "commit": sha,
        "generated_at": datetime.now(UTC).isoformat(),
        "env": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "cpu_count": os.cpu_count(),
            "deterministic": mode == "fake",
            "models": {
                "filter_expert": settings.agents_filter_expert_model,
                "analyst": settings.agents_analyst_model,
                "synthesizer": settings.agents_synthesizer_model,
                "critic": settings.agents_critic_model,
                "summarizer": settings.agents_summarizer_model,
                "intent_router": settings.intent_router_model,
            },
            "note": (
                "fake mode is deterministic; real mode is subject to "
                "infrastructure noise (see evals/README.md)."
            ),
        },
        "scored": [asdict(s) for s in scored],
        "total_cost_usd": total_cost,
        "total_tokens": total_tokens,
        "cache_hit_pct": avg_cache_hit,
        "cost_by_mode": cost_by_mode,
        "cost_cap_tripped": cost_cap_tripped,
    }
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="miot-harness-evals", description=__doc__)
    parser.add_argument(
        "--yaml",
        default=None,
        help=(
            "Path to the golden eval YAML. Defaults to "
            "evals/golden/<MIOT_HARNESS_DATASOURCE_KIND>/examples.yaml."
        ),
    )
    parser.add_argument(
        "--out-dir",
        default="evals/results",
        help="Directory for JSON results.",
    )
    parser.add_argument(
        "--mode",
        default="fake",
        choices=("static", "fake", "real"),
        help=(
            "static = YAML validation only; "
            "fake = scripted FakeListChatModel run (deterministic); "
            "real = live LLM + datasource (requires "
            "MIOT_HARNESS_DATASOURCE_DSN + ANTHROPIC_API_KEY)."
        ),
    )
    parser.add_argument(
        "--baseline",
        default=None,
        help=(
            "Path to a fake-mode result JSON. In --mode real, every case "
            "is compared against the same-id entry in the baseline; "
            "flipped tool_selection / filter_sanity is surfaced as drift. "
            "Default: evals/results/<HEAD-sha>.json."
        ),
    )
    parser.add_argument(
        "--report",
        default=None,
        help=(
            "Print a human-readable report for an existing result JSON "
            "instead of running the suite. Combine with --baseline to "
            "include a Δ-cost / Δ-tokens block. All other args ignored."
        ),
    )
    parser.add_argument(
        "--cost-cap",
        type=float,
        default=10.0,
        help=(
            "Real-mode cost guard, in USD. The suite aborts after the "
            "case whose cumulative cost crosses this threshold. Default "
            "$10 — sized to make a footgun obvious; raise for full runs."
        ),
    )
    args = parser.parse_args(argv)

    if args.report:
        report_path = Path(args.report)
        if not report_path.is_file():
            print(f"Result file not found: {report_path}", file=sys.stderr)
            return 2
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        baseline_payload: dict[str, Any] | None = None
        if args.baseline:
            baseline_file = Path(args.baseline)
            if baseline_file.is_file():
                baseline_payload = json.loads(baseline_file.read_text(encoding="utf-8"))
        _print_report(payload, baseline_payload=baseline_payload)
        return 0

    yaml_path = Path(args.yaml or f"evals/golden/{get_settings().datasource_kind}/examples.yaml")
    if not yaml_path.is_file():
        print(f"Golden YAML not found: {yaml_path}", file=sys.stderr)
        return 2

    baseline_path = Path(args.baseline) if args.baseline else None
    try:
        payload = asyncio.run(
            run_golden(
                yaml_path,
                Path(args.out_dir),
                mode=args.mode,
                baseline_path=baseline_path,
                cost_cap_usd=args.cost_cap,
            )
        )
    except RuntimeError as exc:
        # Real-mode setup refuses (missing credentials / boot failed) — clean
        # exit 1 with the reason on stderr instead of a traceback.
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 1
    if not payload["valid"]:
        for err in payload["errors"]:
            print(f"INVALID: {err}", file=sys.stderr)
        return 1

    if args.mode != "static":
        ok = sum(
            1 for s in payload["scored"] if not str(s.get("notes", "")).startswith("runner_error")
        )
        total = len(payload["scored"])
        # Mirror run_golden's naming: real-mode results carry a -real
        # suffix so they don't clobber the fake-mode baseline.
        suffix = "-real.json" if args.mode == "real" else ".json"
        out_path = Path(args.out_dir) / (payload.get("commit", "baseline") + suffix)
        print(f"Wrote {out_path}: {ok}/{total} ran cleanly (no runner errors)")
    else:
        print(f"Validated {len(yaml.safe_load(yaml_path.read_text()))} entries")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
