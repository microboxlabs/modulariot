"""Phase 0 seam proof: the lifespan boots more than one connection.

A real `nexo` connection (Nexo internals patched, as in test_server_lifespan)
plus a second `fake` connection backed by the FakeProvider, both declared as
`connection.md` files in a temp connections dir. Proves the connection list is
exercised end-to-end (not just the single-connection path).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import miot_harness.datasource.registry as ds_registry
from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.integrations.nexo.boot import NexoBootResult
from tests.fixtures.fake_provider import FakeProvider
from tests.fixtures.recording_pool import RecordingPool

NEXO_MD = """---
name: nexo
backend: nexo
dsn_env: MIOT_HARNESS_DATASOURCE_DSN
options:
  tenant_lock: mintral
---
Coordinador primer.
"""

FAKE_MD = """---
name: fake
backend: fake
dsn_env: FAKE_CONN_DSN
---
Fake connection primer.
"""


def _write(root: Path, name: str, text: str) -> None:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "connection.md").write_text(text, encoding="utf-8")


def test_lifespan_boots_two_connections(monkeypatch, tmp_path):
    get_settings.cache_clear()
    # Register a second provider kind for the seam proof.
    monkeypatch.setitem(ds_registry._REGISTRY, "fake", lambda: FakeProvider())

    conn_dir = tmp_path / "connections"
    _write(conn_dir, "nexo", NEXO_MD)
    _write(conn_dir, "fake", FAKE_MD)

    monkeypatch.setenv("MIOT_HARNESS_CONNECTIONS_DIR", str(conn_dir))
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("FAKE_CONN_DSN", "fake://configured")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    fake_pool = MagicMock()
    fake_pool.close = AsyncMock()
    with (
        patch(
            "miot_harness.integrations.nexo.provider.create_nexo_pool",
            new=AsyncMock(return_value=fake_pool),
        ),
        patch(
            "miot_harness.integrations.nexo.provider.load_nexo_tools",
            new=AsyncMock(
                return_value=NexoBootResult(
                    enabled=True, registered=["coordinador_centro_control"]
                )
            ),
        ),
    ):
        app = create_app()
        with TestClient(app) as client:
            conns = app.state.connections
            # Both connections booted.
            assert set(conns) == {"nexo", "fake"}
            assert conns["nexo"]["enabled"] is True
            assert conns["fake"]["enabled"] is True
            assert conns["fake"]["backend"] == "fake"
            # Primary is nexo (the configured datasource_kind); it drives the
            # back-compat single-valued state.
            assert app.state.primary_connection_name == "nexo"
            assert app.state.datasource_enabled is True
            # Fake registered its tool into the shared registry.
            assert "fake_lookup" in app.state.harness.tools.names()
            # Readiness passes and the additive connections map is exposed.
            resp = client.get("/health/ready")
            assert resp.status_code == 200
            body = resp.json()
            assert set(body["connections"]) == {"nexo", "fake"}

    get_settings.cache_clear()


# A connection whose backend has no registered provider (typo / future backend).
# It must NOT crash the lifespan; marked required: false so it doesn't gate
# readiness. (`pg` is now a real backend — use a genuinely unknown one.)
UNKNOWN_BACKEND_MD = """---
name: legacy_oracle
backend: oracle
dsn_env: MIOT_HARNESS_ORACLE_DSN
required: false
---
A connection for a backend the harness has no provider for.
"""

# An `acs` connection on the generic `pg` backend (Phase 1). Capability declared;
# the master flag decides whether it registers tools.
ACS_PG_MD = """---
name: acs
backend: pg
dsn_env: MIOT_HARNESS_ACS_DSN
required: false
options:
  search_path: acs
capabilities:
  generic_query: true
