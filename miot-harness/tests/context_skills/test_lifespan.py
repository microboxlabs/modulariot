from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _seed_skills(skills_dir: Path) -> None:
    skills_dir.mkdir(parents=True, exist_ok=True)
    (skills_dir / "good.yaml").write_text(
        "kind: http\nid: ping\ntool_name: ping\nurl: https://api.example/ping\n",
        encoding="utf-8",
    )
    # Malformed manifest: missing required `url`.
    (skills_dir / "bad.yaml").write_text(
        "kind: http\nid: broken\ntool_name: broken\n", encoding="utf-8"
    )


def _common_env(monkeypatch, tmp_path: Path) -> Path:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path / "ws"))
    skills_dir = tmp_path / "skills"
    _seed_skills(skills_dir)
    monkeypatch.setenv("MIOT_HARNESS_SKILLS_DIR", str(skills_dir))
    monkeypatch.setenv("MIOT_HARNESS_CONTEXT_DIR", str(tmp_path / "context"))
    return skills_dir


def test_lifespan_loads_connector_and_surfaces_diagnostic(monkeypatch, tmp_path):
    _common_env(monkeypatch, tmp_path)
    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        # Good connector registered even though the datasource is disabled.
        assert "skill_ping" in app.state.context_skills_registered
        assert app.state.harness.context_skills is not None
        # The malformed manifest produced a diagnostic, not a crash.
        levels = {d.level for d in app.state.context_skills_diagnostics}
        assert "error" in levels
        body = resp.json()
        assert "skill_ping" in body["context_skills"]["connector_tools"]


def test_lifespan_strict_mode_fails_readiness(monkeypatch, tmp_path):
    _common_env(monkeypatch, tmp_path)
    monkeypatch.setenv("MIOT_HARNESS_CONTEXT_SKILLS_STRICT", "true")
    app = create_app()
    with TestClient(app) as client:
        # No DSN → datasource not required, so readiness would be 200 — but
        # the malformed manifest under strict mode forces a 503.
        resp = client.get("/health/ready")
        assert resp.status_code == 503


def test_lifespan_survives_loader_crash(monkeypatch, tmp_path):
    _common_env(monkeypatch, tmp_path)
    with patch(
        "miot_harness.api.server.boot_context_skills",
        side_effect=RuntimeError("boom"),
    ):
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200
            assert app.state.harness.context_skills is None
