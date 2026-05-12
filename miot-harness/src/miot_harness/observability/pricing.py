"""Versioned per-model pricing table + cost computation.

Costs are recorded at run-time on each LLM call's span so that historical
queries do not reprice when the table is updated. Update entries by adding a
new row with a fresh ``effective_date``; never mutate existing rows in place
once spans have referenced them.

``TokenUsage`` uses the **Anthropic bucket convention**: ``input_tokens`` is
non-cache input only, with cache reads and cache creations counted separately.
The provider extraction in ``callbacks.py`` reconciles LangChain's total-style
``usage_metadata`` into these buckets.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal


class UnknownModelError(KeyError):
    """Raised when ``compute_cost`` is called with a model that has no entry."""


@dataclass(frozen=True, slots=True)
class ModelPricing:
    """Pricing for one model, expressed in USD per million tokens."""

    input_per_mtok: Decimal
    output_per_mtok: Decimal
    cache_read_per_mtok: Decimal
    cache_creation_per_mtok: Decimal
    effective_date: date


@dataclass(frozen=True, slots=True)
class TokenUsage:
    """Token counts in Anthropic-style buckets (input_tokens excludes cache)."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0


_MTOK = Decimal(1_000_000)
_QUANTUM = Decimal("0.000001")


PRICING: dict[str, ModelPricing] = {
    "claude-opus-4-7": ModelPricing(
        input_per_mtok=Decimal("15"),
        output_per_mtok=Decimal("75"),
        cache_read_per_mtok=Decimal("1.50"),
        cache_creation_per_mtok=Decimal("18.75"),
        effective_date=date(2026, 1, 1),
    ),
    "claude-sonnet-4-6": ModelPricing(
        input_per_mtok=Decimal("3"),
        output_per_mtok=Decimal("15"),
        cache_read_per_mtok=Decimal("0.30"),
        cache_creation_per_mtok=Decimal("3.75"),
        effective_date=date(2026, 1, 1),
    ),
    "claude-haiku-4-5": ModelPricing(
        input_per_mtok=Decimal("1"),
        output_per_mtok=Decimal("5"),
        cache_read_per_mtok=Decimal("0.10"),
        cache_creation_per_mtok=Decimal("1.25"),
        effective_date=date(2026, 1, 1),
    ),
    "gpt-4o-mini": ModelPricing(
        input_per_mtok=Decimal("0.15"),
        output_per_mtok=Decimal("0.60"),
        cache_read_per_mtok=Decimal("0.075"),
        cache_creation_per_mtok=Decimal("0.15"),
        effective_date=date(2026, 1, 1),
    ),
}


def compute_cost(model: str | ModelPricing, usage: TokenUsage) -> Decimal:
    """Return total USD cost for the given token usage, rounded to 6 decimals."""

    pricing = model if isinstance(model, ModelPricing) else _lookup(model)
    cost = (
        Decimal(usage.input_tokens) * pricing.input_per_mtok
        + Decimal(usage.output_tokens) * pricing.output_per_mtok
        + Decimal(usage.cache_read_input_tokens) * pricing.cache_read_per_mtok
        + Decimal(usage.cache_creation_input_tokens) * pricing.cache_creation_per_mtok
    ) / _MTOK
    return cost.quantize(_QUANTUM, rounding=ROUND_HALF_UP)


def _lookup(model: str) -> ModelPricing:
    try:
        return PRICING[model]
    except KeyError as exc:
        raise UnknownModelError(model) from exc
