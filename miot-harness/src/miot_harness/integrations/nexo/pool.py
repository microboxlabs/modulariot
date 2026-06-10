"""Asyncpg pool factory for the Nexo integration.

The pool is owned by the FastAPI lifespan hook (see B7); this module
just exposes a thin factory so tests and boot can build pools the same
way.

Read-only enforcement note (PgBouncer compatibility):
The Coordinador prod tunnel routes through `prod-mintral-pgbouncer` in
transaction-pooling mode, which rejects unknown startup parameters
(`default_transaction_read_only`, `statement_timeout`,
`idle_in_transaction_session_timeout`) sent via asyncpg's
`server_settings=`. Setting them poisons the StartupMessage and the
boot fails with `unsupported startup parameter`.

Instead we enforce read-only on a per-transaction basis using
`async with conn.transaction(readonly=True)`, which issues
`BEGIN READ ONLY` — fully supported by PgBouncer + Postgres. Every
call site under integrations/nexo/ wraps queries in such a
transaction, so mutation attempts are blocked at the DB layer.

NEXO_SERVER_SETTINGS is kept as an exported (empty) dict for tests
and any future settings PgBouncer's `track_extra_parameters` allows
(client_encoding, datestyle, timezone, geqo, intervalstyle,
application_name). The one startup parameter we DO send is
`application_name` (via the explicit kwarg below) — PgBouncer tracks
it natively, and it surfaces in `pg_stat_activity` for DBAs.
"""

from __future__ import annotations

from typing import Any

import asyncpg

NEXO_SERVER_SETTINGS: dict[str, str] = {}


async def create_nexo_pool(
    dsn: str,
    *,
    min_size: int = 1,
    max_size: int = 4,
    application_name: str | None = None,
    **extra: Any,
) -> asyncpg.Pool:
    """Create an asyncpg.Pool for Nexo, PgBouncer-safe.

    `dsn` is a standard Postgres connection string
    (`postgresql://user:password@host:port/database`), sourced from the
    `MIOT_HARNESS_DATASOURCE_DSN` setting.

    `application_name` rides `server_settings` — asyncpg's `connect()`
    has no `application_name` kwarg, and PgBouncer tracks
    `application_name` natively, so it is safe in transaction-pooling
    mode. No OTHER server_settings are passed (PgBouncer rejects
    unknown startup parameters such as `default_transaction_read_only`).
    Read-only enforcement is applied per-transaction via
    `conn.transaction(readonly=True)` at each call site.
    """
    if not dsn:
        raise ValueError("create_nexo_pool requires a non-empty `dsn`")
    if application_name:
        extra["server_settings"] = {"application_name": application_name}
    return await asyncpg.create_pool(
        dsn=dsn,
        min_size=min_size,
        max_size=max_size,
        **extra,
    )
