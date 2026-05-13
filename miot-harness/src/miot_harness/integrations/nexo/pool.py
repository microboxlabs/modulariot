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
application_name).
"""

from __future__ import annotations

from typing import Any

import asyncpg

from miot_harness.integrations.nexo.credentials import NexoCredentials

NEXO_SERVER_SETTINGS: dict[str, str] = {}


async def create_nexo_pool(
    creds: NexoCredentials | None = None,
    *,
    dsn: str | None = None,
    min_size: int = 1,
    max_size: int = 4,
    **extra: Any,
) -> asyncpg.Pool:
    """Create an asyncpg.Pool for Nexo, PgBouncer-safe.

    Two ways to source the DSN:

    - `creds`: a `NexoCredentials` parsed from a `db-scripts/.env` file
      (developer-laptop default).
    - `dsn`: a raw DSN string (containerized deploy default —
      `MIOT_HARNESS_NEXO_DSN` is mounted as a single secret).

    `dsn` wins if both are passed. At least one must be provided.

    Does NOT pass `server_settings` (PgBouncer rejects unknown startup
    parameters in transaction-pooling mode). Read-only enforcement is
    applied per-transaction via `conn.transaction(readonly=True)` at
    each call site.
    """
    resolved = dsn if dsn is not None else (creds.dsn if creds is not None else None)
    if resolved is None:
        raise ValueError("create_nexo_pool requires either `creds` or `dsn`")
    return await asyncpg.create_pool(
        dsn=resolved,
        min_size=min_size,
        max_size=max_size,
        **extra,
    )
