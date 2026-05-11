"""Freshness Judge (rule-based).

Inspects the most recent piece of evidence and classifies it against
two thresholds from settings:

  age <= warn_minutes        → FRESHNESS_FRESH    (proceed)
  warn < age <= refuse        → FRESHNESS_WARN     (analyze + cite stale)
  age > refuse_minutes        → FRESHNESS_REFUSE   (block synth, fail soft)
  no refreshed_at on evidence → FRESHNESS_WARN     (unverified, proceed)

Emits a `freshness.warning` event in WARN/REFUSE zones so the run
record retains an explicit signal for the analyst to cite.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import NexoEvidence
from miot_harness.runtime.tool import Progress

FRESHNESS_FRESH = "fresh"
FRESHNESS_WARN = "warn"
FRESHNESS_REFUSE = "refuse"


def freshness_judge_node(
    state: dict[str, Any],
    *,
    settings: HarnessSettings,
    progress: Progress,
) -> dict[str, Any]:
    evidence: list[NexoEvidence] = list(state.get("evidence", []))
    if not evidence:
        return {"next_action": "analyze", "freshness": FRESHNESS_FRESH}

    last = evidence[-1]
    ctx: HarnessContext = state["ctx"]

    age_minutes: float | None
    if last.refreshed_at is None:
        age_minutes = None
        verdict = FRESHNESS_WARN
    else:
        age_minutes = (datetime.now(UTC) - last.refreshed_at).total_seconds() / 60
        if age_minutes <= settings.nexo_freshness_warn_minutes:
            verdict = FRESHNESS_FRESH
        elif age_minutes <= settings.nexo_freshness_refuse_minutes:
            verdict = FRESHNESS_WARN
        else:
            verdict = FRESHNESS_REFUSE

    if verdict in (FRESHNESS_WARN, FRESHNESS_REFUSE):
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="freshness.warning",
                message=(
                    f"Snapshot age {age_minutes if age_minutes is not None else 'unknown'} "
                    f"min ({verdict})"
                ),
                data={
                    "tool": last.tool,
                    "verdict": verdict,
                    "refreshed_at": last.refreshed_at,
                    "age_minutes": age_minutes,
                },
            )
        )

    # NOTE: is_stale is set by data_fetcher when it constructs NexoEvidence
    # (using the same warn_minutes threshold). The judge classifies + emits
    # but does not mutate evidence, because the LangGraph reducer is
    # operator.add — returning an "evidence" key here would APPEND to the
    # state list, not replace it.

    if verdict == FRESHNESS_REFUSE:
        return {
            "freshness": verdict,
            "next_action": "ready_to_synthesize",
            "failure": (
                f"Coordinador snapshot is stale (age {age_minutes:.0f}min > "
                f"refuse threshold {settings.nexo_freshness_refuse_minutes}min)."
            ),
        }

    return {
        "freshness": verdict,
        "next_action": "analyze",
    }
