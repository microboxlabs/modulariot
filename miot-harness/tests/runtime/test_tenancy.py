"""Which tenants may read a locked datasource."""

from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.tenancy import data_refusal


def test_the_locked_tenant_may_read() -> None:
    assert data_refusal("orion", settings=HarnessSettings(), profile=NEXO_PROFILE) is None


def test_another_tenant_gets_the_profiles_refusal() -> None:
    refusal = data_refusal("acme", settings=HarnessSettings(), profile=NEXO_PROFILE)

    assert refusal == NEXO_PROFILE.tenant_refusal_template.format(
        display_name=NEXO_PROFILE.display_name, lock="orion"
    )


def test_the_env_override_replaces_the_profile_lock() -> None:
    settings = HarnessSettings(datasource_tenant_lock="acme")

    assert data_refusal("acme", settings=settings, profile=NEXO_PROFILE) is None
    assert data_refusal("orion", settings=settings, profile=NEXO_PROFILE) is not None


def test_the_connection_lock_must_match_too() -> None:
    refusal = data_refusal(
        "orion", settings=HarnessSettings(), profile=NEXO_PROFILE, connection_lock="acme"
    )

    assert refusal is not None and "acme" in refusal


def test_no_lock_anywhere_lets_every_tenant_read() -> None:
    assert data_refusal("anyone", settings=HarnessSettings(), profile=None) is None


def test_a_lock_without_a_profile_still_refuses() -> None:
    refusal = data_refusal(
        "acme", settings=HarnessSettings(), profile=None, connection_lock="orion"
    )

    assert refusal == "This datasource is orion-only. I can't read it for other tenants."
