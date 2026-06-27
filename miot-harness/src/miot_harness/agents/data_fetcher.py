"""Data Fetcher (deterministic; no LLM).

Reads the next pending DataStep, invokes the corresponding tool via
ToolRegistry, wraps the typed output as DataEvidence, and returns a
state delta. Failures (raised exceptions, permission denials) are
caught and surface as `state["failure"]` so the supervisor can route
the synthesizer for graceful refusal — no double-fetching.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence, DataStep, FreshnessStatus
from miot_harness.runtime.tool import Progress
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def _emit_failed(
    progress: Progress,
    ctx: HarnessContext,
    tool: str,
    error: str,
    error_type: str,
) -> None:
    # Schema mirrors runtime/tool.py:_emit_failed so SSE consumers see the
    # same tool.failed shape regardless of which emitter ran (registry
    # KeyError here, HarnessTool.invoke for every other exception).
    progress(
        HarnessEvent(
            run_id=ctx.run_id,
            type="tool.failed",
            message=f"Tool {tool} failed",
            data={
                "tool": tool,
                "error": error,
                "error_type": error_type,
                "reason": error,
            },
        )
    )


def _evidence_from_output(
    step_id: str,
    tool: str,
    output: Any,
    *,
    warn_minutes: int,
    source_label: str,
    has_freshness_model: bool = True,
) -> DataEvidence:
    if hasattr(output, "model_dump"):
        dump = output.model_dump()
    elif isinstance(output, dict):
        dump = output
    else:
        dump = {"value": output}

    def _ensure_utc(value: datetime) -> datetime:
        # pg `timestamp` (no tz) columns arrive naive; coerce to UTC so
        # max()/age arithmetic never hits naive-vs-aware TypeError.
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value

    refreshed_at = dump.get("refreshed_at")
    if isinstance(refreshed_at, datetime):
        refreshed_at = _ensure_utc(refreshed_at)
    else:
        # Fall back to scanning ALL rows for refreshed_at_* fields and take
        # the freshest. Multi-layer outputs (e.g. centro_control: one row
        # per capa, each with its own refreshed_at) have no guaranteed row
        # order — keying off row 0 flips between layers across calls.
        candidates = [
            _ensure_utc(v)
            for row in dump.get("rows") or []
            if isinstance(row, dict)
            for k, v in row.items()
            if isinstance(k, str) and k.startswith("refreshed_at") and isinstance(v, datetime)
        ]
        refreshed_at = max(candidates) if candidates else None

    sample_size = 0
    if isinstance(dump.get("rows"), list):
        sample_size = len(dump["rows"])
    elif isinstance(dump.get("data"), dict):
        sample_size = 1
    elif "value" in dump:
        sample_size = 1

    # Classify freshness. "empty" (0 rows, timestamped snapshot) means the
    # FILTER matched nothing — that is not staleness. Only a missing
    # timestamp (with or without rows) is treated as unverified/stale, so
    # the synthesizer can distinguish "no matching rows" from "this view
    # looks unrefreshed" (the beta-review Gap 2 conflation).
    has_rows = sample_size > 0
    age_is_stale = False
    if not has_freshness_model:
        # Live datasources (generic pg) have no snapshot/refresh model: a
        # missing refreshed_at is normal, NOT staleness. Current data is fresh;
        # zero rows is just "no matching rows". Never emit a no_timestamp/stale
        # warning the synthesizer would surface as "trust with caution".
        status: FreshnessStatus = "fresh" if has_rows else "empty"
        is_stale = False
    elif isinstance(refreshed_at, datetime):
        age_minutes = (datetime.now(UTC) - refreshed_at).total_seconds() / 60
        age_is_stale = age_minutes > warn_minutes
        if has_rows:
            status = "stale" if age_is_stale else "fresh"
        else:
            status = "empty"
        is_stale = age_is_stale
    else:
        status = "no_timestamp" if has_rows else "empty_no_timestamp"
        is_stale = True

    # Executed SQL (generic safe-query tools surface it as output.executed_sql)
    # so the synthesizer cites what actually ran. A grep is a fuzzy ILIKE sample
    # — flag it so the synthesizer never reports its row count as a total.
    executed_sql = dump.get("executed_sql")
    return DataEvidence(
        step_id=step_id,
        tool=tool,
        # `or` (not a .get default) so a payload carrying source=None or ""
        # falls back to the profile label instead of stringifying to "None".
        source=str(dump.get("source") or source_label),
        refreshed_at=refreshed_at if isinstance(refreshed_at, datetime) else None,
        output=dump,
        sample_size=sample_size,
        is_stale=is_stale,
        freshness_status=status,
        executed_sql=str(executed_sql) if executed_sql else None,
        is_sample=tool.endswith("_grep"),
    )


async def invoke_step(
    step: DataStep,
    *,
    ctx: HarnessContext,
    registry: ToolRegistry,
    settings: HarnessSettings,
    progress: Progress,
    profile: DataSourceProfile,
) -> dict[str, Any]:
    """Invoke one DataStep's tool and classify the outcome.

    Returns either ``{"evidence": [DataEvidence]}`` on success or a
    ``{"failure": ..., ...}`` delta on any error. Shared by the canned
    `data_fetcher_node` and the agentic executor so both modes execute
    tools through the exact same registry / evidence / failure path.
    """
    try:
        output = await registry.invoke(step.tool, ctx, step.args, progress)
    except KeyError as exc:
        # registry.get(name) couldn't find the tool — HarnessTool.invoke
        # never ran, so no tool.failed was emitted on its behalf.
        error = f"tool {step.tool!r} is not registered"
        error_type = type(exc).__name__
        _emit_failed(progress, ctx, step.tool, error, error_type)
        return {
            "failure": f"{error}: {exc}",
            "error": error,
            "error_type": error_type,
        }
    except PermissionError as exc:
        # HarnessTool.invoke already emitted tool.failed; don't double-emit.
        return {"failure": f"permission denied for {step.tool}: {exc}"}
    except Exception as exc:  # noqa: BLE001 — fetcher must not propagate
        logger.exception("data_fetcher: %s raised", step.tool)
        # HarnessTool.invoke already emitted tool.failed; don't double-emit.
        return {"failure": f"{step.tool} raised: {exc}"}

    evidence = _evidence_from_output(
        step.id,
        step.tool,
        output,
        # Effective threshold: env override wins (including an explicit 0),
        # else the profile default. Mirrors freshness_judge's resolution.
        warn_minutes=(
            settings.datasource_freshness_warn_minutes
            if settings.datasource_freshness_warn_minutes is not None
            else profile.freshness_warn_minutes
        ),
        source_label=profile.source_label,
        has_freshness_model=profile.has_freshness_model,
    )
    return {"evidence": [evidence]}


async def data_fetcher_node(
    state: dict[str, Any],
    *,
    registry: ToolRegistry,
    settings: HarnessSettings,
    progress: Progress,
    profile: DataSourceProfile,
) -> dict[str, Any]:
    plan = state.get("plan")
    pending = int(state.get("pending_step_index", 0))
    if plan is None or pending >= len(plan.steps):
        return {"next_action": "ready_to_synthesize"}

    step = plan.steps[pending]
    ctx: HarnessContext = state["ctx"]

    delta = await invoke_step(
        step,
        ctx=ctx,
        registry=registry,
        settings=settings,
        progress=progress,
        profile=profile,
    )
    if "failure" in delta:
        return delta
    return {
        **delta,  # evidence appended by DataState's operator.add reducer
        "pending_step_index": pending + 1,
        "next_action": "judge_freshness",
    }
