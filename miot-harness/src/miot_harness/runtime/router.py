"""Intent router.

v1 is keyword-based — the Nexo (Coordinador / Mintral) vocabulary is
distinctive enough that high-precision tokens give us low false-
positive routing without touching an LLM.

Resolution rule (review item S7): when a message has both Nexo and
storytelling keywords, **Nexo wins**. Most operational follow-ups
ride on top of Nexo data anyway; misrouting a Nexo question into
storytelling is more expensive (writes a long narrative against
mocked tools) than the reverse.
"""

from __future__ import annotations

import re
from enum import StrEnum

from pydantic import BaseModel


class HarnessRoute(StrEnum):
    DIRECT = "direct"
    STORYTELLING_RUN = "storytelling_run"
    NEXO_QUERY = "nexo_query"
    # Phase E (plan 13): three Nexo modes give cost/quality tiers and
    # let the operator dashboard split per-mode behavior. NEXO_META is
    # the only mode allowed for non-Mintral tenants (meta-info is
    # non-confidential per `decisions made -> tenant gate behavior`).
    NEXO_META = "nexo_meta"
    NEXO_AGENTIC = "nexo_agentic"
    OTHER = "other"


class RouteResult(BaseModel):
    route: HarnessRoute
    reason: str


# High-precision data-route tokens (nexo defaults during the seam transition).
# Lowercased messages are searched against the lowercase forms; ETA stays
# uppercase and word-bounded.
_DEFAULT_DATA_TOKENS = (
    "coordinador",
    "mintral",
    "centro de control",
    "cola crítica",
    "cola critica",
    "dimensionamiento",
    "torre de control",
    "auditoría pod",
    "auditoria pod",
    "fn_dx",
)
_ETA_RE = re.compile(r"\bETA\b")
_STORYTELLING_TOKENS = ("story", "dashboard widget")


class IntentRouter:
    def __init__(self, data_keywords: frozenset[str] | None = None) -> None:
        self._data_keywords = (
            data_keywords if data_keywords is not None else frozenset(_DEFAULT_DATA_TOKENS)
        )

    def route(self, message: str) -> RouteResult:
        normalized = message.lower()

        data_match = next(
            (token for token in self._data_keywords if token in normalized),
            None,
        )
        # ETA regex is coordinador-specific; folded into profile keywords in a follow-up.
        if data_match is None and _ETA_RE.search(message):
            data_match = "ETA"

        if data_match:
            return RouteResult(
                route=HarnessRoute.NEXO_QUERY,
                reason=f"Nexo keyword matched: {data_match!r}",
            )

        if any(token in normalized for token in _STORYTELLING_TOKENS):
            return RouteResult(
                route=HarnessRoute.STORYTELLING_RUN,
                reason="Request asks for a narrative artifact or dashboard draft.",
            )

        return RouteResult(route=HarnessRoute.DIRECT, reason="Simple direct response candidate.")
