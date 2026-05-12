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


# High-precision Nexo tokens. Lowercased messages are searched against
# the lowercase forms; ETA stays uppercase and word-bounded.
_NEXO_LITERAL_TOKENS = (
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
    def route(self, message: str) -> RouteResult:
        normalized = message.lower()

        nexo_match = next(
            (token for token in _NEXO_LITERAL_TOKENS if token in normalized),
            None,
        )
        if nexo_match is None and _ETA_RE.search(message):
            nexo_match = "ETA"

        if nexo_match:
            return RouteResult(
                route=HarnessRoute.NEXO_QUERY,
                reason=f"Nexo keyword matched: {nexo_match!r}",
            )

        if any(token in normalized for token in _STORYTELLING_TOKENS):
            return RouteResult(
                route=HarnessRoute.STORYTELLING_RUN,
                reason="Request asks for a narrative artifact or dashboard draft.",
            )

        return RouteResult(route=HarnessRoute.DIRECT, reason="Simple direct response candidate.")
