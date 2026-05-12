"""E3 — composable DB primitives safety gate + functional surface.

The safety surface is the high-risk piece of plan 13: the primitives
give the agent more freedom, so the gate has to be airtight. These
tests run **without a real database** — the pool is mocked. The gate
itself is exercised against sqlglot's AST parser, no DB needed.

Functional tests run the gate AND a mocked pool to exercise the
HarnessTool wrappers (parameter passing, response shape).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from miot_harness.integrations.nexo.primitives import (
    AllowlistViolation,
    CostGateViolation,
    MutationRejected,
    MultiStatementRejected,
    UnsupportedConstruct,
    nexo_describe,
    nexo_explain,
    nexo_grep,
    nexo_select,
    validate_select_sql,
)


# --------------------- Safety gate (no DB) ---------------------


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT 1; DROP TABLE nexo.dx_servicios",
        "SELECT 1 ; SELECT 2",
        "SELECT * FROM nexo.dx_servicios; INSERT INTO nexo.foo VALUES (1)",
    ],
)
def test_validator_rejects_multi_statement(sql: str) -> None:
    with pytest.raises(MultiStatementRejected):
        validate_select_sql(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO nexo.dx_servicios (id) VALUES (1)",
        "UPDATE nexo.dx_servicios SET id = 1",
        "DELETE FROM nexo.dx_servicios WHERE id = 1",
        "DROP TABLE nexo.dx_servicios",
        "TRUNCATE nexo.dx_servicios",
        "CREATE TABLE nexo.foo (id int)",
        "ALTER TABLE nexo.dx_servicios ADD COLUMN x int",
        "GRANT SELECT ON nexo.dx_servicios TO public",
    ],
)
def test_validator_rejects_mutations(sql: str) -> None:
    with pytest.raises(MutationRejected):
        validate_select_sql(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM pg_catalog.pg_proc",
        "SELECT * FROM information_schema.tables",
        "SELECT * FROM pg_class",
        "SELECT * FROM public.users",
        "SELECT * FROM nexo.private_table",  # nexo.* but not dx_*
    ],
)
def test_validator_rejects_non_allowlisted_tables(sql: str) -> None:
    with pytest.raises(AllowlistViolation):
        validate_select_sql(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM nexo.dx_servicios",
        "SELECT id, status FROM nexo.dx_servicios WHERE id = 1",
        "SELECT * FROM nexo.dx_eta_hoy ORDER BY ETA DESC LIMIT 50",
    ],
)
def test_validator_accepts_allowlisted_select(sql: str) -> None:
    validate_select_sql(sql)  # raises if rejected


def test_validator_rejects_cte_with_mutation() -> None:
    sql = (
        "WITH ins AS (INSERT INTO nexo.dx_x VALUES (1) RETURNING *) "
        "SELECT * FROM ins"
    )
    with pytest.raises((MutationRejected, UnsupportedConstruct)):
        validate_select_sql(sql)


# --------------------- Functional (mocked pool) ---------------------


class _AcquireCtx:
    """Mimic asyncpg's `pool.acquire()` return value: async context manager."""

    def __init__(self, conn: Any) -> None:
        self._conn = conn

    async def __aenter__(self) -> Any:
        return self._conn

    async def __aexit__(self, *args: Any) -> None:
        return None


class _FakePool:
    def __init__(self) -> None:
        self._conn: Any = AsyncMock()

    def acquire(self) -> _AcquireCtx:
        return _AcquireCtx(self._conn)


@pytest.fixture()
def fake_pool() -> _FakePool:
    """Sync pool.acquire() returning an async context manager — asyncpg's shape."""

    return _FakePool()


@pytest.mark.asyncio
async def test_nexo_describe_returns_columns(fake_pool: Any) -> None:
    fake_pool._conn.fetch = AsyncMock(
        return_value=[
            {"column_name": "id", "data_type": "bigint"},
            {"column_name": "status", "data_type": "text"},
        ]
    )
    result = await nexo_describe(pool=fake_pool, table="nexo.dx_servicios")
    assert result == [
        {"column_name": "id", "data_type": "bigint"},
        {"column_name": "status", "data_type": "text"},
    ]


@pytest.mark.asyncio
async def test_nexo_describe_rejects_non_allowlisted(fake_pool: Any) -> None:
    with pytest.raises(AllowlistViolation):
        await nexo_describe(pool=fake_pool, table="pg_catalog.pg_proc")


@pytest.mark.asyncio
async def test_nexo_select_caps_limit_at_hard_max(fake_pool: Any) -> None:
    """LIMIT > 5000 is clamped, never silently allowed past the cap."""

    fake_pool._conn.fetch = AsyncMock(return_value=[])
    await nexo_select(pool=fake_pool, table="nexo.dx_servicios", limit=99_999)
    # Inspect the SQL the mock saw — limit must have been clamped to 5000.
    args, _ = fake_pool._conn.fetch.call_args
    assert "LIMIT 5000" in args[0]


@pytest.mark.asyncio
async def test_nexo_select_default_limit_is_100(fake_pool: Any) -> None:
    fake_pool._conn.fetch = AsyncMock(return_value=[])
    await nexo_select(pool=fake_pool, table="nexo.dx_servicios")
    args, _ = fake_pool._conn.fetch.call_args
    assert "LIMIT 100" in args[0]


@pytest.mark.asyncio
async def test_nexo_grep_builds_ilike_where(fake_pool: Any) -> None:
    fake_pool._conn.fetch = AsyncMock(return_value=[{"id": 1}])
    await nexo_grep(
        pool=fake_pool, table="nexo.dx_servicios", column="status", pattern="%error%"
    )
    args, _ = fake_pool._conn.fetch.call_args
    sql = args[0]
    assert 'ILIKE' in sql.upper() or 'ILIKE' in sql
    assert '"status"' in sql or "status" in sql


@pytest.mark.asyncio
async def test_nexo_explain_refuses_above_cost_threshold(fake_pool: Any) -> None:
    expensive_plan = [
        {"QUERY PLAN": [{"Plan": {"Total Cost": 99999.99, "Node Type": "Seq Scan"}}]}
    ]
    fake_pool._conn.fetch = AsyncMock(return_value=expensive_plan)
    with pytest.raises(CostGateViolation):
        await nexo_explain(
            pool=fake_pool,
            query="SELECT * FROM nexo.dx_servicios",
            cost_threshold=10_000.0,
        )


@pytest.mark.asyncio
async def test_nexo_explain_accepts_below_cost_threshold(fake_pool: Any) -> None:
    cheap_plan = [
        {"QUERY PLAN": [{"Plan": {"Total Cost": 42.5, "Node Type": "Index Scan"}}]}
    ]
    fake_pool._conn.fetch = AsyncMock(return_value=cheap_plan)
    plan = await nexo_explain(
        pool=fake_pool,
        query="SELECT * FROM nexo.dx_servicios WHERE id = 1",
        cost_threshold=10_000.0,
    )
    assert plan["total_cost"] == pytest.approx(42.5)
    assert plan["node_type"] == "Index Scan"
