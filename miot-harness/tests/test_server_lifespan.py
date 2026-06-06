from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.integrations.nexo.boot import NexoBootResult


@pytest.fixture(autouse=True)
def _settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_app_boots_without_nexo_when_dsn_unset(monkeypatch, tmp_path):
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))

    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        # Without env var, Nexo state is disabled
        assert getattr(app.state, "datasource_enabled", False) is False
        # The profile's keyword vocabulary and tenant lock are wired
        # even when the datasource is disabled: a data-keyword message
        # must still route to DATA_QUERY (where the "integration
        # disabled" answer lives), not fall through to DIRECT/OTHER.
        harness = app.state.harness
        route = harness.router.route("estado del coordinador?")
        assert route.route.value == "data_query"
        assert harness.tenant_lock == "mintral"


def test_app_boots_with_nexo_when_load_succeeds(monkeypatch, tmp_path):
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    # Provider keys required by the chat-model factory once Nexo enables
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
                    enabled=True,
                    registered=["coordinador_centro_control"],
                )
            ),
        ),
    ):
        app = create_app()
        with TestClient(app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert app.state.datasource_enabled is True
            assert app.state.datasource_provider is not None

    fake_pool.close.assert_awaited_once()


def test_app_boots_when_load_nexo_returns_disabled(monkeypatch, tmp_path):
    """ACL leak / stale snapshot — load_nexo_tools returns enabled=False
    with a reason. The app must still boot and the pool must close."""
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))

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
                return_value=NexoBootResult(enabled=False, registered=[], reason="stale")
            ),
        ),
    ):
        app = create_app()
        with TestClient(app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert app.state.datasource_enabled is False
    fake_pool.close.assert_awaited_once()


def test_app_boots_when_pool_creation_raises(monkeypatch, tmp_path):
    """Tunnel down — asyncpg.create_pool raises. App still boots."""
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))

    with patch(
        "miot_harness.integrations.nexo.provider.create_nexo_pool",
        new=AsyncMock(side_effect=ConnectionRefusedError("tunnel down")),
    ):
        app = create_app()
        with TestClient(app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert app.state.datasource_enabled is False


def test_graph_build_failure_tears_down_partial_wiring(monkeypatch, tmp_path):
    """If graph/model wiring fails AFTER a successful boot, every graph
    and meta entry point must be cleared (a live agentic_graph behind a
    disabled /health would silently keep serving) and the provider's
    pool must be closed immediately, not at app shutdown."""
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@localhost:5432/d")
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
                    enabled=True,
                    registered=["coordinador_centro_control"],
                )
            ),
        ),
        # Late failure: data_graph builds fine, agentic_graph raises —
        # exercising the partial-wiring branch of the except handler.
        patch(
            "miot_harness.api.server.build_agentic_graph",
            side_effect=RuntimeError("boom"),
        ),
    ):
        app = create_app()
        with TestClient(app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert app.state.datasource_enabled is False
            assert resp.json()["datasource"]["tools"] == []
            harness = app.state.harness
            assert harness.data_graph is None
            assert harness.agentic_graph is None
            assert harness.meta_model is None
            assert harness.llm_router is None
            # Keyword routing survives so the data routes can still
            # serve the "integration disabled" answer.
            assert harness.router.route("estado del coordinador?").route.value == "data_query"
            # Pool released during boot, not deferred to shutdown.
            fake_pool.close.assert_awaited_once()
