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
