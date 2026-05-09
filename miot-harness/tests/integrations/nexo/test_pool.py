from __future__ import annotations

import pytest

from miot_harness.integrations.nexo.credentials import NexoCredentials
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
    creds = NexoCredentials(
        host="h", port=5432, database="d", user="u", password="p"
    )
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):  # noqa: D401
        captured["dsn"] = dsn
        captured["kwargs"] = kwargs
        return "POOL_SENTINEL"

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    pool = await create_nexo_pool(creds, min_size=1, max_size=4)

    assert pool == "POOL_SENTINEL"
    assert captured["dsn"] == creds.dsn
    assert "server_settings" not in captured["kwargs"]
    assert captured["kwargs"]["min_size"] == 1
    assert captured["kwargs"]["max_size"] == 4


@pytest.mark.asyncio
async def test_create_nexo_pool_default_sizes(monkeypatch):
    creds = NexoCredentials(host="h", port=5432, database="d", user="u", password="p")
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):
        captured.update(kwargs)
        return None

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    await create_nexo_pool(creds)

    # Conservative defaults; harness has at most ~handful of concurrent runs
    assert captured["min_size"] >= 1
    assert captured["max_size"] >= captured["min_size"]
