from __future__ import annotations

from miot_harness.integrations.nexo.introspect import (
    ParsedDescription,
    is_denied,
    parse_pg_description,
)

# ---------- parse_pg_description ----------


def test_parse_meta_block():
    raw = """Coordinador centro de control

@meta
domain: [services, fleet]
layer: L1
side_effects: none
returns: kpi_summary
@end

Returns top-level KPIs across services and fleet."""
    parsed = parse_pg_description(raw)

    assert isinstance(parsed, ParsedDescription)
    assert parsed.title == "Coordinador centro de control"
    assert parsed.layer == "meta"
    assert parsed.meta["side_effects"] == "none"
    assert parsed.meta["domain"] == "[services, fleet]"
    assert parsed.meta["returns"] == "kpi_summary"
    assert "Returns top-level KPIs" in parsed.body


def test_parse_layer_prefix():
    raw = "L1: top-level KPI summary"
    parsed = parse_pg_description(raw)
    assert parsed.layer == "L1"
    assert parsed.body == "top-level KPI summary"
    assert parsed.meta == {}


def test_parse_layer_prefix_multiline():
    raw = "L3: per-service drill-down\n\nIncludes events and POD details."
    parsed = parse_pg_description(raw)
    assert parsed.layer == "L3"
    assert "per-service drill-down" in parsed.body
    assert "Includes events" in parsed.body


def test_parse_vt_layer():
    parsed = parse_pg_description("VT: vista turno (handoff helper)")
    assert parsed.layer == "VT"


def test_parse_plain_text():
    raw = "Just a bare description with no layer or meta block."
    parsed = parse_pg_description(raw)
    assert parsed.layer == ""
    assert parsed.body == raw
    assert parsed.meta == {}


def test_parse_none_description():
    parsed = parse_pg_description(None)
    assert parsed.title == ""
    assert parsed.body == ""
    assert parsed.layer == ""
    assert parsed.meta == {}


def test_parse_meta_block_with_writes_side_effects():
    raw = """fn_dx_orchestrator runs refresh fan-out

@meta
side_effects: writes_to_all_dx_tables
domain: orchestration
@end

Used by n8n; not safe for agents."""
    parsed = parse_pg_description(raw)
    assert parsed.meta["side_effects"] == "writes_to_all_dx_tables"


# ---------- is_denied ----------


def test_denied_by_name_pattern():
    assert is_denied(name="fn_refresh_dx_eta_hoy", meta={}) is True
    assert is_denied(name="fn_refresh_anything", meta={}) is True


def test_denied_by_explicit_name():
    assert is_denied(name="fn_dx_orchestrator", meta={}) is True
    assert is_denied(name="fn_dx_orchestrator_auto", meta={}) is True


def test_denied_by_meta_side_effects():
    assert (
        is_denied(name="fn_dx_anything", meta={"side_effects": "writes_to_all_dx_tables"}) is True
    )
    assert is_denied(name="fn_dx_anything", meta={"side_effects": "writes_partial"}) is True


def test_allowed_when_side_effects_none():
    assert is_denied(name="fn_dx_centro_control", meta={"side_effects": "none"}) is False


def test_allowed_when_no_meta():
    assert is_denied(name="fn_dx_centro_control", meta={}) is False
