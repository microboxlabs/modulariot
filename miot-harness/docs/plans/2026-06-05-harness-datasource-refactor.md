# Harness Datasource Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the harness core datasource-agnostic: "Nexo", "Coordinador", and "mintral" live only inside `integrations/nexo/`, behind a `DataSourceProvider` interface selected by `MIOT_HARNESS_DATASOURCE_KIND`.

**Architecture:** A new `datasource/` package defines `DataSourceProvider` (lifecycle) + `DataSourceProfile` (declarative domain values: names, prompts, keywords, thresholds) + a named registry. `integrations/nexo/` becomes the first provider. Core (runtime/agents/api/observability/evals) reads only the profile. Runtime output (tool names, SSE source strings, refusal copy, span names) stays byte-identical because the nexo profile carries today's exact values; the wire-visible breaks are route strings (`nexo_query`→`data_query`), artifact type (`nexo_plan`→`data_plan`), `/health` block key, and the env-var rename.

**Tech Stack:** Python 3.11, pydantic / pydantic-settings, LangGraph, FastAPI, asyncpg, pytest, uv.

**Spec:** `miot-harness/docs/specs/2026-06-05-harness-datasource-refactor-design.md`

**Working directory:** all commands run from `miot-harness/` in the `based/harness-nexo-refactor` worktree.

**Per-task gates (run after EVERY task unless the task says otherwise):**
```bash
uv run pytest -q          # all green
uv run ruff check src tests
uv run mypy
```

---

## Stage 1 — The seam (commit: `feat(harness): add DataSourceProvider seam with nexo as first provider`)

### Task 1: `DataSourceProfile`, `BootResult`, `DataSourceProvider`

**Files:**
- Create: `src/miot_harness/datasource/__init__.py` (empty)
- Create: `src/miot_harness/datasource/provider.py`
- Test: `tests/datasource/test_provider.py` (create `tests/datasource/__init__.py` empty)

- [ ] **Step 1: Write the failing test**

```python
# tests/datasource/test_provider.py
"""DataSourceProvider seam: profile shape and provider contract."""

from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)


def make_profile(**overrides) -> DataSourceProfile:
    base = dict(
        name="fake",
        display_name="FakeSource",
        source_label="FakeSource · fake (test)",
        tool_prefix="fake_",
        primer="FakeSource answers questions about test fixtures.",
        router_keywords=frozenset({"fakesource", "fixture"}),
        tenant_lock="acme",
        tenant_refusal_template=(
            "{display_name} is {lock}-only. I can't answer for other tenants."
        ),
        freshness_warn_minutes=30,
        freshness_refuse_minutes=240,
    )
    base.update(overrides)
    return DataSourceProfile(**base)


def test_profile_is_frozen() -> None:
    profile = make_profile()
    import pytest

    with pytest.raises(Exception):  # dataclasses.FrozenInstanceError
        profile.name = "other"  # type: ignore[misc]


def test_refusal_template_formats() -> None:
    profile = make_profile()
    msg = profile.tenant_refusal_template.format(
        display_name=profile.display_name, lock=profile.tenant_lock
    )
    assert msg == "FakeSource is acme-only. I can't answer for other tenants."


def test_boot_result_defaults() -> None:
    r = BootResult(enabled=False, registered=[])
    assert r.reason is None
    assert r.snapshot_age_minutes is None


def test_provider_is_abstract() -> None:
    import pytest

    with pytest.raises(TypeError):
        DataSourceProvider()  # type: ignore[abstract]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/datasource/test_provider.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'miot_harness.datasource'`

- [ ] **Step 3: Write the implementation**

```python
# src/miot_harness/datasource/provider.py
"""The datasource seam.

The harness core is datasource-agnostic: it orchestrates agents over a
tool registry, but never names the system the tools come from (a DB, a
filesystem, a cloud API, an MCP server). Everything domain-specific is
supplied by a DataSourceProvider:

- lifecycle (`boot` / `close`): connect, discover capabilities,
  register tools into the shared ToolRegistry;
- a declarative `DataSourceProfile`: every name, prompt, keyword and
  threshold the core needs to speak about the datasource without
  hardcoding it.

Each profile field maps 1:1 to a former hardcode (see
docs/specs/2026-06-05-harness-datasource-refactor-design.md).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from miot_harness.config import HarnessSettings
    from miot_harness.tools.registry import ToolRegistry


@dataclass(frozen=True)
class DataSourceProfile:
    """Declarative domain values the core reads instead of hardcoding.

    - name:            machine id ("nexo") — /health block, graph label,
                       OTel span prefix.
    - display_name:    human name ("Coordinador") — agent prompt templating.
    - source_label:    provenance string shown on SSE tool events and
                       evidence rows.
    - tool_prefix:     prefix of tools this datasource registers
                       ("coordinador_") — used by the filter expert to
                       scope tool selection.
    - primer:          grounding text injected into analyst / synthesizer /
                       meta-agent system prompts.
    - router_keywords: lowercase literals that route a message to the
                       data pipeline (keyword router).
    - tenant_lock:     default tenant the datasource is locked to, or
                       None for no lock. Env-overridable via
                       `datasource_tenant_lock`.
    - tenant_refusal_template: str.format template with {display_name}
                       and {lock} placeholders — the exact user-visible
                       refusal copy.
    - freshness_warn_minutes / freshness_refuse_minutes: snapshot-age
                       SLA defaults. Env-overridable.
    """

    name: str
    display_name: str
    source_label: str
    tool_prefix: str
    primer: str
    router_keywords: frozenset[str]
    tenant_lock: str | None
    tenant_refusal_template: str
    freshness_warn_minutes: int
    freshness_refuse_minutes: int


@dataclass(frozen=True)
class BootResult:
    """Outcome of DataSourceProvider.boot — same shape for every provider."""

    enabled: bool
    registered: list[str]
    reason: str | None = None
    snapshot_age_minutes: float | None = None


class DataSourceProvider(ABC):
    """Lifecycle owner for one datasource.

    Implementations own their connection handles (pool, client, MCP
    session); the harness only calls boot() once from the lifespan and
    close() on shutdown. boot() must not raise for operational failures
    — return BootResult(enabled=False, reason=...) so the harness keeps
    serving non-data routes.
    """

    profile: DataSourceProfile

    @abstractmethod
    async def boot(
        self, registry: ToolRegistry, settings: HarnessSettings
    ) -> BootResult: ...

    @abstractmethod
    async def close(self) -> None: ...
```