---
ACS (Alfresco) connection — generic safe-query.
"""


class _CountingFakeProvider(FakeProvider):
    """FakeProvider that counts close() calls, to prove the lifespan closes
    non-primary providers (not just the primary)."""

    def __init__(self) -> None:
        super().__init__()
        self.close_calls = 0

    async def close(self) -> None:
        self.close_calls += 1
        await super().close()


def test_lifespan_closes_every_booted_provider(monkeypatch, tmp_path):
    get_settings.cache_clear()
    counting = _CountingFakeProvider()
    monkeypatch.setitem(ds_registry._REGISTRY, "fake", lambda: counting)

    conn_dir = tmp_path / "connections"
    _write(conn_dir, "nexo", NEXO_MD)  # primary
    _write(conn_dir, "fake", FAKE_MD)  # non-primary

    monkeypatch.setenv("MIOT_HARNESS_CONNECTIONS_DIR", str(conn_dir))
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("FAKE_CONN_DSN", "fake://configured")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    fake_pool = MagicMock()
    fake_pool.close = AsyncMock()
    with (
        patch(
            "miot_harness.integrations.nexo.provider.create_nexo_pool",
            new=AsyncMock(return_value=fake_pool),
        ),
        patch(
            "miot_harness.integrations.nexo.provider.load_nexo_tools",
            new=AsyncMock(
                return_value=NexoBootResult(
                    enabled=True, registered=["coordinador_centro_control"]
                )
            ),
        ),
    ):
        app = create_app()
        with TestClient(app) as client:  # noqa: F841 — lifespan startup
            # The non-primary fake connection booted on the counting provider.
            assert app.state.connections["fake"]["enabled"] is True
            assert counting.close_calls == 0  # not closed while serving
        # Exiting the context ran lifespan shutdown.
    assert counting.close_calls >= 1  # the non-primary provider WAS closed

    get_settings.cache_clear()


def _nexo_patches(fake_pool):
    return (
        patch(
            "miot_harness.integrations.nexo.provider.create_nexo_pool",
            new=AsyncMock(return_value=fake_pool),
        ),
        patch(
            "miot_harness.integrations.nexo.provider.load_nexo_tools",
            new=AsyncMock(
                return_value=NexoBootResult(
                    enabled=True, registered=["coordinador_centro_control"]
                )
            ),
        ),
    )


def test_unknown_backend_disables_connection_without_crashing(monkeypatch, tmp_path):
    get_settings.cache_clear()
    conn_dir = tmp_path / "connections"
    _write(conn_dir, "nexo", NEXO_MD)
    _write(conn_dir, "legacy_oracle", UNKNOWN_BACKEND_MD)

    monkeypatch.setenv("MIOT_HARNESS_CONNECTIONS_DIR", str(conn_dir))
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_ORACLE_DSN", "oracle://u:p@localhost:1521/db")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    fake_pool = MagicMock()
    fake_pool.close = AsyncMock()
    p1, p2 = _nexo_patches(fake_pool)
    with p1, p2:
        app = create_app()
        with TestClient(app) as client:  # lifespan must not raise
            conns = app.state.connections
            assert set(conns) == {"nexo", "legacy_oracle"}
            # unknown backend → disabled with a reason, but loaded.
            assert conns["legacy_oracle"]["enabled"] is False
            assert "Unknown datasource kind" in (conns["legacy_oracle"]["reason"] or "")
            # required: false → does not gate readiness; nexo (enabled) does.
            assert conns["legacy_oracle"]["required"] is False
            assert client.get("/health/ready").status_code == 200

    get_settings.cache_clear()


def test_generic_pg_registers_tools_when_flag_enabled(monkeypatch, tmp_path):
    get_settings.cache_clear()
    conn_dir = tmp_path / "connections"
    _write(conn_dir, "nexo", NEXO_MD)
    _write(conn_dir, "acs", ACS_PG_MD)

    monkeypatch.setenv("MIOT_HARNESS_CONNECTIONS_DIR", str(conn_dir))
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_ACS_DSN", "postgresql://citus:x@localhost:6433/db")
    monkeypatch.setenv("MIOT_HARNESS_GENERIC_QUERY_ENABLED", "true")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    nexo_pool = MagicMock()
    nexo_pool.close = AsyncMock()
    # Recording pool so boot-time schema introspection actually runs (Phase 2).
    acs_pool = RecordingPool(
        fetch_return=[
            {
                "table_schema": "acs",
                "table_name": "act_ru_task",
                "table_type": "BASE TABLE",
                "row_estimate": 1200,
            }
        ]
    )
    p1, p2 = _nexo_patches(nexo_pool)
    with (
        p1,
        p2,
        patch(
            "miot_harness.integrations.generic_pg.provider.create_pg_pool",
            new=AsyncMock(return_value=acs_pool),
        ),
    ):
        app = create_app()
        with TestClient(app) as client:
            conns = app.state.connections
            assert conns["acs"]["enabled"] is True
            assert conns["acs"]["backend"] == "pg"
            # Schema index introspected + recorded for /health.
            assert conns["acs"]["schema"]["table_count"] == 1
            assert conns["acs"]["schema"]["schemas"] == ["acs"]
            names = app.state.harness.tools.names()
            for t in ("acs_list_tables", "acs_describe", "acs_select", "acs_grep"):
                assert t in names
            assert client.get("/health/ready").status_code == 200

    get_settings.cache_clear()


def test_generic_pg_disabled_when_flag_off(monkeypatch, tmp_path):
    get_settings.cache_clear()
    conn_dir = tmp_path / "connections"
    _write(conn_dir, "nexo", NEXO_MD)
    _write(conn_dir, "acs", ACS_PG_MD)

    monkeypatch.setenv("MIOT_HARNESS_CONNECTIONS_DIR", str(conn_dir))
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_ACS_DSN", "postgresql://citus:x@localhost:6433/db")
    monkeypatch.delenv("MIOT_HARNESS_GENERIC_QUERY_ENABLED", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    nexo_pool = MagicMock()
    nexo_pool.close = AsyncMock()
    p1, p2 = _nexo_patches(nexo_pool)
    with p1, p2:
        app = create_app()
        with TestClient(app) as client:
            conns = app.state.connections
            # Loaded but disabled (flag off); no tools registered.
            assert conns["acs"]["enabled"] is False
            assert "disabled" in (conns["acs"]["reason"] or "")
            assert "acs_select" not in app.state.harness.tools.names()
            # required: false → still ready.
            assert client.get("/health/ready").status_code == 200

    get_settings.cache_clear()
