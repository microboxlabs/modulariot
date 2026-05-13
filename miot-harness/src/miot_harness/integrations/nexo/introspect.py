"""Introspect Nexo schema: pg_proc rows + description parsing + denylist.

Three stages:
  1. parse_pg_description — pure: parses heterogeneous description formats
     (`@meta` YAML-ish blocks, `L1/L2/L3/VT:` prefix, plain text).
  2. is_denied — pure: applies the multi-layer denylist (name pattern,
     explicit names, side-effects metadata).
  3. introspect_nexo_functions — async: runs the pg_proc query and
     returns FunctionDescriptor instances ready for tool_factory.

The pure pieces are tested directly. The DB query is exercised in
the boot smoke tests (B6) and the integration tests (E2 with
pytest-postgresql).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import asyncpg

_LAYER_PREFIX_RE = re.compile(r"^(L1|L2|L3|VT)\s*:\s*", re.IGNORECASE)
_META_BLOCK_RE = re.compile(r"@meta\s*\n(.*?)\n@end", re.DOTALL)

NAME_PATTERN_DENY = re.compile(r"^fn_refresh_")
EXPLICIT_NAME_DENY = frozenset({"fn_dx_orchestrator", "fn_dx_orchestrator_auto"})


@dataclass
class ParsedDescription:
    title: str = ""
    body: str = ""
    layer: str = ""  # "L1" | "L2" | "L3" | "VT" | "meta" | ""
    meta: dict[str, str] = field(default_factory=dict)


@dataclass
class FunctionArg:
    name: str
    pg_type: str
    has_default: bool
    default_expr: str | None


@dataclass
class FunctionDescriptor:
    name: str
    proc_oid: int
    description: ParsedDescription
    args: list[FunctionArg]
    returns_kind: str  # "table" | "json" | "scalar"
    returns_columns: list[tuple[str, str]]  # (col_name, pg_type) for table-returning fns


def parse_pg_description(raw: str | None) -> ParsedDescription:
    if not raw:
        return ParsedDescription()

    text = raw.strip()
    meta: dict[str, str] = {}
    layer = ""
    title = ""
    body = text

    meta_match = _META_BLOCK_RE.search(text)
    if meta_match:
        for line in meta_match.group(1).splitlines():
            line = line.strip()
            if not line or ":" not in line:
                continue
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
        layer = "meta"
        before = text[: meta_match.start()].strip()
        after = text[meta_match.end() :].strip()
        title = before.splitlines()[0].strip() if before else ""
        rest_before = "\n".join(before.splitlines()[1:]).strip()
        body = "\n\n".join(part for part in (rest_before, after) if part)
        return ParsedDescription(title=title, body=body, layer=layer, meta=meta)

    prefix = _LAYER_PREFIX_RE.match(text)
    if prefix:
        layer = prefix.group(1).upper()
        body = text[prefix.end() :].strip()
        return ParsedDescription(title="", body=body, layer=layer, meta={})

    return ParsedDescription(title="", body=text, layer="", meta={})


def is_denied(*, name: str, meta: dict[str, str]) -> bool:
    """Multi-layer denylist gate.

    1. name pattern: fn_refresh_*
    2. explicit names: fn_dx_orchestrator{,_auto}
    3. meta side_effects != none
    """
    if NAME_PATTERN_DENY.match(name):
        return True
    if name in EXPLICIT_NAME_DENY:
        return True
    side_effects = meta.get("side_effects", "").strip().lower()
    if side_effects and side_effects != "none":
        return True
    return False


_PG_PROC_QUERY = """
SELECT
    p.oid AS proc_oid,
    p.proname AS name,
    d.description AS description,
    p.pronargs AS nargs,
    p.proargnames AS arg_names,
    pg_catalog.pg_get_function_arguments(p.oid) AS arg_signature,
    pg_catalog.pg_get_function_result(p.oid) AS result_signature,
    p.prorettype::regtype::text AS rettype_text
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_catalog.pg_description d
    ON d.objoid = p.oid AND d.classoid = 'pg_proc'::regclass
