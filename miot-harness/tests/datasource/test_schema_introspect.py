"""Boot-time schema introspection: index, FKs, byte-stability (Phase 2)."""

from __future__ import annotations

import pytest

from miot_harness.datasource.schema_introspect import (
    SchemaSummary,
    TableInfo,
    introspect_foreign_keys,
    introspect_schema,
)
from miot_harness.datasource.sql_policy import (
    RegexTablePolicy,
    SchemaAllowlistPolicy,
)
from tests.fixtures.recording_pool import RecordingPool

ACS = SchemaAllowlistPolicy(frozenset({"acs"}))


def _t(name: str, typ: str, est: int) -> dict:
    return {
        "table_schema": "acs",
        "table_name": name,
        "table_type": typ,
        "row_estimate": est,
    }


def _table_rows() -> list[dict]:
    return [
        _t("act_ru_task", "BASE TABLE", 1200),
        _t("act_hi_procinst", "BASE TABLE", 340000),
        _t("v_open", "VIEW", -1),
        _t("act_empty", "BASE TABLE", 0),
    ]


@pytest.mark.asyncio
async def test_introspect_builds_summary_read_only() -> None:
    pool = RecordingPool(fetch_return=_table_rows())
    summary = await introspect_schema(pool=pool, policy=ACS, connection="acs")
    assert summary.connection == "acs"
    assert summary.schemas == ("acs",)
    assert summary.total_tables == 4
    assert {t.name for t in summary.tables} == {
        "act_ru_task",
        "act_hi_procinst",
        "v_open",
        "act_empty",
    }
    # Ran inside BEGIN READ ONLY with a statement timeout.
    assert pool.conn.txn_readonly is True
    assert any("statement_timeout" in s for s in pool.conn.executed)
    # The schemas were passed as a text[] param.
    assert pool.conn.fetched[-1][1][0] == ["acs"]


@pytest.mark.asyncio
async def test_introspect_unknown_estimate_is_none() -> None:
    pool = RecordingPool(fetch_return=_table_rows())
    summary = await introspect_schema(pool=pool, policy=ACS, connection="acs")
    by_name = {t.name: t for t in summary.tables}
    assert by_name["v_open"].row_estimate is None  # reltuples -1 → unknown
    assert by_name["act_empty"].row_estimate == 0


@pytest.mark.asyncio
async def test_introspect_caps_and_marks_truncated() -> None:
    pool = RecordingPool(fetch_return=_table_rows())
    summary = await introspect_schema(
        pool=pool, policy=ACS, connection="acs", max_tables=2
    )
    assert len(summary.tables) == 2
    assert summary.total_tables == 4
    assert summary.truncated is True
    assert "more" in summary.render()


@pytest.mark.asyncio
async def test_non_enumerable_policy_yields_empty_summary() -> None:
    pool = RecordingPool(fetch_return=_table_rows())
    summary = await introspect_schema(
        pool=pool, policy=RegexTablePolicy(r"^nexo\.dx_.*$"), connection="x"
    )
    assert summary.total_tables == 0
    assert summary.tables == ()
    # Never queried (no schemas to scan).
    assert pool.conn.fetched == []


def test_render_is_byte_stable_and_readable() -> None:
    summary = SchemaSummary(
        connection="acs",
        schemas=("acs",),
        tables=(
            TableInfo("acs", "act_ru_task", "BASE TABLE", 1200),
            TableInfo("acs", "act_hi_procinst", "BASE TABLE", 340000),
            TableInfo("acs", "v_open", "VIEW", None),
        ),
        total_tables=3,
    )
    out = summary.render()
    # Stable across calls.
    assert out == summary.render()
    assert "Schema `acs` (3 tables)" in out
    assert "acs.act_ru_task · ~1k rows" in out
    assert "acs.act_hi_procinst · ~340k rows" in out
    assert "acs.v_open [view]" in out


@pytest.mark.asyncio
async def test_introspect_foreign_keys() -> None:
    pool = RecordingPool(
        fetch_return=[
            {
                "column": "execution_id_",
                "ref_schema": "acs",
                "ref_table": "act_ru_execution",
                "ref_column": "id_",
                "constraint": "act_fk_task_exe",
            }
        ]
    )
    fks = await introspect_foreign_keys(pool=pool, schema="acs", table="act_ru_task")
    assert len(fks) == 1
    assert fks[0].render() == "execution_id_ → acs.act_ru_execution.id_"
    assert pool.conn.txn_readonly is True
    assert pool.conn.fetched[-1][1] == ("acs", "act_ru_task")
