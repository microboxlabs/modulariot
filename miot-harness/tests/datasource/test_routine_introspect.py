"""Routine catalog + definitions: privilege filter, @meta parse, allowlist."""

from __future__ import annotations

import pytest

from miot_harness.datasource.routine_introspect import (
    fetch_definition,
    introspect_routines,
)
from miot_harness.datasource.safe_sql import AllowlistViolation, UnsupportedConstruct
from miot_harness.datasource.sql_policy import RegexTablePolicy, SchemaAllowlistPolicy
from tests.fixtures.recording_pool import RecordingPool

PUBLIC = SchemaAllowlistPolicy(frozenset({"public"}))

_META = """@meta
api: internal
source_tables: live_trip
side_effects: none
@end
Guard: asset belongs to client."""


def _routine_rows() -> list[dict]:
    return [
        {
            "schema": "public",
            "name": "_validate_asset_ownership",
            "args": "p_asset_id text, p_client_id text",
            "returns": "boolean",
            "kind": "f",
            "volatility": "s",
            "language": "sql",
            "description": _META,
            "total": 2,
        },
        {
            "schema": "public",
            "name": "accumulate_lost_signal",
            "args": "",
            "returns": "void",
            "kind": "f",
            "volatility": "v",
            "language": "plpgsql",
            "description": None,
            "total": 2,
        },
    ]


@pytest.mark.asyncio
async def test_routines_are_privilege_filtered_and_read_only() -> None:
    pool = RecordingPool(fetch_return=_routine_rows())
    catalog = await introspect_routines(pool=pool, policy=PUBLIC, pattern="%asset%")
    sql, args = pool.conn.fetched[-1]
    assert "pg_catalog.has_function_privilege(p.oid, 'EXECUTE')" in sql
    assert "pg_catalog.has_schema_privilege(n.oid, 'USAGE')" in sql
    assert "dep.deptype = 'e'" in sql
    assert args[0] == ["public"] and args[1] == "%asset%"
    assert pool.conn.txn_readonly is True
    assert catalog.total == 2
    first = catalog.routines[0]
    assert first.qualified == "public._validate_asset_ownership"
    assert first.volatility == "stable" and first.kind == "function"
    assert first.description.meta["side_effects"] == "none"
    assert first.description.meta["source_tables"] == "live_trip"
    assert catalog.routines[1].volatility == "volatile"
    assert catalog.routines[1].description.meta == {}


@pytest.mark.asyncio
async def test_routines_limit_zero_returns_only_total() -> None:
    pool = RecordingPool(fetch_return=_routine_rows())
    catalog = await introspect_routines(pool=pool, policy=PUBLIC, limit=0)
    assert catalog.total == 2 and catalog.routines == ()
    assert pool.conn.fetched[-1][1][2] == 1  # LIMIT 1 keeps the window row


@pytest.mark.asyncio
async def test_routines_not_enumerable_policy_is_empty() -> None:
    pool = RecordingPool(fetch_return=_routine_rows())
    catalog = await introspect_routines(pool=pool, policy=RegexTablePolicy("^x$"))
    assert catalog.total == 0 and pool.conn.fetched == []


@pytest.mark.asyncio
async def test_definition_of_a_view() -> None:
    def respond(sql: str) -> list:
        if "pg_get_viewdef" in sql:
            return [{"relkind": "v", "definition": "SELECT 1", "description": None}]
        return []

    pool = RecordingPool(responder=respond)
    defs = await fetch_definition(pool=pool, policy=PUBLIC, name="public.v_x")
    assert [(d.kind, d.definition) for d in defs] == [("view", "SELECT 1")]
    assert len(pool.conn.fetched) == 1  # a view match skips the routine lookup


@pytest.mark.asyncio
async def test_definition_falls_through_to_overloaded_routines() -> None:
    def respond(sql: str) -> list:
        if "pg_get_functiondef" in sql:
            return [
                {"kind": "f", "definition": "CREATE FUNCTION f(int)", "description": "a"},
                {"kind": "f", "definition": "CREATE FUNCTION f(text)", "description": "b"},
            ]
        return []

    pool = RecordingPool(responder=respond)
    defs = await fetch_definition(pool=pool, policy=PUBLIC, name="public.f")
    assert [d.description for d in defs] == ["a", "b"]
    assert all(d.kind == "function" for d in defs)


@pytest.mark.asyncio
async def test_definition_truncates_long_bodies() -> None:
    def respond(sql: str) -> list:
        if "pg_get_functiondef" in sql:
            return [{"kind": "f", "definition": "x" * 50, "description": ""}]
        return []

    pool = RecordingPool(responder=respond)
    defs = await fetch_definition(
        pool=pool, policy=PUBLIC, name="public.f", max_chars=10
    )
    assert defs[0].truncated is True and defs[0].definition.startswith("x" * 10)


@pytest.mark.asyncio
async def test_definition_refuses_outside_allowlist_before_querying() -> None:
    pool = RecordingPool(fetch_return=[])
    with pytest.raises(AllowlistViolation):
        await fetch_definition(pool=pool, policy=PUBLIC, name="ims.secret_fn")
    with pytest.raises(UnsupportedConstruct):
        await fetch_definition(pool=pool, policy=PUBLIC, name="bare_name")
    assert pool.conn.fetched == []
