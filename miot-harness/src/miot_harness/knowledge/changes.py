"""A change to one knowledge item, as tools, run overlays and evaluations
pass it around."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Layer = Literal["fact", "rule", "skill", "primer", "note", "eval"]
LAYERS: tuple[Layer, ...] = ("fact", "rule", "skill", "primer", "note", "eval")
# The layers a run reads, and so the only ones an overlay can change.
RUN_LAYERS: frozenset[str] = frozenset({"fact", "rule", "skill", "primer"})

MAX_OVERLAY_CHANGES = 50
MAX_CHANGE_CHARS = 20_000


class KnowledgeChange(BaseModel):
    layer: Layer
    id: str = Field(min_length=1, max_length=128)
    target: str | None = Field(default=None, max_length=128)
    op: Literal["upsert", "delete"] = "upsert"
    title: str = Field(default="", max_length=500)
    content: str = Field(default="", max_length=MAX_CHANGE_CHARS)
    reason: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def _primer_is_never_deleted(self) -> KnowledgeChange:
        # A data source always has a description; the store refuses deletes too.
        if self.layer == "primer" and self.op == "delete":
            raise ValueError("a data source description cannot be deleted")
        return self


def changes_for(
    overlay: Iterable[KnowledgeChange], layer: str, target: str | None = None
) -> list[KnowledgeChange]:
    """The overlay's changes to `layer` (and `target`, for layers that have one),
    in order; a later change to the same id wins when applied in sequence."""
    return [c for c in overlay if c.layer == layer and c.target == target]
