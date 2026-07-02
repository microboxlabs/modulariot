"""LIVE test — talks to the Anthropic API. Skipped unless both
ANTHROPIC_API_KEY and MIOT_HARNESS_RUN_LIVE_TESTS=1 are set.

Asserts the agent loop's cache contract:
- call 1 writes the prefix cache (cache_creation_input_tokens > 0). If this
  is 0, the frozen prefix is below the model's minimum cacheable size
  (2048 tokens on Sonnet 4.6) or a marker is misplaced.
- call 2 reads it (cache_read_input_tokens > 0). If this is 0 while call 1
  wrote, a silent invalidator is injecting unstable bytes into the prefix.

Usage-key verification (run once, result recorded in task-8-report.md):
    grep cache_read .venv/lib/python3.*/site-packages/langchain_core/messages/ai.py
    # Found: cache_creation / cache_read inside input_token_details — matches
    # the keys used in _cache_tokens() below.

Minimum-size note: FAKE_PROFILE's short primer + 4 tiny tools is far below
Sonnet 4.6's 2048-token minimum. _big_registry() pads the prefix with 25
fake tools whose descriptions are ~500 characters each (~125 tokens/tool),
bringing the prefix comfortably above the 2048-token threshold.
"""

from __future__ import annotations

import os

import pytest
from pydantic import BaseModel

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE

