"""E7 — tenancy gate behavior matrix.

The plan's matrix:
- DATA_QUERY  → refuse non-Mintral.
- DATA_AGENTIC → refuse non-Mintral (composable primitives touch data).
- DATA_META   → allow ANY tenant (meta-info is non-confidential).

Plus: when meta is allowed for a non-locked tenant, emit an audit
attribute `tenant.bypass: meta_route` on the gate's emitted event.
"""

from __future__ import annotations

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.router import HarnessRoute
from miot_harness.runtime.tenancy import tenancy_gate_decision


def _ctx(tenant: str = "mintral") -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id=tenant, user_id="u")


@pytest.mark.parametrize(
    "route",
    [HarnessRoute.DATA_QUERY, HarnessRoute.DATA_AGENTIC],
)
def test_data_routes_refuse_non_mintral(route: HarnessRoute) -> None:
    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="other-tenant"),
        route=route,
        settings=HarnessSettings(),
    )
    assert decision.allowed is False
    assert "mintral" in (decision.refusal_message or "").lower()
    assert decision.audit_attr is None


@pytest.mark.parametrize(
    "route",
    [HarnessRoute.DATA_QUERY, HarnessRoute.DATA_AGENTIC],
)
def test_data_routes_allow_locked_tenant(route: HarnessRoute) -> None:
    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="mintral"),
        route=route,
        settings=HarnessSettings(),
    )
    assert decision.allowed is True
    assert decision.refusal_message is None
    assert decision.audit_attr is None


def test_data_meta_allows_any_tenant_with_audit_attr() -> None:
    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="ams-customer"),
        route=HarnessRoute.DATA_META,
        settings=HarnessSettings(),
    )
    assert decision.allowed is True
    # Audit attr fires only when the gate is "bypassed" for a non-locked tenant.
    assert decision.audit_attr == {"tenant.bypass": "meta_route"}


def test_data_meta_for_locked_tenant_does_not_emit_bypass_attr() -> None:
    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="mintral"),
        route=HarnessRoute.DATA_META,
        settings=HarnessSettings(),
    )
    assert decision.allowed is True
    assert decision.audit_attr is None


def test_unknown_route_defaults_to_strict_refuse_for_safety() -> None:
    """If we ever route something unexpected through the gate, refuse."""

    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="other"),
        route=HarnessRoute.OTHER,
        settings=HarnessSettings(),
    )
    assert decision.allowed is False


def test_gate_uses_profile_lock_and_template() -> None:
    from tests.fixtures.fake_provider import FAKE_PROFILE

    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="intruder"),
        route=HarnessRoute.DATA_QUERY,
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
    )
    assert decision.allowed is False
    assert decision.refusal_message == (
        "FakeSource is acme-only. I can't answer for other tenants."
    )


def test_gate_profile_lock_allows_matching_tenant() -> None:
    from tests.fixtures.fake_provider import FAKE_PROFILE

    decision = tenancy_gate_decision(
        ctx=_ctx(tenant="acme"),
        route=HarnessRoute.DATA_QUERY,
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
    )
    assert decision.allowed is True
