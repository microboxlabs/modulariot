"""Golden eval runner for the Nexo conversational graph.

Reads `evals/golden/nexo/examples.yaml`, runs each entry through the
graph in one of three modes:

  static — validate YAML schema only (no graph runs, no LLMs).
  fake   — use FakeListChatModel scripted to emit each entry's first
           expected_tool; stub registry returns canned data. Default;
           catches routing / structural regressions deterministically.
  real   — use real Anthropic + the live Nexo DB. Requires env vars.

For each entry, scores deterministic axes:
  - tool_selection      did the chosen tool intersect expected_tools?
  - filter_sanity       were any forbidden_tools called?
  - freshness_citation  did the answer mention refreshed_at?
  - refusal             did the run refuse cleanly when expected?
  - no_hallucination    did expected KPI substrings appear?
  - step_economy        was the plan within [min_turns, max_turns]? (the
                        over-engineering guard — too many tool calls fails it)
  - latency_ms / cost   placeholder (real mode only)

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
from langchain_core.language_models import BaseChatModel, FakeListChatModel
from pydantic import BaseModel

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.nexo_graph import build_nexo_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry, build_default_registry

logger = logging.getLogger(__name__)


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


def _build_fake_registry(entry: dict[str, Any]) -> ToolRegistry:
    """Build a stub registry with one tool per entry's expected_tools."""

    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(ctx: HarnessContext, inp: BaseModel) -> PermissionResult:
        if ctx.tenant_id != "mintral":
            return PermissionResult.deny("Mintral-only")
        return PermissionResult.allow()

    refreshed = datetime.now(UTC)

    async def _call(ctx: HarnessContext, inp: BaseModel, progress: Callable[..., None]) -> _Out:
        return _Out(
            rows=[{"n_criticos": 2, "n_eta_riesgo": 3, "refreshed_at_servicios": refreshed}],
            refreshed_at=refreshed,
        )

    registry = ToolRegistry()
    expected = entry.get("expected_tools") or []
    for tool_name in expected:
        if not tool_name.startswith("coordinador_"):
            continue
        registry.register(
            HarnessTool(
                name=tool_name,
                description="[Layer L1] eval-stub",
                input_model=_In,
                output_model=_Out,
                check_permission=_check,
                call=_call,
            )
        )
    # Always register a centro_control fallback so empty expected_tools (refusal cases)
    # still resolve.
    if "coordinador_centro_control" not in registry.names() and not expected:
        registry.register(
            HarnessTool(
                name="coordinador_centro_control",
                description="[Layer L1] eval-stub",
                input_model=_In,
                output_model=_Out,
                check_permission=_check,
                call=_call,
            )
        )
    return registry


def _fake_models(entry: dict[str, Any]) -> dict[str, Any]:
    expected = entry.get("expected_tools") or ["coordinador_centro_control"]
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


