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
from langchain_core.language_models import FakeListChatModel
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.nexo_graph import build_nexo_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry

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

    # Score
    plan = final.get("plan")
    plan_tools = [s.tool for s in plan.steps] if plan is not None else []
    answer = (final.get("answer") or "").lower()
    expected_tools = set(entry.get("expected_tools") or [])
    forbidden = set(entry.get("forbidden_tools") or [])

    refusal_expected = bool(entry.get("expected_refusal"))
    answer_is_refusal = "mintral-only" in answer or "no puedo responder" in answer

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

    if mode != "fake":
        raise NotImplementedError(f"mode {mode!r} not yet supported (fake|static only).")

    scored: list[EvalScore] = []
    for entry in entries:
        try:
            scored.append(await _run_one_fake(entry))
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

    out_dir.mkdir(parents=True, exist_ok=True)
    sha = _commit_sha()
    out_path = out_dir / f"{sha}.json"
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
            "fake = scripted FakeListChatModel run; "
            "real = live LLM (TODO)."
        ),
    )
    args = parser.parse_args(argv)

    yaml_path = Path(args.yaml)
    if not yaml_path.is_file():
        print(f"Golden YAML not found: {yaml_path}", file=sys.stderr)
        return 2

    payload = asyncio.run(run_golden(yaml_path, Path(args.out_dir), mode=args.mode))
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
        out_path = Path(args.out_dir) / (payload.get("commit", "baseline") + ".json")
        print(f"Wrote {out_path}: {ok}/{total} ran cleanly (no runner errors)")
    else:
        print(f"Validated {len(yaml.safe_load(yaml_path.read_text()))} entries")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
