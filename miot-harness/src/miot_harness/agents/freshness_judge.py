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
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence
from miot_harness.runtime.tool import Progress

FRESHNESS_FRESH = "fresh"
FRESHNESS_WARN = "warn"
FRESHNESS_REFUSE = "refuse"


def freshness_judge_node(
    state: dict[str, Any],
    *,
    settings: HarnessSettings,
    progress: Progress,
    profile: DataSourceProfile,
) -> dict[str, Any]:
    # Effective thresholds: env override wins (including an explicit 0),
    # else the profile default. This is the single resolution point that
    # data_fetcher mirrors when it stamps is_stale.
    warn = (
        settings.datasource_freshness_warn_minutes
        if settings.datasource_freshness_warn_minutes is not None
        else profile.freshness_warn_minutes
    )
    refuse = (
        settings.datasource_freshness_refuse_minutes
        if settings.datasource_freshness_refuse_minutes is not None
        else profile.freshness_refuse_minutes
    )

    evidence: list[DataEvidence] = list(state.get("evidence", []))
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
        if age_minutes <= warn:
            verdict = FRESHNESS_FRESH
        elif age_minutes <= refuse:
            verdict = FRESHNESS_WARN
        else:
            verdict = FRESHNESS_REFUSE

    if verdict in (FRESHNESS_WARN, FRESHNESS_REFUSE):
        data: dict[str, Any] = {
            "tool": last.tool,
            "verdict": verdict,
            "refreshed_at": last.refreshed_at,
            "age_minutes": age_minutes,
        }
        # Machine-readable cause for the no-timestamp warn zone: lets ops
        # / SSE consumers distinguish "snapshot looks unrefreshed" from a
        # plain old timestamp without re-deriving evidence shape.
        if last.refreshed_at is None and last.freshness_status in (
            "empty_no_timestamp",
            "no_timestamp",
        ):
            data["reason"] = last.freshness_status
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="freshness.warning",
                message=(
                    f"Snapshot age {age_minutes if age_minutes is not None else 'unknown'} "
                    f"min ({verdict})"
                ),
                data=data,
            )
        )

    # NOTE: is_stale is set by data_fetcher when it constructs DataEvidence
    # (using the same warn_minutes threshold). The judge classifies + emits
    # but does not mutate evidence, because the LangGraph reducer is
    # operator.add — returning an "evidence" key here would APPEND to the
    # state list, not replace it.

    if verdict == FRESHNESS_REFUSE:
        return {
            "freshness": verdict,
            "next_action": "ready_to_synthesize",
            "failure": (
                f"{profile.display_name} snapshot is stale (age {age_minutes:.0f}min > "
                f"refuse threshold {refuse}min)."
            ),
        }

    return {
        "freshness": verdict,
        "next_action": "analyze",
    }
