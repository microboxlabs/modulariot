"""Building the data graph with the FakeProvider profile must produce a
graph — proof no Coordinador hardcode is required by core code."""

from __future__ import annotations

from langchain_core.language_models import FakeListChatModel

from miot_harness.config import HarnessSettings
from miot_harness.runtime.data_graph import build_data_graph
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


def _models() -> dict[str, FakeListChatModel]:
    """Cheapest model pool: one empty FakeListChatModel per LLM seat. The
    seam test only compiles the graph (no ainvoke), so no responses needed.
    Mirrors the seat list used by tests/integrations/nexo/test_graph.py::_models.
    """
    return {
        "filter_expert": FakeListChatModel(responses=[]),
        "domain_analyst": FakeListChatModel(responses=[]),
        "synthesizer": FakeListChatModel(responses=[]),
        "critic": FakeListChatModel(responses=[]),
        "summarizer": FakeListChatModel(responses=[]),
    }


def test_build_data_graph_with_fake_profile_compiles() -> None:
    graph = build_data_graph(
        registry=ToolRegistry(),
        settings=HarnessSettings(),
        models=_models(),
        profile=FAKE_PROFILE,
    )
    assert graph is not None