pytestmark = pytest.mark.skipif(
    not (os.getenv("ANTHROPIC_API_KEY") and os.getenv("MIOT_HARNESS_RUN_LIVE_TESTS")),
    reason="live Anthropic test; set ANTHROPIC_API_KEY and MIOT_HARNESS_RUN_LIVE_TESTS=1",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cache_tokens(usage: dict) -> tuple[int, int]:  # type: ignore[type-arg]
    """Return (cache_created, cache_read) token counts from a usage_log entry.

    langchain_anthropic maps Anthropic's prompt-cache usage as follows:

    Standard (1-hour+) cache:
      cache_creation_input_tokens  → input_token_details["cache_creation"]
      cache_read_input_tokens      → input_token_details["cache_read"]

    Ephemeral (5-minute) cache — the type used by cached_system_message():
      cache_creation.ephemeral_5m_input_tokens  → input_token_details["ephemeral_5m_input_tokens"]
      cache_creation.ephemeral_1h_input_tokens  → input_token_details["ephemeral_1h_input_tokens"]
      When either ephemeral field is > 0, langchain_anthropic EXPLICITLY sets
      input_token_details["cache_creation"] = 0 (so checking only "cache_creation"
      misses ephemeral writes).

    Cache READS from the ephemeral cache are still returned by the Anthropic API
    in cache_read_input_tokens, so input_token_details["cache_read"] covers both
    standard and ephemeral reads.
    """
    details = usage.get("input_token_details") or {}
    # Cache CREATED: standard path + ephemeral 5-min + ephemeral 1-hour
    created = (
        int(details.get("cache_creation") or 0)
        + int(details.get("ephemeral_5m_input_tokens") or 0)
        + int(details.get("ephemeral_1h_input_tokens") or 0)
    )
    # Cache READ: single field covers both standard and ephemeral reads
    read = int(details.get("cache_read") or 0)
    return created, read


class _In(BaseModel):
    limit: int = 10


class _Out(BaseModel):
    rows: list[dict] = []  # type: ignore[type-arg]


def _fat_tool(name: str, description: str) -> HarnessTool:
    """Create a fake curated tool with a long description to pad the prefix."""

    async def _allow(ctx, parsed):  # type: ignore[no-untyped-def]
        return PermissionResult.allow("test")

    async def _call(ctx, parsed, progress):  # type: ignore[no-untyped-def]
        return _Out()

    return HarnessTool(
        name=name,
        description=description,
        input_model=_In,
        output_model=_Out,
        kind="curated",
        check_permission=_allow,
        call=_call,
    )


def _big_registry() -> ToolRegistry:
    """Return a ToolRegistry whose prefix far exceeds the 2048-token minimum.

    Sonnet 4.6 requires >=2048 tokens in the frozen prefix before it will
    write a cache entry. FAKE_PROFILE's 4-tool registry is far too small.
    Each tool below has a ~500-character description (~125 tokens), so 25
    tools contribute ~3 125 tokens of tool payload alone — comfortably above
    the threshold when combined with the system-prompt text (~350 tokens) and
    JSON-schema boilerplate (~30 tokens/tool * 25 = 750 tokens).
    """
    reg = ToolRegistry.__new__(ToolRegistry)
    reg._tools = {}

    _TOOLS = [
        (
            "fake_asset_health_summary",
            (
                "[Layer L1] Returns a summary of asset health metrics for the tenant's fleet. "
                "Aggregates fault codes, downtime hours, and maintenance events across all "
                "registered devices. Use this tool when the user asks about overall fleet "
                "health, aggregate fault rates, or a high-level operational summary. "
                "Returns one row per asset class with columns: asset_class, fault_count, "
                "downtime_hours, last_maintenance_date. Filter by date range using `limit`."
            ),
        ),
        (
            "fake_device_uptime_report",
            (
                "[Layer L1] Computes per-device uptime percentage over a rolling window. "
                "Queries the telemetry event log to calculate the ratio of reported-online "
                "intervals to total wall-clock time. Use when the user asks which devices "
                "are most or least available, or wants an uptime SLA report. Returns one "
                "row per device_id with columns: device_id, device_name, uptime_pct, "
                "total_hours_sampled, last_seen_at. Ordered by uptime_pct ascending."
            ),
        ),
        (
            "fake_fault_code_histogram",
            (
                "[Layer L1] Returns a frequency histogram of fault codes raised in the "
                "specified period. Each row is one distinct fault code with its occurrence "
                "count, affected device count, and most recent trigger timestamp. Use this "
                "tool when the user asks which faults are most common, recurring, or "
                "trending. Columns: fault_code, fault_description, occurrence_count, "
                "device_count, latest_at. Ordered by occurrence_count descending."
            ),
        ),
        (
            "fake_maintenance_schedule",
            (
                "[Layer L1] Retrieves upcoming and overdue preventive maintenance tasks "
                "for the tenant fleet. Joins the maintenance calendar with the asset "
                "register to return tasks enriched with asset identifiers and location. "
                "Use when the user asks about scheduled maintenance, overdue tasks, or "
                "which assets are approaching their service interval. Columns: task_id, "
                "asset_id, asset_name, scheduled_date, status, technician_assigned."
            ),
        ),
        (
            "fake_energy_consumption_daily",
            (
                "[Layer L1] Returns daily energy consumption totals by asset or asset "
                "group. Sums kWh readings from the meter telemetry stream, normalized to "
                "calendar days in the tenant timezone. Use for energy-cost analysis, "
                "carbon-footprint reporting, or identifying high-consumption outliers. "
                "Columns: date, asset_id, asset_group, kwh_consumed, co2_kg_equivalent. "
                "Ordered by date descending, then asset_id ascending."
            ),
        ),
        (
            "fake_alarm_event_log",
            (
                "[Layer L1] Fetches raw alarm events from the operational event bus for "
                "the specified look-back window. Each row is one alarm activation or "
                "clearance event with severity, source device, and acknowledgement state. "
                "Use for incident investigation, SLA breach analysis, or identifying "
                "noisy-alarm sources. Columns: event_id, device_id, alarm_code, severity, "
                "triggered_at, cleared_at, acknowledged_by, duration_seconds."
            ),
        ),
        (
            "fake_production_output_kpi",
            (
                "[Layer L1] Returns production output KPIs aggregated by shift, line, or "
                "product SKU. Joins the production order table with the telemetry counter "
                "feed to compute units produced, reject rate, and OEE score. Use when the "
                "user asks about throughput, quality metrics, or overall equipment "
                "effectiveness. Columns: period, line_id, sku, units_produced, "
                "reject_count, reject_pct, oee_score."
            ),
        ),
        (
            "fake_sensor_anomaly_detection",
            (
                "[Layer L1] Queries the anomaly-detection result table for sensor readings "
                "that deviated beyond the configured z-score threshold in the look-back "
                "window. Use when the user reports unexpected sensor behavior or wants to "
                "know which sensors triggered anomaly alerts. Returns one row per anomaly "
                "event: sensor_id, sensor_name, anomaly_score, observed_value, "
                "expected_value, detected_at, asset_id."
            ),
        ),
        (
            "fake_spare_parts_inventory",
            (
                "[Layer L1] Returns current spare-parts inventory levels for the tenant "
                "warehouse. Joins the parts catalog with stock movements to compute "
                "on-hand quantity, reorder point, and days-of-supply remaining. Use when "
                "the user asks about parts availability, stockout risk, or upcoming "
                "procurement needs. Columns: part_number, part_name, on_hand_qty, "
                "reorder_point, days_of_supply, supplier_id."
            ),
        ),
        (
            "fake_work_order_status",
            (
                "[Layer L1] Retrieves open and recently closed work orders for the tenant "
                "fleet. Each row is one work order with its priority, assigned technician, "
                "estimated vs. actual completion time, and linked asset. Use when the user "
                "asks about outstanding repairs, mean-time-to-repair, or work-order backlog. "
                "Columns: wo_id, asset_id, priority, status, created_at, closed_at, "
                "technician_id, labor_hours_actual."
            ),
        ),
        (
            "fake_connectivity_status",
            (
                "[Layer L1] Returns real-time and historical connectivity status for all "
                "registered IoT gateways and edge devices. Includes last-heartbeat "
                "timestamp, packet-loss rate, and signal quality index. Use when the user "
                "asks which devices are offline, experiencing connectivity issues, or have "
                "not reported recently. Columns: device_id, gateway_id, status, "
                "last_heartbeat_at, packet_loss_pct, signal_quality."
            ),
        ),
        (
            "fake_throughput_trend",
            (
                "[Layer L1] Computes a rolling throughput trend (units/hour) for each "
                "production line over the specified period, compared against the target "
                "rate and the same period in the prior year. Use for trend analysis, "
                "capacity planning, or identifying lines trending below target. Columns: "
                "line_id, line_name, period, actual_units_per_hour, target_units_per_hour, "
                "prior_year_units_per_hour, pct_vs_target, pct_vs_prior_year."
            ),
        ),
        (
            "fake_environmental_readings",
            (
                "[Layer L1] Returns environmental sensor readings (temperature, humidity, "
                "pressure, particulate matter) for the specified zone and time range. "
                "Useful for compliance reporting, root-cause analysis of quality deviations, "
                "and cold-chain verification. Columns: reading_id, zone_id, sensor_type, "
                "value, unit, recorded_at, within_spec. Ordered by recorded_at descending."
            ),
        ),
        (
            "fake_operator_activity_log",
            (
                "[Layer L1] Returns a log of operator interactions with the SCADA / HMI "
                "system, including parameter changes, manual overrides, and setpoint "
                "adjustments. Use for audit trails, change management, or correlating "
                "process deviations with operator actions. Columns: log_id, operator_id, "
                "operator_name, action_type, target_device, old_value, new_value, "
                "performed_at."
            ),
        ),
        (
            "fake_batch_quality_results",
            (
                "[Layer L1] Fetches quality-control results for completed production "
                "batches, including lab test outcomes, in-process inspection pass/fail "
                "counts, and final disposition (released, quarantined, scrapped). Use "
                "when the user asks about batch quality, first-pass yield, or quarantine "
                "rates. Columns: batch_id, sku, start_time, end_time, units_produced, "
                "units_passed, units_failed, disposition, qa_approved_by."
            ),
        ),
        (
            "fake_predictive_maintenance_scores",
            (
                "[Layer L1] Returns machine-learning–derived predictive maintenance risk "
                "scores for each asset in the fleet, computed from vibration, temperature, "
                "and runtime telemetry. A score above 0.7 indicates elevated failure risk "
                "within the next 14 days. Use when the user wants to proactively identify "
                "at-risk assets. Columns: asset_id, asset_name, risk_score, risk_level, "
                "predicted_failure_date, top_contributing_factor."
            ),
        ),
        (
            "fake_shift_performance_report",
            (
                "[Layer L1] Aggregates operator and line performance metrics by shift "
                "(morning, afternoon, night). Computes units produced, fault events raised, "
                "average cycle time, and shift OEE. Use for shift-comparison analysis, "
                "identifying which shifts underperform, or benchmarking against targets. "
                "Columns: shift_date, shift_name, line_id, units_produced, fault_count, "
                "avg_cycle_time_s, oee_score, supervisor_id."
            ),
        ),
        (
            "fake_customer_order_pipeline",
            (
                "[Layer L1] Returns open customer orders and their production-readiness "
                "status, linking sales order lines to scheduled production runs and "
                "available inventory. Use when the user asks about order fulfilment risk, "
                "late orders, or production-to-order alignment. Columns: order_id, "
                "customer_id, sku, quantity_ordered, quantity_ready, scheduled_ship_date, "
                "days_until_due, at_risk."
            ),
        ),
        (
            "fake_raw_material_consumption",
            (
                "[Layer L1] Returns raw material consumption per production run, comparing "
                "actual vs. standard bill-of-materials quantities to compute yield loss and "
                "material efficiency. Use for cost variance analysis, waste reduction "
                "initiatives, or identifying over-consumption patterns. Columns: run_id, "
                "material_code, material_name, standard_qty, actual_qty, variance_qty, "
                "variance_pct, unit_of_measure."
            ),
        ),
        (
            "fake_safety_incident_log",
            (
                "[Layer L1] Retrieves safety incident and near-miss records for the "
                "tenant site, including severity classification, affected area, root-cause "
                "category, and corrective action status. Use for safety KPI dashboards, "
                "trend analysis, or regulatory compliance reporting. Columns: incident_id, "
                "incident_date, severity, area_id, affected_employees, root_cause_category, "
                "corrective_action_status, days_since_last_incident."
            ),
        ),
        (
            "fake_downtime_pareto",
            (
                "[Layer L1] Computes a Pareto ranking of downtime causes for the fleet "
                "or a specific line over the specified period. Joins stop-event records "
                "with the downtime-reason catalog to return cumulative downtime minutes "
                "and percentage contribution per cause code. Use for loss analysis and "
                "prioritising improvement projects. Columns: reason_code, reason_description, "
                "total_downtime_min, pct_of_total, cumulative_pct."
            ),
        ),
        (
            "fake_calibration_due_report",
            (
                "[Layer L1] Returns instruments and measurement devices whose calibration "
                "certificates are expired or due within the next 30 days. Use for "
                "calibration planning, audit preparation, or identifying out-of-tolerance "
                "measurement risk. Columns: instrument_id, instrument_name, location, "
                "last_calibration_date, next_due_date, days_overdue, calibration_status, "
                "responsible_technician."
            ),
        ),
        (
            "fake_water_usage_report",
            (
                "[Layer L1] Returns daily water consumption totals from the site's flow "
                "meters, segmented by process area and compared against permitted discharge "
                "limits and sustainability targets. Use for environmental reporting, ISO "
                "14001 audits, or water-efficiency projects. Columns: date, area_id, "
                "area_name, cubic_meters_consumed, target_cubic_meters, variance_pct, "
                "within_permit."
            ),
        ),
        (
            "fake_iot_firmware_versions",
            (
                "[Layer L1] Returns the current firmware version for every managed IoT "
                "device in the tenant fleet, alongside the latest available version and "
                "a flag indicating whether an update is pending or blocked. Use when "
                "the user asks about firmware currency, update campaign progress, or "
                "devices running vulnerable versions. Columns: device_id, device_model, "
                "current_version, latest_version, update_status, last_updated_at."
            ),
        ),
        (
            "fake_cost_center_allocation",
            (
                "[Layer L1] Returns actual vs. budgeted cost allocations by cost centre "
                "for the current fiscal period, broken down by cost category (labour, "
                "materials, energy, maintenance). Use for variance reporting, budget "
                "review preparation, or identifying overspending cost centres. Columns: "
                "cost_centre_id, cost_centre_name, category, budgeted_amount, "
                "actual_amount, variance_amount, variance_pct, period."
            ),
        ),
    ]

    for name, description in _TOOLS:
        reg.register(_fat_tool(name, description))

    return reg


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prefix_caches_across_two_runs() -> None:
    runner = AgentLoopRunner(
        model=get_chat_model("claude-sonnet-4-6"),
        registry=_big_registry(),
        settings=HarnessSettings(agents_agentic_max_turns=2),
        profile=FAKE_PROFILE,
    )
    ctx = UserRequest(message="hola", tenant_id="acme", mode="agentic").to_context()

    first = await runner.run(
        user_message="Say hello, do not call tools.",
        ctx=ctx,
        prior_messages=[],
        progress=lambda e: None,
    )
    second = await runner.run(
        user_message="Say hello again, do not call tools.",
        ctx=ctx,
        prior_messages=[],
        progress=lambda e: None,
    )

    assert first["usage_log"], "first run returned no usage_log entries"
    assert second["usage_log"], "second run returned no usage_log entries"

    first_created, first_read = _cache_tokens(first["usage_log"][0])
    second_created, second_read = _cache_tokens(second["usage_log"][0])

    # Call 1: the prefix must be EITHER newly cached (cold start) OR already cached
    # from a very recent prior run still within the 5-minute TTL window.
    # Either outcome proves the prefix exceeds the 2048-token minimum.
    # Cold start: first_created > 0, first_read == 0
    # Warm cache: first_read > 0, first_created == 0 (prior run's cache still live)
    assert first_created + first_read > 0, (
        f"call 1 saw zero cache activity — prefix is likely below the 2048-token "
        f"minimum or a cache_control marker is misplaced. "
        f"usage_log[0]={first['usage_log'][0]}"
    )
    # Call 2: must read from cache regardless of whether call 1 created or hit it.
    # A silent invalidator (unstable bytes in the prefix) would cause a fresh
    # cache WRITE here instead of a read, making second_read == 0.
    assert second_read > 0, (
        f"second run missed the cache — silent invalidator may be injecting "
        f"unstable bytes into the prefix between calls. "
        f"usage_log[0]={second['usage_log'][0]}"
    )
