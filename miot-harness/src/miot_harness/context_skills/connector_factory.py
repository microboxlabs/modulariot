"""Compile a declarative HTTP connector skill into a callable HarnessTool.

The produced tool reuses the existing HarnessTool machinery verbatim:
permission gating (read_only -> allow, mutating -> approval "ask"),
progress events, and metadata lifting. Only the `call` closure is new —
it binds `{placeholders}` from validated input into a FIXED base URL,
resolves `${ENV_VAR}` header secrets from the environment at call time,
and issues the request.

Invariants enforced here (a violation raises ValueError -> the loader
turns it into a diagnostic and skips the skill, never crashing boot):

- Placeholders may fill only the path/query of the manifest URL; a
  substitution that changes scheme or host is rejected (SSRF guard).
- A header whose name looks sensitive (authorization, token, api-key,
  cookie, secret) must be a `${ENV_VAR}` reference — never a plaintext
  literal in a mounted file.
"""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import quote, urlsplit

import httpx
from pydantic import BaseModel, ConfigDict, create_model

from miot_harness.context_skills.skill_models import HttpConnectorSkill
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
_ENV_REF_RE = re.compile(r"\$\{([A-Z_][A-Z0-9_]*)\}")
_SENSITIVE_HEADER_HINTS = ("authorization", "token", "api-key", "apikey", "cookie", "secret")

_JSON_SCALAR_TYPES: dict[str, type] = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
}


class HttpToolOutput(BaseModel):
    """Generic connector output. `source` / `refreshed_at` are surfaced by
    HarnessTool's `_lift_metadata` into the tool.completed event."""

    model_config = ConfigDict(extra="allow")

    status_code: int
    body: Any = None
    source: str = ""
    refreshed_at: str | None = None


def _build_input_model(skill: HttpConnectorSkill) -> type[BaseModel]:
    """Compile the JSON-schema-lite `input_schema` into a pydantic model.

    Supports object schemas with scalar properties (string/integer/
    number/boolean); unknown types fall back to `Any`. Non-required
    fields become optional with a `None` default.
    """
    schema = skill.input_schema or {}
    properties: dict[str, Any] = schema.get("properties", {}) or {}
    required = set(schema.get("required", []) or [])
    fields: dict[str, Any] = {}
    for prop_name, prop_schema in properties.items():
        json_type = (prop_schema or {}).get("type", "string")
        py_type = _JSON_SCALAR_TYPES.get(json_type, Any)
        if prop_name in required:
            fields[prop_name] = (py_type, ...)
        else:
            fields[prop_name] = (py_type | None, None)
    model_name = f"{skill.tool_name.title().replace('_', '')}Input"
    return create_model(model_name, **fields)


def _validate_headers(skill: HttpConnectorSkill) -> None:
    for header_name, value in skill.headers.items():
        sensitive = any(hint in header_name.lower() for hint in _SENSITIVE_HEADER_HINTS)
        if sensitive and not _ENV_REF_RE.search(value):
            raise ValueError(
                f"header {header_name!r} looks sensitive but holds a literal value; "
                "use a ${ENV_VAR} reference so secrets stay out of mounted files"
            )


def _resolve_env_refs(value: str) -> str:
    """Replace every ${ENV_VAR} with its environment value at call time."""

    def _sub(match: re.Match[str]) -> str:
        name = match.group(1)
        env = os.environ.get(name)
        if env is None:
            raise RuntimeError(f"connector header references unset env var ${{{name}}}")
        return env

    return _ENV_REF_RE.sub(_sub, value)


def _bind_url(url_template: str, params: dict[str, Any]) -> str:
    """Fill `{placeholders}` from `params` into the URL, URL-encoding each
    value, then assert scheme+host are unchanged (SSRF guard)."""
    base = urlsplit(url_template)

    def _sub(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in params or params[key] is None:
            raise RuntimeError(f"URL placeholder {{{key}}} has no input value")
        return quote(str(params[key]), safe="")

    bound = _PLACEHOLDER_RE.sub(_sub, url_template)
    after = urlsplit(bound)
    if (after.scheme, after.netloc) != (base.scheme, base.netloc):
        raise RuntimeError("URL placeholder altered scheme/host; refusing (SSRF guard)")
    return bound


def build_http_tool(
    skill: HttpConnectorSkill,
    *,
    name: str,
    source_label: str,
    http_client: httpx.AsyncClient | None = None,
) -> HarnessTool[BaseModel, HttpToolOutput]:
    """Return a HarnessTool that issues `skill`'s HTTP request.

    Raises ValueError if the manifest is structurally unsafe (sensitive
    literal header, no-host URL) — the loader catches it as a diagnostic.
    """
    parsed = urlsplit(skill.url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"connector url must be absolute (scheme+host): {skill.url!r}")
    _validate_headers(skill)
    input_model = _build_input_model(skill)

    async def check_permission(
        ctx: HarnessContext, _input: BaseModel
    ) -> PermissionResult:
        if skill.read_only and not skill.destructive:
            return PermissionResult.allow(f"Read-only connector {name}")
        return PermissionResult.ask(
            f"Connector {name} performs a {skill.method} request; approval required"
        )

    async def call(
        ctx: HarnessContext, parsed_input: BaseModel, progress: Progress
    ) -> HttpToolOutput:
        params = parsed_input.model_dump()
        url = _bind_url(skill.url, params)
        headers = {k: _resolve_env_refs(v) for k, v in skill.headers.items()}
        owns_client = http_client is None
        client = http_client or httpx.AsyncClient()
        try:
            response = await client.request(
                skill.method, url, headers=headers, timeout=skill.timeout_seconds
            )
        finally:
            if owns_client:
                await client.aclose()
        try:
            body: Any = response.json()
        except ValueError:
            body = response.text
        return HttpToolOutput(
            status_code=response.status_code, body=body, source=source_label
        )

    return HarnessTool(
        name=name,
        description=skill.description or f"HTTP connector {name}",
        input_model=input_model,
        output_model=HttpToolOutput,
        read_only=skill.read_only,
        destructive=skill.destructive,
        source=source_label,
        check_permission=check_permission,
        call=call,
    )
