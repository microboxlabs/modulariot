"""Context-side domain models.

A `SystemContext` is one loaded context document. It carries an
always-injected `primer_text` fragment and zero or more queryable
`SystemFact`s. Every document is tagged with a `ContextScope` so the
bundle can layer a per-tenant overlay on top of the global base.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ContextScope(BaseModel):
    """Layering discriminator shared by contexts and skills.

    `kind="global"` applies to every tenant; `kind="tenant"` applies only
    to `tenant_id` and overrides a global item with the same id/name when
    that tenant is the one asking.
    """

    kind: Literal["global", "tenant"] = "global"
    tenant_id: str | None = None

    @model_validator(mode="after")
    def _tenant_requires_id(self) -> ContextScope:
        if self.kind == "tenant" and not self.tenant_id:
            raise ValueError("scope.kind='tenant' requires a non-empty tenant_id")
        if self.kind == "global" and self.tenant_id:
            raise ValueError("scope.kind='global' must not set tenant_id")
        return self


class SystemFact(BaseModel):
    """One queryable fact about the system around the harness.

    Surfaced through the meta path as a `MetaAgentCatalogEntry`, so the
    field names mirror that projection (`name`/`title`/`body`/`layer`).
    """

    name: str = Field(min_length=1)
    title: str = ""
    body: str = Field(min_length=1)
    # Catalog "layer" label; defaults to "context" so facts are visually
    # distinct from the datasource's curated-function rows.
    layer: str = "context"


class SystemContext(BaseModel):
    """One loaded context document (global or per-tenant)."""

    # Stable slug; used to match a tenant overlay against the global doc
    # it overrides during layering.
    id: str = Field(min_length=1)
    scope: ContextScope = ContextScope()
    # Always-injected fragment. May be empty (a facts-only document).
    primer_text: str = ""
    facts: tuple[SystemFact, ...] = ()
    # Higher wins when two same-id documents collide at the same scope.
    priority: int = 0
