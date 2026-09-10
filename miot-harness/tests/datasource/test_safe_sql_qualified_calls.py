"""The gate admits pg_catalog builtins only: a user routine that shares an
allowlisted name, reached by schema-qualifying the call or through OPERATOR(),
must not pass."""

from __future__ import annotations

import pytest

from miot_harness.datasource.safe_sql import UnsupportedConstruct, validate_select_sql
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy

PUBLIC = SchemaAllowlistPolicy(frozenset({"public"}))


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT public.lower(name) FROM public.rules",
        "SELECT a.b.lower('x')",
        "SELECT 1 OPERATOR(public.===) 2",
        "SELECT 1 OPERATOR(pg_catalog.+) 2",
    ],
)
def test_qualified_calls_are_refused(sql: str) -> None:
    with pytest.raises(UnsupportedConstruct):
        validate_select_sql(sql, table_policy=PUBLIC)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT lower(name) FROM public.rules",
        "SELECT pg_catalog.lower(name) FROM public.rules",
        "SELECT r.name FROM public.rules AS r",
    ],
)
def test_unqualified_builtins_and_column_dots_still_pass(sql: str) -> None:
    validate_select_sql(sql, table_policy=PUBLIC)