Also create the two empty `__init__.py` files:

```bash
touch src/miot_harness/datasource/__init__.py tests/datasource/__init__.py
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/datasource/test_provider.py -v`
Expected: 4 PASS

- [ ] **Step 5: Run gates** (`uv run pytest -q && uv run ruff check src tests && uv run mypy`)

### Task 2: Named registry

**Files:**
- Create: `src/miot_harness/datasource/registry.py`
- Test: `tests/datasource/test_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/datasource/test_registry.py
import pytest

from miot_harness.datasource.registry import available_kinds, resolve


def test_nexo_is_registered() -> None:
    assert "nexo" in available_kinds()


def test_resolve_nexo_returns_provider_with_profile() -> None:
    provider = resolve("nexo")
    assert provider.profile.name == "nexo"
    assert provider.profile.display_name == "Coordinador"
    assert provider.profile.tool_prefix == "coordinador_"
    assert provider.profile.tenant_lock == "mintral"


def test_resolve_unknown_kind_fails_fast_listing_kinds() -> None:
    with pytest.raises(ValueError) as exc:
        resolve("definitely-not-a-datasource")
    assert "nexo" in str(exc.value)  # lists available kinds
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/datasource/test_registry.py -v`
Expected: FAIL — `ModuleNotFoundError` (registry.py missing; NexoProvider not yet written — Task 3 makes the second test pass, write both before running full green)

- [ ] **Step 3: Write the implementation**

```python
# src/miot_harness/datasource/registry.py
"""Named datasource registry.

`MIOT_HARNESS_DATASOURCE_KIND` selects the provider at boot. This
registry is the future plugin hook: entry-point-discovered or
MCP-backed providers register here the same way the in-repo one does.

Imports are deferred into the factory functions so importing the
registry never drags in provider dependencies (asyncpg etc.).
"""

from __future__ import annotations

from collections.abc import Callable

from miot_harness.datasource.provider import DataSourceProvider


def _make_nexo() -> DataSourceProvider:
    from miot_harness.integrations.nexo.provider import NexoProvider

    return NexoProvider()


_REGISTRY: dict[str, Callable[[], DataSourceProvider]] = {
    "nexo": _make_nexo,
}


def available_kinds() -> tuple[str, ...]:
    return tuple(sorted(_REGISTRY))


def resolve(kind: str) -> DataSourceProvider:
    """Instantiate the provider for `kind`.

    Raises ValueError listing available kinds — called from the
    lifespan so a typo in MIOT_HARNESS_DATASOURCE_KIND fails the boot,
    not the first request (same fail-fast pattern as
    validate_auth_config).
    """
    factory = _REGISTRY.get(kind)
    if factory is None:
        raise ValueError(
            f"Unknown datasource kind {kind!r}. Available: "
            + ", ".join(available_kinds())
        )
    return factory()
```

- [ ] **Step 4: Continue to Task 3 (registry tests need NexoProvider), then run both test files**

### Task 3: `NexoProvider` + `NEXO_PROFILE`

**Files:**
- Create: `src/miot_harness/integrations/nexo/provider.py`
- Test: `tests/integrations/nexo/test_provider.py` (create `tests/integrations/__init__.py` and `tests/integrations/nexo/__init__.py`, both empty)

The profile values below are **today's exact strings** — copied from `tool_factory.py` (source label, refusal copy), `primer.py`, `router.py` (`_NEXO_LITERAL_TOKENS`), and `config.py` defaults. Do not normalize or "improve" any of them.

- [ ] **Step 1: Write the failing test**

```python
# tests/integrations/nexo/test_provider.py
"""NexoProvider: profile carries today's exact runtime strings, and
boot() degrades to disabled when no DSN is configured."""

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE, NexoProvider
from miot_harness.tools.registry import ToolRegistry


def test_profile_values_match_legacy_hardcodes() -> None:
    p = NEXO_PROFILE
    assert p.name == "nexo"
    assert p.display_name == "Coordinador"
    assert p.source_label == "Coordinador · nexo (Citus DB)"
    assert p.tool_prefix == "coordinador_"
    assert "coordinador" in p.router_keywords
    assert "mintral" in p.router_keywords
    assert p.tenant_lock == "mintral"
    assert (
        p.tenant_refusal_template.format(
            display_name=p.display_name, lock=p.tenant_lock
        )
        == "Coordinador is mintral-only. I can't answer for other tenants."
    )
    assert p.freshness_warn_minutes == 30
    assert p.freshness_refuse_minutes == 240


@pytest.mark.asyncio
async def test_boot_without_dsn_returns_disabled() -> None:
    provider = NexoProvider()
    settings = HarnessSettings(nexo_dsn=None)
    result = await provider.boot(ToolRegistry(), settings)
    assert result.enabled is False
    assert result.registered == []
    assert result.reason is not None
    await provider.close()  # no-op when never connected; must not raise
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/nexo/test_provider.py -v`
Expected: FAIL — `ModuleNotFoundError: ... integrations.nexo.provider`

- [ ] **Step 3: Write the implementation**

