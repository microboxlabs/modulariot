"""POST /connections/{connection}/knowledge — the APPLY seam.

A human-approved fact is persisted as a connection-scoped card that the R0
loader reads back on the next run. These tests cover the happy path (written +
loadable), the guard branches (unknown connection, no on-disk file, personal
scope), and the tenant-ownership check.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from miot_harness.api.server import (
    _enforce_tenant_may_write_connection,
    create_app,
)
from miot_harness.config import get_settings
from miot_harness.connections.models import Connection
from miot_harness.datasource.knowledge.loader import load_connection_cards


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


def _on_disk_connection(tmp_path: Path, name: str = "acs") -> tuple[Connection, Path]:
    """A connection with a real `connection.md` (so it has a sibling knowledge
    dir), placed OUTSIDE the workspace so boot doesn't also load it."""
    conn_dir = tmp_path / "conns" / name
    conn_dir.mkdir(parents=True)
    conn_md = conn_dir / "connection.md"
    conn_md.write_text(
        "---\nname: acs\nbackend: postgres\n---\n\nprimer\n", encoding="utf-8"
    )
    conn = Connection(
        name=name, backend="postgres", dsn=None, source_path=str(conn_md)
    )
    return conn, conn_dir / "knowledge"


def test_write_persists_a_loadable_card(tmp_path: Path) -> None:
    conn, knowledge_dir = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        resp = client.post(
            "/connections/acs/knowledge",
            json={
                "term": "entregas",
                "body": "Solo `confirmDelivery` cuenta como entrega.",
                "kind": "stage",
                "confidence": 0.9,
            },
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["card_id"] == "entregas"
    assert data["scope"] == "tenant"
    assert data["status"] == "approved"

    # The written card is loadable by the R0 loader — the loop closes.
    assert (knowledge_dir / "entregas.md").exists()
    loaded = load_connection_cards(knowledge_dir)
    assert loaded.diagnostics == ()
    card = loaded.cards[0]
    assert card.term == "entregas"
    assert card.kind == "stage"
    assert card.confidence == 0.9


def test_unknown_connection_is_404(tmp_path: Path) -> None:
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/connections/nope/knowledge",
            json={"term": "t", "body": "b"},
        )
    assert resp.status_code == 404


def test_connection_without_on_disk_file_is_409(tmp_path: Path) -> None:
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects["synth"] = Connection(
            name="synth", backend="postgres", dsn=None  # source_path=<synthesized>
        )
        resp = client.post(
            "/connections/synth/knowledge",
            json={"term": "t", "body": "b"},
        )
    assert resp.status_code == 409


def test_personal_scope_is_rejected(tmp_path: Path) -> None:
    conn, _ = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        resp = client.post(
            "/connections/acs/knowledge",
            json={"term": "t", "body": "b", "scope": "personal"},
        )
    assert resp.status_code == 400
    assert "not shareable" in resp.json()["detail"]


def test_row_level_secret_body_is_400(tmp_path: Path) -> None:
    """The security invariant at the endpoint: a card embedding a concrete
    sensitive value (here a phone number) is rejected, not written."""
    conn, knowledge_dir = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        resp = client.post(
            "/connections/acs/knowledge",
            json={"term": "chofer", "body": "El chofer es +56 9 1234 5678"},
        )
    assert resp.status_code == 400
    assert "row-level value" in resp.json()["detail"]
    assert not knowledge_dir.exists()  # nothing written


def test_empty_term_is_422(tmp_path: Path) -> None:
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/connections/acs/knowledge",
            json={"term": "", "body": "b"},
        )
    assert resp.status_code == 422


def test_enforce_write_lock() -> None:
    """The tenant-ownership check mirrors the runtime gate's `tenant_id == lock`
    equality: locked connections reject other tenants; global unlocked ones and
    the auth-disabled path allow through."""
    locked = Connection(
        name="nexo", backend="postgres", dsn=None, options={"tenant_lock": "T1"}
    )
    _enforce_tenant_may_write_connection(locked, {"tenant_id": "T1"}, "nexo")  # ok
    with pytest.raises(HTTPException) as exc:
        _enforce_tenant_may_write_connection(locked, {"tenant_id": "T2"}, "nexo")
    assert exc.value.status_code == 403
    _enforce_tenant_may_write_connection(locked, {}, "nexo")  # auth disabled → no-op

    unlocked = Connection(name="acs", backend="postgres", dsn=None)
    _enforce_tenant_may_write_connection(unlocked, {"tenant_id": "T2"}, "acs")  # ok

    scoped = Connection(
        name="x", backend="postgres", dsn=None, scope="tenant", tenant_id="T9"
    )
    with pytest.raises(HTTPException):
        _enforce_tenant_may_write_connection(scoped, {"tenant_id": "T2"}, "x")


