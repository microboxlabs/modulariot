"""Whether a tenant may read the datasource.

A datasource can be locked to one tenant. Every tenant still talks to the
model; for the others the datasource tools refuse.
"""

from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import DataSourceProfile


def data_refusal(
    tenant_id: str,
    *,
    settings: HarnessSettings,
    profile: DataSourceProfile | None,
    connection_lock: str | None = None,
) -> str | None:
    """None when the tenant may read the datasource, else the refusal to show.

    Two locks apply and both must match: the one the primary connection
    declares (`connection_lock`), and the env override or the profile's own
    (`MIOT_HARNESS_DATASOURCE_TENANT_LOCK`, else `profile.tenant_lock`). An
    unset lock matches every tenant.
    """

    profile_lock = settings.datasource_tenant_lock or (
        profile.tenant_lock if profile is not None else None
    )
    for lock in (connection_lock, profile_lock):
        if lock and tenant_id != lock:
            if profile is None:
                return f"This datasource is {lock}-only. I can't read it for other tenants."
            return profile.tenant_refusal_template.format(
                display_name=profile.display_name, lock=lock
            )
    return None