Note: in Stage 1 the provider still reads the OLD settings names (`nexo_dsn`, `nexo_application_name`) so the suite stays green; Task 14 (settings break) switches them.

```python
# src/miot_harness/integrations/nexo/provider.py
"""Nexo: the first DataSourceProvider (Citus/Postgres, Coordinador schema).

This package is the ONLY place in the harness allowed to say
"Nexo", "Coordinador", or "mintral".
"""

from __future__ import annotations

import logging

import asyncpg

from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

NEXO_PROFILE = DataSourceProfile(
    name="nexo",
    display_name="Coordinador",
    source_label="Coordinador · nexo (Citus DB)",
    tool_prefix="coordinador_",
    primer=COORDINADOR_PRIMER,
    router_keywords=frozenset(
        {
            "coordinador",
            "mintral",
            "centro de control",
            "cola crítica",
            "cola critica",
            "dimensionamiento",
            "torre de control",
            "auditoría pod",
            "auditoria pod",
            "fn_dx",
        }
    ),
    tenant_lock="mintral",
    tenant_refusal_template=(
        "{display_name} is {lock}-only. I can't answer for other tenants."
    ),
    freshness_warn_minutes=30,
    freshness_refuse_minutes=240,
)


class NexoProvider(DataSourceProvider):
    profile = NEXO_PROFILE

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    async def boot(
        self, registry: ToolRegistry, settings: HarnessSettings
    ) -> BootResult:
        dsn = settings.nexo_dsn  # Task 14 renames to datasource_dsn
        if dsn is None:
            return BootResult(
                enabled=False,
                registered=[],
                reason="MIOT_HARNESS_NEXO_DSN is not set",
            )
        try:
            self._pool = await create_nexo_pool(
                dsn, application_name=settings.nexo_application_name
            )
        except Exception as exc:  # noqa: BLE001 — boot must not die
            logger.critical("Nexo: pool creation failed (%s)", exc)
            return BootResult(
                enabled=False, registered=[], reason=f"pool creation failed: {exc}"
            )
        legacy = await load_nexo_tools(registry, settings=settings, pool=self._pool)
        return BootResult(
            enabled=legacy.enabled,
            registered=list(legacy.registered),
            reason=legacy.reason,
            snapshot_age_minutes=legacy.snapshot_age_minutes,
        )

    async def close(self) -> None:
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Nexo: pool close raised %s", exc)
            self._pool = None
```

- [ ] **Step 4: Run all three new test files**

Run: `uv run pytest tests/datasource/ tests/integrations/ -v`
Expected: all PASS (registry tests from Task 2 now pass too)

- [ ] **Step 5: Run gates**

### Task 4: `FakeProvider` test fixture (the de-facto second provider)

**Files:**
- Create: `tests/fixtures/fake_provider.py` (create `tests/fixtures/__init__.py` empty)
- Test: `tests/datasource/test_fake_provider.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/datasource/test_fake_provider.py
import pytest

from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE, FakeProvider
from miot_harness.config import HarnessSettings


@pytest.mark.asyncio
async def test_fake_provider_boots_and_registers_tools() -> None:
    provider = FakeProvider()
    registry = ToolRegistry()
    result = await provider.boot(registry, HarnessSettings())
    assert result.enabled is True
    assert result.registered == ["fake_lookup"]
    assert "fake_lookup" in registry.names()
    assert provider.profile is FAKE_PROFILE
    await provider.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/datasource/test_fake_provider.py -v`
Expected: FAIL — `ModuleNotFoundError: tests.fixtures.fake_provider`

- [ ] **Step 3: Write the implementation**

```python
# tests/fixtures/fake_provider.py
"""A minimal second DataSourceProvider.

Exists to prove the seam: core runtime/agent tests run against this
provider so they cannot accidentally depend on Nexo/Coordinador/Mintral
specifics. Mirrors the eval-stub tool shape used by run_golden.py.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry

FAKE_PROFILE = DataSourceProfile(
    name="fake",
    display_name="FakeSource",
    source_label="FakeSource · fake (test)",
    tool_prefix="fake_",
    primer="FakeSource is a synthetic datasource used in harness tests.",
    router_keywords=frozenset({"fakesource", "fixture"}),
    tenant_lock="acme",
    tenant_refusal_template=(
        "{display_name} is {lock}-only. I can't answer for other tenants."
    ),
    freshness_warn_minutes=30,
    freshness_refuse_minutes=240,
)


class _In(BaseModel):
    pass


class _Out(BaseModel):
    rows: list[dict[str, Any]] = []
    refreshed_at: datetime | None = None
    source: str = FAKE_PROFILE.source_label


async def _check(ctx: HarnessContext, inp: BaseModel) -> PermissionResult:
    if ctx.tenant_id != FAKE_PROFILE.tenant_lock:
        return PermissionResult.deny("FakeSource is acme-only")
    return PermissionResult.allow()


async def _call(
    ctx: HarnessContext, inp: BaseModel, progress: Callable[..., None]
) -> _Out:
    now = datetime.now(UTC)
    return _Out(rows=[{"value": 42, "refreshed_at": now}], refreshed_at=now)


class FakeProvider(DataSourceProvider):
    profile = FAKE_PROFILE

    async def boot(
        self, registry: ToolRegistry, settings: HarnessSettings
    ) -> BootResult:
        registry.register(
            HarnessTool(
                name="fake_lookup",
                description="[Layer L1] fake test tool",
                input_model=_In,
                output_model=_Out,
                check_permission=_check,
                call=_call,
            )
        )
        return BootResult(enabled=True, registered=["fake_lookup"])

    async def close(self) -> None:
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/datasource/ -v`
Expected: all PASS

- [ ] **Step 5: Run gates**

### Task 5: server lifespan boots via the registry

