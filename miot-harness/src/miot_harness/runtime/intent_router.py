"""LLM-driven intent router (plan 13, E1).

Classifies a free-form user message into one of six routes:
DATA_QUERY, DATA_META, DATA_AGENTIC, STORYTELLING_RUN, DIRECT, OTHER.

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

from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult

logger = logging.getLogger(__name__)


# Defaults used when no profile is threaded in (legacy / unit-test paths).
# Generic, datasource-agnostic placeholders; a real profile overrides both.
_DEFAULT_DISPLAY_NAME = "the data source"
_DEFAULT_KEYWORD_EXAMPLES = "operational status, KPIs, fleet metrics"

_SYSTEM_PROMPT_TEMPLATE = """You are the intent router for the ModularIoT harness.

Classify the user's message into EXACTLY ONE of these routes:

- DATA_QUERY: A canned data question about {display_name} that maps
  cleanly to a curated data function. Examples are phrased around its
  vocabulary: {keyword_examples}.
- DATA_META: A schema/primer/introspection question that needs no SQL.
  Examples: "what data do you have?", "how is this field calculated?",
  "what does this function return?".
- DATA_AGENTIC: A free-form exploration of {display_name} data that may
  need composable primitives (describe/select/grep) — the canned
  catalog doesn't cover it. Examples: "show me rows where some_metric
  > 6", "tell me more about that", multi-turn drilldowns.
- STORYTELLING_RUN: User wants a written narrative or dashboard draft.
  Examples: "write a story about", "draft a status update".
- DIRECT: Greetings, small talk, simple chat where no data or narrative
  is needed.
- OTHER: Anything else (out-of-scope, abusive, malformed).

Reply with a single JSON object, no prose:
{{"route": "<ROUTE_NAME>", "confidence": <0..1>, "reasoning": "<one short sentence>"}}

`confidence` is your subjective certainty in the label, calibrated honestly
— if the message could plausibly be two routes, drop confidence below 0.7.
"""


def _render_system_prompt(profile: DataSourceProfile | None) -> str:
    """Render the router prompt for a given datasource profile.

    The route vocabulary is profile-agnostic; only the example wording is
    parameterized via the profile's `display_name` and `router_keywords`
    so the prompt names the active datasource instead of hardcoding it.
    """

    if profile is None:
        display_name = _DEFAULT_DISPLAY_NAME
        keyword_examples = _DEFAULT_KEYWORD_EXAMPLES
    else:
        display_name = profile.display_name
        # Sorted for deterministic rendering; the full keyword set keeps
        # distinctive literals (e.g. tenant names) visible to the LLM.
        keyword_examples = ", ".join(sorted(profile.router_keywords)) or (
            _DEFAULT_KEYWORD_EXAMPLES
        )
    return _SYSTEM_PROMPT_TEMPLATE.format(
        display_name=display_name, keyword_examples=keyword_examples
    )

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
        profile: DataSourceProfile | None = None,
    ) -> None:
        self._model = model
        self._threshold = confidence_threshold
        self._fallback = keyword_fallback or IntentRouter()
        self._system_prompt = _render_system_prompt(profile)

    async def route(self, message: str) -> RouteResult:
        try:
            response = await self._model.ainvoke(
                [
                    SystemMessage(content=self._system_prompt),
                    HumanMessage(content=message),
                ]
            )
        except Exception as exc:  # noqa: BLE001 — fallback on ANY model failure
            # Any failure (timeout, provider error, network) trips the
            # deterministic keyword fallback rather than failing the run.
            # Log the exception class only — exception messages may include
            # request payloads that contain the user's message.
            logger.warning(
                "LLMIntentRouter: model invocation failed (%s); falling back",
                type(exc).__name__,
            )
            return self._fallback.route(message)

        raw = response.content if hasattr(response, "content") else str(response)
        if not isinstance(raw, str):
            raw = str(raw)

        decision = _parse_decision(raw)
        if decision is None:
            # Don't log raw content: a misbehaving LLM frequently echoes
            # parts of the user's message, which may carry tenant
            # identifiers, PII, or business data that doesn't belong in
            # operator-visible logs. Length is sufficient for triage.
            logger.warning(
                "LLMIntentRouter: unparseable response (length=%d); falling back",
                len(raw),
            )
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
