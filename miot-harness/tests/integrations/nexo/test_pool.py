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
    creds = NexoCredentials(host="h", port=5432, database="d", user="u", password="p")
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


# --- DSN-bypass path (T05) -------------------------------------------------
# Container deploys mount `MIOT_HARNESS_NEXO_DSN` as a single secret instead
# of a full db-scripts directory. The pool factory must accept a raw DSN
# without requiring a NexoCredentials wrapper, and produce an equivalent
# pool to the file-based path.


@pytest.mark.asyncio
async def test_create_nexo_pool_with_raw_dsn(monkeypatch):
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):
        captured["dsn"] = dsn
        captured["kwargs"] = kwargs
        return "POOL_DSN_PATH"

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    pool = await create_nexo_pool(dsn="postgresql://u:p@h:5432/d")

    assert pool == "POOL_DSN_PATH"
    assert captured["dsn"] == "postgresql://u:p@h:5432/d"
    # Same PgBouncer guard: still no server_settings even via the DSN path.
    assert "server_settings" not in captured["kwargs"]


@pytest.mark.asyncio
async def test_dsn_kwarg_overrides_creds_when_both_passed(monkeypatch):
    """Precedence rule: explicit DSN wins over file-derived credentials.
    Mirrors industry standard (Django DATABASE_URL, sqlx, etc.) and
    keeps containerized deploys free of stale alias-file fallout."""
    creds = NexoCredentials(host="ignored", port=1, database="x", user="x", password="x")
    captured: dict = {}

    async def fake_create_pool(dsn=None, **kwargs):
        captured["dsn"] = dsn
        return None

    import asyncpg

    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    await create_nexo_pool(creds, dsn="postgresql://override:secret@db:6432/citus")

    assert captured["dsn"] == "postgresql://override:secret@db:6432/citus"
    assert "ignored" not in captured["dsn"]


@pytest.mark.asyncio
async def test_create_nexo_pool_requires_creds_or_dsn():
    """At least one source of truth must be passed — caller bug surfacing."""
    with pytest.raises(ValueError, match="creds.*dsn|dsn.*creds"):
        await create_nexo_pool()
