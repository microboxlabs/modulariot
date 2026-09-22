"""GET /models and the `model` allowlist on run creation."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.api.server import create_app
from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunners
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel
from tests.test_native_tools import _registry


def _runners() -> AgentLoopRunners:
    def build(name: str) -> Any:
        return ScriptedModel([AIMessage(content=f"from {name}")])

    return AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-sonnet-4-6"],
        build_model=build,
        registry=_registry(),
        settings=HarnessSettings(agents_agentic_max_turns=3),
        profile=FAKE_PROFILE,
    )


def test_models_lists_the_allowlist_when_the_loop_is_wired() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.agent_loop = _runners()
        resp = client.get("/models")
    assert resp.status_code == 200
    assert resp.json() == {
        "default": "claude-opus-4-8",
        "models": ["claude-opus-4-8", "claude-sonnet-4-6"],
    }


def test_models_is_empty_without_the_loop() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.agent_loop = None
        resp = client.get("/models")
    assert resp.json() == {"default": None, "models": []}


def test_run_with_a_model_outside_the_allowlist_is_a_400() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.agent_loop = _runners()
        resp = client.post(
            "/runs:start",
            json={"message": "hi", "tenant_id": "acme", "model": "claude-haiku-4-5"},
        )
        assert resp.status_code == 400
        assert "GET /models" in resp.json()["detail"]
        resp = client.post(
            "/runs:start",
            json={"message": "hi", "tenant_id": "acme", "model": "claude-sonnet-4-6"},
        )
        assert resp.status_code == 202


def test_run_with_a_model_but_no_loop_is_a_400() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.harness.agent_loop = None
        resp = client.post(
            "/runs", json={"message": "hi", "tenant_id": "acme", "model": "claude-opus-4-8"}
        )
    assert resp.status_code == 400
