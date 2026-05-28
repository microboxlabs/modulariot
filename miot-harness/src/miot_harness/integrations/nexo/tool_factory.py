"""Build HarnessTool instances from Nexo `FunctionDescriptor`s.

The factory creates per-function:
  - input_model: pydantic BaseModel where every arg with a DEFAULT is
    Optional. Names are kept verbatim (`p_*`) so the LLM sees the same
    surface as the underlying function.
  - output_model: a thin metadata wrapper around the SQL result —
    {rows, total_count, refreshed_at, source, layer, domain, truncated}
    for table-returning fns, {data, refreshed_at, ...} for json,
    {value, refreshed_at, ...} for scalar.
  - check_permission: tenant-lock gate (defense-in-depth; the graph also
    has a tenant_gate_node that short-circuits before any LLM call).
  - call: opens a pooled connection, sets search_path, runs
    `SELECT * FROM nexo.<fn>($1, ...)` with positional args from
    `input.model_dump(exclude_none=True)`, surfaces `refreshed_at_*`
    columns into the output metadata, applies S9 truncation to row
    lists, and emits a `tool.completed` event with structured metadata.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

import asyncpg
from pydantic import BaseModel, ConfigDict, Field, create_model

from miot_harness.integrations.nexo.introspect import (
    FunctionArg,
    FunctionDescriptor,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

SHARED_FILTER_PRIMER = (
    "Shared filter contract: all coordinador_* tools accept the same set of "
    "p_* parameters with sensible defaults. Only set parameters the user "
    "explicitly asked for. Do not invent tenants — the harness is locked to "
    "Mintral. The Coordinador snapshot may be hours old; cite refreshed_at* "
    "from the result in your answer."
)

_PG_TYPE_MAP: dict[str, type] = {
    "text": str,
    "varchar": str,
    "character varying": str,
    "char": str,
    "name": str,
    "int": int,
    "int4": int,
    "integer": int,
    "smallint": int,
    "bigint": int,
    "int8": int,
    "boolean": bool,
    "bool": bool,
    "timestamp": datetime,
    "timestamptz": datetime,
    "timestamp with time zone": datetime,
    "timestamp without time zone": datetime,
    "date": date,
    "numeric": Decimal,
    "decimal": Decimal,
    "real": float,
    "double precision": float,
    "json": dict,
    "jsonb": dict,
    "uuid": str,
}


def _python_type_for(pg_type: str) -> type:
    base = pg_type.lower().strip()
    if base.endswith("[]"):
        # Arrays — strip and wrap in list[]
        inner = _python_type_for(base[:-2].strip())
        return list[inner]  # type: ignore[valid-type]
    return _PG_TYPE_MAP.get(base, Any)


def _input_model_from_args(name: str, args: list[FunctionArg]) -> type[BaseModel]:
    fields: dict[str, Any] = {}
    for arg in args:
        py_type = _python_type_for(arg.pg_type)
        if arg.has_default:
            # Optional — None means "let the function use its DEFAULT"
            fields[arg.name] = (py_type | None, Field(default=None))
        else:
            fields[arg.name] = (py_type, Field(...))
    model: type[BaseModel] = create_model(
        f"_Input_{name}",
        __config__=ConfigDict(arbitrary_types_allowed=True, extra="forbid"),
        **fields,
    )
    return model


def _output_model_for(name: str, returns_kind: str) -> type[BaseModel]:
    common: dict[str, Any] = {
        "refreshed_at": (datetime | None, Field(default=None)),
        "source": (str, Field(default="Coordinador · nexo (Citus DB)")),
        "layer": (str, Field(default="")),
        "domain": (list[str], Field(default_factory=list)),
        "truncated": (bool, Field(default=False)),
    }
    if returns_kind == "table":
        common["rows"] = (list[dict[str, Any]], Field(default_factory=list))
        common["total_count"] = (int, Field(default=0))
    elif returns_kind == "json":
        common["data"] = (dict[str, Any], Field(default_factory=dict))
    else:
        common["value"] = (Any, Field(default=None))
    output_model: type[BaseModel] = create_model(
        f"_Output_{name}",
        __config__=ConfigDict(arbitrary_types_allowed=True),
        **common,
    )
    return output_model


def _render_description(descriptor: FunctionDescriptor) -> str:
    parsed = descriptor.description
    if parsed.layer == "meta":
        body_parts = []
        if parsed.title:
            body_parts.append(parsed.title)
        if parsed.body:
            body_parts.append(parsed.body)
        meta_lines = []
        if "domain" in parsed.meta:
            meta_lines.append(f"Domain: {parsed.meta['domain']}")
        if "returns" in parsed.meta:
            meta_lines.append(f"Returns: {parsed.meta['returns']}")
        body = "\n\n".join(
            part
            for part in [
                "\n\n".join(body_parts),
                "\n".join(meta_lines),
                SHARED_FILTER_PRIMER,
            ]
            if part
        )
        return body
    if parsed.layer in {"L1", "L2", "L3", "VT"}:
        return f"[Layer {parsed.layer}] {parsed.body}\n\n{SHARED_FILTER_PRIMER}"
    return f"{parsed.body or descriptor.name}\n\n{SHARED_FILTER_PRIMER}"


def _truncate_rows(
    rows: list[dict[str, Any]], cap: int = 5
) -> tuple[list[dict[str, Any]], int, bool]:
    total = len(rows)
    if total <= cap:
        return rows, total, False
    return rows[:cap], total, True


def _extract_refreshed_at(row: dict[str, Any]) -> datetime | None:
    for key, value in row.items():
        if not isinstance(key, str):
            continue
        if key.startswith("refreshed_at") and isinstance(value, datetime):
            return value
    return None


def _row_to_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, dict):
        return dict(row)
    if hasattr(row, "items"):
        return dict(row.items())
    if hasattr(row, "_asdict"):
        return dict(row._asdict())
    return dict(row)


def _domain_from_meta(meta: dict[str, str]) -> list[str]:
    raw = meta.get("domain", "").strip()
    if not raw:
        return []
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    return [part.strip().strip("'\"") for part in raw.split(",") if part.strip()]


def build_nexo_tool(
    descriptor: FunctionDescriptor,
    *,
    pool: asyncpg.Pool,
    tenant_lock: str,
    schema: str = "nexo",
) -> HarnessTool[BaseModel, BaseModel]:
    name = "coordinador_" + descriptor.name.removeprefix("fn_dx_")
    description = _render_description(descriptor)
    input_model = _input_model_from_args(name, descriptor.args)
    output_model = _output_model_for(name, descriptor.returns_kind)
    domain = _domain_from_meta(descriptor.description.meta)
    layer = descriptor.description.layer

    async def check_permission(ctx: HarnessContext, _input: BaseModel) -> PermissionResult:
        if ctx.tenant_id != tenant_lock:
            return PermissionResult.deny(
                f"Coordinador is locked to tenant '{tenant_lock}'; refusing for '{ctx.tenant_id}'."
            )
        return PermissionResult.allow("Read-only Coordinador snapshot")

    arg_names = [a.name for a in descriptor.args]

    async def call(ctx: HarnessContext, parsed_input: BaseModel, progress: Progress) -> BaseModel:
        positional = [getattr(parsed_input, n, None) for n in arg_names]
        sql_args = ", ".join(f"${i + 1}" for i in range(len(arg_names)))
        sql = f"SELECT * FROM {schema}.{descriptor.name}({sql_args})"

        async with pool.acquire() as conn:
            async with conn.transaction(readonly=True):
                await conn.execute(f"SET LOCAL search_path TO {schema}, public")
                raw_rows = await conn.fetch(sql, *positional)

        rows = [_row_to_dict(r) for r in raw_rows]
        refreshed_at = rows[0].get("refreshed_at") if rows else None
        if refreshed_at is None and rows:
            refreshed_at = _extract_refreshed_at(rows[0])

        if descriptor.returns_kind == "table":
            kept, total, truncated = _truncate_rows(rows)
            output = output_model(
                rows=kept,
                total_count=total,
                refreshed_at=refreshed_at,
                source="Coordinador · nexo (Citus DB)",
                layer=layer,
                domain=domain,
                truncated=truncated,
            )
        elif descriptor.returns_kind == "json":
            data = rows[0] if rows else {}
            # If the JSON column was packed under a single key, unwrap it
            if len(data) == 1:
                only_value = next(iter(data.values()))
                if isinstance(only_value, dict):
                    data = only_value
            output = output_model(
                data=data,
                refreshed_at=refreshed_at,
                source="Coordinador · nexo (Citus DB)",
                layer=layer,
                domain=domain,
                truncated=False,
            )
        else:
            value: Any = None
            if rows:
                first = rows[0]
                if first:
                    value = next(iter(first.values()))
            output = output_model(
                value=value,
                refreshed_at=refreshed_at,
                source="Coordinador · nexo (Citus DB)",
                layer=layer,
                domain=domain,
                truncated=False,
            )

        # Metadata (source/refreshed_at/layer/domain/truncated) is lifted by
        # HarnessTool.invoke from the typed output_model into the
        # tool.completed event so we don't double-emit.
        return output

    return HarnessTool(
        name=name,
        description=description,
        input_model=input_model,
        output_model=output_model,
        read_only=True,
        destructive=False,
        source="Coordinador · nexo (Citus DB)",
        check_permission=check_permission,
        call=call,
    )
