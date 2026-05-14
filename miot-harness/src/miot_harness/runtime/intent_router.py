"""LLM-driven intent router (plan 13, E1).

Classifies a free-form user message into one of six routes:
NEXO_QUERY, NEXO_META, NEXO_AGENTIC, STORYTELLING_RUN, DIRECT, OTHER.

When the LLM's reported confidence is below the configured threshold, we
fall back to the keyword router (`runtime/router.IntentRouter`) — this is
the deterministic safety net for the "we don't know what this is" case.

Emits telemetry attrs on its own span via the per-agent callback wired
in `runtime/supervisor.py` (`modular.route.chosen`,
`modular.route.confidence`).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """You are the intent router for the ModularIoT harness.

Classify the user's message into EXACTLY ONE of these routes:

- NEXO_QUERY: A canned data question about Coordinador/Mintral that maps
  cleanly to a curated `fn_dx_*` function. Examples: "estado del centro
  de control", "ETA en riesgo hoy", "cola crítica del turno".
- NEXO_META: A schema/primer/introspection question that needs no SQL.
  Examples: "what data do you have?", "how is es_critico calculated?",
  "what does fn_dx_centro_control return?".
- NEXO_AGENTIC: A free-form exploration of Coordinador data that may
  need composable primitives (nexo_describe/select/grep) — the canned
  catalog doesn't cover it. Examples: "show me services where
  delta_eta_horas > 6", "tell me more about that", multi-turn drilldowns.
- STORYTELLING_RUN: User wants a written narrative or dashboard draft.
  Examples: "write a story about", "draft a status update".
- DIRECT: Greetings, small talk, simple chat where no data or narrative
  is needed.
- OTHER: Anything else (out-of-scope, abusive, malformed).

Reply with a single JSON object, no prose:
{"route": "<ROUTE_NAME>", "confidence": <0..1>, "reasoning": "<one short sentence>"}

`confidence` is your subjective certainty in the label, calibrated honestly
— if the message could plausibly be two routes, drop confidence below 0.7.
"""

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


@dataclass(frozen=True, slots=True)
class _RouterDecision:
    route: HarnessRoute
    confidence: float
    reasoning: str


_ROUTE_BY_NAME = {r.name: r for r in HarnessRoute}


def _parse_decision(raw: str) -> _RouterDecision | None:
    """Tolerant JSON parse: accepts bare JSON or a fenced ```json``` block."""

    text = raw.strip()
    fenced = _JSON_FENCE_RE.search(text)
    if fenced is not None:
        text = fenced.group(1)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    # Guard against the LLM returning a bare string / list / number instead
    # of a JSON object — `.get(...)` on those types raises AttributeError
    # and would crash the route call before the keyword fallback runs.
    if not isinstance(payload, dict):
        return None
    route_name = str(payload.get("route", "")).upper()
    route = _ROUTE_BY_NAME.get(route_name)
    if route is None:
        return None
    try:
        confidence = float(payload.get("confidence", 0.0))
    except (TypeError, ValueError):
        return None
    confidence = max(0.0, min(1.0, confidence))
    reasoning = str(payload.get("reasoning", ""))
    return _RouterDecision(route=route, confidence=confidence, reasoning=reasoning)


class LLMIntentRouter:
    """Async LLM-driven router with a deterministic keyword fallback.

    `keyword_fallback` runs when the LLM either (a) returns unparseable
    JSON, or (b) reports confidence below `confidence_threshold`. This
    is the safety net for "the LLM doesn't know" — we'd rather route via
    high-precision keywords than guess.
    """

    def __init__(
        self,
        model: BaseChatModel,
        *,
        confidence_threshold: float = 0.7,
        keyword_fallback: IntentRouter | None = None,
    ) -> None:
        self._model = model
        self._threshold = confidence_threshold
        self._fallback = keyword_fallback or IntentRouter()

    async def route(self, message: str) -> RouteResult:
        response = await self._model.ainvoke(
            [
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=message),
            ]
        )
        raw = response.content if hasattr(response, "content") else str(response)
        if not isinstance(raw, str):
            raw = str(raw)

        decision = _parse_decision(raw)
        if decision is None:
            logger.warning("LLMIntentRouter: unparseable response %r; falling back", raw[:120])
            return self._fallback.route(message)

        if decision.confidence < self._threshold:
            fallback = self._fallback.route(message)
            return RouteResult(
                route=fallback.route,
                reason=(
                    f"LLM confidence {decision.confidence:.2f} below "
                    f"threshold {self._threshold:.2f}; keyword fallback: {fallback.reason}"
                ),
            )

        return RouteResult(
            route=decision.route,
            reason=f"LLM (conf={decision.confidence:.2f}): {decision.reasoning}",
        )
