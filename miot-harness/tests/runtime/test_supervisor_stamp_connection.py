"""Supervisor stamps the run's connection onto ground-or-flag assumptions.

The synthesizer self-reports term/interpretation/predicate; the connection is the
harness's to assign (the LLM can't know it) and defaults to the primary connection
the deployment serves — so the review surface can stage a candidate against the
right connection. See the semantic-layer continual-learning design (R2c).
"""

from __future__ import annotations

from typing import Any

from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


def _supervisor(tmp_path: Any) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
    )


def test_stamps_primary_connection_onto_assumptions(tmp_path: Any) -> None:
    sup = _supervisor(tmp_path)
    sup.primary_connection_name = "acs"
    stamped = sup._stamp_connection(
        [{"term": "entregas", "interpretation": "confirmDelivery", "grounded": False}]
    )
    assert stamped[0]["connection"] == "acs"
    # Original term data is preserved.
    assert stamped[0]["term"] == "entregas"


def test_never_overwrites_an_existing_connection(tmp_path: Any) -> None:
    sup = _supervisor(tmp_path)
    sup.primary_connection_name = "acs"
    stamped = sup._stamp_connection([{"term": "x", "connection": "nexo"}])
    assert stamped[0]["connection"] == "nexo"


def test_no_op_when_no_primary_connection(tmp_path: Any) -> None:
    sup = _supervisor(tmp_path)
    # primary_connection_name defaults to None (legacy/dev).
    assert sup.primary_connection_name is None
    assumptions = [{"term": "x"}]
    stamped = sup._stamp_connection(assumptions)
    assert stamped == [{"term": "x"}]
    assert "connection" not in stamped[0]
