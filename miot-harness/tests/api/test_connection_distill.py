"""POST /connections/{connection}/distill — the DISTILL seam.

The modulith's scheduled reconciler POSTs a batch of interaction episodes; the
harness runs the reflector over them (lending its LLM + already-grounded terms)
and returns candidate facts for the modulith to stage. These tests cover the
off-by-default gate, the guard branches, and the happy path with a stub model.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.connections.models import Connection


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class _StubModel:
    def __init__(self, answer: str) -> None:
        self._answer = answer

    async def ainvoke(self, messages: Any, *args: Any, **kwargs: Any) -> AIMessage:
        return AIMessage(content=self._answer)


def _on_disk_connection(tmp_path: Path, name: str = "acs") -> Connection:
    conn_dir = tmp_path / "conns" / name
    conn_dir.mkdir(parents=True)
    conn_md = conn_dir / "connection.md"
    conn_md.write_text(
        "---\nname: acs\nbackend: postgres\n---\n\nprimer\n", encoding="utf-8"
    )
    return Connection(name=name, backend="postgres", dsn=None, source_path=str(conn_md))


_EPISODES = [
    {
        "run_id": "run_a",
        "surface": "spotlight",
        "signal": "rephrase",
        "payload": {
            "query": "cuantos servicios en entregas",
            "assumptions": [
                {
                    "term": "entregas",
                    "interpretation": "confirmDelivery + receiveDelivery",
                    "grounded": False,
                    "connection": "acs",
                }
            ],
        },
    }
]


def test_distill_disabled_by_default_is_503(tmp_path: Path) -> None:
    conn = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        resp = client.post("/connections/acs/distill", json={"episodes": _EPISODES})
    assert resp.status_code == 503


def test_distill_unknown_connection_is_404(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_KNOWLEDGE_DISTILLER_ENABLED", "true")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        client.app.state.distiller_model = _StubModel("[]")
        resp = client.post("/connections/nope/distill", json={"episodes": _EPISODES})
    assert resp.status_code == 404


def test_distill_returns_candidates_with_grounded_provenance(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_KNOWLEDGE_DISTILLER_ENABLED", "true")
    get_settings.cache_clear()
    conn = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        client.app.state.distiller_model = _StubModel(
            '[{"term": "entregas", "kind": "stage", '
            '"body": "task_def_key in (confirmDelivery)", "confidence": 0.9}]'
        )
        resp = client.post("/connections/acs/distill", json={"episodes": _EPISODES})
    assert resp.status_code == 200
    data = resp.json()
    assert data["connection"] == "acs"
    assert len(data["candidates"]) == 1
    cand = data["candidates"][0]
    assert cand["term"] == "entregas"
    assert cand["kind"] == "stage"
    assert cand["confidence"] == 0.9
    assert cand["provenance"] == {"run_ids": ["run_a"], "evidence": 1}


def test_distill_empty_batch_returns_no_candidates(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_KNOWLEDGE_DISTILLER_ENABLED", "true")
    get_settings.cache_clear()
    conn = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        client.app.state.distiller_model = _StubModel("[]")
        resp = client.post("/connections/acs/distill", json={"episodes": []})
    assert resp.status_code == 200
    assert resp.json()["candidates"] == []
