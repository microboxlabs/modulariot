"""Repo-wide test isolation.

The harness's `.env` file lives at `miot-harness/.env` and operators are
expected to populate it (Nexo DSN, ANTHROPIC_API_KEY, OTel toggles…).
Pydantic-settings auto-loads that file every time `HarnessSettings()`
is constructed, which means a populated dev `.env` silently changes
the "default" values the unit tests assert against.

This conftest pins ``HarnessSettings.model_config["env_file"]`` to a
non-existent path for the test session so every `HarnessSettings()`
sees stock defaults unless the test itself sets env vars via
``monkeypatch.setenv``.

Also clears `MIOT_HARNESS_*` env vars (and `ANTHROPIC_API_KEY` / etc.)
that may leak in from the developer's shell, so the same suite passes
deterministically on CI and on a populated dev box.
"""

from __future__ import annotations

import os

import pytest

from miot_harness.config import HarnessSettings


@pytest.fixture(autouse=True)
def _isolate_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Per-test: pretend `.env` doesn't exist and clear MIOT_HARNESS_* envs."""

    # Disable `.env` discovery for this test. Pydantic-settings reads
    # `model_config["env_file"]` lazily on each construction.
    monkeypatch.setitem(HarnessSettings.model_config, "env_file", "/nonexistent/.env")

    # Drop any inherited env values that would override defaults.
    for key in list(os.environ.keys()):
        if key.startswith("MIOT_HARNESS_") or key in {
            "ANTHROPIC_API_KEY",
            "OPENAI_API_KEY",
            "GOOGLE_API_KEY",
        }:
            monkeypatch.delenv(key, raising=False)
