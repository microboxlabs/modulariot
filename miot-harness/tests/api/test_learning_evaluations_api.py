"""/learning/evaluations over HTTP: start, poll, list, tenant scoping, and the
`run_learning_eval` tool offered to trainers."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.run_store import HarnessRunRecord
from miot_harness.tools.learning_eval import RUN_LEARNING_EVAL_TOOL


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


class _JudgeModel:
    async def ainvoke(self, messages: list[Any]) -> AIMessage:
        return AIMessage(content='{"score": 4, "reason": "close"}')


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as client:
        seen: list[UserRequest] = []

        async def run(request: UserRequest, **kw: Any) -> HarnessRunRecord:
            seen.append(request)
            return HarnessRunRecord(
                run_id=kw.get("run_id_override") or "r",
                status="completed",
                answer="Answer.",
                model="m",
            )

        state = client.app.state  # type: ignore[attr-defined]
        state.harness.run = run
        state.judge_model = _JudgeModel()
        state.seen = seen
        yield client


def _wait_done(client: TestClient, evaluation_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while True:
        doc: dict[str, Any] = client.get(
            f"/learning/evaluations/{evaluation_id}", headers=_T1
        ).json()
        if doc["status"] != "running" or time.monotonic() > deadline:
            return doc
        time.sleep(0.02)


def test_start_poll_and_list(client: TestClient, tmp_path: Path) -> None:
    body = {
        "cases": [{"id": "c1", "question": "How many trips?", "expectation": "12"}],
        "changes": [{"layer": "rule", "id": "cargado", "content": "Loaded = live_trip."}],
        "repeat": 1,
    }
    started = client.post("/learning/evaluations", json=body, headers=_T1)
    assert started.status_code == 202, started.text
    evaluation_id = started.json()["evaluation_id"]

    doc = _wait_done(client, evaluation_id)
    assert doc["status"] == "done"
    assert set(doc) >= {"id", "status", "model", "progress", "summary", "results"}
    result = doc["results"][0]
    assert result["case"]["question"] == "How many trips?"
    for side in ("baseline", "candidate"):
        run = result[side]
        assert (run["answer"], run["score"], run["reason"]) == ("Answer.", 4.0, "close")
        assert {"run_id", "seconds", "tokens", "skills_used"} <= set(run)
    assert doc["summary"]["unchanged"] == 1

    seen = client.app.state.seen  # type: ignore[attr-defined]
    assert {r.tenant_id for r in seen} == {"t1"}
    assert sorted(len(r.to_context().knowledge_overlay) for r in seen) == [0, 1]
    saved = tmp_path / "pvc" / "evals" / "tenants" / "t1" / "results" / f"{evaluation_id}.json"
    assert saved.is_file()

    listed = client.get("/learning/evaluations", headers=_T1).json()["evaluations"]
    assert [e["id"] for e in listed] == [evaluation_id]
    assert client.get(f"/learning/evaluations/{evaluation_id}", headers=_T2).status_code == 404
    assert client.get("/learning/evaluations", headers=_T2).json() == {"evaluations": []}


def test_rejects_bad_bodies_and_models(client: TestClient) -> None:
    assert client.post("/learning/evaluations", json={"cases": []}, headers=_T1).status_code == 422
    bad_change = {
        "cases": [{"question": "q", "expectation": "e"}],
        "changes": [{"layer": "primer", "id": "db", "op": "delete"}],
    }
    assert client.post("/learning/evaluations", json=bad_change, headers=_T1).status_code == 422
    unknown_model = {"cases": [{"question": "q", "expectation": "e"}], "model": "nope"}
    assert client.post("/learning/evaluations", json=unknown_model, headers=_T1).status_code == 400
    assert client.get("/learning/evaluations/ev-0000000000000000", headers=_T1).status_code == 404


def test_the_tool_is_registered_for_trainers(client: TestClient) -> None:
    tool = client.app.state.harness.tools.get(RUN_LEARNING_EVAL_TOOL)  # type: ignore[attr-defined]
    assert tool.kind == "trainer"
