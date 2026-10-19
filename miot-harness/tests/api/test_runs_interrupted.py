"""A run the previous process left unfinished reads as failed after a restart."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore


@pytest.fixture(autouse=True)
def _workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_KIND", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_a_run_left_running_is_failed_as_interrupted_on_boot(tmp_path: Path) -> None:
    JsonRunStore(tmp_path).save(
        HarnessRunRecord(
            run_id="run_left",
            status="running",
            events=[
                HarnessEvent(run_id="run_left", seq=0, type="run.started", message="Run started")
            ],
        )
    )

    with TestClient(create_app()) as client:
        resp = client.get("/runs/run_left")
        with client.stream("GET", "/runs/run_left/stream") as stream:
            body = "".join(stream.iter_text())

    assert resp.status_code == 200
    record = resp.json()
    assert record["status"] == "failed"
    assert record["events"][-1]["type"] == "run.failed"
    assert record["events"][-1]["data"]["reason"] == "interrupted"
    assert "event: run.failed" in body


def test_a_run_in_flight_is_read_from_memory(tmp_path: Path) -> None:
    app = create_app()
    with TestClient(app) as client:
        live = HarnessRunRecord(run_id="run_live", status="running")
        app.state.harness._live_records["run_live"] = live
        resp = client.get("/runs/run_live")

    assert resp.status_code == 200
    assert resp.json()["status"] == "running"
