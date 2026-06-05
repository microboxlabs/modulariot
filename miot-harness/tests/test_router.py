from __future__ import annotations

import pytest

from miot_harness.runtime.router import HarnessRoute, IntentRouter


@pytest.fixture
def router() -> IntentRouter:
    return IntentRouter()


@pytest.mark.parametrize(
    "message",
    [
        "¿estado del coordinador hoy?",
        "Centro de control: dame KPIs",
        "Mintral fleet status",
        "cola crítica para hoy",
        "dimensionamiento para mañana",
        "torre de control overview",
        "auditoría POD del último turno",
        "llamada a fn_dx_centro_control",
        "ETA en riesgo",
    ],
)
def test_nexo_keywords_route_to_nexo_query(router: IntentRouter, message: str):
    result = router.route(message)
    assert result.route == HarnessRoute.NEXO_QUERY


def test_eta_word_boundary_does_not_match_etapa(router: IntentRouter):
    """The plan calls for \\bETA\\b regex (word-boundary, uppercase) so
    'etapa', 'meta', and 'completada' don't trigger the Nexo path."""
    for false_positive in ("etapa siguiente", "meta cumplida", "completada"):
        result = router.route(false_positive)
        assert result.route != HarnessRoute.NEXO_QUERY, (
            f"unexpected NEXO match for {false_positive!r}"
        )


def test_storytelling_still_routes_correctly(router: IntentRouter):
    result = router.route("write me a story about delivery metrics")
    assert result.route == HarnessRoute.STORYTELLING_RUN


def test_storytelling_with_nexo_keyword_resolves_to_nexo_first(router: IntentRouter):
    """Plan resolution: when both keywords appear, Nexo wins."""
    result = router.route("write a story about Mintral coordinador status")
    assert result.route == HarnessRoute.NEXO_QUERY


def test_unrelated_message_routes_direct(router: IntentRouter):
    result = router.route("how do I reset my password?")
    assert result.route == HarnessRoute.DIRECT


def test_etapa_with_eta_word_doesnt_match():
    """Lowercase 'eta' inside other words must NOT trigger; the regex is
    \\bETA\\b (uppercase, word boundary)."""
    router = IntentRouter()
    assert router.route("la etapa siguiente").route != HarnessRoute.NEXO_QUERY


def test_uppercase_eta_matches():
    router = IntentRouter()
    assert router.route("¿qué ETA tenemos?").route == HarnessRoute.NEXO_QUERY


def test_router_accepts_custom_keywords() -> None:
    router = IntentRouter(data_keywords=frozenset({"fakesource"}))
    result = router.route("estado de fakesource hoy")
    assert result.route == HarnessRoute.NEXO_QUERY


def test_router_custom_keywords_replace_defaults() -> None:
    # With custom keywords, the default nexo literals must NOT route to data.
    router = IntentRouter(data_keywords=frozenset({"fakesource"}))
    result = router.route("estado del coordinador?")
    assert result.route == HarnessRoute.DIRECT
