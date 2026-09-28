"""/knowledge/layers and /knowledge/items: the editable layers over HTTP."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.connections.models import Connection
from miot_harness.datasource.knowledge.learned import LearnedFacts, LearnedFactsSource


@pytest.fixture(autouse=True)
def _settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    monkeypatch.setenv("MIOT_HARNESS_CONTEXT_DIR", str(tmp_path / "pvc" / "context"))
    monkeypatch.setenv("MIOT_HARNESS_SKILLS_DIR", str(tmp_path / "pvc" / "skills"))
    monkeypatch.setenv("MIOT_HARNESS_REFRESH_PACKAGED_DEFAULTS", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


_T1 = {"X-Miot-Tenant-Client-Id": "t1"}
_T2 = {"X-Miot-Tenant-Client-Id": "t2"}


def _client(tmp_path: Path) -> Iterator[TestClient]:
    conn_dir = tmp_path / "conns" / "db"
    conn_dir.mkdir(parents=True)
    conn_md = conn_dir / "connection.md"
    conn_md.write_text("---\nname: db\nbackend: postgres\n---\n\nPrimer.\n", encoding="utf-8")
    conn = Connection(
        name="db",
        backend="postgres",
        dsn=None,
        source_path=str(conn_md),
        options={"tenant_lock": "t1"},
    )
    with TestClient(create_app()) as client:
        client.app.state.connection_objects["db"] = conn  # type: ignore[attr-defined]
        client.app.state.harness.learned_facts = LearnedFacts(  # type: ignore[attr-defined]
            [LearnedFactsSource("db", conn_dir / "knowledge", "t1")], char_budget=100
        )
        yield client


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    yield from _client(tmp_path)


def test_put_get_history_and_version(client: TestClient, tmp_path: Path) -> None:
    url = "/knowledge/items/rule/cargado"
    first = client.put(url, json={"title": "Cargado", "content": "One."}, headers=_T1)
    assert first.status_code == 200, first.text
    second = client.put(
        url,
        json={"title": "Cargado", "content": "Two.", "reason": "fix", "author": "ana"},
        headers=_T1,
    )
    item = second.json()
    assert (item["version"], item["updated_by"], item["content"]) == (2, "ana", "Two.")
    assert [h["version"] for h in item["history"]] == [2, 1]
    got = client.get(url, headers=_T1).json()
    assert set(got) == {
        "layer",
        "id",
        "target",
        "title",
        "content",
        "meta",
        "version",
        "updated_at",
        "updated_by",
        "history",
    }
    old = client.get(f"{url}/versions/1", headers=_T1).json()
    assert old["content"] == "One."
    assert (tmp_path / "pvc" / "context" / "tenants" / "t1" / "learned" / "cargado.md").exists()


def test_revert_and_delete(client: TestClient) -> None:
    url = "/knowledge/items/skill/count"
    client.put(url, json={"title": "Count", "content": "A."}, headers=_T1)
    client.put(url, json={"title": "Count", "content": "B."}, headers=_T1)
    reverted = client.post(f"{url}/revert", json={"version": 1, "reason": "undo"}, headers=_T1)
    assert reverted.status_code == 200
    assert reverted.json()["content"] == "A."
    assert reverted.json()["version"] == 3
    deleted = client.delete(url, params={"reason": "gone", "author": "ana"}, headers=_T1)
    assert deleted.status_code == 204
    assert client.get(url, headers=_T1).status_code == 404
    assert client.delete(url, headers=_T1).status_code == 404


def test_layers_listing_is_per_tenant(client: TestClient) -> None:
    client.put(
        "/knowledge/items/fact/loaded",
        params={"target": "db"},
        json={"title": "Loaded", "content": "Rows in active_trips."},
        headers=_T1,
    )
    layers = client.get("/knowledge/layers", headers=_T1).json()["layers"]
    fact = next(layer for layer in layers if layer["layer"] == "fact")
    assert fact["targets"] == ["db"]
    assert [(i["id"], i["target"], i["version"]) for i in fact["items"]] == [("loaded", "db", 1)]
    assert {layer["layer"]: layer["editable"] for layer in layers}["note"] is False
    other = client.get("/knowledge/layers", headers=_T2).json()["layers"]
    assert all(layer["items"] == [] for layer in other)


def test_tenant_query_is_used_without_a_header(client: TestClient) -> None:
    resp = client.get("/knowledge/layers", params={"tenant_id": "t1"})
    assert resp.status_code == 200
    assert client.get("/knowledge/layers").status_code == 400


def test_another_tenants_connection_is_403(client: TestClient) -> None:
    body = {"title": "X", "content": "Meaning."}
    fact = client.put("/knowledge/items/fact/x", params={"target": "db"}, json=body, headers=_T2)
    assert fact.status_code == 403
    primer = client.put("/knowledge/items/primer/db", json=body, headers=_T2)
    assert primer.status_code == 403
    assert client.get("/knowledge/items/primer/db", headers=_T1).status_code == 200


def test_bad_requests(client: TestClient) -> None:
    body = {"title": "X", "content": "Meaning."}
    assert client.put("/knowledge/items/nope/x", json=body, headers=_T1).status_code == 404
    assert client.put("/knowledge/items/rule/..", json=body, headers=_T1).status_code in (
        400,
        404,
    )
    assert client.put("/knowledge/items/rule/Bad_Id", json=body, headers=_T1).status_code == 400
    assert (
        client.put(
            "/knowledge/items/note/x", params={"target": "db"}, json=body, headers=_T1
        ).status_code
        == 405
    )
    leaky = {"title": "X", "content": "Call someone@example.com"}
    assert client.put("/knowledge/items/rule/x", json=leaky, headers=_T1).status_code == 400
    assert client.get("/knowledge/items/rule/x/versions/9", headers=_T1).status_code == 404


def test_eval_case_accepts_expected_skills(client: TestClient) -> None:
    resp = client.put(
        "/knowledge/items/eval/trips-today",
        json={
            "title": "How many trips were loaded today?",
            "content": "Counts today's active_trips rows.",
            "expect_skill": "count-trips",
            "expect_no_skill": ["other"],
        },
        headers=_T1,
    )
    assert resp.status_code == 200, resp.text
    meta = client.get("/knowledge/items/eval/trips-today", headers=_T1).json()["meta"]
    assert meta == {"expect_skill": "count-trips", "expect_no_skill": ["other"]}
