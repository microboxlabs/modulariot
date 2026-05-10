"""Tests for the GET /health endpoint shape (T01)."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    # The "Nexo disabled" assumption requires NEITHER the file-path config
    # NOR the DSN bypass to be set in the environment.
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DSN", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_health_default_nexo_disabled() -> None:
    """Without MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT, lifespan disables Nexo and
    /health reports the deploy-readable shape with Nexo state defaults."""
    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "env" in body
    nexo = body["nexo"]
    assert nexo["enabled"] is False
    assert nexo["tools"] == []
    assert nexo["snapshot_age_minutes"] is None


def test_health_reflects_simulated_nexo_enabled_state() -> None:
    """Patching app.state after lifespan startup must reflect through the
    /health response — proves the handler reads live state, not a
    snapshot."""
    app = create_app()
    with TestClient(app) as client:
        # First call confirms baseline.
        baseline = client.get("/health").json()
        assert baseline["nexo"]["enabled"] is False

        # Simulate post-boot state mutation as if Nexo had enabled.
        app.state.nexo_enabled = True
        app.state.nexo_registered = ["coordinador_centro_control", "coordinador_servicios"]
        app.state.nexo_snapshot_age_minutes = 12.5

        body = client.get("/health").json()
    nexo = body["nexo"]
    assert nexo["enabled"] is True
    assert nexo["tools"] == [
        "coordinador_centro_control",
        "coordinador_servicios",
    ]
    assert nexo["snapshot_age_minutes"] == 12.5
