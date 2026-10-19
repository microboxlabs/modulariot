"""Catalog reads stay refused, and the refusal names the tools that answer them."""

from __future__ import annotations

import pytest

from miot_harness.datasource.safe_sql import SafetyGateViolation, validate_select_sql
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy

PUBLIC = SchemaAllowlistPolicy(frozenset({"public"}))


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT proname FROM pg_catalog.pg_proc",
        "SELECT proname FROM pg_proc",
        "SELECT routine_name FROM information_schema.routines",
        "SELECT pg_get_function_identity_arguments(1) FROM public.rules",
        "SELECT pg_catalog.pg_get_functiondef(1) FROM public.rules",
    ],
)
def test_catalog_reads_point_at_the_introspection_tools(sql: str) -> None:
    with pytest.raises(SafetyGateViolation) as refused:
        validate_select_sql(sql, table_policy=PUBLIC)
    assert "<connection>_functions" in str(refused.value)
    assert "<connection>_definition" in str(refused.value)


@pytest.mark.parametrize(
    "sql", ["SELECT * FROM private.secrets", "SELECT pg_sleep(1) FROM public.rules"]
)
def test_other_refusals_carry_no_catalog_hint(sql: str) -> None:
    with pytest.raises(SafetyGateViolation) as refused:
        validate_select_sql(sql, table_policy=PUBLIC)
    assert "_functions" not in str(refused.value)
