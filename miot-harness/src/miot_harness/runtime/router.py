"""Intent router.

v1 is keyword-based — a datasource's domain vocabulary is distinctive
enough that high-precision tokens give us low false-positive routing
without touching an LLM. The keyword set is supplied per datasource via
``data_keywords`` (the active ``DataSourceProfile.router_keywords``); the
core ships no built-in vocabulary.

Resolution rule (review item S7): when a message has both data-route and
storytelling keywords, **the data route wins**. Most operational
follow-ups ride on top of datasource data anyway; misrouting a data
question into storytelling is more expensive (writes a long narrative
against mocked tools) than the reverse.
"""

from __future__ import annotations

import re
from enum import StrEnum

from pydantic import BaseModel


class HarnessRoute(StrEnum):
    DIRECT = "direct"
    STORYTELLING_RUN = "storytelling_run"
    DATA_QUERY = "data_query"
    # Phase E (plan 13): three data modes give cost/quality tiers and
    # let the operator dashboard split per-mode behavior. DATA_META is
    # the only mode allowed for off-lock (non-locked-tenant) requests
    # (meta-info is non-confidential per `decisions made -> tenant gate
    # behavior`).
    DATA_META = "data_meta"
    DATA_AGENTIC = "data_agentic"
    OTHER = "other"


class RouteResult(BaseModel):
    route: HarnessRoute
    reason: str


# Generic ETA token: matched word-bounded and case-sensitively. ETA is a
# cross-domain logistics term, so it is a built-in data-route hint
# regardless of the active datasource's keyword set.
_ETA_RE = re.compile(r"\bETA\b")
_STORYTELLING_TOKENS = ("story", "dashboard widget")


class IntentRouter:
    def __init__(self, data_keywords: frozenset[str] | None = None) -> None:
        # No built-in domain vocabulary: keywords come from the active
        # datasource profile (server.py passes profile.router_keywords). A
        # bare IntentRouter() routes only on the generic ETA token until a
        # datasource is wired.
        self._data_keywords = data_keywords if data_keywords is not None else frozenset()

    def route(self, message: str) -> RouteResult:
        normalized = message.lower()

        data_match = next(
            (token for token in self._data_keywords if token in normalized),
            None,
        )
        # Generic ETA hint, applied on top of the profile keyword set.
        if data_match is None and _ETA_RE.search(message):
            data_match = "ETA"

        if data_match:
            return RouteResult(
                route=HarnessRoute.DATA_QUERY,
                reason=f"data keyword matched: {data_match!r}",
            )

        if any(token in normalized for token in _STORYTELLING_TOKENS):
            return RouteResult(
                route=HarnessRoute.STORYTELLING_RUN,
                reason="Request asks for a narrative artifact or dashboard draft.",
            )

        return RouteResult(route=HarnessRoute.DIRECT, reason="Simple direct response candidate.")
