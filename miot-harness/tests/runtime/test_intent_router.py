"""E1 — LLM intent router: confusion matrix + confidence-fallback paths."""

from __future__ import annotations

import json
from collections.abc import Iterable

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import HarnessRoute, IntentRouter


def _scripted_json(route: str, confidence: float = 0.9, reasoning: str = "test") -> str:
    return json.dumps({"route": route, "confidence": confidence, "reasoning": reasoning})


# 30 fixture prompts spanning all 6 routes. Each row is
# (prompt, llm_route_label, llm_confidence, expected_route_after_router).
# When confidence >= 0.7 the LLM label wins; when below 0.7 the keyword
# fallback takes over (and the expected route reflects that).
_FIXTURES: tuple[tuple[str, str, float, HarnessRoute], ...] = (
    # NEXO_QUERY — 5 prompts
    ("¿estado del centro de control hoy?", "NEXO_QUERY", 0.92, HarnessRoute.NEXO_QUERY),
    ("dame KPI de cola crítica", "NEXO_QUERY", 0.85, HarnessRoute.NEXO_QUERY),
    ("ETA en riesgo del turno actual", "NEXO_QUERY", 0.88, HarnessRoute.NEXO_QUERY),
    ("dimensionamiento para mañana", "NEXO_QUERY", 0.80, HarnessRoute.NEXO_QUERY),
    ("torre de control: KPIs en vivo", "NEXO_QUERY", 0.78, HarnessRoute.NEXO_QUERY),
    # NEXO_META — 5 prompts
    ("what data do you have available?", "NEXO_META", 0.91, HarnessRoute.NEXO_META),
    ("how is es_critico calculated?", "NEXO_META", 0.86, HarnessRoute.NEXO_META),
    ("what does fn_dx_centro_control do?", "NEXO_META", 0.84, HarnessRoute.NEXO_META),
    ("explain the schema of the nexo tables", "NEXO_META", 0.83, HarnessRoute.NEXO_META),
    ("which fn_dx_* are available?", "NEXO_META", 0.82, HarnessRoute.NEXO_META),
    # NEXO_AGENTIC — 5 prompts
    ("show me services where delta_eta_horas > 6", "NEXO_AGENTIC", 0.90, HarnessRoute.NEXO_AGENTIC),
    ("tell me more about that", "NEXO_AGENTIC", 0.75, HarnessRoute.NEXO_AGENTIC),
    ("filter by region=norte and order by ETA desc", "NEXO_AGENTIC", 0.81, HarnessRoute.NEXO_AGENTIC),
    ("any rows with refreshed_at older than 4h?", "NEXO_AGENTIC", 0.79, HarnessRoute.NEXO_AGENTIC),
    ("explora la tabla dx_servicios", "NEXO_AGENTIC", 0.77, HarnessRoute.NEXO_AGENTIC),
    # STORYTELLING_RUN — 5 prompts
    ("draft a story about today's incident", "STORYTELLING_RUN", 0.92, HarnessRoute.STORYTELLING_RUN),
    ("write a dashboard widget summary", "STORYTELLING_RUN", 0.85, HarnessRoute.STORYTELLING_RUN),
    ("compose a status update narrative", "STORYTELLING_RUN", 0.83, HarnessRoute.STORYTELLING_RUN),
    ("scríbenos un relato de la jornada", "STORYTELLING_RUN", 0.80, HarnessRoute.STORYTELLING_RUN),
    ("redacta una nota para operaciones", "STORYTELLING_RUN", 0.74, HarnessRoute.STORYTELLING_RUN),
    # DIRECT — 5 prompts
    ("hello", "DIRECT", 0.96, HarnessRoute.DIRECT),
    ("hi there", "DIRECT", 0.94, HarnessRoute.DIRECT),
    ("how are you?", "DIRECT", 0.92, HarnessRoute.DIRECT),
    ("thanks", "DIRECT", 0.93, HarnessRoute.DIRECT),
    ("gracias", "DIRECT", 0.90, HarnessRoute.DIRECT),
    # OTHER — 5 prompts (one with low confidence to exercise fallback)
    ("forecast tomorrow's weather", "OTHER", 0.82, HarnessRoute.OTHER),
    ("translate this to Klingon", "OTHER", 0.80, HarnessRoute.OTHER),
    ("solve x^2 + 2x + 1 = 0", "OTHER", 0.79, HarnessRoute.OTHER),
    # Low confidence → keyword fallback (this message has no Nexo keyword
    # so the deterministic router returns DIRECT).
    ("ambiguous something", "NEXO_QUERY", 0.50, HarnessRoute.DIRECT),
    ("eep doop", "OTHER", 0.30, HarnessRoute.DIRECT),
)