**Files:**
- Modify: `src/miot_harness/api/server.py` (lifespan only — find the `if settings.nexo_dsn is None:` block and the `pool = await create_nexo_pool(...)` / `load_nexo_tools(...)` calls)
- Test: existing `tests/api/` suite is the safety net (lifespan behavior unchanged)

- [ ] **Step 1: Replace direct nexo calls with provider calls**

In `_make_lifespan`, replace:

```python
# OLD (delete):
if settings.nexo_dsn is None:
    logger.info("Nexo: disabled (MIOT_HARNESS_NEXO_DSN is not set)")
    ...
pool = await create_nexo_pool(settings.nexo_dsn)
result = await load_nexo_tools(harness.tools, settings=settings, pool=pool)
```

with:

```python
# NEW:
from miot_harness.datasource.registry import resolve  # top-of-file import

provider = resolve(settings.datasource_kind)  # Stage 1: hardcode "nexo" until Task 14 adds the setting
app.state.datasource_provider = provider
result = await provider.boot(harness.tools, settings)
```

Stage-1 transitional note: until Task 14 adds `datasource_kind`, call `resolve("nexo")`. Keep `app.state.nexo_*` names for now (renamed in Task 12). The `finally:` block replaces `await pool.close()` with `await provider.close()`. Remove the now-unused `create_nexo_pool` / `load_nexo_tools` imports from server.py.

- [ ] **Step 2: Run the API suite**

Run: `uv run pytest tests/api -q`
Expected: all PASS (no behavior change — provider wraps the same calls)

- [ ] **Step 3: Run gates**

- [ ] **Step 4: Commit Stage 1**

```bash
git add -A miot-harness
git commit -m "feat(harness): add DataSourceProvider seam with nexo as first provider"
```

---

## Stage 2 — Core consumes the profile (commit: `refactor(harness): core reads DataSourceProfile instead of hardcoded domain values`)

Plumbing rule for every task in this stage: the profile travels **explicitly** — `HarnessSupervisor` gains a `profile: DataSourceProfile | None` attribute (set by the lifespan from `provider.profile`; `None` keeps legacy defaults during the transition), and `build_nexo_graph(...)`/`build_agentic_graph(...)` gain a required `profile` keyword that they close over into their nodes. No global/ambient profile.

### Task 6: keyword router takes profile keywords

**Files:**
- Modify: `src/miot_harness/runtime/router.py` (`_NEXO_LITERAL_TOKENS` and `IntentRouter`)
- Modify test: `tests/test_router.py` (or wherever `IntentRouter()` is constructed — `grep -rln "IntentRouter(" tests/ src/`)

- [ ] **Step 1: Write the failing test** (add to the existing router test file)

```python
def test_router_accepts_custom_keywords() -> None:
    from miot_harness.runtime.router import IntentRouter

    router = IntentRouter(data_keywords=frozenset({"fakesource"}))
    result = router.route("estado de fakesource?")
    assert result.route.value == "nexo_query"  # renamed to data_query in Task 11
```

- [ ] **Step 2: Run to verify it fails** (`TypeError: unexpected keyword argument`)

- [ ] **Step 3: Implement** — `IntentRouter.__init__(self, data_keywords: frozenset[str] | None = None)`; default `None` keeps the current `_NEXO_LITERAL_TOKENS` tuple (renamed `_DEFAULT_DATA_TOKENS`) so existing construction sites behave identically. `route()` checks `self._data_keywords`. Construction sites that have a profile (server lifespan, supervisor LLM-router fallback) pass `profile.router_keywords`.

- [ ] **Step 4: Run gates**

### Task 7: tenancy gate takes lock + refusal from profile

**Files:**
- Modify: `src/miot_harness/runtime/tenancy.py`
- Modify: callers — `src/miot_harness/runtime/nexo_graph.py` and `src/miot_harness/runtime/agentic_graph.py` (pass their `profile` through to the gate)
- Test: `tests/runtime/test_tenancy_gate.py` (existing file — extend)

- [ ] **Step 1: Write the failing test**

```python
def test_gate_uses_profile_lock_and_template() -> None:
    from tests.fixtures.fake_provider import FAKE_PROFILE
    decision = tenancy_gate_decision(
        ctx=make_ctx(tenant_id="intruder"),
        route=HarnessRoute.NEXO_QUERY,
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
    )
    assert decision.allowed is False
    assert decision.refusal_message == (
        "FakeSource is acme-only. I can't answer for other tenants."
    )
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement** — add `profile: DataSourceProfile | None = None` keyword. Lock resolution: `lock = settings.nexo_tenant_lock if profile is None else (settings override or profile.tenant_lock)` — in Stage 2 keep it simple: `lock = profile.tenant_lock if profile is not None else settings.nexo_tenant_lock`; Task 14 adds the env override. Refusal message: `profile.tenant_refusal_template.format(display_name=profile.display_name, lock=lock)` when profile present; the legacy f-string otherwise. Existing tests (no profile arg) stay green.

- [ ] **Step 4: Run gates**

### Task 8: agents read profile (prompts, primer, prefix, source, freshness)

**Files:**
- Modify: `src/miot_harness/agents/filter_expert.py` — system prompt `"You are the Filter Expert for Coordinador (Mintral fleet operations)"` → templated with `profile.display_name`; the two `name.startswith("coordinador_")` checks → `name.startswith(profile.tool_prefix)`
- Modify: `src/miot_harness/agents/domain_analyst.py` — prompt `"You are the Coordinador Domain Analyst"` → templated; `COORDINADOR_PRIMER` import → `profile.primer`
- Modify: `src/miot_harness/agents/synthesizer.py` — same pattern; the tenant-refusal helper uses `profile.tenant_refusal_template`; keep ALL Spanish user-facing copy byte-identical
- Modify: `src/miot_harness/agents/critic.py` — prompt templated
- Modify: `src/miot_harness/agents/freshness_judge.py` — thresholds from `profile.freshness_*_minutes` (Stage 2: profile wins when present, settings otherwise); `"Coordinador snapshot is stale"` → `f"{profile.display_name} snapshot is stale"`
- Modify: `src/miot_harness/agents/data_fetcher.py` — `source="Coordinador · nexo (Citus DB)"` → `source=profile.source_label`
- Modify: `src/miot_harness/runtime/nexo_graph.py` — `build_nexo_graph(..., profile: DataSourceProfile)` required kwarg, passed into every node builder
- Modify: `src/miot_harness/runtime/agentic_graph.py` — same; system prompt `"You are the Coordinador agentic synthesizer for Mintral fleet operations"` → templated with display_name; `COORDINADOR_PRIMER` import → `profile.primer`
- Modify: call sites of `build_nexo_graph` / `build_agentic_graph`: `src/miot_harness/api/server.py` (pass `provider.profile`), `src/miot_harness/evals/run_golden.py` (pass `NEXO_PROFILE` for now — Task 16 generalizes)
- Tests: existing agent tests pin behavior; add one seam test:

- [ ] **Step 1: Write the failing seam test**

```python
# tests/test_graph_profile_seam.py
"""Building the data graph with the FakeProvider profile must produce
FakeSource-flavored agents — proof no Coordinador string is reachable
from core code."""

