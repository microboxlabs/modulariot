"""A model the harness needs and nobody configured is an error, never a
built-in model."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import ModelNotConfiguredError, get_settings


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _errors(caplog: pytest.LogCaptureFixture) -> str:
    return "\n".join(r.getMessage() for r in caplog.records if r.levelno >= logging.ERROR)


def test_boot_logs_an_error_for_each_model_that_is_not_set(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.INFO), TestClient(create_app()):
        pass
    errors = _errors(caplog)
    assert "MIOT_HARNESS_AGENTS_SUMMARIZER_MODEL" in errors
    assert "MIOT_HARNESS_AGENTS_AGENT_LOOP_MODEL" in errors
    assert "MIOT_HARNESS_WEB_SEARCH_MODEL" in errors


def test_boot_logs_an_error_when_the_distiller_is_on_without_a_model(
    caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_KNOWLEDGE_DISTILLER_ENABLED", "true")
    get_settings.cache_clear()
    with caplog.at_level(logging.INFO), TestClient(create_app()):
        pass
    assert "MIOT_HARNESS_KNOWLEDGE_DISTILLER_MODEL" in _errors(caplog)


def test_a_run_without_a_model_fails_and_says_which_setting_is_missing() -> None:
    with TestClient(create_app(), headers={"X-Miot-Tenant-Client-Id": "demo-tenant"}) as client:
        resp = client.post("/runs", json={"message": "hi"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    failed = next(e for e in body["events"] if e["type"] == "run.failed")
    assert "MIOT_HARNESS_AGENTS_AGENT_LOOP_MODEL" in failed["data"]["error"]


def test_titles_without_a_summarizer_model_is_503_and_logs_why(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with TestClient(create_app()) as client:
        caplog.clear()
        with caplog.at_level(logging.WARNING):
            resp = client.post("/titles", json={"message": "hello", "answer": "hi"})
    assert resp.status_code == 503
    assert "MIOT_HARNESS_AGENTS_SUMMARIZER_MODEL" in caplog.text


def test_the_eval_judge_without_a_model_is_an_error() -> None:
    app = create_app()
    with TestClient(app):
        app.state.harness.agent_loop = None
        judge = app.state.learning_evals._judge
        with pytest.raises(ModelNotConfiguredError, match="MIOT_HARNESS_AGENTS_AGENT_LOOP_MODEL"):
            asyncio.run(judge("q", "e", "a", None))
