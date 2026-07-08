from __future__ import annotations

import pytest

from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.permissions import (
    PermissionDecision,
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
)


def test_context_defaults_permission_policy_to_none() -> None:
    ctx = HarnessContext(thread_id="t", tenant_id="acme", user_id="u")
    assert ctx.permission_policy is None


def test_user_request_carries_mode_and_rules_to_context() -> None:
    req = UserRequest(
        message="hi",
        tenant_id="demo-tenant",
        permission_mode=PermissionMode.AUTO_SAFE,
        rules=[PermissionRule(tool="run_sql", decision=PermissionDecision.ALLOW)],
    )
    ctx = req.to_context()
    assert ctx.permission_policy is not None
    assert ctx.permission_policy.mode is PermissionMode.AUTO_SAFE
    assert ctx.permission_policy.rules[0].tool == "run_sql"


def test_user_request_without_mode_yields_no_policy() -> None:
    ctx = UserRequest(message="hi", tenant_id="demo-tenant").to_context()
    assert ctx.permission_policy is None


def test_user_request_normalizes_tenant_id_to_context() -> None:
    ctx = UserRequest(message="hi", tenant_id="  demo-tenant  ").to_context()
    assert ctx.tenant_id == "demo-tenant"


def test_user_request_whitespace_tenant_id_cannot_create_context() -> None:
    req = UserRequest(message="hi", tenant_id="   ")
    with pytest.raises(ValueError, match="tenant_id is unresolved"):
        req.to_context()


def test_permission_policy_excluded_from_context_dump() -> None:
    ctx = HarnessContext(
        thread_id="t",
        tenant_id="acme",
        user_id="u",
        permission_policy=PermissionPolicy(mode=PermissionMode.BYPASS),
    )
    assert "permission_policy" not in ctx.model_dump()
