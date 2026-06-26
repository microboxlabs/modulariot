from __future__ import annotations

import pytest

from miot_harness.datasource.registry import available_kinds, resolve


def test_nexo_is_registered() -> None:
    assert "nexo" in available_kinds()


def test_resolve_nexo_returns_provider_with_profile() -> None:
    provider = resolve("nexo")
    assert provider.profile.name == "nexo"
    assert provider.profile.display_name == "Coordinador"
    assert provider.profile.tool_prefix == "coordinador_"
    assert provider.profile.tenant_lock == "mintral"


def test_generic_pg_is_registered() -> None:
    assert "pg" in available_kinds()


def test_resolve_pg_returns_generic_provider() -> None:
    from miot_harness.integrations.generic_pg.provider import GenericPgProvider

    assert isinstance(resolve("pg"), GenericPgProvider)


def test_resolve_unknown_kind_fails_fast_listing_kinds() -> None:
    with pytest.raises(ValueError) as exc:
        resolve("definitely-not-a-datasource")
    assert "nexo" in str(exc.value)  # lists available kinds


def test_resolve_returns_fresh_instance_per_call() -> None:
    # Providers own connection pools; a cached singleton would make one
    # caller's close() break another. The registry must instantiate.
    assert resolve("nexo") is not resolve("nexo")
