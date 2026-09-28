from __future__ import annotations

from typing import Any

import pytest

from miot_harness.datasource.profile import safe_profile
from miot_harness.datasource.safe_sql import AllowlistViolation
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from tests.fixtures.recording_pool import RecordingPool

OPS = SchemaAllowlistPolicy(frozenset({"ops"}))


def _responder(est_rows: int) -> Any:
    def respond(sql: str) -> list[dict[str, Any]]:
        if "FROM pg_attribute" in sql:
            return [
                {"name": "code", "type": "text", "comment": None, "est_rows": est_rows},
                {
                    "name": "minutes",
                    "type": "integer",
                    "comment": "minutes moving",
                    "est_rows": est_rows,
                },
                {"name": "detail", "type": "jsonb", "comment": None, "est_rows": est_rows},
            ]
        if sql.startswith("SELECT count(*) AS n"):
            return [{"n": 100}]
        if "jsonb_object_keys" in sql:
            return [{"key": "speeding", "n": 40}]
        if 'count("detail") AS non_null' in sql:
            return [{"non_null": 80, "distinct_n": 30}]
        if "::text AS v FROM" in sql and "GROUP BY" not in sql:
            return [{"v": '{"speeding": {"t": 1}}'}]
        if 'count(DISTINCT "code")' in sql:
            return [{"non_null": 100, "distinct_n": 90}]
        if 'count(DISTINCT "minutes")' in sql:
            return [{"non_null": 95, "distinct_n": 50, "min": "3", "max": "700"}]
        if "GROUP BY 1 ORDER BY 2 DESC" in sql:
            return [{"v": "SV1", "n": 2}]
        return []

    return respond


@pytest.mark.asyncio
async def test_profile_reports_what_each_column_holds() -> None:
    pool = RecordingPool(responder=_responder(100))
    profile = await safe_profile(pool=pool, policy=OPS, table="ops.trips")
    by_name = {c["name"]: c for c in profile["columns"]}
    assert profile["sample"] == "all rows"
    assert by_name["code"] == {
        "name": "code",
        "type": "text",
        "null_pct": 0.0,
        "distinct": 90,
        "top": [["SV1", 2]],
    }
    assert by_name["minutes"]["comment"] == "minutes moving"
    assert (by_name["minutes"]["min"], by_name["minutes"]["max"]) == ("3", "700")
    assert by_name["minutes"]["null_pct"] == 5.0
    assert by_name["detail"]["json_keys"] == [["speeding", 40]]
    assert by_name["detail"]["null_pct"] == 20.0
    assert by_name["detail"]["distinct"] == 30
    assert by_name["minutes"]["top"] == [["SV1", 2]]
    assert pool.conn.txn_readonly is True


@pytest.mark.asyncio
async def test_a_large_table_is_sampled_by_pages() -> None:
    pool = RecordingPool(responder=_responder(10_000_000))
    profile = await safe_profile(pool=pool, policy=OPS, table="ops.trips", columns=["code"])
    assert profile["sample"] == "random pages"
    assert [c["name"] for c in profile["columns"]] == ["code"]
    sampled = [sql for sql, _ in pool.conn.fetched if "FROM pg_attribute" not in sql]
    assert sampled
    assert all("TABLESAMPLE SYSTEM (0.1000) REPEATABLE (7)" in sql for sql in sampled)


@pytest.mark.asyncio
async def test_a_stale_estimate_that_hits_the_limit_reports_first_rows() -> None:
    def respond(sql: str) -> list[dict[str, Any]]:
        if "FROM pg_attribute" in sql:
            return [{"name": "code", "type": "text", "comment": None, "est_rows": 10}]
        if sql.startswith("SELECT count(*) AS n"):
            return [{"n": 50_000}]
        return [{"non_null": 50_000, "distinct_n": 0}]

    profile = await safe_profile(pool=RecordingPool(responder=respond), policy=OPS, table="ops.t")
    assert profile["sample"] == "first rows"


@pytest.mark.asyncio
async def test_array_columns_get_no_min_max_or_top() -> None:
    def respond(sql: str) -> list[dict[str, Any]]:
        if "FROM pg_attribute" in sql:
            return [{"name": "ids", "type": "integer[]", "comment": None, "est_rows": 10}]
        if sql.startswith("SELECT count(*) AS n"):
            return [{"n": 10}]
        return [{"non_null": 10, "distinct_n": 4}]

    pool = RecordingPool(responder=respond)
    profile = await safe_profile(pool=pool, policy=OPS, table="ops.t")
    assert profile["columns"] == [
        {"name": "ids", "type": "integer[]", "null_pct": 0.0, "distinct": 4}
    ]
    assert not any("min(" in sql or "GROUP BY" in sql for sql, _ in pool.conn.fetched)


@pytest.mark.asyncio
async def test_profile_refuses_tables_outside_the_allowlist() -> None:
    with pytest.raises(AllowlistViolation):
        await safe_profile(pool=RecordingPool(), policy=OPS, table="public.users")


@pytest.mark.asyncio
async def test_a_column_name_that_cannot_be_quoted_is_skipped() -> None:
    def respond(sql: str) -> list[dict[str, Any]]:
        if "FROM pg_attribute" in sql:
            return [
                {"name": 'we"ird', "type": "text", "comment": None, "est_rows": 10},
                {"name": "ok", "type": "text", "comment": None, "est_rows": 10},
            ]
        if sql.startswith("SELECT count(*) AS n"):
            return [{"n": 10}]
        return [{"non_null": 10, "distinct_n": 0}]

    pool = RecordingPool(responder=respond)
    profile = await safe_profile(pool=pool, policy=OPS, table="ops.trips")
    assert [c["name"] for c in profile["columns"]] == ["ok"]
