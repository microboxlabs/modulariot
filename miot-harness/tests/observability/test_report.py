"""C3 — cost report aggregation (no live Langfuse needed) + E10 live fetcher."""

from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest

from miot_harness.observability.report import (
    CostRow,
    _project_langfuse_trace,
    aggregate_cost,
    fetch_traces_window,
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


# ---------------------------------------------------------------------------
# Live Langfuse fetcher (mocked httpx)
# ---------------------------------------------------------------------------


def _langfuse_trace_fixture(**overrides: object) -> dict[str, object]:
    """One trace row in the shape Langfuse's /api/public/traces returns."""

    base: dict[str, object] = {
        "id": "trace-abc",
        "name": "nexo.run",
        "userId": "odtorres",
        "sessionId": "conv-1",
        "tags": ["tenant:mintral", "mode:auto", "agent:filter_expert", "route:nexo_query"],
        "metadata": {},
        "totalCost": 0.0521,
        "timestamp": "2026-05-13T10:00:00Z",
        "projectId": "miot-harness-local",
        "environment": "local",
    }
    base.update(overrides)
    return base


def test_project_langfuse_trace_extracts_tags_and_cost() -> None:
    row = _langfuse_trace_fixture(totalCost=1.25, tags=["tenant:acme", "mode:agentic"])
    attrs = _project_langfuse_trace(row)["attributes"]
    assert attrs["modular.tenant_id"] == "acme"
    assert attrs["modular.mode"] == "agentic"
    assert attrs["gen_ai.usage.cost_usd"] == 1.25


def test_project_langfuse_trace_handles_missing_tags() -> None:
    """Traces with no tags must still project a row (cost stays grouped under '(unknown)')."""

    row = _langfuse_trace_fixture(tags=[], totalCost=0.001)
    attrs = _project_langfuse_trace(row)["attributes"]
    assert "modular.tenant_id" not in attrs
    assert "modular.mode" not in attrs
    assert attrs["gen_ai.usage.cost_usd"] == 0.001


def test_project_langfuse_trace_handles_null_total_cost() -> None:
    """Langfuse returns `totalCost: null` for traces with no LLM calls yet."""

    row = _langfuse_trace_fixture(totalCost=None)
    attrs = _project_langfuse_trace(row)["attributes"]
    assert attrs["gen_ai.usage.cost_usd"] == 0.0


def test_project_langfuse_trace_marks_multi_agent_with_sentinel() -> None:
    """A trace with multiple `agent:` tags projects `(multi)` so the
    aggregator bucket is visibly distinct from any single-agent bucket.

    Previously this projected the first `agent:` tag and silently dropped
    the rest, undercounting per-agent rollups for canned-mode runs that
    fire 3+ agents. The sentinel makes the multi-agent case
    operator-visible: billing dashboards see a `(multi)` bucket and know
    to drill down via the observations endpoint.
    """

    row = _langfuse_trace_fixture(
        tags=["agent:filter_expert", "agent:synthesizer", "tenant:mintral"]
    )
    attrs = _project_langfuse_trace(row)["attributes"]
    assert attrs["modular.agent"] == "(multi)"


def test_project_langfuse_trace_single_agent_uses_real_name() -> None:
    """Single `agent:` tag still projects the real agent name (not the sentinel)."""

    row = _langfuse_trace_fixture(tags=["agent:meta_agent", "tenant:gama", "mode:meta"])
    attrs = _project_langfuse_trace(row)["attributes"]
    assert attrs["modular.agent"] == "meta_agent"


def _mock_langfuse_transport(pages: list[dict[str, object]]) -> httpx.MockTransport:
    """Return a MockTransport that serves `pages[page-1]` per request."""

    def handler(request: httpx.Request) -> httpx.Response:
        page = int(request.url.params.get("page", "1"))
        if page > len(pages):
            return httpx.Response(200, json={"data": [], "meta": {"totalPages": len(pages)}})
        return httpx.Response(200, json=pages[page - 1])

    return httpx.MockTransport(handler)


def test_fetch_traces_window_paginates_until_total_pages() -> None:
    pages: list[dict[str, object]] = [
        {
            "data": [_langfuse_trace_fixture(id=f"t-{p}-{i}") for i in range(2)],
            "meta": {"page": p, "limit": 2, "totalItems": 6, "totalPages": 3},
        }
        for p in (1, 2, 3)
    ]
    transport = _mock_langfuse_transport(pages)
    with httpx.Client(transport=transport) as client:
        traces = fetch_traces_window(
            host="http://lf",
            public_key="pk",
            secret_key="sk",
            since=timedelta(days=1),
            client=client,
            page_size=2,
        )
    assert len(traces) == 6
    assert [t["id"] for t in traces] == ["t-1-0", "t-1-1", "t-2-0", "t-2-1", "t-3-0", "t-3-1"]


def test_fetch_traces_window_forwards_since_as_query_params() -> None:
    captured_params: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_params.append(dict(request.url.params))
        return httpx.Response(
            200, json={"data": [], "meta": {"totalPages": 0}}
        )

    transport = httpx.MockTransport(handler)
    fixed_now = datetime(2026, 5, 13, 12, 0, tzinfo=UTC)
    with httpx.Client(transport=transport) as client:
        fetch_traces_window(
            host="http://lf",
            public_key="pk",
            secret_key="sk",
            since=timedelta(days=7),
            now=fixed_now,
            client=client,
        )
    params = captured_params[0]
    assert params["toTimestamp"] == "2026-05-13T12:00:00+00:00"
    assert params["fromTimestamp"] == "2026-05-06T12:00:00+00:00"


def test_fetch_traces_window_sends_basic_auth_header() -> None:
    captured_headers: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_headers.append(dict(request.headers))
        return httpx.Response(200, json={"data": [], "meta": {"totalPages": 0}})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        fetch_traces_window(
            host="http://lf",
            public_key="pk-lf-foo",
            secret_key="sk-lf-bar",
            since=timedelta(days=1),
            client=client,
        )
    expected = "Basic " + base64.b64encode(b"pk-lf-foo:sk-lf-bar").decode()
    assert captured_headers[0]["authorization"] == expected


def test_fetch_traces_window_strips_trailing_slash_from_host() -> None:
    """`host=http://lf:3000/` should not produce a `//api/...` request."""

    seen_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        return httpx.Response(200, json={"data": [], "meta": {"totalPages": 0}})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        fetch_traces_window(
            host="http://lf:3000/",
            public_key="pk",
            secret_key="sk",
            since=timedelta(hours=1),
            client=client,
        )
    assert "//api/public/traces" not in seen_urls[0]
    assert "/api/public/traces" in seen_urls[0]