from miot_harness.config import HarnessSettings
from miot_harness.runtime.nexo_graph import build_nexo_graph  # data_graph after Task 11
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


def test_graph_builds_with_fake_profile() -> None:
    graph = build_nexo_graph(
        registry=ToolRegistry(),
        settings=HarnessSettings(),
        models={},          # match existing no-model test pattern in tests/
        profile=FAKE_PROFILE,
    )
    assert graph is not None
```

(Adjust the `models={}` line to whatever minimal-models pattern the existing graph tests use — see `grep -rn "build_nexo_graph(" tests/` and copy the cheapest construction.)

- [ ] **Step 2: Run to verify it fails** (`TypeError: unexpected keyword 'profile'`)

- [ ] **Step 3: Implement file by file, running the file's tests after each** — e.g. after filter_expert: `uv run pytest tests/test_filter_expert.py -q`. The prompt templating pattern, applied uniformly:

```python
# OLD
SYSTEM_PROMPT = """You are the Filter Expert for Coordinador (Mintral fleet operations).
..."""

# NEW
SYSTEM_PROMPT_TEMPLATE = """You are the Filter Expert for {display_name}.
..."""
# at node-build time:
system_prompt = SYSTEM_PROMPT_TEMPLATE.format(display_name=profile.display_name)
```

Where a prompt previously interleaved primer text via `COORDINADOR_PRIMER`, substitute `profile.primer` at the same position. **Never reword the surrounding prompt text** — diff should show only the name/primer substitutions.

- [ ] **Step 4: Verify byte-identical output for nexo**: run the fake-mode evals — `uv run miot-harness-evals --mode fake` → Expected: `25/25 ran cleanly`.

- [ ] **Step 5: Run gates**

### Task 9: supervisor + telemetry take the profile

**Files:**
- Modify: `src/miot_harness/runtime/supervisor.py` — add `self.profile: DataSourceProfile | None = None`; the disabled message `"Coordinador integration is currently disabled"` → `f"{display_name} integration is currently disabled"` with `display_name = self.profile.display_name if self.profile else "Coordinador"`; `tenant_lock` constructor default stays until Task 14
- Modify: `src/miot_harness/observability/callbacks.py` — `NexoTelemetryCallback` gains `span_prefix: str = "nexo"` constructor arg; `f"nexo.{agent}"` → `f"{self._span_prefix}.{agent}"` (class renamed in Task 11)
- Modify: `src/miot_harness/api/server.py` lifespan — `harness.profile = provider.profile`; telemetry callback constructed with `span_prefix=provider.profile.name`
- Test: extend `tests/runtime/test_supervisor_event_bus.py`-adjacent suite or the existing supervisor tests with:

```python
def test_disabled_message_uses_profile_display_name() -> None:
    sup = make_supervisor()              # existing helper pattern in the test file
    sup.profile = FAKE_PROFILE
    # drive the disabled path the same way the existing
    # "nexo disabled" test does and assert the message contains "FakeSource"
```

- [ ] **Steps: test-fail-implement-pass, then gates** (same cadence as above)

- [ ] **Commit Stage 2**

```bash
git add -A miot-harness
git commit -m "refactor(harness): core reads DataSourceProfile instead of hardcoded domain values"
```

---

## Stage 3 — Renames (commit: `refactor(harness): rename nexo core symbols and wire strings to datasource-generic terms`)

### Task 10: state types (`plan.py`)

**Files:**
- Modify: `src/miot_harness/runtime/plan.py` + every importer (`grep -rln "NexoState\|NexoPlan\|NexoStep\|NexoEvidence" src/ tests/`)

- [ ] **Step 1: Mechanical rename, exact table:**

| Old | New |
|---|---|
| `NexoStep` | `DataStep` |
| `NexoPlan` | `DataPlan` |
| `NexoEvidence` | `DataEvidence` |
| `NexoState` | `DataState` |

```bash
grep -rl "NexoStep\|NexoPlan\|NexoEvidence\|NexoState" src/ tests/ \
  | xargs sed -i '' -e 's/NexoStep/DataStep/g; s/NexoPlan/DataPlan/g; s/NexoEvidence/DataEvidence/g; s/NexoState/DataState/g'
