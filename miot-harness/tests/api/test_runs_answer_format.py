"""End-to-end FastAPI tests for the answer_format feature on POST /runs.

Drives the real FastAPI app (via TestClient) with the same env-isolation and
supervisor setup used by tests/api/test_runs_stream.py.  No production-code
stubs are introduced — the renderer (answer_render.py) and supervisor wiring
from Tasks 1-4 are exercised end-to-end.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from collections.abc import Iterator
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Per-test isolation: scrub datasource env vars, pin workspace to tmp."""
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_KIND", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """A TestClient wired to a fresh app instance with no auth or datasource."""
    app = create_app()
    with TestClient(app) as tc:
        yield tc


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_omitted_format_defaults_to_markdown(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer_format"] == "markdown"
    assert isinstance(body["answer"], str)


def test_invalid_format_is_rejected_422(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi", "answer_format": "pdf"})
    assert resp.status_code == 422


def test_yaml_format_round_trips(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi", "answer_format": "yaml"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer_format"] == "yaml"
    loaded = yaml.safe_load(body["answer"])
    assert isinstance(loaded, dict)
    assert set(loaded.keys()) == {"answer"}


def test_xml_format_is_well_formed(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi", "answer_format": "xml"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer_format"] == "xml"
    root = ET.fromstring(body["answer"])
    assert root.tag == "answer"


def test_html_format_contains_markup(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi", "answer_format": "html"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer_format"] == "html"
    assert "<" in body["answer"]
