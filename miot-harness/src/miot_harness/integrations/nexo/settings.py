"""Nexo-private settings.

These are Postgres concepts (schema search path, EXPLAIN plan cost),
honestly Nexo's — they keep the MIOT_HARNESS_NEXO_* prefix and live
here so HarnessSettings never mentions the provider. Loaded by the
NexoProvider boot path, never by core code.
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
    # Composable Nexo primitives (E3). EXPLAIN total cost > this → refuse.
    # PostgreSQL plan-cost units. Default 10000 is roughly "10s of seq scans
    # on a million-row table" — generous enough for analyst exploration,
    # tight enough to refuse an unindexed cross-join. Must be strictly
    # positive; 0 or negative would refuse every query.
    nexo_explain_cost_threshold: float = Field(default=10000.0, gt=0.0)
