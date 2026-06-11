"""Per-function freshness survey (Gap 2).

At boot we probe every zero-required-arg `fn_dx_*` function with
`SELECT * FROM <schema>.<fn>() LIMIT 1` (read-only, per-call timeout)
and classify its snapshot state. The result feeds:

- `/health` — ops can see which snapshots are stale before users do;
- the meta-agent catalog — "¿qué funciones tienen datos frescos?" is
  answerable without running a single data query.

Survey failures never disable the integration: an unprobeable function
is reported as status="error" and everything else proceeds.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from miot_harness.datasource.provider import FreshnessProbe
from miot_harness.integrations.nexo.introspect import FunctionDescriptor
from miot_harness.integrations.nexo.tool_factory import _row_to_dict, freshest_refreshed_at

logger = logging.getLogger(__name__)

_DEFAULT_PER_CALL_TIMEOUT_S = 3.0
# Below the asyncpg pool's default size so probes never starve each other
# (or live traffic) waiting on pool.acquire.
_PROBE_CONCURRENCY = 4


def _classify(
    *, rows: list[dict[str, Any]], refreshed_at: datetime | None, warn_minutes: int
) -> tuple[str, float | None]:
    age_minutes: float | None = None
    if refreshed_at is not None:
        age_minutes = (datetime.now(UTC) - refreshed_at).total_seconds() / 60
        if rows:
            return ("stale" if age_minutes > warn_minutes else "fresh"), age_minutes
        return "empty", age_minutes
    if rows:
        return "no_timestamp", None
    return "empty_no_timestamp", None


async def _probe_one(
    pool: Any,
    *,
    schema: str,
    descriptor: FunctionDescriptor,
    warn_minutes: int,
    timeout_s: float,
    semaphore: asyncio.Semaphore,
) -> FreshnessProbe:
    # LIMIT 50 (not 1): multi-layer functions return one row per layer,
    # each with its own refreshed_at_*, in no guaranteed order — the
    # status must reflect the freshest layer.
    sql = f"SELECT * FROM {schema}.{descriptor.name}() LIMIT 50"

    async def _run() -> list[dict[str, Any]]:
        # The semaphore bounds concurrency BELOW the pool size so probes
        # don't queue on pool.acquire — queue time would otherwise eat the
        # per-call budget and misreport slow-but-healthy functions as
        # errors. The timeout covers only the query itself.
        async with semaphore:
            async with pool.acquire() as conn:
                async with conn.transaction(readonly=True):
                    await conn.execute(f"SET LOCAL search_path TO {schema}, public")
                    raw = await asyncio.wait_for(conn.fetch(sql), timeout=timeout_s)
        return [_row_to_dict(r) for r in raw]

    try:
        rows = await _run()
    except Exception as exc:  # noqa: BLE001 — survey must not break boot
        logger.warning(
            "Nexo freshness survey: %s probe failed (%s: %s)",
            descriptor.name,
            type(exc).__name__,
            exc,
        )
        return FreshnessProbe(
            function=descriptor.name,
            refreshed_at=None,
            age_minutes=None,
            has_rows=False,
            status="error",
        )

    refreshed_at = freshest_refreshed_at(rows)
    status, age_minutes = _classify(
        rows=rows, refreshed_at=refreshed_at, warn_minutes=warn_minutes
    )
    return FreshnessProbe(
        function=descriptor.name,
        refreshed_at=refreshed_at,
        age_minutes=age_minutes,
        has_rows=bool(rows),
        status=status,
    )


async def survey_freshness(
    pool: Any,
    *,
    schema: str,
    descriptors: list[FunctionDescriptor],
    warn_minutes: int,
    per_call_timeout_s: float = _DEFAULT_PER_CALL_TIMEOUT_S,
) -> dict[str, FreshnessProbe]:
    """Probe each surveyable function once; return {fn_name: probe}.

    Functions with any required (defaultless) argument are skipped — we
    can't call them without inventing arguments.
    """
    probes: dict[str, FreshnessProbe] = {}
    runnable: list[FunctionDescriptor] = []
    for descriptor in descriptors:
        if all(arg.has_default for arg in descriptor.args):
            runnable.append(descriptor)
        else:
            probes[descriptor.name] = FreshnessProbe(
                function=descriptor.name,
                refreshed_at=None,
                age_minutes=None,
                has_rows=False,
                status="skipped",
            )

    semaphore = asyncio.Semaphore(_PROBE_CONCURRENCY)
    results = await asyncio.gather(
        *(
            _probe_one(
                pool,
                schema=schema,
                descriptor=d,
                warn_minutes=warn_minutes,
                timeout_s=per_call_timeout_s,
                semaphore=semaphore,
            )
            for d in runnable
        )
    )
    for probe in results:
        probes[probe.function] = probe
    return probes
