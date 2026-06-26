"""Backend-agnostic asyncpg pool factory.

Mirrors the PgBouncer-safe approach documented in
`integrations/nexo/pool.py`: no startup `server_settings` other than
`application_name` (PgBouncer in transaction-pooling mode rejects unknown
startup parameters such as `default_transaction_read_only` /
`statement_timeout`). Read-only enforcement and statement timeouts are applied
per-transaction at the call site (`BEGIN READ ONLY` + `SET LOCAL
statement_timeout`), not via startup parameters.

This lives under `datasource/` (not `integrations/nexo/`) so generic
connections can build pools without importing the Nexo integration — the
"only `integrations/nexo` may say Nexo/Coordinador/mintral" boundary stays
intact.
"""

from __future__ import annotations

from typing import Any

import asyncpg


async def create_pg_pool(
    dsn: str,
    *,
    min_size: int = 1,
    max_size: int = 4,
    application_name: str | None = None,
    **extra: Any,
) -> asyncpg.Pool:
    """Create an asyncpg.Pool, PgBouncer-safe.

    `dsn` is a standard Postgres connection string. `application_name` rides
    `server_settings` (PgBouncer tracks it natively); no other server_settings
    are passed.
    """
    if not dsn:
        raise ValueError("create_pg_pool requires a non-empty `dsn`")
    if application_name:
        extra["server_settings"] = {"application_name": application_name}
    return await asyncpg.create_pool(
        dsn=dsn,
        min_size=min_size,
        max_size=max_size,
        **extra,
    )
