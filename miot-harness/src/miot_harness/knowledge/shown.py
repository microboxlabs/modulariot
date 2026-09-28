"""The file text each approval card showed, so the approved write can refuse a
file that changed while the trainer was deciding."""

from __future__ import annotations

import hashlib
from collections import OrderedDict

from miot_harness.knowledge.store import KnowledgeError

_CAP = 1024


def _digest(text: str | None) -> str:
    return "" if text is None else hashlib.sha256(text.encode("utf-8")).hexdigest()


class ShownFiles:
    def __init__(self) -> None:
        self._shown: OrderedDict[tuple[str, str], str] = OrderedDict()

    def remember(self, run_id: str, path: str, text: str | None) -> None:
        self._shown[(run_id, path)] = _digest(text)
        while len(self._shown) > _CAP:
            self._shown.popitem(last=False)

    def check(self, run_id: str, path: str, text: str | None) -> None:
        """Raise when `path` no longer holds the text its approval card showed."""
        shown = self._shown.pop((run_id, path), None)
        if shown is not None and shown != _digest(text):
            raise KnowledgeError(
                409, f"{path} changed after it was shown for approval; read it and propose again"
            )
