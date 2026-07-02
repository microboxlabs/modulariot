"""Per-directory pytest configuration for live integration tests.

The root conftest strips ANTHROPIC_API_KEY (and other provider keys) from
the environment so that unit tests run in a clean, deterministic state.
This conftest re-injects those keys for the integration directory so live
API tests can actually call the real providers.

Key values are captured at module import time (before the root autouse
fixture runs per-test) and restored by a function-scoped autouse fixture
that runs AFTER the root fixture has cleared them.
"""

from __future__ import annotations

import os

import pytest

# Capture at collection time, before the root conftest's autouse fixture
# strips them for each test.
_SAVED_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")
_SAVED_RUN_LIVE = os.environ.get("MIOT_HARNESS_RUN_LIVE_TESTS")


@pytest.fixture(autouse=True)
def _restore_live_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Re-inject provider API keys stripped by the root conftest.

    The root _isolate_settings_from_env fixture (autouse, function-scoped)
    deletes ANTHROPIC_API_KEY so unit tests can't accidentally call the real
    API. For live integration tests we undo that deletion here so
    HarnessSettings picks the key up from the environment.
    """
    if _SAVED_ANTHROPIC_KEY:
        monkeypatch.setenv("ANTHROPIC_API_KEY", _SAVED_ANTHROPIC_KEY)
    if _SAVED_RUN_LIVE:
        monkeypatch.setenv("MIOT_HARNESS_RUN_LIVE_TESTS", _SAVED_RUN_LIVE)
