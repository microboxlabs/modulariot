"""One entry in what the harness tells the model about a datasource or tenant."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CatalogEntry:
    name: str
    layer: str
    title: str
    body: str
