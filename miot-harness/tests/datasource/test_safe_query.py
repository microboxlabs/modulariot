"""Generic safe-query primitives + read-only execution envelope (Phase 1).

No real DB: a recording fake connection captures the transaction mode, the
`SET LOCAL statement_timeout`, and the SQL the DB would see. The sqlglot gate
runs for real (it needs no DB).
"""

from __future__ import annotations

from typing import Any

import pytest

from miot_harness.datasource.safe_query import (
    safe_describe,
    safe_explain,
    safe_grep,
    safe_list_tables,
    safe_select,
)
from miot_harness.datasource.safe_sql import (
    AllowlistViolation,
    CostGateViolation,
    UnsupportedConstruct,
)
from miot_harness.datasource.sql_policy import (
    RegexTablePolicy,
    SchemaAllowlistPolicy,
)

ACS = SchemaAllowlistPolicy(frozenset({"acs"}))


class _RecordingConn:
    def __init__(self, fetch_return: list[Any]) -> None:
        self.executed: list[str] = []
        self.fetched: list[tuple[str, tuple[Any, ...]]] = []
        self.txn_readonly: bool | None = None
        self._fetch_return = fetch_return

    def transaction(self, *, readonly: bool = False) -> Any:
        self.txn_readonly = readonly
        outer = self

        class _Txn:
            async def __aenter__(self_: Any) -> None:
                return None

            async def __aexit__(self_: Any, *a: Any) -> None:
                return None

        del outer
        return _Txn()

    async def execute(self, sql: str, *args: Any) -> None:
        self.executed.append(sql)

    async def fetch(self, sql: str, *args: Any) -> list[Any]:
        self.fetched.append((sql, args))
        return self._fetch_return


class _RecordingPool:
    def __init__(self, fetch_return: list[Any] | None = None) -> None:
        self.conn = _RecordingConn(fetch_return or [])

    def acquire(self) -> Any:
        conn = self.conn

        class _Acq:
            async def __aenter__(self_: Any) -> Any:
                return conn

            async def __aexit__(self_: Any, *a: Any) -> None:
                return None

        return _Acq()


@pytest.mark.asyncio
async def test_select_runs_read_only_with_timeout() -> None:
    pool = _RecordingPool(fetch_return=[{"id": 1}])
    rows = await safe_select(
        pool=pool, policy=ACS, table="acs.act_ru_task", limit=10
    )
    assert rows == [{"id": 1}]
    assert pool.conn.txn_readonly is True  # BEGIN READ ONLY
    assert any("statement_timeout" in s for s in pool.conn.executed)
    assert "LIMIT 10" in pool.conn.fetched[-1][0]


@pytest.mark.asyncio
async def test_select_clamps_limit_to_max_rows() -> None:
    pool = _RecordingPool(fetch_return=[])
    await safe_select(
        pool=pool, policy=ACS, table="acs.act_ru_task", limit=99_999, max_rows=200
    )
    assert "LIMIT 200" in pool.conn.fetched[-1][0]


@pytest.mark.asyncio
async def test_select_rejects_out_of_schema_table() -> None:
    pool = _RecordingPool()
    with pytest.raises(AllowlistViolation):
        await safe_select(pool=pool, policy=ACS, table="public.users")
    # Nothing reached the DB.
    assert pool.conn.fetched == []


@pytest.mark.asyncio
async def test_select_rejects_unqualified_table() -> None:
    pool = _RecordingPool()
    with pytest.raises(AllowlistViolation):
        await safe_select(pool=pool, policy=ACS, table="act_ru_task")


@pytest.mark.asyncio
async def test_select_rejects_mutation_via_shared_gate() -> None:
    pool = _RecordingPool()
    # where-clause injection attempt with a stacked statement is caught by the
    # shared gate (single-statement / mutation rules), proving reuse.
    with pytest.raises(Exception):  # noqa: B017 — any SafetyGateViolation
        await safe_select(
            pool=pool, policy=ACS, table="acs.act_ru_task", where="1=1); DROP TABLE acs.x --"
        )


@pytest.mark.asyncio
async def test_select_can_disable_timeout() -> None:
    pool = _RecordingPool(fetch_return=[])
    await safe_select(
        pool=pool,
        policy=ACS,
        table="acs.act_ru_task",
        statement_timeout_ms=None,
    )
    assert not any("statement_timeout" in s for s in pool.conn.executed)


@pytest.mark.asyncio
async def test_grep_builds_ilike_and_is_read_only() -> None:
    pool = _RecordingPool(fetch_return=[{"id": 1}])
    await safe_grep(
        pool=pool, policy=ACS, table="acs.act_ru_task", column="assignee_", pattern="%x%"
    )
    sql, args = pool.conn.fetched[-1]
    assert "ILIKE" in sql.upper()
    assert args == ("%x%",)
    assert pool.conn.txn_readonly is True


@pytest.mark.asyncio
async def test_describe_policy_checked_and_read_only() -> None:
    pool = _RecordingPool(
        fetch_return=[{"column_name": "id_", "data_type": "bigint"}]
    )
    rows = await safe_describe(pool=pool, policy=ACS, table="acs.act_ru_task")
    assert rows == [{"column_name": "id_", "data_type": "bigint"}]
    assert pool.conn.txn_readonly is True


@pytest.mark.asyncio
async def test_describe_rejects_out_of_schema() -> None:
    pool = _RecordingPool()
    with pytest.raises(AllowlistViolation):
        await safe_describe(pool=pool, policy=ACS, table="public.users")


@pytest.mark.asyncio
async def test_describe_requires_schema_qualified() -> None:
    pool = _RecordingPool()
    with pytest.raises(UnsupportedConstruct):
        await safe_describe(pool=pool, policy=ACS, table="act_ru_task")


@pytest.mark.asyncio
async def test_list_tables_scans_allowed_schemas() -> None:
    pool = _RecordingPool(
        fetch_return=[
            {"table_schema": "acs", "table_name": "act_ru_task", "table_type": "BASE TABLE"}
        ]
    )
    rows = await safe_list_tables(pool=pool, policy=ACS)
    assert rows[0]["table_name"] == "act_ru_task"
    sql, args = pool.conn.fetched[-1]
    assert "information_schema.tables" in sql
    assert args[0] == ["acs"]


@pytest.mark.asyncio
async def test_list_tables_refuses_non_enumerable_policy() -> None:
    pool = _RecordingPool()
    with pytest.raises(UnsupportedConstruct):
        await safe_list_tables(pool=pool, policy=RegexTablePolicy(r"^nexo\.dx_.*$"))


@pytest.mark.asyncio
async def test_explain_passes_under_budget() -> None:
    pool = _RecordingPool(
        fetch_return=[
            {"QUERY PLAN": [{"Plan": {"Total Cost": 42.0, "Node Type": "Seq Scan"}}]}
        ]
    )
    result = await safe_explain(
        pool=pool, policy=ACS, query="SELECT * FROM acs.act_ru_task", cost_threshold=10_000.0
    )
    assert result["total_cost"] == pytest.approx(42.0)
    assert result["node_type"] == "Seq Scan"


@pytest.mark.asyncio
async def test_explain_refuses_over_budget() -> None:
    pool = _RecordingPool(
        fetch_return=[{"QUERY PLAN": [{"Plan": {"Total Cost": 99_999.0}}]}]
    )
    with pytest.raises(CostGateViolation):
        await safe_explain(
            pool=pool, policy=ACS, query="SELECT * FROM acs.act_ru_task", cost_threshold=100.0
        )
