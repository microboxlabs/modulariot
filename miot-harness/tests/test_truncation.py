from __future__ import annotations

from miot_harness.utils.truncation import (
    DEFAULT_DICT_KEY_CAP,
    DEFAULT_ROW_CAP,
    truncate_for_trace,
)


def test_short_list_unchanged():
    rows = [{"a": 1}, {"a": 2}]
    out, info = truncate_for_trace(rows)
    assert out == rows
    assert info["truncated"] is False
    assert info["total_count"] == 2


def test_long_list_truncated_with_total_count():
    rows = [{"i": i} for i in range(12)]
    out, info = truncate_for_trace(rows)
    assert len(out) == DEFAULT_ROW_CAP
    assert info["truncated"] is True
    assert info["total_count"] == 12


def test_dict_with_few_keys_unchanged():
    payload = {"a": 1, "b": 2, "refreshed_at_servicios": "2026-05-08T10:00:00"}
    out, info = truncate_for_trace(payload)
    assert out == payload
    assert info["truncated"] is False


def test_dict_with_many_keys_caps_at_default_and_lists_truncated():
    payload = {f"key_{i}": i for i in range(30)}
    out, info = truncate_for_trace(payload)
    assert len(out) <= DEFAULT_DICT_KEY_CAP
    assert info["truncated"] is True
    assert "truncated_keys" in info
    assert len(info["truncated_keys"]) == 30 - DEFAULT_DICT_KEY_CAP


def test_dict_always_preserves_refreshed_at_keys():
    payload = {f"k{i}": i for i in range(50)}
    payload["refreshed_at_servicios"] = "2026-05-08T10:00:00"
    payload["refreshed_at_pod"] = "2026-05-08T10:01:00"
    out, info = truncate_for_trace(payload)
    assert "refreshed_at_servicios" in out
    assert "refreshed_at_pod" in out


def test_dict_preserves_known_kpi_scalars():
    payload = {f"filler_{i}": i for i in range(50)}
    payload["n_eta_riesgo"] = 3
    payload["n_pod_pendiente"] = 1
    payload["es_critico"] = True
    out, info = truncate_for_trace(payload)
    assert out["n_eta_riesgo"] == 3
    assert out["n_pod_pendiente"] == 1
    assert out["es_critico"] is True


def test_nested_lists_inside_dicts_also_truncated():
    payload = {
        "rows": [{"i": i} for i in range(20)],
        "n_eta_riesgo": 5,
    }
    out, info = truncate_for_trace(payload)
    assert isinstance(out["rows"], list)
    assert len(out["rows"]) == DEFAULT_ROW_CAP
    assert info.get("truncated") is True
