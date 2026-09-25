"""Trace-friendly output truncation (review item S9).

Rules:
- Lists of rows → keep first DEFAULT_ROW_CAP, append `total_count`.
- Dicts with > DEFAULT_DICT_KEY_CAP keys → keep top N + always-keep
  set (refreshed_at*, known KPI scalars), drop rest with
  `truncated_keys: [...]`.
- Always preserve `refreshed_at*` fields and any known KPI scalars
  even when capping.

The full output stays in the run record / workspace; only the
event payload / agent-visible trace is capped.
"""

from __future__ import annotations

import json
from typing import Any

DEFAULT_ROW_CAP = 5
DEFAULT_DICT_KEY_CAP = 20

_ALWAYS_KEEP_KEYS = frozenset(
    {
        # KPIs the analyst commonly cites
        "n_eta_riesgo",
        "n_pod_pendiente",
        "n_servicios",
        "n_criticos",
        "es_critico",
        "eta_clasificacion",
        "fecha_tipo",
        "delta_eta_horas",
    }
)


def _is_refreshed_at(key: object) -> bool:
    return isinstance(key, str) and key.startswith("refreshed_at")


def _truncate_list(rows: list[Any], cap: int) -> tuple[list[Any], dict[str, Any]]:
    total = len(rows)
    if total <= cap:
        return rows, {"truncated": False, "total_count": total}
    return rows[:cap], {"truncated": True, "total_count": total}


def _truncate_dict(payload: dict[str, Any], cap: int) -> tuple[dict[str, Any], dict[str, Any]]:
    if len(payload) <= cap:
        # Still recurse into list values
        out = {k: v for k, v in payload.items()}
        any_truncated = False
        truncated_keys: list[str] = []
        total_count = 0
        for k, v in payload.items():
            if isinstance(v, list):
                new_v, info = _truncate_list(v, DEFAULT_ROW_CAP)
                out[k] = new_v
                if info["truncated"]:
                    any_truncated = True
                    total_count = max(total_count, info["total_count"])
        return out, {
            "truncated": any_truncated,
            "total_count": total_count,
            "truncated_keys": truncated_keys,
        }

    # Pick keys to keep: refreshed_at_* + always-keep set + first
    # remaining keys to fill the cap.
    pinned = {k: v for k, v in payload.items() if _is_refreshed_at(k) or k in _ALWAYS_KEEP_KEYS}
    rest_keys = [k for k in payload.keys() if k not in pinned]
    budget = max(0, cap - len(pinned))
    kept = {k: payload[k] for k in rest_keys[:budget]}
    truncated_keys = list(rest_keys[budget:])
    out = {**pinned, **kept}

    # Recurse into list values
    for k, v in list(out.items()):
        if isinstance(v, list):
            new_v, _ = _truncate_list(v, DEFAULT_ROW_CAP)
            out[k] = new_v

    return out, {"truncated": True, "total_count": len(payload), "truncated_keys": truncated_keys}


def truncate_for_trace(payload: Any) -> tuple[Any, dict[str, Any]]:
    """Cap the size of a tool output for trace/event display.

    Returns (truncated_payload, info) where info has at least:
      truncated: bool, total_count: int, and (for dicts) truncated_keys.
    """
    if isinstance(payload, list):
        return _truncate_list(payload, DEFAULT_ROW_CAP)
    if isinstance(payload, dict):
        return _truncate_dict(payload, DEFAULT_DICT_KEY_CAP)
    return payload, {"truncated": False, "total_count": 1}


_PROMPT_PINNED_KEYS = ("rows", "total")


def excerpt_for_prompt(payload: Any, max_chars: int) -> tuple[str, str]:
    """Render a tool output for a judge or synthesizer prompt.

    Returns (text, note). `text` is the payload as JSON with every list capped
    at DEFAULT_ROW_CAP items, primitive values first, `rows` next, other
    containers last, at most DEFAULT_DICT_KEY_CAP keys with `rows` and `total`
    always kept, then cut at `max_chars`. `note` names everything hidden
    ("first 5 of 50 rows", "omitted keys: a, b", "cut at 2000 chars") or is
    empty when nothing was hidden.
    """
    notes: list[str] = []
    shown: Any
    if isinstance(payload, list):
        shown, info = _truncate_list(payload, DEFAULT_ROW_CAP)
        if info["truncated"]:
            notes.append(f"first {DEFAULT_ROW_CAP} of {len(payload)} rows")
    elif isinstance(payload, dict):
        primitives = [k for k, v in payload.items() if not isinstance(v, (list, dict))]
        rows_key = ["rows"] if "rows" in payload else []
        containers = [k for k in payload if k not in primitives and k != "rows"]
        ordered = primitives + rows_key + containers
        pinned = [k for k in ordered if k in _PROMPT_PINNED_KEYS]
        budget = max(0, DEFAULT_DICT_KEY_CAP - len(pinned))
        kept = pinned + [k for k in ordered if k not in pinned][:budget]
        omitted = [k for k in ordered if k not in kept]
        shown = {}
        for k in ordered:
            if k not in kept:
                continue
            v = payload[k]
            if isinstance(v, list):
                v, info = _truncate_list(v, DEFAULT_ROW_CAP)
                if info["truncated"]:
                    notes.append(f"first {DEFAULT_ROW_CAP} of {info['total_count']} {k}")
            shown[k] = v
        if omitted:
            notes.append("omitted keys: " + ", ".join(omitted))
    else:
        shown = payload
    text = json.dumps(shown, default=str)
    if len(text) > max_chars:
        text = text[:max_chars] + " ..."
        notes.append(f"cut at {max_chars} chars")
    return text, ", ".join(notes)
