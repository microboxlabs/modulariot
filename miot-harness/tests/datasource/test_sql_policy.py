"""Table-access policies for the shared safe-query gate (Phase 1)."""

from __future__ import annotations

from miot_harness.datasource.sql_policy import (
    RegexTablePolicy,
    SchemaAllowlistPolicy,
)


def test_regex_policy_matches_nexo_dx_only() -> None:
    p = RegexTablePolicy(r"^nexo\.dx_[a-zA-Z0-9_]+$")
    assert p.is_allowed(schema="nexo", table="dx_servicios") is True
    assert p.is_allowed(schema="nexo", table="private_table") is False
    assert p.is_allowed(schema="public", table="users") is False
    # Unqualified table → no "nexo." prefix → rejected.
    assert p.is_allowed(schema="", table="dx_servicios") is False
    # Not enumerable.
    assert p.allowed_schemas() is None


def test_schema_allowlist_accepts_in_schema_rejects_others() -> None:
    p = SchemaAllowlistPolicy(frozenset({"acs", "miot_core"}))
    assert p.is_allowed(schema="acs", table="act_ru_task") is True
    assert p.is_allowed(schema="miot_core", table="anything") is True
    assert p.is_allowed(schema="public", table="users") is False
    assert p.is_allowed(schema="nexo", table="dx_servicios") is False


def test_schema_allowlist_rejects_unqualified_tables() -> None:
    # A bare table whose resolution depends on server search_path is unsafe.
    p = SchemaAllowlistPolicy(frozenset({"acs"}))
    assert p.is_allowed(schema="", table="act_ru_task") is False


def test_schema_allowlist_is_enumerable() -> None:
    p = SchemaAllowlistPolicy(frozenset({"acs"}))
    assert p.allowed_schemas() == frozenset({"acs"})
    assert "acs" in p.describe()
