"""Route-aware tenancy gate (plan 13, E7).

Refactor of plan 12's per-graph `tenant_gate_node` into a single
decision function shared by `nexo_graph.py` (NEXO_QUERY) and
`agentic_graph.py` (NEXO_AGENTIC). NEXO_META is allowed for any
authenticated tenant — meta-info is non-confidential.

The decision function is pure (no I/O, no LLM call) so the graphs can
embed it cheaply inside their entry-point node.

This is the "generalized for plan 14" piece: future tenant locks (AMS,
etc.) wire in here by extending the `_DATA_ROUTES` allowlist or
replacing the gate with a `TenancyPolicy` strategy.
"""

from __future__ import annotations

from dataclasses import dataclass

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.router import HarnessRoute

# Routes that touch tenant DATA (must match the tenant lock).
_DATA_ROUTES: frozenset[HarnessRoute] = frozenset(
    {HarnessRoute.NEXO_QUERY, HarnessRoute.NEXO_AGENTIC}
)

# Routes that return non-confidential meta information (allow any tenant).
_META_ROUTES: frozenset[HarnessRoute] = frozenset({HarnessRoute.NEXO_META})


@dataclass(frozen=True, slots=True)
class TenancyDecision:
    """Result of the gate check.

    - `allowed=True` with `audit_attr=None`: standard pass.
    - `allowed=True` with `audit_attr` set: pass for an off-lock tenant
      via a non-data route — the audit attr lets Langfuse spot these.
    - `allowed=False`: caller must short-circuit with `refusal_message`.
    """

    allowed: bool
    refusal_message: str | None = None
    audit_attr: dict[str, str] | None = None


def tenancy_gate_decision(
    *,
    ctx: HarnessContext,
    route: HarnessRoute,
    settings: HarnessSettings,
) -> TenancyDecision:
    lock = settings.nexo_tenant_lock
    tenant_matches = ctx.tenant_id == lock

    if route in _DATA_ROUTES:
        if tenant_matches:
            return TenancyDecision(allowed=True)
        return TenancyDecision(
            allowed=False,
            refusal_message=(
                f"Coordinador is {lock}-only. I can't answer for other tenants."
            ),
        )

    if route in _META_ROUTES:
        # Always allowed; emit an audit attribute when the tenant is
        # off-lock so the Langfuse panel can spot "meta route used for
        # non-Mintral tenant" patterns.
        if tenant_matches:
            return TenancyDecision(allowed=True)
        return TenancyDecision(
            allowed=True,
            audit_attr={"tenant.bypass": "meta_route"},
        )

    # Unknown / out-of-scope routes: safe-default to refuse for non-lock
    # tenants so a future route added without thinking about tenancy
    # can't accidentally leak.
    if tenant_matches:
        return TenancyDecision(allowed=True)
    return TenancyDecision(
        allowed=False,
        refusal_message=f"Route {route!s} is not available for tenant {ctx.tenant_id!r}.",
    )
