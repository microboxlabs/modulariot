"""Mode resolver — explicit dispatch override for `RunRequest.mode` (E1).

When `request.mode == "auto"` the LLM intent router decides. When it's
one of `canned` / `meta` / `agentic`, we skip the router entirely and
dispatch directly. Validation rejects data-touching modes (`canned`,
`agentic`) for off-lock tenants at request-validation time so
unauthorized callers never reach an LLM, graph node, or a tool call
that would emit billable telemetry. `meta` is allowed for any tenant
(non-confidential schema/primer info per the plan's tenant-gate
decision).
"""

from __future__ import annotations

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import HarnessRoute, RouteResult


class ModeAccessDenied(PermissionError):
    """Caller requested an explicit mode they are not authorized for."""


_EXPLICIT_MODE_ROUTES: dict[str, HarnessRoute] = {
    "canned": HarnessRoute.DATA_QUERY,
    "meta": HarnessRoute.DATA_META,
    "agentic": HarnessRoute.DATA_AGENTIC,
}


async def resolve_mode(
    request: UserRequest,
    *,
    llm_router: LLMIntentRouter,
    tenant_lock: str,
) -> RouteResult:
    """Return the route to dispatch for ``request``.

    `tenant_lock` is the tenant id that gates data-touching routes
    (`canned` / `agentic`). `meta` is allowed for any tenant — meta-info
    is non-confidential per the plan's tenant-gate decision.
    """

    if request.mode == "auto":
        return await llm_router.route(request.message)

    # Both data-touching modes gated up-front. `tool_factory` enforces
    # the same lock at execution time, but rejecting here avoids
    # spinning up the graph (and its billable LLM / span emissions) for
    # a request that will be denied anyway.
    if request.mode in ("agentic", "canned") and request.tenant_id != tenant_lock:
        raise ModeAccessDenied(
            f"mode={request.mode!r} is {tenant_lock}-only; tenant={request.tenant_id!r}"
        )

    route = _EXPLICIT_MODE_ROUTES[request.mode]
    return RouteResult(
        route=route,
        reason=f"explicit mode={request.mode!r} (router bypassed)",
    )
