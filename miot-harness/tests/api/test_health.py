"""Tests for the GET /health and /health/ready endpoint shapes (T01)."""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    # The "Nexo disabled" assumption requires the DSN to be unset.
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DSN", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_health_default_nexo_disabled() -> None:
    """Without MIOT_HARNESS_NEXO_DSN, lifespan disables Nexo and
    /health reports the deploy-readable shape with datasource state defaults."""
    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "env" in body
    assert body["datasource"] == {
        "name": "nexo",
        "enabled": False,
        "tools": [],
        "snapshot_age_minutes": None,
    }


def test_health_reflects_simulated_nexo_enabled_state() -> None:
    """Patching app.state after lifespan startup must reflect through the
    /health response — proves the handler reads live state, not a
    snapshot."""
    app = create_app()
    with TestClient(app) as client:
        # First call confirms baseline.
        baseline = client.get("/health").json()
        assert baseline["datasource"]["enabled"] is False

        # Simulate post-boot state mutation as if Nexo had enabled.
        app.state.datasource_enabled = True
        app.state.datasource_registered = ["coordinador_centro_control", "coordinador_servicios"]
        app.state.datasource_snapshot_age_minutes = 12.5

        body = client.get("/health").json()
    assert body["datasource"] == {
        "name": "nexo",
        "enabled": True,
        "tools": [
            "coordinador_centro_control",
            "coordinador_servicios",
        ],
        "snapshot_age_minutes": 12.5,
    }


def test_health_ready_without_nexo_dsn_is_ready() -> None:
    """No DSN configured -> Nexo not required -> readiness probe passes."""
    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["datasource"] == {
        "name": "nexo",
        "required": False,
        "enabled": False,
        "tools": [],
        "snapshot_age_minutes": None,
    }


def test_health_ready_with_dsn_but_nexo_disabled_returns_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DSN configured but lifespan failed to enable Nexo (tunnel down,
    tools didn't register, snapshot too stale, etc.) -> readiness MUST
    fail so the Service doesn't route traffic to a half-booted pod."""
    monkeypatch.setenv("MIOT_HARNESS_NEXO_DSN", "postgresql://u:p@localhost:5432/d")
    get_settings.cache_clear()

    # Mirror tests/test_server_lifespan.py — mock pool creation to raise
    # so lifespan exercises the "Nexo disabled despite DSN" path without
    # attempting a real connect.
    with patch(
        "miot_harness.integrations.nexo.provider.create_nexo_pool",
        new=AsyncMock(side_effect=ConnectionRefusedError("tunnel down")),
    ):
        app = create_app()
        with TestClient(app) as client:
            resp = client.get("/health/ready")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "not_ready"
    ds = body["datasource"]
    assert ds["required"] is True
    assert ds["enabled"] is False


def test_health_ready_reflects_simulated_nexo_enabled_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DSN configured AND lifespan brought Nexo up -> readiness passes.

    Lifespan is stubbed-failed (so the chat-model factory isn't invoked,
    keeping the test hermetic); the enabled state is simulated by post-
    lifespan mutation of app.state, identical to how
    `test_health_reflects_simulated_nexo_enabled_state` exercises /health.
    """
    monkeypatch.setenv("MIOT_HARNESS_NEXO_DSN", "postgresql://u:p@localhost:5432/d")
    get_settings.cache_clear()
    with patch(
        "miot_harness.integrations.nexo.provider.create_nexo_pool",
        new=AsyncMock(side_effect=ConnectionRefusedError("tunnel down")),
    ):
        app = create_app()
        with TestClient(app) as client:
            app.state.datasource_enabled = True
            app.state.datasource_registered = ["coordinador_centro_control"]
            app.state.datasource_snapshot_age_minutes = 7.5
            resp = client.get("/health/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["datasource"] == {
        "name": "nexo",
        "required": True,
        "enabled": True,
        "tools": ["coordinador_centro_control"],
        "snapshot_age_minutes": 7.5,
    }
