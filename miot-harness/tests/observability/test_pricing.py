"""Pricing table + cost math (A2)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from miot_harness.observability.pricing import (
    PRICING,
    ModelPricing,
    TokenUsage,
    UnknownModelError,
    compute_cost,
)


def test_pricing_table_includes_runtime_models() -> None:
    """Every model the harness can dispatch must have an entry."""

    expected = {
        "claude-sonnet-4-6",
        "claude-haiku-4-5",
        "claude-opus-4-7",
        "gpt-4o-mini",
    }
    missing = expected - set(PRICING)
    assert not missing, f"missing pricing entries: {missing}"


def test_pricing_entries_are_versioned() -> None:
    """Pricing rows carry an effective_date so historical reads are stable."""

    for model, entry in PRICING.items():
        assert isinstance(entry, ModelPricing), model
        assert isinstance(entry.effective_date, date), model


def test_compute_cost_anthropic_with_cache_split() -> None:
    pricing = ModelPricing(
        input_per_mtok=Decimal("3"),
        output_per_mtok=Decimal("15"),
        cache_read_per_mtok=Decimal("0.30"),
        cache_creation_per_mtok=Decimal("3.75"),
        effective_date=date(2026, 1, 1),
    )
    usage = TokenUsage(
        input_tokens=1_000_000,
        output_tokens=500_000,
        cache_read_input_tokens=2_000_000,
        cache_creation_input_tokens=100_000,
    )
    cost = compute_cost(pricing, usage)
    # 1M*3 + 0.5M*15 + 2M*0.30 + 0.1M*3.75 = 3 + 7.5 + 0.6 + 0.375 = 11.475
    assert cost == Decimal("11.475000")


def test_compute_cost_accepts_model_key_lookup() -> None:
    """`compute_cost` resolves a model id by lookup in the pricing table."""

    usage = TokenUsage(input_tokens=10_000, output_tokens=2_000)
    cost = compute_cost("claude-haiku-4-5", usage)
    assert cost > Decimal("0")
    assert cost.as_tuple().exponent == -6  # rounded to 6 decimals


def test_compute_cost_rejects_unknown_model() -> None:
    with pytest.raises(UnknownModelError):
        compute_cost("nonexistent-model-x", TokenUsage(input_tokens=1, output_tokens=1))


def test_compute_cost_zero_usage_returns_zero() -> None:
    cost = compute_cost("claude-haiku-4-5", TokenUsage(input_tokens=0, output_tokens=0))
    assert cost == Decimal("0.000000")
