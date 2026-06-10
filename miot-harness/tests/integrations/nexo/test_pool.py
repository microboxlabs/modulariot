from __future__ import annotations

import pytest

from miot_harness.integrations.nexo.pool import (
    NEXO_SERVER_SETTINGS,
    create_nexo_pool,
)


def test_server_settings_constant_is_pgbouncer_safe():
    """PgBouncer transaction-pooling rejects unknown startup parameters,
    so we ship NO server_settings at pool-creation time. Read-only
    enforcement is per-transaction at each call site instead."""
    assert NEXO_SERVER_SETTINGS == {}


@pytest.mark.asyncio
async def test_create_nexo_pool_does_not_pass_server_settings(monkeypatch):
    """Regression for the PgBouncer 'unsupported startup parameter:
    default_transaction_read_only' boot failure observed against
    coordinador-prod. The pool factory must NOT forward
    server_settings to asyncpg.create_pool.
    """
    dsn = "postgresql://u:p@h:5432/d"
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):  # noqa: D401
        captured["dsn"] = dsn
        captured["kwargs"] = kwargs
        return "POOL_SENTINEL"

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    pool = await create_nexo_pool(dsn, min_size=1, max_size=4)

    assert pool == "POOL_SENTINEL"
    assert captured["dsn"] == dsn
    assert "server_settings" not in captured["kwargs"]
    assert captured["kwargs"]["min_size"] == 1
    assert captured["kwargs"]["max_size"] == 4


@pytest.mark.asyncio
async def test_create_nexo_pool_default_sizes(monkeypatch):
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):
        captured.update(kwargs)
        return None

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    await create_nexo_pool("postgresql://u:p@h:5432/d")

    # Conservative defaults; harness has at most ~handful of concurrent runs
    assert captured["min_size"] >= 1
    assert captured["max_size"] >= captured["min_size"]


@pytest.mark.asyncio
async def test_create_nexo_pool_with_dsn(monkeypatch):
    """The harness sources Nexo credentials from a single standard
    Postgres connection string (`MIOT_HARNESS_DATASOURCE_DSN`)."""
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):
        captured["dsn"] = dsn
        captured["kwargs"] = kwargs
        return "POOL_DSN_PATH"

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    pool = await create_nexo_pool("postgresql://u:p@h:6432/citus")

    assert pool == "POOL_DSN_PATH"
    assert captured["dsn"] == "postgresql://u:p@h:6432/citus"
    assert "server_settings" not in captured["kwargs"]


@pytest.mark.asyncio
async def test_create_nexo_pool_application_name_rides_server_settings(monkeypatch):
    """Regression for the prod boot failure `connect() got an unexpected
    keyword argument 'application_name'`: asyncpg has no such kwarg, so
    the pool factory must translate it into `server_settings` — the one
    startup parameter PgBouncer tracks natively (unlike the read-only /
    timeout parameters guarded against above)."""
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):
        captured["kwargs"] = kwargs
        return "POOL_APPNAME"

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    pool = await create_nexo_pool(
        "postgresql://u:p@h:6432/citus", application_name="miot-harness"
    )

    assert pool == "POOL_APPNAME"
    assert captured["kwargs"]["server_settings"] == {
        "application_name": "miot-harness"
    }


@pytest.mark.asyncio
async def test_create_nexo_pool_rejects_empty_dsn():
    """An empty DSN is a caller/config bug — surface it loudly rather
    than handing asyncpg a meaningless connection string."""
    with pytest.raises(ValueError, match="dsn"):
        await create_nexo_pool("")
