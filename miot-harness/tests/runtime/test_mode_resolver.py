"""E1 — explicit-mode bypass: 4 paths (canned / meta / agentic / agentic-denied)."""

from __future__ import annotations

import json

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.mode_resolver import ModeAccessDenied, resolve_mode
from miot_harness.runtime.router import HarnessRoute, IntentRouter


def _llm_router_that_must_not_be_called() -> LLMIntentRouter:
    """Build a router whose FakeListChatModel has 0 scripted responses.

    If `resolve_mode` accidentally calls `.route(...)` on this router, the
    underlying model raises IndexError on the empty responses list — test
    fails loudly. This is exactly what we want for the bypass paths.
    """

    return LLMIntentRouter(
        FakeListChatModel(responses=[]),
        confidence_threshold=0.7,
        keyword_fallback=IntentRouter(),
    )


@pytest.mark.asyncio
async def test_explicit_canned_mode_bypasses_router() -> None:
    request = UserRequest(message="anything", tenant_id="mintral", mode="canned")
    result = await resolve_mode(
        request, llm_router=_llm_router_that_must_not_be_called(), tenant_lock="mintral"
    )
    assert result.route is HarnessRoute.DATA_QUERY
    assert "canned" in result.reason


@pytest.mark.asyncio
async def test_explicit_meta_mode_bypasses_router() -> None:
    request = UserRequest(message="what data?", tenant_id="any-tenant", mode="meta")
    result = await resolve_mode(
        request, llm_router=_llm_router_that_must_not_be_called(), tenant_lock="mintral"
    )
    # Meta is allowed for any tenant — non-confidential by spec.
    assert result.route is HarnessRoute.DATA_META


@pytest.mark.asyncio
async def test_explicit_agentic_mode_for_mintral_tenant() -> None:
    request = UserRequest(message="explore the data", tenant_id="mintral", mode="agentic")
    result = await resolve_mode(
        request, llm_router=_llm_router_that_must_not_be_called(), tenant_lock="mintral"
    )
    assert result.route is HarnessRoute.DATA_AGENTIC


@pytest.mark.asyncio
async def test_explicit_agentic_mode_rejected_for_non_mintral_tenant() -> None:
    request = UserRequest(message="explore", tenant_id="ams-other", mode="agentic")
    with pytest.raises(ModeAccessDenied):
        await resolve_mode(
            request,
            llm_router=_llm_router_that_must_not_be_called(),
            tenant_lock="mintral",
        )


@pytest.mark.asyncio
async def test_explicit_canned_mode_rejected_for_non_mintral_tenant() -> None:
    """`canned` is data-touching just like `agentic` — the tenant lock
    must reject it at request-validation time so an off-lock caller can't
    even reach the graph (where the tool-level lock would deny anyway,
    but only after billable LLM + span emissions have already fired).
    """

    request = UserRequest(message="status", tenant_id="ams-other", mode="canned")
    with pytest.raises(ModeAccessDenied):
        await resolve_mode(
            request,
            llm_router=_llm_router_that_must_not_be_called(),
            tenant_lock="mintral",
        )


@pytest.mark.asyncio
async def test_auto_mode_delegates_to_llm_router() -> None:
    model = FakeListChatModel(
        responses=[json.dumps({"route": "DATA_AGENTIC", "confidence": 0.95})]
    )
    router = LLMIntentRouter(model, confidence_threshold=0.7, keyword_fallback=IntentRouter())
    request = UserRequest(message="show me services", tenant_id="mintral")  # mode default "auto"
    result = await resolve_mode(request, llm_router=router, tenant_lock="mintral")
    assert result.route is HarnessRoute.DATA_AGENTIC


def test_user_request_rejects_unknown_mode() -> None:
    """Invalid mode values fail pydantic validation (HTTP 422 in FastAPI)."""

    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UserRequest(message="x", tenant_id="mintral", mode="bogus")  # type: ignore[arg-type]
