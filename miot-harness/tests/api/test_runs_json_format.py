"""End-to-end FastAPI tests for the json answer_format on POST /runs.

Drives the real FastAPI app (via TestClient) with the same env-isolation and
workspace setup used by tests/api/test_runs_answer_format.py.  No production-
code stubs are introduced.

Realistic no-LLM behavior: the direct agent returns fallback prose, so the
json finalize path wraps it in a single markdown block.  The multi-block valid
path is covered by Tasks 1, 3, and 4.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import pytest
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


def test_json_format_returns_a_block_array_string(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi", "answer_format": "json"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer_format"] == "json"
    # `answer` is a STRING containing a JSON array of blocks.
    blocks = json.loads(body["answer"])
    assert isinstance(blocks, list)
    assert all("type" in b and "value" in b for b in blocks)


def test_json_fallback_wraps_prose_as_single_markdown_block(client: TestClient) -> None:
    # No LLM in tests → the agent returns fallback prose → single markdown block.
    resp = client.post("/runs", json={"message": "hi", "answer_format": "json"})
    assert resp.status_code == 200
    blocks = json.loads(resp.json()["answer"])
    assert len(blocks) == 1
    assert blocks[0]["type"] == "markdown"
    assert isinstance(blocks[0]["value"], str) and blocks[0]["value"]


def test_invalid_format_still_422(client: TestClient) -> None:
    resp = client.post("/runs", json={"message": "hi", "answer_format": "pdf"})
    assert resp.status_code == 422


def test_slug_in_message_is_accepted(client: TestClient) -> None:
    # A leading /slug must not break the request (skill simply unresolved here).
    resp = client.post("/runs", json={"message": "/some-skill hi", "answer_format": "json"})
    assert resp.status_code == 200
    assert resp.json()["answer_format"] == "json"