```

- [ ] **Step 2: Run gates** (pytest + ruff + mypy — mypy catches any missed import)

### Task 11: modules, routes, supervisor methods, telemetry class

- [ ] **Step 1: module + builder renames**

```bash
git mv src/miot_harness/runtime/nexo_graph.py src/miot_harness/runtime/data_graph.py
grep -rl "nexo_graph\|build_nexo_graph" src/ tests/ \
  | xargs sed -i '' -e 's/build_nexo_graph/build_data_graph/g; s/runtime\.nexo_graph/runtime.data_graph/g; s/runtime\/nexo_graph/runtime\/data_graph/g'
```

- [ ] **Step 2: route enum + wire values** (in `router.py`, then all references)

```python
class HarnessRoute(StrEnum):
    DIRECT = "direct"
    STORYTELLING_RUN = "storytelling_run"
    DATA_QUERY = "data_query"        # was NEXO_QUERY = "nexo_query"
    DATA_META = "data_meta"          # was NEXO_META = "nexo_meta"
    DATA_AGENTIC = "data_agentic"    # was NEXO_AGENTIC = "nexo_agentic"
    OTHER = "other"
```

```bash
grep -rl "NEXO_QUERY\|NEXO_META\|NEXO_AGENTIC" src/ tests/ \
  | xargs sed -i '' -e 's/NEXO_QUERY/DATA_QUERY/g; s/NEXO_META/DATA_META/g; s/NEXO_AGENTIC/DATA_AGENTIC/g'
grep -rl '"nexo_query"\|"nexo_meta"\|"nexo_agentic"\|"nexo_plan"' src/ tests/ \
  | xargs sed -i '' -e 's/"nexo_query"/"data_query"/g; s/"nexo_meta"/"data_meta"/g; s/"nexo_agentic"/"data_agentic"/g; s/"nexo_plan"/"data_plan"/g'
```

Also check the **LLM intent-router prompt** (`runtime/intent_router.py`): its route vocabulary must emit the new strings; reword its routing-rule examples from "Coordinador/Mintral" to profile-agnostic phrasing parameterized with `profile.display_name` + `profile.router_keywords` (this is the one prompt where wording legitimately changes — it names routes, and the route names changed).

- [ ] **Step 3: supervisor internals**

| Old | New |
|---|---|
| `_run_nexo` | `_run_data_query` |
| `_run_nexo_agentic` | `_run_data_agentic` |
| `_run_nexo_meta` | `_run_data_meta` |
| `self.nexo_graph` | `self.data_graph` |

```bash
grep -rl "_run_nexo\|nexo_graph" src/ tests/ \
  | xargs sed -i '' -e 's/_run_nexo_agentic/_run_data_agentic/g; s/_run_nexo_meta/_run_data_meta/g; s/_run_nexo\b/_run_data_query/g; s/\.nexo_graph/.data_graph/g'
