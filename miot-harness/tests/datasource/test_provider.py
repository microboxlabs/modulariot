"""DataSourceProvider seam: profile shape and provider contract."""

from __future__ import annotations

import pytest

from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)


def make_profile(**overrides) -> DataSourceProfile:
    base = dict(
        name="fake",
        display_name="FakeSource",
        source_label="FakeSource · fake (test)",
        tool_prefix="fake_",
        primer="FakeSource answers questions about test fixtures.",
        router_keywords=frozenset({"fakesource", "fixture"}),
        tenant_lock="acme",
        tenant_refusal_template=(
            "{display_name} is {lock}-only. I can't answer for other tenants."
        ),
        freshness_warn_minutes=30,
        freshness_refuse_minutes=240,
    )
    base.update(overrides)
    return DataSourceProfile(**base)


def test_profile_is_frozen() -> None:
    profile = make_profile()
    with pytest.raises(AttributeError):  # dataclasses.FrozenInstanceError
        profile.name = "other"  # type: ignore[misc]


def test_refusal_template_formats() -> None:
    profile = make_profile()
    msg = profile.tenant_refusal_template.format(
        display_name=profile.display_name, lock=profile.tenant_lock
    )
    assert msg == "FakeSource is acme-only. I can't answer for other tenants."


def test_boot_result_defaults() -> None:
    r = BootResult(enabled=False, registered=())
    assert r.registered == ()
    assert r.reason is None
    assert r.snapshot_age_minutes is None


def test_provider_is_abstract() -> None:
    with pytest.raises(TypeError):
        DataSourceProvider()  # type: ignore[abstract]


def test_provider_without_profile_is_abstract() -> None:
    class _NoProfile(DataSourceProvider):
        async def boot(self, registry, settings):  # type: ignore[no-untyped-def]
            raise NotImplementedError

        async def close(self) -> None: ...

    with pytest.raises(TypeError):
        _NoProfile()  # type: ignore[abstract]


def test_provider_with_class_attribute_profile_instantiates() -> None:
    """A subclass satisfying profile via a class attribute instantiates fine."""

    class _WithProfile(DataSourceProvider):
        profile = make_profile()

        async def boot(self, registry, settings):  # type: ignore[no-untyped-def]
            raise NotImplementedError

        async def close(self) -> None: ...

    provider = _WithProfile()
    assert provider.profile == make_profile()
