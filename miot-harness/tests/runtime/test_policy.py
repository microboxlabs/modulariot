from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.runtime.permissions import PermissionMode
from miot_harness.runtime.policy import resolve_effective_mode


def _settings(**kw: object) -> HarnessSettings:
    return HarnessSettings(datasource_dsn=None, **kw)  # type: ignore[arg-type]


def test_non_bypass_modes_pass_through() -> None:
    s = _settings(env="prod", steering_bypass_policy="dev_only")
    mode, denied = resolve_effective_mode(
        PermissionMode.AUTO_SAFE, settings=s, tenant_id="acme"
    )
    assert mode is PermissionMode.AUTO_SAFE
    assert denied is False


def test_bypass_allowed_in_dev_under_dev_only() -> None:
    s = _settings(env="local", steering_bypass_policy="dev_only")
    mode, denied = resolve_effective_mode(
        PermissionMode.BYPASS, settings=s, tenant_id="acme"
    )
    assert mode is PermissionMode.BYPASS
    assert denied is False


def test_bypass_downgraded_in_prod_under_dev_only() -> None:
    s = _settings(env="prod", steering_bypass_policy="dev_only")
    mode, denied = resolve_effective_mode(
        PermissionMode.BYPASS, settings=s, tenant_id="acme"
    )
    assert mode is PermissionMode.DEFAULT
    assert denied is True


def test_bypass_allowed_anywhere_under_audited() -> None:
    s = _settings(env="prod", steering_bypass_policy="audited")
    mode, denied = resolve_effective_mode(
        PermissionMode.BYPASS, settings=s, tenant_id="acme"
    )
    assert mode is PermissionMode.BYPASS
    assert denied is False


def test_bypass_per_tenant_allowlist() -> None:
    s = _settings(
        env="prod",
        steering_bypass_policy="per_tenant",
        steering_bypass_tenants="acme,globex",
    )
    allowed, _ = resolve_effective_mode(
        PermissionMode.BYPASS, settings=s, tenant_id="acme"
    )
    denied_mode, denied = resolve_effective_mode(
        PermissionMode.BYPASS, settings=s, tenant_id="initech"
    )
    assert allowed is PermissionMode.BYPASS
    assert denied_mode is PermissionMode.DEFAULT
    assert denied is True
