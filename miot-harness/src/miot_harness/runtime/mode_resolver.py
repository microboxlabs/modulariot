"""Mode resolver — explicit dispatch override for `RunRequest.mode` (E1).

When `request.mode == "auto"` the LLM intent router decides. When it's
one of `canned` / `meta` / `agentic`, we skip the router entirely and
dispatch directly. Validation rejects `mode="agentic"` for non-Mintral
tenants at request-validation time so unauthorized callers never reach
an LLM or graph node.
"""

from __future__ import annotations

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import HarnessRoute, RouteResult


class ModeAccessDenied(PermissionError):
    """Caller requested an explicit mode they are not authorized for."""


_EXPLICIT_MODE_ROUTES: dict[str, HarnessRoute] = {
    "canned": HarnessRoute.NEXO_QUERY,
    "meta": HarnessRoute.NEXO_META,
    "agentic": HarnessRoute.NEXO_AGENTIC,
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

    if request.mode == "agentic" and request.tenant_id != tenant_lock:
        raise ModeAccessDenied(
            f"mode='agentic' is {tenant_lock}-only; tenant={request.tenant_id!r}"
        )

    route = _EXPLICIT_MODE_ROUTES[request.mode]
    return RouteResult(
        route=route,
        reason=f"explicit mode={request.mode!r} (router bypassed)",
    )
