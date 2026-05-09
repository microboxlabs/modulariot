"""Asyncpg pool factory for the Nexo integration.

The pool is owned by the FastAPI lifespan hook (see B7); this module
just exposes a thin factory so tests and boot can build pools the same
way. `server_settings` is applied to every connection on acquire,
giving us read-only sessions even if the role itself lacks role-level
ALTER ROLE defaults (the case for CosmoDB-managed roles).
"""

from __future__ import annotations

from typing import Any

import asyncpg

from miot_harness.integrations.nexo.credentials import NexoCredentials

NEXO_SERVER_SETTINGS: dict[str, str] = {
    "default_transaction_read_only": "on",
    "statement_timeout": "30s",
    "idle_in_transaction_session_timeout": "5s",
}


async def create_nexo_pool(
    creds: NexoCredentials,
    *,
    min_size: int = 1,
    max_size: int = 4,
    **extra: Any,
) -> asyncpg.Pool:
    """Create an asyncpg.Pool for Nexo with safe defaults.

    Read-only enforcement is applied via `server_settings`, which
    asyncpg passes to each new connection's startup options. This
    catches mutation attempts at the DB layer regardless of role
    defaults.
    """
    return await asyncpg.create_pool(
        dsn=creds.dsn,
        min_size=min_size,
        max_size=max_size,
        server_settings=NEXO_SERVER_SETTINGS,
        **extra,
    )
