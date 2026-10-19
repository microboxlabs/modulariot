"""POST /titles: a short thread title from the first exchange."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.api.server import create_app


class _StubModel:
    def __init__(self, answer: str | Exception) -> None:
        self._answer = answer
        self.prompts: list[Any] = []

    async def ainvoke(self, messages: Any, *args: Any, **kwargs: Any) -> AIMessage:
        self.prompts.append(messages)
        if isinstance(self._answer, Exception):
            raise self._answer
        return AIMessage(content=self._answer)


def test_titles_returns_the_cleaned_model_answer() -> None:
    model = _StubModel('"Entregas pendientes por región."')
    app = create_app()
    with TestClient(app) as client:
        app.state.title_model = model
        resp = client.post(
            "/titles",
            json={"message": "¿Cuántas entregas quedan por región?", "answer": "Hay 12 en total."},
        )
    assert resp.status_code == 200
    assert resp.json() == {"title": "Entregas pendientes por región"}
    prompt = model.prompts[0][1].content
    assert "¿Cuántas entregas quedan por región?" in prompt
    assert "Hay 12 en total." in prompt


def test_titles_is_503_when_the_model_fails() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.title_model = _StubModel(RuntimeError("provider down"))
        resp = client.post("/titles", json={"message": "hello", "answer": "hi"})
    assert resp.status_code == 503


def test_titles_needs_a_message() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.title_model = _StubModel("unused")
        resp = client.post("/titles", json={"message": "", "answer": "hi"})
    assert resp.status_code == 422
