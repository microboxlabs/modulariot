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


# An experimental connection whose backend has no registered provider yet
# (e.g. an `acs` connection pending the Phase 1 generic provider). It must NOT
# crash the lifespan; marked required: false so it doesn't gate readiness.
ACS_UNKNOWN_MD = """---
name: acs
backend: pg
dsn_env: MIOT_HARNESS_ACS_DSN
required: false
---
ACS (Alfresco) connection — awaiting the generic provider.
"""


def test_unknown_backend_disables_connection_without_crashing(monkeypatch, tmp_path):
    get_settings.cache_clear()
    conn_dir = tmp_path / "connections"
    _write(conn_dir, "nexo", NEXO_MD)
    _write(conn_dir, "acs", ACS_UNKNOWN_MD)

    monkeypatch.setenv("MIOT_HARNESS_CONNECTIONS_DIR", str(conn_dir))
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_ACS_DSN", "postgresql://citus:x@localhost:6433/db")
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
        with TestClient(app) as client:  # lifespan must not raise
            conns = app.state.connections
            assert set(conns) == {"nexo", "acs"}
            # acs has an unknown backend → disabled with a reason, but loaded.
            assert conns["acs"]["enabled"] is False
            assert "Unknown datasource kind" in (conns["acs"]["reason"] or "")
            # required: false → acs does not gate readiness; nexo (enabled) does.
            assert conns["acs"]["required"] is False
            assert client.get("/health/ready").status_code == 200

    get_settings.cache_clear()