def _write_card(client: TestClient, term: str, body: str) -> None:
    resp = client.post("/connections/acs/knowledge", json={"term": term, "body": body})
    assert resp.status_code == 201


def test_list_returns_authored_cards(tmp_path: Path) -> None:
    conn, _ = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        assert client.get("/connections/acs/knowledge").json() == {"cards": []}
        _write_card(client, "current process", "Only version v2 is current.")
        cards = client.get("/connections/acs/knowledge").json()["cards"]
    assert len(cards) == 1
    card = cards[0]
    assert card["id"] == "current-process"
    assert card["term"] == "current process"
    assert card["body"] == "Only version v2 is current."
    assert card["scope"] == "tenant"
    assert card["updated_at"]


def test_delete_removes_card_and_revert_restores_it(tmp_path: Path) -> None:
    conn, knowledge_dir = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        _write_card(client, "current process", "Only version v2 is current.")

        assert client.delete("/connections/acs/knowledge/current-process").status_code == 204
        assert client.get("/connections/acs/knowledge").json() == {"cards": []}
        assert client.delete("/connections/acs/knowledge/current-process").status_code == 404

        resp = client.post("/connections/acs/knowledge/current-process/revert")
        assert resp.status_code == 200
        assert resp.json()["card_id"] == "current-process"
        ids = [c["id"] for c in client.get("/connections/acs/knowledge").json()["cards"]]
        assert ids == ["current-process"]
        # Nothing older left to restore.
        assert client.post("/connections/acs/knowledge/current-process/revert").status_code == 404
    assert (knowledge_dir / "current-process.md").exists()


def test_delete_finds_a_card_whose_id_differs_from_its_file_name(tmp_path: Path) -> None:
    conn, knowledge_dir = _on_disk_connection(tmp_path)
    knowledge_dir.mkdir()
    (knowledge_dir / "stage-shipments.md").write_text(
        "---\nid: shipments\nterm: shipments\n---\n\nOnly confirmed rows count.\n",
        encoding="utf-8",
    )
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        ids = [c["id"] for c in client.get("/connections/acs/knowledge").json()["cards"]]
        assert ids == ["shipments"]
        assert client.delete("/connections/acs/knowledge/shipments").status_code == 204
    assert not (knowledge_dir / "stage-shipments.md").exists()


def test_options_lock_wins_over_tenant_scope() -> None:
    both = Connection(
        name="x",
        backend="postgres",
        dsn=None,
        scope="tenant",
        tenant_id="T9",
        options={"tenant_lock": "T1"},
    )
    _enforce_tenant_may_write_connection(both, {"tenant_id": "T1"}, "x")
    with pytest.raises(HTTPException):
        _enforce_tenant_may_write_connection(both, {"tenant_id": "T9"}, "x")


def test_delete_unknown_card_is_404(tmp_path: Path) -> None:
    conn, _ = _on_disk_connection(tmp_path)
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects[conn.name] = conn
        assert client.delete("/connections/acs/knowledge/nope").status_code == 404
        assert client.delete("/connections/nope/knowledge/x").status_code == 404


def test_list_and_delete_respect_tenant_lock(tmp_path: Path) -> None:
    conn, knowledge_dir = _on_disk_connection(tmp_path)
    locked = Connection(
        name="acs",
        backend="postgres",
        dsn=None,
        source_path=conn.source_path,
        options={"tenant_lock": "T1"},
    )
    app = create_app()
    with TestClient(app) as client:
        client.app.state.connection_objects["acs"] = locked
        _write_card(client, "current process", "Only version v2 is current.")
        other = {"X-Miot-Tenant-Client-Id": "T2"}
        assert client.get("/connections/acs/knowledge", headers=other).status_code == 403
        resp = client.delete("/connections/acs/knowledge/current-process", headers=other)
        assert resp.status_code == 403
        owner = {"X-Miot-Tenant-Client-Id": "T1"}
        assert len(client.get("/connections/acs/knowledge", headers=owner).json()["cards"]) == 1
    assert (knowledge_dir / "current-process.md").exists()
