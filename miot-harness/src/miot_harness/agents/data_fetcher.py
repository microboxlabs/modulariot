"""Data Fetcher (deterministic; no LLM).

Reads the next pending NexoStep, invokes the corresponding tool via
ToolRegistry, wraps the typed output as NexoEvidence, and returns a
state delta. Failures (raised exceptions, permission denials) are
caught and surface as `state["failure"]` so the supervisor can route
the synthesizer for graceful refusal — no double-fetching.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import NexoEvidence
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
) -> NexoEvidence:
    if hasattr(output, "model_dump"):
        dump = output.model_dump()
    elif isinstance(output, dict):
        dump = output
    else:
        dump = {"value": output}

    refreshed_at = dump.get("refreshed_at")
    if not isinstance(refreshed_at, datetime):
        # Fall back to scanning row 0 for a refreshed_at_* field
        rows = dump.get("rows") or []
        if rows and isinstance(rows[0], dict):
            for k, v in rows[0].items():
                if isinstance(k, str) and k.startswith("refreshed_at") and isinstance(v, datetime):
                    refreshed_at = v
                    break

    sample_size = 0
    if isinstance(dump.get("rows"), list):
        sample_size = len(dump["rows"])
    elif isinstance(dump.get("data"), dict):
        sample_size = 1
    elif "value" in dump:
        sample_size = 1

    is_stale = False
    if isinstance(refreshed_at, datetime):
        age_minutes = (datetime.now(UTC) - refreshed_at).total_seconds() / 60
        is_stale = age_minutes > warn_minutes
    elif refreshed_at is None and dump:
        # Tool returned data but no refreshed_at — treat as unverified
        is_stale = True

    return NexoEvidence(
        step_id=step_id,
        tool=tool,
        source=str(dump.get("source", "Coordinador · nexo (Citus DB)")),
        refreshed_at=refreshed_at if isinstance(refreshed_at, datetime) else None,
        output=dump,
        sample_size=sample_size,
        is_stale=is_stale,
    )


async def data_fetcher_node(
    state: dict[str, Any],
    *,
    registry: ToolRegistry,
    settings: HarnessSettings,
    progress: Progress,
) -> dict[str, Any]:
    plan = state.get("plan")
    pending = int(state.get("pending_step_index", 0))
    if plan is None or pending >= len(plan.steps):
        return {"next_action": "ready_to_synthesize"}

    step = plan.steps[pending]
    ctx: HarnessContext = state["ctx"]

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
        warn_minutes=settings.nexo_freshness_warn_minutes,
    )
    return {
        "evidence": [evidence],  # appended by NexoState's operator.add reducer
        "pending_step_index": pending + 1,
        "next_action": "judge_freshness",
    }
