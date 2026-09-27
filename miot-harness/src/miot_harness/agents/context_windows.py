"""Context window size per conversation model, in tokens.

Claude models take 200K. Other providers vary by model, so they use
`agents_context_window_default` unless `agents_context_windows` names the
model.
"""

from __future__ import annotations

from collections.abc import Mapping

from miot_harness.agents.model_providers import is_anthropic

_ANTHROPIC_WINDOW = 200_000


def context_window(model: str, *, overrides: Mapping[str, int], default: int) -> int:
    if model in overrides:
        return overrides[model]
    if is_anthropic(model):
        return _ANTHROPIC_WINDOW
    return default
