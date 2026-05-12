"""E2 — meta-question agent: cached introspection + primer, no SQL."""

from __future__ import annotations

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.meta_agent import (
    MetaAgentCatalogEntry,
    meta_agent_node,
)


def _catalog_fixture() -> list[MetaAgentCatalogEntry]:
    """Three curated `fn_dx_*` entries that mirror real Coordinador shapes."""

    return [
        MetaAgentCatalogEntry(
            name="fn_dx_centro_control",
            layer="L1",
            title="KPI summary for the operations center",
            body="Returns aggregated counters for ETA-at-risk, critical queue, etc.",
        ),
        MetaAgentCatalogEntry(
            name="fn_dx_eta_hoy",
            layer="L2",
            title="ETA classification for today's services",
            body="One row per service with `eta_clasificacion` bucket and `es_critico` flag.",
        ),
        MetaAgentCatalogEntry(
            name="fn_dx_kpi_servicio",
            layer="L2",
            title="Per-service KPI breakdown",
            body="Detail-level metrics; pair with fn_dx_eta_hoy for end-to-end view.",
        ),
    ]


@pytest.mark.asyncio
async def test_meta_agent_answers_from_primer_and_catalog() -> None:
    model = FakeListChatModel(
        responses=[
            "We have fn_dx_centro_control (KPI summary), fn_dx_eta_hoy "
            "(today's ETA classification), and fn_dx_kpi_servicio (per-service)."
        ]
    )
    delta = await meta_agent_node(
        {"user_message": "what data do you have available?"},
        model=model,
        primer="Mintral fleet operations primer text",
        catalog=_catalog_fixture(),
    )
    assert "fn_dx_centro_control" in delta["answer"]
    assert delta.get("failure") is None


@pytest.mark.asyncio
async def test_meta_agent_includes_primer_in_system_prompt() -> None:
    """The model must see the primer; without it the agent can't ground meta answers."""

    captured: list[list] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    model = _RecordingModel(responses=["ok"])
    await meta_agent_node(
        {"user_message": "how is es_critico calculated?"},
        model=model,
        primer="ES_CRITICO_DEFINITION_MARKER",
        catalog=_catalog_fixture(),
    )
    system = captured[0][0].content
    assert "ES_CRITICO_DEFINITION_MARKER" in system
    # Catalog must appear too — each fn_dx_* name should be in the system prompt.
    for entry in _catalog_fixture():
        assert entry.name in system


@pytest.mark.asyncio
async def test_meta_agent_includes_catalog_function_descriptions() -> None:
    """Title + body for every catalog entry must reach the LLM."""

    captured: list[str] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(input[0].content)
            return await super().ainvoke(input, *args, **kwargs)

    model = _RecordingModel(responses=["ok"])
    await meta_agent_node(
        {"user_message": "describe each fn_dx_*"},
        model=model,
        primer="primer",
        catalog=_catalog_fixture(),
    )
    system = captured[0]
    for entry in _catalog_fixture():
        assert entry.title in system
        assert entry.body in system


@pytest.mark.asyncio
async def test_meta_agent_does_not_invoke_tools() -> None:
    """No registry, no tool argument — structural guarantee of 'no SQL'.

    `meta_agent_node` signature does not accept a `ToolRegistry`; this
    test asserts the surface stays narrow so a future refactor can't
    sneak SQL access into the meta path.
    """

    import inspect

    sig = inspect.signature(meta_agent_node)
    assert "registry" not in sig.parameters
    assert "tools" not in sig.parameters
    assert "pool" not in sig.parameters
