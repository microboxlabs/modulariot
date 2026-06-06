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
from langchain_core.language_models import FakeListChatModel
from pydantic import BaseModel

from miot_harness.config import HarnessSettings, get_settings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.datasource.registry import resolve as resolve_datasource
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import build_data_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry

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


def _build_fake_registry(
    entry: dict[str, Any], profile: DataSourceProfile
) -> ToolRegistry:
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


def _score(
    entry: dict[str, Any],
    final: dict[str, Any],
    latency_ms: float,
    *,
    profile: DataSourceProfile,
) -> EvalScore:
    """Deterministic scoring shared by fake and real modes — identical rules
    applied to the same final-state shape."""
    plan = final.get("plan")
    plan_tools = [s.tool for s in plan.steps] if plan is not None else []
    answer = (final.get("answer") or "").lower()
    expected_tools = set(entry.get("expected_tools") or [])
    forbidden = set(entry.get("forbidden_tools") or [])

    refusal_expected = bool(entry.get("expected_refusal"))
    # "<lock>-only" is the tenant-gate refusal (profile-derived); "no puedo
    # responder" is the synthesizer's literal copy, not a domain name, so it
    # stays hardcoded.
    answer_is_refusal = (
        f"{profile.tenant_lock}-only" in answer or "no puedo responder" in answer
    )

    if not refusal_expected:
        refusal_score: bool | None = None
        notes = ""
    elif entry.get("refusal_mechanism") == "semantic":
        # The scripted FakeListChatModel cannot produce a semantic refusal;
        # this axis is only meaningful in real mode.
        refusal_score = None
        notes = "refusal: semantic — real-mode-only"
    else:  # structural (e.g. tenant gate) — deterministic in fake mode
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
    )


def _real_models(settings: HarnessSettings) -> dict[str, Any]:
    """Per-agent live chat models for real mode (built once per suite)."""
    from miot_harness.agents.chat_models import get_chat_model

    synth_budget = (
        settings.agents_synthesizer_thinking_budget
        if settings.agents_synthesizer_stream
        else None
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
            "real mode requires ANTHROPIC_API_KEY (the configured agent "
            "models include claude-*)"
        )

    from miot_harness.tools.registry import build_default_registry

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
    return _score(entry, final, latency_ms, profile=provider.profile)


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
                    scored.append(
                        await _run_one_real(entry, registry, provider, models, settings)
                    )
                except Exception as exc:  # noqa: BLE001
                    scored.append(_error_score(entry, exc))
        finally:
            await provider.close()

    out_dir.mkdir(parents=True, exist_ok=True)
    sha = _commit_sha()
    # Real-mode results land at `<sha>-real.json` so they don't clobber the
    # canonical fake-mode baseline at `<sha>.json`.
    out_path = out_dir / (f"{sha}-real.json" if mode == "real" else f"{sha}.json")
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
            "fake = scripted FakeListChatModel run; "
            "real = live LLM + datasource."
        ),
    )
    args = parser.parse_args(argv)

    yaml_path = Path(
        args.yaml or f"evals/golden/{get_settings().datasource_kind}/examples.yaml"
    )
    if not yaml_path.is_file():
        print(f"Golden YAML not found: {yaml_path}", file=sys.stderr)
        return 2

    try:
        payload = asyncio.run(run_golden(yaml_path, Path(args.out_dir), mode=args.mode))
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
            1
            for s in payload["scored"]
            if not str(s.get("notes", "")).startswith("runner_error")
        )
        total = len(payload["scored"])
        suffix = "-real.json" if args.mode == "real" else ".json"
        out_path = Path(args.out_dir) / (payload.get("commit", "baseline") + suffix)
        print(f"Wrote {out_path}: {ok}/{total} ran cleanly (no runner errors)")
    else:
        print(f"Validated {len(yaml.safe_load(yaml_path.read_text()))} entries")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
