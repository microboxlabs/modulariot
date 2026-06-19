from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _clean(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_bypass_in_prod_emits_mode_denied(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_ENV", "prod")
    monkeypatch.setenv("MIOT_HARNESS_STEERING_BYPASS_POLICY", "dev_only")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs", json={"message": "hola", "permission_mode": "bypass"}
        )
    assert resp.status_code == 200
    types = [e["type"] for e in resp.json()["events"]]
    assert "steering.mode_denied" in types


def test_bypass_in_local_does_not_emit_mode_denied(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_ENV", "local")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs", json={"message": "hola", "permission_mode": "bypass"}
        )
    assert resp.status_code == 200
    types = [e["type"] for e in resp.json()["events"]]
    assert "steering.mode_denied" not in types
