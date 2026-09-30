"""POST /describe: a plain-language description of a symptom rule."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.agents.rule_describer import MAX_DESCRIPTION_CHARS, sanitize_description
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


def test_describe_returns_the_sanitized_model_answer() -> None:
    model = _StubModel("Se activa cuando el camión está <b>en viaje</b>.<script>x()</script>")
    app = create_app()
    with TestClient(app) as client:
        app.state.describe_model = model
        resp = client.post(
            "/describe",
            json={
                "section": "activation",
                "rule": 'trip.status == "EN_VIAJE"',
                "fields": {"trip.status": "Estado del viaje"},
            },
        )
    assert resp.status_code == 200
    assert resp.json() == {
        "html": "Se activa cuando el camión está <b>en viaje</b>.&lt;script&gt;x()&lt;/script&gt;"
    }
    prompt = model.prompts[0][1].content
    assert 'trip.status == "EN_VIAJE"' in prompt
    assert "trip.status: Estado del viaje" in prompt
    assert "Locale: es-CL" in prompt


def test_describe_is_503_when_the_model_fails() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.describe_model = _StubModel(RuntimeError("provider down"))
        resp = client.post("/describe", json={"section": "measure", "rule": "x"})
    assert resp.status_code == 503


def test_describe_validates_the_body() -> None:
    app = create_app()
    with TestClient(app) as client:
        app.state.describe_model = _StubModel("unused")
        empty = client.post("/describe", json={"section": "measure", "rule": ""})
        too_long = client.post("/describe", json={"section": "measure", "rule": "x" * 4001})
        too_many = client.post(
            "/describe",
            json={"section": "measure", "rule": "x", "fields": {f"f{i}": "l" for i in range(201)}},
        )
    assert empty.status_code == 422
    assert too_long.status_code == 422
    assert too_many.status_code == 422


def test_sanitizer_escapes_scripts_and_attributes() -> None:
    raw = (
        '<script>alert(1)</script><b onclick="x()">a</b> <i>b</i> <mark>c</mark> <a href="y">d</a>'
    )
    out = sanitize_description(raw)
    assert "<script>" not in out
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in out
    assert "<b onclick" not in out
    assert "<i>b</i> <mark>c</mark>" in out
    assert "<a " not in out


def test_sanitizer_closes_open_tags_and_caps_length() -> None:
    assert sanitize_description("<B>abierto") == "<b>abierto</b>"
    assert sanitize_description("stray</i> close") == "stray close"
    out = sanitize_description("<b>" + "x" * 1000 + "</b>")
    assert out == "<b>" + "x" * MAX_DESCRIPTION_CHARS + "</b>"


def test_sanitizer_keeps_character_references() -> None:
    once = sanitize_description("a &lt;b&gt; & <b>c</b> &amp; d")
    assert once == "a &lt;b&gt; &amp; <b>c</b> &amp; d"
    assert sanitize_description(once) == once


def test_sanitizer_cap_counts_code_points() -> None:
    truck = "\U0001f69a"
    out = sanitize_description("x" * (MAX_DESCRIPTION_CHARS - 1) + truck + "yz")
    assert out == "x" * (MAX_DESCRIPTION_CHARS - 1) + truck


def test_describe_accepts_the_whole_levels_section() -> None:
    model = _StubModel("Nivel 1 desde <b>0 km/h</b> sobre el límite.")
    app = create_app()
    rule = "medida = signal.gps.speed_kmh\nnivel 1: medida > 0 && medida < 5"
    with TestClient(app) as client:
        app.state.describe_model = model
        resp = client.post(
            "/describe",
            json={"section": "levels", "rule": rule, "fields": {"medida": "valor medido"}},
        )
    assert resp.status_code == 200
    system, prompt = model.prompts[0][0].content, model.prompts[0][1].content
    assert "4 Código negro" in system
    assert "Section: levels (this rule defines the measure" in prompt
    assert rule in prompt
