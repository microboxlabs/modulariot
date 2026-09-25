"""`safe_call_routine`: rendering, gates and envelope for calling analyst functions."""

from __future__ import annotations

from typing import Any

import asyncpg
import pytest

from miot_harness.datasource.routine_call import safe_call_routine
from miot_harness.datasource.safe_sql import (
    AllowlistViolation,
    CostGateViolation,
    UnsupportedConstruct,
)
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from tests.fixtures.recording_pool import RecordingPool

PUBLIC = SchemaAllowlistPolicy(frozenset({"public"}))

_META_NONE = "@meta\nside_effects: none\n@end\nDashboard."
_META_WRITES = "@meta\nside_effects: writes audit_log\n@end\nAudit."


def _sig(
    name: str = "api_modular_symptoms_dashboard",
    *,
    schema: str = "public",
    kind: str = "f",
    secdef: bool = False,
    names: list[str] | None = None,
    types: list[str] | None = None,
    modes: list[str] | None = None,
    nargs: int | None = None,
    ndefaults: int = 0,
    description: str | None = None,
) -> dict[str, Any]:
    names = ["p_client_id", "p_days"] if names is None else names
    types = ["character varying", "integer"] if types is None else types
    return {
        "schema": schema,
        "name": name,
        "kind": kind,
        "security_definer": secdef,
        "nargs": len(types) if nargs is None else nargs,
        "ndefaults": ndefaults,
        "arg_names": names,
        "arg_modes": modes,
        "arg_types": types,
        "signature": ", ".join(f"{n} {t}" for n, t in zip(names, types, strict=False)),
        "description": description,
    }


def _pool(lookup: list[dict[str, Any]], rows: list[dict[str, Any]] | None = None) -> RecordingPool:
    def respond(sql: str) -> list[Any]:
        if "pg_catalog.pg_proc" in sql:
            return lookup
        if sql.startswith("EXPLAIN"):
            return [['[{"Plan": {"Total Cost": 12.5}}]']]
        return rows if rows is not None else [{"api_modular_symptoms_dashboard": {"n": 1}}]

    return RecordingPool(responder=respond)


@pytest.mark.asyncio
async def test_renders_named_call_with_casts_and_row_cap() -> None:
    pool = _pool([_sig(ndefaults=1)])
    run = await safe_call_routine(
        pool=pool,
        policy=PUBLIC,
        name="public.api_modular_symptoms_dashboard",
        args={"p_client_id": "abc"},
        max_rows=50,
        cost_threshold=None,
    )
    sql, params = pool.conn.fetched[-1]
    assert sql == (
        "SELECT * FROM (SELECT * FROM public.api_modular_symptoms_dashboard("
        "p_client_id => $1::text::character varying)) AS _miot_q LIMIT 50"
    )
    assert params == ("abc",)
    assert run.sql.endswith("(p_client_id => 'abc'::character varying)) AS _miot_q LIMIT 50")
    assert run.rows == [{"api_modular_symptoms_dashboard": {"n": 1}}]
    assert pool.conn.txn_readonly is True


@pytest.mark.asyncio
async def test_unqualified_name_resolves_in_allowed_schemas() -> None:
    pool = _pool([_sig(ndefaults=2)])
    await safe_call_routine(pool=pool, policy=PUBLIC, name="api_modular_symptoms_dashboard")
    lookup_sql, lookup_args = pool.conn.fetched[0]
    assert lookup_args == ("public", "api_modular_symptoms_dashboard")
    assert "SELECT * FROM public.api_modular_symptoms_dashboard()" in pool.conn.fetched[-1][0]


@pytest.mark.asyncio
async def test_dict_and_bool_arguments_travel_as_text() -> None:
    pool = _pool([_sig(names=["p_filter", "p_flag"], types=["jsonb", "boolean"])])
    await safe_call_routine(
        pool=pool,
        policy=PUBLIC,
        name="api_modular_symptoms_dashboard",
        args={"p_filter": {"a": 1}, "p_flag": True},
        cost_threshold=None,
    )
    sql, params = pool.conn.fetched[-1]
    assert "p_filter => $1::text::jsonb, p_flag => $2::text::boolean" in sql
    assert params == ('{"a": 1}', "true")