def _aggregate_usage(
    events: list[Any],
) -> tuple[
    float | None, int | None, int | None, float | None, dict[str, float] | None
]:
    """Aggregate `usage.recorded` events from a graph run.

    The NexoTelemetryCallback (observability/callbacks.py) emits one
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
    *,
    latency_ms: float,
    mode: str = "fake",
) -> EvalScore:
    """Score a single eval entry against the final graph state. Shared by
    fake and real mode — both modes feed in identical state shapes
    (the NexoState dict produced by build_nexo_graph), so the scoring
    rules apply uniformly. `mode` only gates the semantic-refusal axis:
    the scripted FakeListChatModel cannot produce a semantic refusal, so
    that axis scores None in fake mode and for real in real mode.
    """
    plan = final.get("plan")
    plan_tools = [s.tool for s in plan.steps] if plan is not None else []
    answer = (final.get("answer") or "").lower()
    expected_tools = set(entry.get("expected_tools") or [])
    forbidden = set(entry.get("forbidden_tools") or [])

    refusal_expected = bool(entry.get("expected_refusal"))
    answer_is_refusal = "mintral-only" in answer or "no puedo responder" in answer

    cost_usd, tok_in, tok_out, cache_pct, per_agent = _aggregate_usage(
        final.get("_events") or []
    )

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


async def _run_one_fake(entry: dict[str, Any]) -> EvalScore:
    settings = HarnessSettings()
    registry = _build_fake_registry(entry)
    graph = build_nexo_graph(registry=registry, settings=settings, models=_fake_models(entry))
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
    return _score(entry, final, latency_ms=latency_ms)


async def _build_real_setup(
    settings: HarnessSettings,
) -> tuple[ToolRegistry, Any, dict[str, BaseChatModel]]:
    """Build a real harness setup: introspected Coordinador tools on a
    live asyncpg pool + real chat models from the chat_models factory.

    Returns `(registry, pool, models)`. Caller MUST close the pool.

    Raises RuntimeError when settings lack the credentials real mode needs.
    Refusing up front beats discovering an auth failure mid-suite.
    """
    if not settings.nexo_dsn:
        raise RuntimeError(
            "real mode requires MIOT_HARNESS_NEXO_DSN; bring up the "
            "db-scripts tunnel and export the DSN before running."
        )
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "real mode requires ANTHROPIC_API_KEY; the chat-model factory "
            "cannot construct Claude models without it."
        )

    pool = await create_nexo_pool(
        settings.nexo_dsn, application_name=settings.nexo_application_name
    )
    registry = build_default_registry()
    boot = await load_nexo_tools(registry, settings=settings, pool=pool)
    if not boot.enabled:
        await pool.close()
        raise RuntimeError(f"Nexo boot failed: {boot.reason}")

    models: dict[str, BaseChatModel] = {
        "filter_expert": get_chat_model(settings.nexo_filter_expert_model),
        "domain_analyst": get_chat_model(settings.nexo_analyst_model),
        "synthesizer": get_chat_model(
            settings.nexo_synthesizer_model,
            thinking_budget_tokens=settings.nexo_synthesizer_thinking_budget,
        ),
        "critic": get_chat_model(settings.nexo_critic_model),
        "summarizer": get_chat_model(settings.nexo_summarizer_model),
    }
    return registry, pool, models


async def _run_one_real(
    entry: dict[str, Any],
    *,
    registry: ToolRegistry,
    settings: HarnessSettings,
    models: dict[str, BaseChatModel],
) -> EvalScore:
    graph = build_nexo_graph(registry=registry, settings=settings, models=models)
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
    return _score(entry, final, latency_ms=latency_ms, mode="real")


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


def _annotate_drift(
    scored: list[EvalScore], baseline: dict[str, dict[str, Any]]
) -> None:
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
        raise NotImplementedError(f"mode {mode!r} not yet supported (static|fake|real only).")

    scored: list[EvalScore] = []
    real_setup: tuple[ToolRegistry, Any, dict[str, BaseChatModel]] | None = None
    if mode == "real":
        # Build the live setup once (introspect + connect + load models)
        # and reuse it across every entry to avoid re-paying init cost.
        try:
            real_setup = await _build_real_setup(HarnessSettings())
        except RuntimeError as exc:
            return {
                "mode": "real",
                "valid": False,
                "errors": [str(exc)],
                "scored": [],
            }

    accumulated_cost = 0.0
    cost_cap_tripped = False
    try:
        for entry in entries:
            try:
                if mode == "fake":
                    scored.append(await _run_one_fake(entry))
                else:
                    assert real_setup is not None  # narrowing for mypy
                    registry, _pool, models = real_setup
                    scored.append(
                        await _run_one_real(
                            entry,
                            registry=registry,
                            settings=HarnessSettings(),
                            models=models,
                        )
                    )
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
                                "cost cap $%.2f exceeded ($%.4f spent); "
                                "aborting suite after case %s",
                                cost_cap_usd,
                                accumulated_cost,
                                scored[-1].id,
                            )
                            break
            except Exception as exc:  # noqa: BLE001
                logger.exception("eval entry %s raised", entry.get("id"))
                scored.append(
                    EvalScore(
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
                )
    finally:
        if real_setup is not None:
            _registry, pool, _models = real_setup
            await pool.close()

    out_dir.mkdir(parents=True, exist_ok=True)
    sha = _commit_sha()
    # Real-mode results get a -real suffix so they don't clobber the
    # canonical fake-mode baseline (which lives at <sha>.json).
    suffix = "-real" if mode == "real" else ""
    out_path = out_dir / f"{sha}{suffix}.json"

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
    total_tokens = sum(
        (s.tokens_input or 0) + (s.tokens_output or 0) for s in scored
    ) or None
    cache_pcts = [s.cache_hit_pct for s in scored if s.cache_hit_pct is not None]
    avg_cache_hit = (sum(cache_pcts) / len(cache_pcts)) if cache_pcts else None
    # Per-mode rollup: today every case in the YAML routes through
    # nexo_graph (canned). Until multi-route eval seeds exist, the
    # rollup just attributes the whole spend to canned.
    cost_by_mode = {"canned": total_cost} if total_cost is not None else {}

    settings = HarnessSettings()
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
                "filter_expert": settings.nexo_filter_expert_model,
                "analyst": settings.nexo_analyst_model,
                "synthesizer": settings.nexo_synthesizer_model,
                "critic": settings.nexo_critic_model,
                "summarizer": settings.nexo_summarizer_model,
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
        default="evals/golden/nexo/examples.yaml",
        help="Path to the golden eval YAML.",
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
            "real = live Anthropic + Nexo DB (requires ANTHROPIC_API_KEY + "
            "MIOT_HARNESS_NEXO_DSN, plus an active db-scripts tunnel)."
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
                baseline_payload = json.loads(
                    baseline_file.read_text(encoding="utf-8")
                )
        _print_report(payload, baseline_payload=baseline_payload)
        return 0

    yaml_path = Path(args.yaml)
    if not yaml_path.is_file():
        print(f"Golden YAML not found: {yaml_path}", file=sys.stderr)
        return 2

    baseline_path = Path(args.baseline) if args.baseline else None
    payload = asyncio.run(
        run_golden(
            yaml_path,
            Path(args.out_dir),
            mode=args.mode,
            baseline_path=baseline_path,
            cost_cap_usd=args.cost_cap,
        )
    )
    if not payload["valid"]:
        for err in payload["errors"]:
            print(f"INVALID: {err}", file=sys.stderr)
        return 1

    if args.mode != "static":
        ok = sum(
            1
            for s in payload["scored"]
            if not str(s.get("notes", "")).startswith("runner_error")
        )
        total = len(payload["scored"])
        # Mirror run_golden's naming: real-mode results carry a -real
        # suffix so they don't clobber the fake-mode baseline.
        suffix = "-real" if args.mode == "real" else ""
        out_path = Path(args.out_dir) / (payload.get("commit", "baseline") + f"{suffix}.json")
        print(f"Wrote {out_path}: {ok}/{total} ran cleanly (no runner errors)")
    else:
        print(f"Validated {len(yaml.safe_load(yaml_path.read_text()))} entries")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