```

(Then `grep -rn "nexo_graph" src/ tests/` and fix any leftover by hand — sed word-boundary on macOS is fragile; verify with the grep.)

- [ ] **Step 4: telemetry class** — `NexoTelemetryCallback` → `AgentTelemetryCallback` (constructor already takes `span_prefix` from Task 9; nexo deployments keep emitting `nexo.*` spans because the lifespan passes `profile.name`):

```bash
grep -rl "NexoTelemetryCallback" src/ tests/ | xargs sed -i '' 's/NexoTelemetryCallback/AgentTelemetryCallback/g'
```

- [ ] **Step 5: rename test files** whose names say nexo but test core behavior:

```bash
git mv tests/test_supervisor_nexo_branch.py tests/test_supervisor_data_branch.py
```

(Inspect remaining `tests/test_*nexo*` files: those exercising the provider move under `tests/integrations/nexo/` with `git mv`; those exercising core get renamed like above. List them with `ls tests/ | grep -i nexo` and decide per file by what they import.)

- [ ] **Step 6: Run gates + fake evals (25/25)**

### Task 12: API surface — `/health` block + `app.state`

**Files:**
- Modify: `src/miot_harness/api/server.py`
- Modify: `tests/api/` health tests; `evals/deploy/02-image-boots.sh` (greps the health payload)

- [ ] **Step 1: Update the failing tests first** (health tests asserting `body["nexo"]`):

```python
assert body["datasource"] == {
    "name": "nexo",
    "enabled": False,
    "tools": [],
    "snapshot_age_minutes": None,
}
```

- [ ] **Step 2: Implement** — `app.state.nexo_enabled/nexo_pool/nexo_registered/nexo_snapshot_age_minutes` → `app.state.datasource_enabled/datasource_registered/datasource_snapshot_age_minutes` (the pool no longer lives on app.state — the provider owns it). `/health` and `/health/ready` emit:

```python
"datasource": {
    "name": provider.profile.name,
    "enabled": app.state.datasource_enabled,
    "tools": list(app.state.datasource_registered),
    "snapshot_age_minutes": app.state.datasource_snapshot_age_minutes,
},
```

`/health/ready` keeps the same readiness semantics: `required = settings.datasource_dsn is not None` (still `nexo_dsn` until Task 14), `ready = (not required) or enabled`. Update `evals/deploy/02-image-boots.sh` to grep `"datasource"` instead of `"nexo"`.

- [ ] **Step 3: Run gates**

### Task 13: cross-package client + chat fixtures

**Files:**
- Modify: `../turbo-repo/packages/miot-harness-client/src/types.ts:53,59` — route-string unions gain the new values; `graph: "nexo" | "agentic" | "meta"` is **unchanged**
- Modify: `../turbo-repo/packages/miot-chat/src/tui/__tests__/components/App.smoke.test.tsx` — `"nexo_meta"` → `"data_meta"`, `"nexo_query"` → `"data_query"` in fixtures

- [ ] **Step 1: Apply both edits**, exact type change in types.ts: any union containing `"nexo_query" | "nexo_meta" | "nexo_agentic"` route literals becomes `"data_query" | "data_meta" | "data_agentic"`.

- [ ] **Step 2: Run the JS tests**

```bash
cd ../turbo-repo && npx turbo run test --filter=@microboxlabs/miot-chat --filter=@microboxlabs/miot-harness-client
```
Expected: PASS. (Package docs/changelog sync happens at release time via the doc-sync-package flow — out of this plan's scope.)

- [ ] **Step 3: Commit Stage 3**

```bash
git add -A miot-harness ../turbo-repo/packages/miot-harness-client ../turbo-repo/packages/miot-chat
git commit -m "refactor(harness): rename nexo core symbols and wire strings to datasource-generic terms"
```

---

## Stage 4 — Settings break (commit: `refactor(harness)!: rename MIOT_HARNESS_NEXO_* env vars to DATASOURCE_*/AGENTS_*`)

### Task 14: config.py regroup

**Files:**
- Modify: `src/miot_harness/config.py`
- Create: `src/miot_harness/integrations/nexo/settings.py`
- Modify: every reader (`grep -rn "nexo_" src/ tests/ --include="*.py" -l` after Stage 3 — should be config readers only)
- Test: `tests/test_config.py` (extend existing or create)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py (add)
def test_datasource_and_agents_settings_env_names(monkeypatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_KIND", "nexo")
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@h:5432/db")
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_MAX_TURNS", "5")
    s = HarnessSettings()
    assert s.datasource_kind == "nexo"
    assert s.datasource_dsn == "postgresql://u:p@h:5432/db"
    assert s.agents_max_turns == 5
    assert not hasattr(s, "nexo_dsn")  # clean break — old name is gone


def test_nexo_provider_private_settings(monkeypatch) -> None:
    from miot_harness.integrations.nexo.settings import NexoSettings

    monkeypatch.setenv("MIOT_HARNESS_NEXO_SEARCH_PATH", "custom_schema")
    ns = NexoSettings()
    assert ns.nexo_search_path == "custom_schema"
    assert ns.nexo_explain_cost_threshold == 10000.0
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement.** Exact rename table in `HarnessSettings`:

| Old field | New field | Default |
|---|---|---|
| — | `datasource_kind: str` | `"nexo"` |
| `nexo_dsn` | `datasource_dsn: str \| None` | `None` |
| `nexo_application_name` | `datasource_application_name: str` | `"miot-harness"` |
| `nexo_tenant_lock` | `datasource_tenant_lock: str \| None` | `None` (None → profile default) |
| `nexo_freshness_warn_minutes` | `datasource_freshness_warn_minutes: int \| None` | `None` (None → profile default) |
| `nexo_freshness_refuse_minutes` | `datasource_freshness_refuse_minutes: int \| None` | `None` (None → profile default) |
| `nexo_max_turns` | `agents_max_turns: int` | `8` |
| `nexo_critic_enabled` | `agents_critic_enabled: bool` | `False` |
| `nexo_supervisor_mode` | `agents_supervisor_mode: Literal["rule", "llm"]` | `"rule"` |
| `nexo_filter_expert_model` | `agents_filter_expert_model: str` | `"claude-haiku-4-5"` |
| `nexo_analyst_model` | `agents_analyst_model: str` | `"claude-sonnet-4-6"` |
| `nexo_synthesizer_model` | `agents_synthesizer_model: str` | `"claude-sonnet-4-6"` |
| `nexo_critic_model` | `agents_critic_model: str` | `"claude-sonnet-4-6"` |
| `nexo_summarizer_model` | `agents_summarizer_model: str` | `"claude-haiku-4-5"` |
| `nexo_synthesizer_stream` | `agents_synthesizer_stream: bool` | `True` |
| `nexo_synthesizer_thinking_budget` | `agents_synthesizer_thinking_budget: int (ge=0)` | `4096` |
| `nexo_search_path` | → moves to `NexoSettings.nexo_search_path` | `"nexo"` |
| `nexo_explain_cost_threshold` | → moves to `NexoSettings.nexo_explain_cost_threshold` | `10000.0 (gt=0)` |

Preserve every existing docstring/comment, adjusting only the names. New provider-private file:

```python
# src/miot_harness/integrations/nexo/settings.py
"""Nexo-private settings.

These are Postgres concepts (schema search path, EXPLAIN plan cost),
honestly Nexo's — they keep the MIOT_HARNESS_NEXO_* prefix and live
here so HarnessSettings never mentions the provider. Loaded by
NexoProvider/boot at boot time, never by core code.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class NexoSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="MIOT_HARNESS_",
        extra="ignore",
        case_sensitive=False,
    )

    nexo_search_path: str = "nexo"
    # PostgreSQL plan-cost units; EXPLAIN total cost > this → refuse.
    nexo_explain_cost_threshold: float = Field(default=10000.0, gt=0.0)
```

Effective-value resolution (where Stage 2 left "profile wins"):

```python
# tenancy.py / freshness_judge.py pattern:
lock = settings.datasource_tenant_lock or profile.tenant_lock
warn = settings.datasource_freshness_warn_minutes or profile.freshness_warn_minutes
refuse = settings.datasource_freshness_refuse_minutes or profile.freshness_refuse_minutes
```

Then run `grep -rn "\.nexo_" src/ tests/` and update every reader to the new names (`boot.py`/`primitives.py` read `NexoSettings` for the two private knobs; `NexoProvider.boot` switches to `settings.datasource_dsn`/`datasource_application_name`; server lifespan switches `resolve("nexo")` → `resolve(settings.datasource_kind)` and readiness `required = settings.datasource_dsn is not None`).

- [ ] **Step 4: Run gates**

### Task 15: deploy/config files + docs sweep for env names

**Files:**
- Modify: `docker-compose.yml`, `.env.example`, `README.md`, `docs/dispatch-modes.md`, `evals/deploy/*.sh`, `evals/README.md` — every `MIOT_HARNESS_NEXO_*` reference

- [ ] **Step 1: Mechanical sweep**

```bash
grep -rln "MIOT_HARNESS_NEXO_" --exclude-dir=.venv --exclude-dir=node_modules . | grep -v "integrations/nexo\|uv.lock"
```

For each hit apply the Task 14 table (`MIOT_HARNESS_NEXO_DSN` → `MIOT_HARNESS_DATASOURCE_DSN`, `MIOT_HARNESS_NEXO_MAX_TURNS` → `MIOT_HARNESS_AGENTS_MAX_TURNS`, etc.). `MIOT_HARNESS_NEXO_SEARCH_PATH` / `_EXPLAIN_COST_THRESHOLD` stay (provider-private). Add `MIOT_HARNESS_DATASOURCE_KIND=nexo` to `.env.example` with a comment.

- [ ] **Step 2: Run gates + fake evals**

- [ ] **Step 3: Commit Stage 4**

```bash
git add -A miot-harness
git commit -m "refactor(harness)!: rename MIOT_HARNESS_NEXO_* env vars to DATASOURCE_*/AGENTS_*

BREAKING CHANGE: deployments must rename env vars per the table in
docs/specs/2026-06-05-harness-datasource-refactor-design.md. The two
Postgres-specific knobs (MIOT_HARNESS_NEXO_SEARCH_PATH,
MIOT_HARNESS_NEXO_EXPLAIN_COST_THRESHOLD) are unchanged."
```

---

## Stage 5 — Evals + final sweep (commit: `refactor(evals): de-hardcode golden runner; enforce datasource-clean core`)

### Task 16: run_golden.py de-hardcoding

**Files:**
- Modify: `src/miot_harness/evals/run_golden.py`
- Test: `tests/test_run_golden.py` (existing — extend)

- [ ] **Step 1: Changes, each grounded in a current hardcode:**
  1. `_build_fake_registry`: drop the `if not tool_name.startswith("coordinador_"): continue` filter — build a stub for every name in `expected_tools` verbatim; the always-registered fallback name comes from a module constant `DEFAULT_FALLBACK_TOOL = NEXO_PROFILE.tool_prefix + "centro_control"`.
  2. Stub `_Out.source` default and `_check` refusal: import `NEXO_PROFILE` (the provider under test) — `source=NEXO_PROFILE.source_label`, tenant compare against `NEXO_PROFILE.tenant_lock`.
  3. Refusal detection in `_score`: `answer_is_refusal` substrings derive from the profile: `f"{NEXO_PROFILE.tenant_lock}-only" in answer or "no puedo responder" in answer` (the Spanish phrase is synthesizer copy, not a domain name — keep it).
  4. Real mode (`_build_real_setup`): replace `create_nexo_pool` + `load_nexo_tools` direct calls with `registry.resolve(settings.datasource_kind)` + `provider.boot(...)`; the refusal errors keep their current texts but reference the new env names (`MIOT_HARNESS_DATASOURCE_DSN`).
  5. `build_data_graph(..., profile=provider.profile)` in both fake and real paths (fake path uses `NEXO_PROFILE` — the dataset is the nexo provider's).
  6. CLI `--yaml` default becomes `f"evals/golden/{settings.datasource_kind}/examples.yaml"` resolved at parse time with a plain `"evals/golden/nexo/examples.yaml"` fallback comment.

- [ ] **Step 2: Run** `uv run pytest tests/test_run_golden.py -q` then `uv run miot-harness-evals --mode fake` → `25/25 ran cleanly`, and `MIOT_HARNESS_DATASOURCE_DSN="" uv run miot-harness-evals --mode real` → refuses, exit 1.

### Task 17: final grep gate + docs sweep

- [ ] **Step 1: The gate that proves the goal**

```bash
grep -rin "nexo\|coordinador\|mintral" src/miot_harness --exclude-dir=integrations
```
Expected: **zero matches**. Every hit is a missed reference — fix it (typically: comments, docstrings, log strings missed by the symbol renames).

- [ ] **Step 2: Same sweep over tests** (allowed only under `tests/integrations/nexo/` and imports of `NEXO_PROFILE`/`tests.fixtures`):

```bash
grep -rln "nexo\|coordinador\|mintral" -i tests/ | grep -v "tests/integrations/nexo"
```
Inspect each remaining file: legitimate hits are only `from miot_harness.integrations.nexo.provider import NEXO_PROFILE` in eval-related tests. Fix the rest (switch to FakeProvider).

- [ ] **Step 3: README sweep** — `miot-harness/README.md` + `evals/README.md`: describe the datasource seam (one short section: kind selection, profile, where nexo lives), update env-var tables.

- [ ] **Step 4: Full final verification**

```bash
uv run pytest -q                      # all green
uv run ruff check src tests          # clean
uv run mypy                          # clean
uv run miot-harness-evals --mode fake   # 25/25
cd ../turbo-repo && npx turbo run test --filter=@microboxlabs/miot-chat --filter=@microboxlabs/miot-harness-client
```

- [ ] **Step 5: Commit Stage 5**

```bash
git add -A miot-harness
git commit -m "refactor(evals): de-hardcode golden runner; enforce datasource-clean core"
```

---

## Out of scope (tracked in spec)

- Entry-point/pip plugin discovery; MCP-backed provider (the registry + `boot()` are the hooks).
- Real-mode baseline re-validation (needs tunnel + API key).
- Renaming golden dataset content; any prompt-semantics change beyond name/primer substitution (except the intent-router prompt, whose route vocabulary necessarily changed — Task 11 Step 2).
