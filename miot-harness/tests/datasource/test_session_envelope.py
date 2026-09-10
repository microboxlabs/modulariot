"""Session envelope: read-only + timeout as connection settings, one round trip."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from miot_harness.datasource import pool as pool_mod
from miot_harness.datasource.pool import SessionPool, create_pg_pool
from miot_harness.datasource.safe_query import fetch_readonly, safe_run_select
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from tests.fixtures.recording_pool import RecordingPool

ACS = SchemaAllowlistPolicy(frozenset({"acs"}))


class SessionRecordingPool(RecordingPool):
    session_envelope = True


@pytest.mark.asyncio
async def test_transaction_pool_passes_only_application_name(monkeypatch) -> None:
    fake = AsyncMock(return_value=object())
    monkeypatch.setattr(pool_mod.asyncpg, "create_pool", fake)
    await create_pg_pool("postgresql://u:p@h/db", application_name="miot")
    kwargs = fake.call_args.kwargs
    assert kwargs["server_settings"] == {"application_name": "miot"}
    assert "reset" not in kwargs


@pytest.mark.asyncio
async def test_session_pool_pins_read_only_and_timeout_at_connect(monkeypatch) -> None:
    fake = AsyncMock(return_value=object())
    monkeypatch.setattr(pool_mod.asyncpg, "create_pool", fake)
    pool = await create_pg_pool(
        "postgresql://u:p@h/db",
        application_name="miot",
        envelope="session",
        statement_timeout_ms=15000,
    )
    kwargs = fake.call_args.kwargs
    assert kwargs["server_settings"] == {
        "application_name": "miot",
        "default_transaction_read_only": "on",
        "statement_timeout": "15000",
    }
    assert callable(kwargs["reset"])
    assert isinstance(pool, SessionPool) and pool.session_envelope is True


@pytest.mark.asyncio
async def test_unknown_envelope_is_refused() -> None:
    with pytest.raises(ValueError):
        await create_pg_pool("postgresql://u:p@h/db", envelope="pooled")


@pytest.mark.asyncio
async def test_fetch_readonly_session_skips_begin_and_set_local() -> None:
    pool = SessionRecordingPool(fetch_return=[{"x": 1}])
    rows = await fetch_readonly(pool, "SELECT 1", statement_timeout_ms=5000)
    assert rows == [{"x": 1}]
    assert pool.conn.txn_readonly is None  # no transaction opened
    assert pool.conn.executed == []  # no SET LOCAL


@pytest.mark.asyncio
async def test_fetch_readonly_transaction_keeps_the_envelope() -> None:
    pool = RecordingPool(fetch_return=[{"x": 1}])
    await fetch_readonly(pool, "SELECT 1", statement_timeout_ms=5000)
    assert pool.conn.txn_readonly is True
    assert any("statement_timeout" in s for s in pool.conn.executed)


@pytest.mark.asyncio
async def test_run_select_session_still_applies_the_cost_gate() -> None:
    def respond(sql: str) -> list:
        if sql.startswith("EXPLAIN"):
            return [{"QUERY PLAN": [{"Plan": {"Total Cost": 12.0}}]}]
        return [{"id_": "t1"}]

    pool = SessionRecordingPool(responder=respond)
    run = await safe_run_select(
        pool=pool,
        policy=ACS,
        sql="SELECT id_ FROM acs.act_ru_task",
        max_rows=10,
        cost_threshold=100.0,
        statement_timeout_ms=5000,
    )
    assert run.rows == [{"id_": "t1"}]
    assert pool.conn.txn_readonly is None and pool.conn.executed == []
    assert [s[:7] for s, _ in pool.conn.fetched] == ["EXPLAIN", "SELECT "]
