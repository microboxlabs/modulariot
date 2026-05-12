"""C3 — cost report aggregation (no live Langfuse needed)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from miot_harness.observability.report import (
    CostRow,
    aggregate_cost,
    parse_since,
)


def _trace(agent: str, tenant: str, mode: str, cost: float) -> dict[str, object]:
    """Mimic the projection the CLI pulls from Langfuse's trace export."""

    return {
        "attributes": {
            "modular.agent": agent,
            "modular.tenant_id": tenant,
            "modular.mode": mode,
            "gen_ai.usage.cost_usd": cost,
            "gen_ai.usage.input_tokens": 100,
            "gen_ai.usage.output_tokens": 40,
        }
    }


def test_aggregate_by_agent_sums_cost() -> None:
    rows = aggregate_cost(
        [
            _trace("filter_expert", "mintral", "auto", 0.001),
            _trace("filter_expert", "mintral", "auto", 0.002),
            _trace("domain_analyst", "mintral", "auto", 0.010),
        ],
        by="agent",
    )
    by_agent = {r.key: r for r in rows}
    assert by_agent["filter_expert"].cost_usd == Decimal("0.003000")
    assert by_agent["domain_analyst"].cost_usd == Decimal("0.010000")
    assert by_agent["filter_expert"].traces == 2
    assert by_agent["domain_analyst"].traces == 1


def test_aggregate_by_tenant_groups_by_tenant_id() -> None:
    rows = aggregate_cost(
        [
            _trace("a", "mintral", "auto", 0.01),
            _trace("a", "ams-other", "auto", 0.02),
            _trace("b", "mintral", "auto", 0.03),
        ],
        by="tenant",
    )
    by_tenant = {r.key: r for r in rows}
    assert by_tenant["mintral"].cost_usd == Decimal("0.040000")
    assert by_tenant["ams-other"].cost_usd == Decimal("0.020000")


def test_aggregate_by_mode_splits_canned_vs_agentic() -> None:
    rows = aggregate_cost(
        [
            _trace("a", "mintral", "canned", 0.01),
            _trace("a", "mintral", "agentic", 0.05),
            _trace("a", "mintral", "agentic", 0.04),
            _trace("a", "mintral", "meta", 0.001),
        ],
        by="mode",
    )
    by_mode = {r.key: r for r in rows}
    assert by_mode["canned"].cost_usd == Decimal("0.010000")
    assert by_mode["agentic"].cost_usd == Decimal("0.090000")
    assert by_mode["meta"].cost_usd == Decimal("0.001000")


def test_aggregate_skips_traces_without_cost_attr() -> None:
    rows = aggregate_cost(
        [
            _trace("a", "mintral", "auto", 0.0),
            {"attributes": {"modular.agent": "b"}},  # cost missing → skip
        ],
        by="agent",
    )
    # `a` keeps its row (cost=0 is valid); `b` is dropped.
    assert {r.key for r in rows} == {"a"}


def test_aggregate_sorts_by_cost_descending() -> None:
    rows = aggregate_cost(
        [
            _trace("low", "mintral", "auto", 0.001),
            _trace("high", "mintral", "auto", 1.0),
            _trace("mid", "mintral", "auto", 0.1),
        ],
        by="agent",
    )
    assert [r.key for r in rows] == ["high", "mid", "low"]


def test_aggregate_rejects_unknown_grouping_dimension() -> None:
    with pytest.raises(ValueError):
        aggregate_cost([], by="banana")  # type: ignore[arg-type]


def test_aggregate_returns_cost_row_with_token_totals() -> None:
    rows = aggregate_cost(
        [_trace("a", "mintral", "auto", 0.01)],
        by="agent",
    )
    assert isinstance(rows[0], CostRow)
    assert rows[0].input_tokens == 100
    assert rows[0].output_tokens == 40


@pytest.mark.parametrize(
    "spec,expected_seconds",
    [
        ("1h", 3600),
        ("24h", 86_400),
        ("7d", 7 * 86_400),
        ("30d", 30 * 86_400),
        ("90m", 90 * 60),
    ],
)
def test_parse_since_handles_common_specs(spec: str, expected_seconds: int) -> None:
    assert parse_since(spec).total_seconds() == expected_seconds


def test_parse_since_rejects_invalid_specs() -> None:
    for bad in ("", "1", "7y", "minus", "1.5d"):
        with pytest.raises(ValueError):
            parse_since(bad)
