"""Effective permission-mode resolution + the bypass policy gate.

The supervisor calls `resolve_effective_mode` once per run to turn a
*requested* mode into the *effective* mode that lands on HarnessContext.
A `bypass` request that the deployment's policy forbids is downgraded to
`default` and flagged (`denied=True`) so the caller can emit
`steering.mode_denied` rather than hard-failing the run.
"""

from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.runtime.permissions import PermissionMode


def resolve_effective_mode(
    requested: PermissionMode,
    *,
    settings: HarnessSettings,
    tenant_id: str,
) -> tuple[PermissionMode, bool]:
    """Return (effective_mode, denied).

    Only `bypass` is gated. `default` and `auto_safe` pass through
    unchanged. When `bypass` is forbidden by the deployment policy, the
    effective mode is downgraded to `default` and `denied` is True.
    """

    if requested is not PermissionMode.BYPASS:
        return requested, False

    policy = settings.steering_bypass_policy
    if policy == "audited":
        allowed = True
    elif policy == "per_tenant":
        allowed = settings.bypass_tenant_allowed(tenant_id)
    else:  # dev_only
        allowed = settings.env != "prod"

    if allowed:
        return PermissionMode.BYPASS, False
    return PermissionMode.DEFAULT, True