@pytest.mark.asyncio
async def test_out_arguments_are_not_call_arguments() -> None:
    pool = _pool(
        [
            _sig(
                names=["p_trip_id", "location", "speed"],
                types=["text"],
                modes=["i", "t", "t"],
                nargs=1,
            )
        ]
    )
    await safe_call_routine(
        pool=pool, policy=PUBLIC, name="api_modular_symptoms_dashboard", args={"p_trip_id": "t1"}
    )
    assert "(p_trip_id => $1::text::text)" in pool.conn.fetched[-1][0]


@pytest.mark.asyncio
async def test_missing_required_argument_names_the_signature() -> None:
    pool = _pool([_sig()])
    with pytest.raises(UnsupportedConstruct, match="do not match any signature"):
        await safe_call_routine(
            pool=pool,
            policy=PUBLIC,
            name="api_modular_symptoms_dashboard",
            args={"p_client_id": "x"},
        )
    assert len(pool.conn.fetched) == 1  # lookup only


@pytest.mark.asyncio
async def test_overloads_resolve_by_argument_names_or_refuse() -> None:
    one = _sig(names=["p_a"], types=["text"])
    two = _sig(names=["p_a", "p_b"], types=["text", "text"], ndefaults=1)
    pool = _pool([one, two])
    with pytest.raises(UnsupportedConstruct, match="ambiguous"):
        await safe_call_routine(
            pool=pool, policy=PUBLIC, name="api_modular_symptoms_dashboard", args={"p_a": "x"}
        )
    await safe_call_routine(
        pool=pool,
        policy=PUBLIC,
        name="api_modular_symptoms_dashboard",
        args={"p_a": "x", "p_b": "y"},
    )
    assert "p_b => $2::text::text" in pool.conn.fetched[-1][0]


@pytest.mark.asyncio
async def test_refuses_procedures_security_definer_and_side_effects() -> None:
    with pytest.raises(UnsupportedConstruct, match="procedure"):
        await safe_call_routine(
            pool=_pool([_sig(kind="p", ndefaults=2)]),
            policy=PUBLIC,
            name="api_modular_symptoms_dashboard",
        )
    with pytest.raises(AllowlistViolation, match="SECURITY DEFINER"):
        await safe_call_routine(
            pool=_pool([_sig(secdef=True, ndefaults=2)]),
            policy=PUBLIC,
            name="api_modular_symptoms_dashboard",
        )
    pool = _pool([_sig(secdef=True, ndefaults=2)])
    await safe_call_routine(
        pool=pool,
        policy=PUBLIC,
        name="api_modular_symptoms_dashboard",
        allow_security_definer=True,
        cost_threshold=100.0,
    )
    assert len(pool.conn.fetched) == 3  # lookup, explain, call
    with pytest.raises(UnsupportedConstruct, match="side_effects"):
        await safe_call_routine(
            pool=_pool([_sig(ndefaults=2, description=_META_WRITES)]),
            policy=PUBLIC,
            name="api_modular_symptoms_dashboard",
        )
    pool = _pool([_sig(ndefaults=2, description=_META_NONE)])
    await safe_call_routine(pool=pool, policy=PUBLIC, name="api_modular_symptoms_dashboard")


@pytest.mark.asyncio
async def test_refuses_outside_allowlist_and_unknown_before_calling() -> None:
    pool = _pool([])
    with pytest.raises(AllowlistViolation):
        await safe_call_routine(pool=pool, policy=PUBLIC, name="ims.secret_fn")
    assert pool.conn.fetched == []
    with pytest.raises(UnsupportedConstruct, match="no executable routine"):
        await safe_call_routine(pool=pool, policy=PUBLIC, name="nope")


@pytest.mark.asyncio
async def test_cost_gate_and_read_only_write_are_clean_errors() -> None:
    pool = _pool([_sig(ndefaults=2)])
    with pytest.raises(CostGateViolation):
        await safe_call_routine(
            pool=pool, policy=PUBLIC, name="api_modular_symptoms_dashboard", cost_threshold=1.0
        )

    def respond(sql: str) -> list[Any]:
        if "pg_catalog.pg_proc" in sql:
            return [_sig(ndefaults=2)]
        raise asyncpg.ReadOnlySQLTransactionError(
            "cannot execute INSERT in a read-only transaction"
        )

    with pytest.raises(UnsupportedConstruct, match="tried to write"):
        await safe_call_routine(
            pool=RecordingPool(responder=respond),
            policy=PUBLIC,
            name="api_modular_symptoms_dashboard",
            cost_threshold=None,
        )
