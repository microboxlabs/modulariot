"""File-backed connection source.

Discovers `connection.md` files under a directory and parses each into a
`Connection`. Layout (mirrors the skills/context source conventions):

    <dir>/<name>/connection.md                      -> global connection
    <dir>/tenants/<tenant_id>/<name>/connection.md  -> tenant-scoped connection

A `connection.md` is a YAML frontmatter block fenced by `---`, followed by an
optional Markdown body (the connection primer):

    ---
    name: nexo
    backend: postgres            # DataSourceProvider kind (resolve_datasource)
    dsn_env: MIOT_HARNESS_DATASOURCE_DSN   # env var holding the DSN (secret-safe)
    scope: tenant                # global | tenant
    options:
      tenant_lock: mintral
      freshness_warn_minutes: 30
      freshness_refuse_minutes: 240
    capabilities:
      curated: true
      generic_query: false
    ---

    # Nexo — Coordinador BI
    <primer markdown ...>

Contract (mirrors `SkillSource.load` / `DataSourceProvider.boot`): `load()`
MUST NOT raise for content/operational errors. Bad files are captured as
`ConnectionDiagnostic` and skipped; only a programming bug should escape.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml

from miot_harness.connections.models import (
    Connection,
    ConnectionDiagnostic,
    ConnectionLoadResult,
    ConnectionScope,
)
from miot_harness.connections.source import ConnectionSource

logger = logging.getLogger(__name__)

_CONNECTION_FILE = "connection.md"


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Return (frontmatter mapping, body). Raises ValueError if the `---`
    fences are missing or the block isn't a mapping — the caller turns that
    into a diagnostic."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("missing opening '---' frontmatter fence")
    closing = next(
        (i for i in range(1, len(lines)) if lines[i].strip() == "---"), None
    )
    if closing is None:
        raise ValueError("missing closing '---' frontmatter fence")
    front = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(front, dict):
        raise ValueError("frontmatter is not a mapping")
    body = "\n".join(lines[closing + 1 :]).strip()
    return front, body


def _coerce_connection(
    front: dict[str, Any],
    body: str,
    *,
    rel_path: str,
    default_name: str,
    scope: ConnectionScope,
    tenant_id: str | None,
) -> Connection:
    name = str(front.get("name") or default_name).strip()
    backend = str(front.get("backend") or "").strip()
    if not backend:
        raise ValueError("frontmatter field 'backend' is required")
    dsn_env = front.get("dsn_env")
    dsn = os.environ.get(str(dsn_env)) if dsn_env else None
    # Scope is derived purely from the dir convention: a connection is
    # tenant-scoped iff it lives under `tenants/<tenant_id>/`. (A globally
    # loaded connection can still be tenant-*locked* via options.tenant_lock —
    # that's a different concept, like Nexo being Mintral-only.)
    resolved_scope: ConnectionScope = scope
    options = front.get("options") or {}
    capabilities = front.get("capabilities") or {}
    required = bool(front.get("required", True))
    return Connection(
        name=name,
        backend=backend,
        dsn=dsn,
        scope=resolved_scope,
        tenant_id=tenant_id,
        options=dict(options) if isinstance(options, dict) else {},
        capabilities=(
            {str(k): bool(v) for k, v in capabilities.items()}
            if isinstance(capabilities, dict)
            else {}
        ),
        primer=body,
        required=required,
        source_path=rel_path,
    )


class FileConnectionSource(ConnectionSource):
    """Loads connections from `connection.md` files under `root`."""

    def __init__(self, root: Path) -> None:
        self._root = root

    def load(self) -> ConnectionLoadResult:
        connections: list[Connection] = []
        diagnostics: list[ConnectionDiagnostic] = []
        root = self._root
        if not root.exists():
            diagnostics.append(
                ConnectionDiagnostic(
                    str(root),
                    "warning",
                    "connections dir does not exist; no connections loaded",
                )
            )
            return ConnectionLoadResult((), tuple(diagnostics))

        for path in sorted(root.rglob(_CONNECTION_FILE)):
            scope, tenant_id, default_name = self._classify(path, root)
            rel = str(path)
            try:
                front, body = _split_frontmatter(
                    path.read_text(encoding="utf-8")
                )
                conn = _coerce_connection(
                    front,
                    body,
                    rel_path=rel,
                    default_name=default_name,
                    scope=scope,
                    tenant_id=tenant_id,
                )
            except (ValueError, OSError) as exc:
                diagnostics.append(ConnectionDiagnostic(rel, "error", str(exc)))
                continue
            connections.append(conn)

        # Stable, deterministic order: by name (the lifespan picks the primary
        # by matching the configured datasource kind, not by list position).
        connections.sort(key=lambda c: c.name)
        return ConnectionLoadResult(tuple(connections), tuple(diagnostics))

    @staticmethod
    def _classify(
        path: Path, root: Path
    ) -> tuple[ConnectionScope, str | None, str]:
        """Derive (scope, tenant_id, default_name) from the file's location:
        `tenants/<tenant_id>/<name>/connection.md` is tenant-scoped; anything
        else is global. `default_name` is the connection's parent dir name."""
        default_name = path.parent.name
        try:
            parts = path.relative_to(root).parts
        except ValueError:
            return "global", None, default_name
        if len(parts) >= 3 and parts[0] == "tenants":
            return "tenant", parts[1], default_name
        return "global", None, default_name
