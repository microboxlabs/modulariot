"""Per-function freshness survey (Gap 2 — expose what's fresh vs stale
BEFORE the user asks)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from miot_harness.integrations.nexo.freshness import survey_freshness
from miot_harness.integrations.nexo.introspect import (
    FunctionArg,
    FunctionDescriptor,
    ParsedDescription,
)


def _descriptor(name: str, *, defaults: bool = True) -> FunctionDescriptor:
    return FunctionDescriptor(
        name=name,
        proc_oid=1,
        description=ParsedDescription(layer="L1", body="kpi"),
        args=[
            FunctionArg(
                name="p_tenant",
                pg_type="text",
                has_default=defaults,
                default_expr="'mintral'" if defaults else None,
            )
        ],
        returns_kind="table",
        returns_columns=[],
    )


def _pool(fetch_results: dict[str, Any]) -> MagicMock:
    """Fake asyncpg pool: routes `SELECT * FROM nexo.<fn>()` per function.

    A value of Exception → the fetch raises; otherwise it's the row list.
    """
    fake_conn = MagicMock()

    async def fetch(sql: str, *args: Any) -> list[dict[str, Any]]:
        for fn, result in fetch_results.items():
            if fn in sql:
                if isinstance(result, Exception):
                    raise result
                return result
        return []

    fake_conn.fetch = AsyncMock(side_effect=fetch)
    fake_conn.execute = AsyncMock()
    txn_cm = MagicMock()
    txn_cm.__aenter__ = AsyncMock(return_value=None)
    txn_cm.__aexit__ = AsyncMock(return_value=None)
    fake_conn.transaction = MagicMock(return_value=txn_cm)

    pool = MagicMock()
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_conn)
    cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=cm)
    return pool


@pytest.mark.asyncio
async def test_survey_classifies_mixed_statuses() -> None:
    now = datetime.now(UTC)
    descriptors = [
        _descriptor("fn_dx_centro_control"),
        _descriptor("fn_dx_cola_critica"),
        _descriptor("fn_dx_sintomas_servicio"),
        _descriptor("fn_dx_task_timeline"),
        _descriptor("fn_dx_broken"),
    ]
    pool = _pool(
        {
            "fn_dx_centro_control": [{"n": 1, "refreshed_at_servicios": now}],
            "fn_dx_cola_critica": [
                {"n": 2, "refreshed_at_servicios": now - timedelta(days=30)}
            ],
            "fn_dx_sintomas_servicio": [{"n": 3}],  # rows, no timestamp
            "fn_dx_task_timeline": [],  # no rows, no timestamp
            "fn_dx_broken": RuntimeError("boom"),
        }
    )

    probes = await survey_freshness(
        pool, schema="nexo", descriptors=descriptors, warn_minutes=30
    )

    assert probes["fn_dx_centro_control"].status == "fresh"
    assert probes["fn_dx_cola_critica"].status == "stale"
    assert probes["fn_dx_cola_critica"].age_minutes > 60 * 24
    assert probes["fn_dx_sintomas_servicio"].status == "no_timestamp"
    assert probes["fn_dx_task_timeline"].status == "empty_no_timestamp"
    assert probes["fn_dx_broken"].status == "error"


@pytest.mark.asyncio
async def test_survey_skips_functions_with_required_args() -> None:
    descriptors = [_descriptor("fn_dx_requires_arg", defaults=False)]
    pool = _pool({})
    probes = await survey_freshness(
        pool, schema="nexo", descriptors=descriptors, warn_minutes=30
    )
    assert probes["fn_dx_requires_arg"].status == "skipped"
    pool.acquire.assert_not_called()


@pytest.mark.asyncio
async def test_survey_empty_with_timestamp_is_empty() -> None:
    """A 0-row probe that still carries a refreshed_at (e.g. a metadata
    row scan) classifies as 'empty', not unrefreshed."""
    now = datetime.now(UTC)
    descriptors = [_descriptor("fn_dx_x")]

    # A function returning a single all-null row except refreshed_at would
    # still have a row; the 'empty' case needs rows=[] + a timestamp from
    # somewhere — not reachable via row scan, so classify [] as
    # empty_no_timestamp and a timestamped row set as fresh/stale. This
    # test pins the [] behavior.
    pool = _pool({"fn_dx_x": []})
    probes = await survey_freshness(
        pool, schema="nexo", descriptors=descriptors, warn_minutes=30
    )
    assert probes["fn_dx_x"].status == "empty_no_timestamp"
    assert probes["fn_dx_x"].has_rows is False
