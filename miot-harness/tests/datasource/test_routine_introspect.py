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
    assert "dep.classid = 'pg_catalog.pg_proc'::regclass" in sql
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
    routine_sql = pool.conn.fetched[-1][0]
    assert "dep.classid = 'pg_catalog.pg_proc'::regclass" in routine_sql
    assert "dep.deptype = 'e'" in routine_sql


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
        await fetch_definition(pool=pool, policy=PUBLIC, name="a.b.c")
    assert pool.conn.fetched == []


@pytest.mark.asyncio
async def test_definition_resolves_an_unqualified_name_across_allowed_schemas() -> None:
    calls: list[tuple[str, ...]] = []

    def respond(sql: str) -> list:
        # Schema order is sorted: public first (miss), then reports (hit).
        calls.append(("view" if "pg_get_viewdef" in sql else "routine",))
        if len(calls) == 4:
            return [{"kind": "f", "definition": "CREATE FUNCTION fn()", "description": ""}]
        return []

    policy = SchemaAllowlistPolicy(frozenset({"public", "reports"}))
    pool = RecordingPool(responder=respond)
    defs = await fetch_definition(pool=pool, policy=policy, name="fn")
    assert [d.qualified for d in defs] == ["reports.fn"]
    assert [args[0] for _, args in pool.conn.fetched] == ["public", "public", "reports", "reports"]


@pytest.mark.asyncio
async def test_definition_unqualified_name_not_found_returns_empty() -> None:
    pool = RecordingPool(fetch_return=[])
    assert await fetch_definition(pool=pool, policy=PUBLIC, name="nope") == []


@pytest.mark.asyncio
async def test_routines_bare_pattern_is_a_substring_match() -> None:
    pool = RecordingPool(fetch_return=_routine_rows())
    await introspect_routines(pool=pool, policy=PUBLIC, pattern="symptom")
    assert pool.conn.fetched[-1][1][1] == "%symptom%"
    await introspect_routines(pool=pool, policy=PUBLIC, pattern="symptom%")
    assert pool.conn.fetched[-1][1][1] == "symptom%"
    # A bare name is literal: its underscores are escaped, not one-char wildcards.
    await introspect_routines(pool=pool, policy=PUBLIC, pattern="fn_dx_")
    assert pool.conn.fetched[-1][1][1] == "%fn\\_dx\\_%"
    await introspect_routines(pool=pool, policy=PUBLIC, pattern="fn_%")
    assert pool.conn.fetched[-1][1][1] == "fn_%"
    await introspect_routines(pool=pool, policy=PUBLIC, pattern=None)
    assert pool.conn.fetched[-1][1][1] is None


@pytest.mark.asyncio
async def test_definition_of_a_table_does_not_fall_through_to_a_same_named_routine() -> None:
    def respond(sql: str) -> list:
        if "pg_get_viewdef" in sql:
            return [{"relkind": "r", "definition": None, "description": None}]
        if "pg_get_functiondef" in sql:
            return [{"kind": "f", "definition": "CREATE FUNCTION symptoms()", "description": ""}]
        return []

    pool = RecordingPool(responder=respond)
    defs = await fetch_definition(pool=pool, policy=PUBLIC, name="public.symptoms")
    assert defs == []
    assert len(pool.conn.fetched) == 1  # the routine query never ran
