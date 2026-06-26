"""Unit tests for the connections subsystem (Phase 0)."""

from __future__ import annotations

from pathlib import Path

from miot_harness.config import HarnessSettings
from miot_harness.connections.file_source import FileConnectionSource
from miot_harness.connections.loader import load_connections, select_primary
from miot_harness.connections.models import ConnectionLoadResult
from miot_harness.connections.source import ConnectionSource

NEXO_MD = """---
name: nexo
backend: nexo
dsn_env: TEST_NEXO_DSN
options:
  tenant_lock: mintral
  freshness_refuse_minutes: 240
capabilities:
  curated: true
  generic_query: false
---

Coordinador primer body.
"""


def _write(root: Path, name: str, text: str) -> None:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "connection.md").write_text(text, encoding="utf-8")


def test_file_source_parses_connection(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("TEST_NEXO_DSN", "postgresql://u:p@h:5432/db")
    _write(tmp_path, "nexo", NEXO_MD)
    result = FileConnectionSource(tmp_path).load()
    assert [d for d in result.diagnostics if d.level == "error"] == []
    assert len(result.connections) == 1
    c = result.connections[0]
    assert c.name == "nexo"
    assert c.backend == "nexo"
    assert c.dsn == "postgresql://u:p@h:5432/db"
    assert c.scope == "global"
    assert c.tenant_id is None
    assert c.options["tenant_lock"] == "mintral"
    assert c.options["freshness_refuse_minutes"] == 240
    assert c.capabilities == {"curated": True, "generic_query": False}
    assert c.primer.strip() == "Coordinador primer body."
    assert c.configured is True
    assert c.gates_readiness is True


def test_dsn_unset_is_unconfigured_and_does_not_gate(
    tmp_path: Path, monkeypatch
) -> None:
    # Mirrors the dev no-datasource / B2 mode: dsn_env unset → dsn None →
    # connection is unconfigured and never blocks readiness.
    monkeypatch.delenv("TEST_NEXO_DSN", raising=False)
    _write(tmp_path, "nexo", NEXO_MD)
    c = FileConnectionSource(tmp_path).load().connections[0]
    assert c.dsn is None
    assert c.configured is False
    assert c.gates_readiness is False


def test_missing_backend_is_error_and_skips(tmp_path: Path) -> None:
    _write(tmp_path, "bad", "---\nname: bad\n---\nbody")
    result = FileConnectionSource(tmp_path).load()
    assert result.connections == ()
    assert any(
        d.level == "error" and "backend" in d.message for d in result.diagnostics
    )


def test_missing_frontmatter_is_error(tmp_path: Path) -> None:
    _write(tmp_path, "nofm", "no frontmatter here")
    result = FileConnectionSource(tmp_path).load()
    assert result.connections == ()
    assert any(d.level == "error" for d in result.diagnostics)


def test_missing_dir_warns(tmp_path: Path) -> None:
    result = FileConnectionSource(tmp_path / "does-not-exist").load()
    assert result.connections == ()
    assert any(d.level == "warning" for d in result.diagnostics)


def test_tenant_dir_convention(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("TEST_NEXO_DSN", "x")
    _write(tmp_path / "tenants" / "acme", "nexo", NEXO_MD)
    c = FileConnectionSource(tmp_path).load().connections[0]
    assert c.scope == "tenant"
    assert c.tenant_id == "acme"


class _EmptySource(ConnectionSource):
    def load(self) -> ConnectionLoadResult:
        return ConnectionLoadResult((), ())


def test_load_connections_synthesizes_from_legacy_env_when_no_files() -> None:
    settings = HarnessSettings(
        datasource_kind="nexo",
        datasource_dsn="postgresql://u:p@h:5432/db",
        datasource_tenant_lock="mintral",
    )
    result = load_connections(settings, source=_EmptySource())
    assert len(result.connections) == 1
    c = result.connections[0]
    assert c.name == "nexo"
    assert c.backend == "nexo"
    assert c.dsn == "postgresql://u:p@h:5432/db"
    assert c.options["tenant_lock"] == "mintral"
    assert c.source_path == "<legacy-env>"


def test_load_connections_empty_when_no_files_and_no_dsn() -> None:
    settings = HarnessSettings(datasource_kind="nexo", datasource_dsn=None)
    result = load_connections(settings, source=_EmptySource())
    assert result.connections == ()


def test_select_primary_prefers_configured_kind() -> None:
    settings = HarnessSettings(datasource_kind="nexo")
    src = ConnectionLoadResult(
        load_connections(
            HarnessSettings(
                datasource_kind="nexo",
                datasource_dsn="postgresql://u:p@h/db",
            ),
            source=_EmptySource(),
        ).connections
    )
    primary = select_primary(src.connections, settings)
    assert primary is not None
    assert primary.backend == "nexo"


def test_select_primary_none_when_empty() -> None:
    assert select_primary((), HarnessSettings()) is None
