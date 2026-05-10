"""Real-Postgres integration test for the introspection contract (E2).

Spins up an ephemeral Postgres via pytest-postgresql, seeds a minimal
nexo-shaped schema covering the four denylist outcomes (allow,
fn_refresh_*, explicit orchestrator names, @meta side_effects), and
runs introspect_nexo_functions against asyncpg.

Skipped automatically when the local environment has no usable
Postgres binary (e.g., CI image without it). Local devs and the
review workflow get the integration coverage; bare CI doesn't break.
"""

from __future__ import annotations

import os
import shutil
import subprocess

import pytest


def _probe_postgres_server() -> bool:
    """Return True iff a real postgres server binary is reachable.

    `pg_ctl` and `initdb` may be on PATH from a libpq-only install
    (Homebrew's libpq cellar) without the actual server. Try to run
    `initdb --version` and check for a sibling `postgres` binary.
    """
    initdb = shutil.which("initdb")
    if not initdb:
        return False
    candidate = os.path.join(os.path.dirname(initdb), "postgres")
    if os.path.exists(candidate):
        return True
    # Fallback: ask pg_config for bindir, then look there.
    pgcfg = shutil.which("pg_config")
    if pgcfg:
        try:
            bindir = subprocess.run(
                [pgcfg, "--bindir"], capture_output=True, text=True, check=True, timeout=5
            ).stdout.strip()
            if bindir and os.path.exists(os.path.join(bindir, "postgres")):
                return True
        except Exception:  # noqa: BLE001
            pass
    return False


if not _probe_postgres_server():
    pytest.skip(
        "Postgres server binary not reachable; skipping E2 integration",
        allow_module_level=True,
    )

# Try to import pytest-postgresql; skip gracefully if unavailable.
try:
    from pytest_postgresql import factories  # noqa: F401
except ImportError:  # pragma: no cover
    pytest.skip("pytest-postgresql not installed", allow_module_level=True)

import asyncpg  # noqa: E402

from miot_harness.integrations.nexo.introspect import introspect_nexo_functions  # noqa: E402

_SEED_SQL = """
CREATE SCHEMA IF NOT EXISTS nexo;

-- Allowed: clean L1 prefix description
CREATE FUNCTION nexo.fn_dx_centro_control()
RETURNS TABLE(n_eta_riesgo int, refreshed_at_servicios timestamptz)
LANGUAGE sql AS $$ SELECT 0::int, now() $$;
COMMENT ON FUNCTION nexo.fn_dx_centro_control() IS 'L1: KPI summary';

-- Allowed: @meta with side_effects: none
CREATE FUNCTION nexo.fn_dx_kpi_servicio(p_servicio_id bigint DEFAULT 0)
RETURNS json LANGUAGE sql AS $$ SELECT '{"data": {}}'::json $$;
COMMENT ON FUNCTION nexo.fn_dx_kpi_servicio(bigint) IS '
KPI por servicio

@meta
domain: [services]
layer: L3
side_effects: none
returns: kpi_summary
@end

Devuelve la KPI para un servicio.
';

-- Denied by name pattern: fn_refresh_*
CREATE FUNCTION nexo.fn_refresh_dx_eta_hoy()
RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;

-- Denied by explicit name: fn_dx_orchestrator
CREATE FUNCTION nexo.fn_dx_orchestrator()
RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
COMMENT ON FUNCTION nexo.fn_dx_orchestrator() IS 'orchestrator';

-- Denied by explicit name: fn_dx_orchestrator_auto
CREATE FUNCTION nexo.fn_dx_orchestrator_auto()
RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
COMMENT ON FUNCTION nexo.fn_dx_orchestrator_auto() IS 'orchestrator_auto';

-- Denied by @meta side_effects != none
CREATE FUNCTION nexo.fn_dx_writes_thing()
RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
COMMENT ON FUNCTION nexo.fn_dx_writes_thing() IS '
writer

@meta
side_effects: writes_to_dx_servicios
@end
';
"""


@pytest.mark.asyncio
async def test_introspect_real_pg_filters_denylist(postgresql):
    """postgresql fixture is a psycopg connection; we read the proc info,
    then connect via asyncpg to the same DB to exercise the real query."""
    info = postgresql.info
    dsn = f"postgresql://{info.user}@{info.host}:{info.port}/{info.dbname}"

    # Seed via the psycopg connection (sync)
    with postgresql.cursor() as cur:
        for stmt in _split_sql(_SEED_SQL):
            cur.execute(stmt)
    postgresql.commit()

    conn = await asyncpg.connect(dsn=dsn)
    try:
        descriptors = await introspect_nexo_functions(conn, schema="nexo")
    finally:
        await conn.close()

    surviving_names = {d.name for d in descriptors}
    # Only the two clean functions should make it through:
    assert "fn_dx_centro_control" in surviving_names
    assert "fn_dx_kpi_servicio" in surviving_names

    # All four denylist categories must be excluded:
    assert "fn_refresh_dx_eta_hoy" not in surviving_names
    assert "fn_dx_orchestrator" not in surviving_names
    assert "fn_dx_orchestrator_auto" not in surviving_names
    assert "fn_dx_writes_thing" not in surviving_names

    # Layer + meta parsing should be populated correctly:
    centro = next(d for d in descriptors if d.name == "fn_dx_centro_control")
    assert centro.description.layer == "L1"

    kpi = next(d for d in descriptors if d.name == "fn_dx_kpi_servicio")
    assert kpi.description.layer == "meta"
    assert kpi.description.meta.get("side_effects") == "none"
    assert kpi.description.meta.get("layer") == "L3"


def _split_sql(text: str) -> list[str]:
    """Split a multi-statement script keeping dollar-quoted bodies intact."""
    out: list[str] = []
    buf: list[str] = []
    in_dollar = False
    i = 0
    while i < len(text):
        ch = text[i]
        if text[i : i + 2] == "$$":
            in_dollar = not in_dollar
            buf.append("$$")
            i += 2
            continue
        if ch == ";" and not in_dollar:
            stmt = "".join(buf).strip()
            if stmt:
                out.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out