WHERE n.nspname = $1
  AND p.proname LIKE 'fn_dx_%'
ORDER BY p.proname;
"""


def _split_args(signature: str) -> list[FunctionArg]:
    """Parse `pg_get_function_arguments` output into FunctionArg list.

    Format examples:
      ""                                      → []
      "p_tenant text"                         → 1 arg, no default
      "p_tenant text DEFAULT 'mintral'"       → 1 arg, default 'mintral'
      "p_a int DEFAULT 1, p_b text"           → 2 args
    """
    if not signature.strip():
        return []
    out: list[FunctionArg] = []
    depth = 0
    buf: list[str] = []
    raw_args: list[str] = []
    for ch in signature:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            raw_args.append("".join(buf).strip())
            buf = []
            continue
        buf.append(ch)
    if buf:
        raw_args.append("".join(buf).strip())

    for raw in raw_args:
        upper = raw.upper()
        default_idx = upper.find(" DEFAULT ")
        if default_idx == -1:
            head = raw
            default_expr: str | None = None
            has_default = False
        else:
            head = raw[:default_idx].strip()
            default_expr = raw[default_idx + len(" DEFAULT ") :].strip()
            has_default = True
        head_parts = head.split(maxsplit=1)
        if len(head_parts) == 2:
            arg_name, pg_type = head_parts
        else:
            # No name (positional): synthesize
            arg_name = f"arg{len(out)}"
            pg_type = head_parts[0] if head_parts else "unknown"
        out.append(
            FunctionArg(
                name=arg_name.lstrip(),
                pg_type=pg_type.strip(),
                has_default=has_default,
                default_expr=default_expr,
            )
        )
    return out


_TABLE_RESULT_RE = re.compile(r"^\s*TABLE\s*\((.*)\)\s*$", re.IGNORECASE | re.DOTALL)


def _parse_returns(result_signature: str, rettype_text: str) -> tuple[str, list[tuple[str, str]]]:
    table_match = _TABLE_RESULT_RE.match(result_signature)
    if table_match:
        cols: list[tuple[str, str]] = []
        depth = 0
        buf: list[str] = []
        raw_cols: list[str] = []
        for ch in table_match.group(1):
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == "," and depth == 0:
                raw_cols.append("".join(buf).strip())
                buf = []
                continue
            buf.append(ch)
        if buf:
            raw_cols.append("".join(buf).strip())
        for raw in raw_cols:
            parts = raw.split(maxsplit=1)
            if len(parts) == 2:
                cols.append((parts[0], parts[1]))
        return ("table", cols)
    if rettype_text in ("json", "jsonb"):
        return ("json", [])
    return ("scalar", [])


async def introspect_nexo_functions(
    conn: asyncpg.Connection | asyncpg.Pool,
    *,
    schema: str = "nexo",
) -> list[FunctionDescriptor]:
    rows = await conn.fetch(_PG_PROC_QUERY, schema)
    out: list[FunctionDescriptor] = []
    for row in rows:
        parsed = parse_pg_description(row["description"])
        if is_denied(name=row["name"], meta=parsed.meta):
            continue
        args = _split_args(row["arg_signature"] or "")
        returns_kind, columns = _parse_returns(
            row["result_signature"] or "", row["rettype_text"] or ""
        )
        out.append(
            FunctionDescriptor(
                name=row["name"],
                proc_oid=row["proc_oid"],
                description=parsed,
                args=args,
                returns_kind=returns_kind,
                returns_columns=columns,
            )
        )
    return out


def split_args(signature: str) -> list[FunctionArg]:
    """Public re-export for tests."""
    return _split_args(signature)


def parse_returns(result_signature: str, rettype_text: str) -> tuple[str, list[tuple[str, str]]]:
    return _parse_returns(result_signature, rettype_text)


__all__ = [
    "FunctionArg",
    "FunctionDescriptor",
    "ParsedDescription",
    "introspect_nexo_functions",
    "is_denied",
    "parse_pg_description",
    "parse_returns",
    "split_args",
]
