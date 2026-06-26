"""The connection Source seam.

`ConnectionSource` is the boundary the loader depends on. Phase 0 ships a
file-backed implementation (`file_source.py`); a later runtime API/DB-backed
source implements the same interface with no change to the loader or lifespan
(mirrors the context/skills Source seam).

`load()` is synchronous: it runs once at boot and reads local files (packaged
defaults or a mounted volume). Contract: it MUST NOT raise for content errors —
bad input becomes a `ConnectionDiagnostic`; only a programming bug escapes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from miot_harness.connections.models import ConnectionLoadResult


class ConnectionSource(ABC):
    @abstractmethod
    def load(self) -> ConnectionLoadResult:
        """Load all connection definitions. Never raises on bad content."""
        ...