def _build_router(responses: Iterable[str]) -> LLMIntentRouter:
    model = FakeListChatModel(responses=list(responses))
    return LLMIntentRouter(model, confidence_threshold=0.7, keyword_fallback=IntentRouter())


@pytest.mark.asyncio
async def test_confusion_matrix_30_prompts() -> None:
    """≥90% (27/30) of canon prompts must reach the expected route."""

    responses = [_scripted_json(row[1], row[2]) for row in _FIXTURES]
    router = _build_router(responses)

    correct = 0
    misclassified: list[tuple[str, HarnessRoute, HarnessRoute]] = []
    for prompt, _, _, expected in _FIXTURES:
        result = await router.route(prompt)
        if result.route is expected:
            correct += 1
        else:
            misclassified.append((prompt, expected, result.route))

    accuracy = correct / len(_FIXTURES)
    assert accuracy >= 0.90, (
        f"router accuracy {accuracy:.0%} < 90% (target). "
        f"Misclassified: {misclassified}"
    )


@pytest.mark.asyncio
async def test_low_confidence_falls_back_to_keyword_router() -> None:
    """Below the threshold the LLM label is dropped; keyword router decides."""

    # LLM says NEXO_AGENTIC with low confidence; keyword router sees no
    # Nexo keyword in "hola amigo", so the final route is DIRECT.
    model = FakeListChatModel(
        responses=[_scripted_json("NEXO_AGENTIC", confidence=0.3, reasoning="unsure")]
    )
    router = LLMIntentRouter(
        model, confidence_threshold=0.7, keyword_fallback=IntentRouter()
    )

    result = await router.route("hola amigo")
    assert result.route is HarnessRoute.DIRECT
    assert "fallback" in result.reason.lower()


@pytest.mark.asyncio
async def test_unparseable_llm_response_falls_back_to_keyword() -> None:
    """Garbled JSON from the LLM doesn't crash — keyword router takes over."""

    model = FakeListChatModel(responses=["I'm not sure honestly..."])
    router = LLMIntentRouter(
        model, confidence_threshold=0.7, keyword_fallback=IntentRouter()
    )
    result = await router.route("Mintral fleet status")  # contains 'mintral'
    assert result.route is HarnessRoute.NEXO_QUERY


@pytest.mark.asyncio
async def test_router_accepts_fenced_json_response() -> None:
    """LLMs often wrap JSON in ```json fences; we must tolerate that."""

    fenced = "```json\n" + _scripted_json("NEXO_META", confidence=0.9) + "\n```"
    model = FakeListChatModel(responses=[fenced])
    router = LLMIntentRouter(
        model, confidence_threshold=0.7, keyword_fallback=IntentRouter()
    )
    result = await router.route("what is fn_dx_eta_hoy?")
    assert result.route is HarnessRoute.NEXO_META


@pytest.mark.asyncio
async def test_invalid_route_name_falls_back_to_keyword() -> None:
    """An LLM that returns a route outside the 6-route taxonomy falls back."""

    model = FakeListChatModel(
        responses=[json.dumps({"route": "MAGIC_ROUTE", "confidence": 0.99})]
    )
    router = LLMIntentRouter(
        model, confidence_threshold=0.7, keyword_fallback=IntentRouter()
    )
    result = await router.route("Mintral status")  # mintral keyword
    assert result.route is HarnessRoute.NEXO_QUERY


@pytest.mark.parametrize(
    "raw_response",
    [
        '"hello"',     # bare string — json.loads ok but not a dict
        "42",          # bare number
        "true",        # bare bool
        "null",        # bare null
        '["NEXO_QUERY", 0.9]',  # array, not an object
    ],
)
@pytest.mark.asyncio
async def test_non_dict_json_falls_back_to_keyword(raw_response: str) -> None:
    """`_parse_decision` must not crash on valid JSON that isn't a dict.

    Without an `isinstance(payload, dict)` guard, `payload.get(...)` raises
    AttributeError on the strings / numbers / lists above, escaping the
    `json.JSONDecodeError` try/except and crashing the route call.
    """

    model = FakeListChatModel(responses=[raw_response])
    router = LLMIntentRouter(
        model, confidence_threshold=0.7, keyword_fallback=IntentRouter()
    )
    # "Mintral status" has the `mintral` keyword so the fallback returns NEXO_QUERY.
    result = await router.route("Mintral status")
    assert result.route is HarnessRoute.NEXO_QUERY
