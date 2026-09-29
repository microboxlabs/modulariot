"""Which provider serves a model, and with what key and endpoint.

A model is named `provider:model` (`deepseek:deepseek-chat`,
`openrouter:anthropic/claude-sonnet-4`, `llmgateway:deepseek-v4-flash`). A bare
`claude-*` name is an Anthropic model and a bare `gpt-*` / `o1-*` / `o3-*` name
an OpenAI one.

Anthropic models use the Anthropic client. Every other provider speaks the
OpenAI chat API and uses the OpenAI client with the provider's base URL.

Providers come from the environment (`registry_from_settings`) and from the
modulith, where the platform owner sets them (`registry_from_modulith`); the
modulith's win for a provider set in both.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Literal

ProviderKind = Literal["anthropic", "openai_compatible"]

# Provider name -> (client kind, default base URL).
KNOWN_PROVIDERS: dict[str, tuple[ProviderKind, str | None]] = {
    "anthropic": ("anthropic", None),
    "openai": ("openai_compatible", "https://api.openai.com/v1"),
    "openrouter": ("openai_compatible", "https://openrouter.ai/api/v1"),
    "llmgateway": ("openai_compatible", "https://api.llmgateway.io/v1"),
    "deepseek": ("openai_compatible", "https://api.deepseek.com/v1"),
    "qwen": ("openai_compatible", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
    "kimi": ("openai_compatible", "https://api.moonshot.ai/v1"),
    "glm": ("openai_compatible", "https://api.z.ai/api/paas/v4"),
}

_OPENAI_PREFIXES = ("gpt-", "o1-", "o3-")

# The wording operators know for the two providers set by a plain key variable.
_MISSING_KEY = {
    "anthropic": "ANTHROPIC_API_KEY is not set; cannot construct Claude chat model",
    "openai": "OPENAI_API_KEY is not set; cannot construct OpenAI chat model",
}


@dataclass(frozen=True)
class ModelSpec:
    """A model as the provider names it, with its price per million tokens."""

    id: str
    input_per_mtok: Decimal | None = None
    output_per_mtok: Decimal | None = None
    default: bool = False


@dataclass(frozen=True)
class Provider:
    name: str
    kind: ProviderKind
    api_key: str = field(repr=False)
    base_url: str | None = None
    # The models offered to runs.
    models: tuple[ModelSpec, ...] = ()


def split_model(name: str) -> tuple[str, str]:
    """(provider, model id) for a model name. Raises ValueError when unknown."""
    if ":" in name:
        provider, _, model = name.partition(":")
        if provider and model:
            return provider, model
    elif name.startswith("claude-"):
        return "anthropic", name
    elif name.startswith(_OPENAI_PREFIXES):
        return "openai", name
    raise ValueError(
        f"Unsupported model name {name!r}: use provider:model, or a claude-* / gpt-* name"
    )


def qualified(provider: str, model: str) -> str:
    """The name a run uses for a provider's model. Anthropic and OpenAI models
    keep their bare names, which is how they were named before providers."""
    if provider == "anthropic" and model.startswith("claude-"):
        return model
    if provider == "openai" and model.startswith(_OPENAI_PREFIXES):
        return model
    return f"{provider}:{model}"


def is_anthropic(name: str) -> bool:
    try:
        provider, _ = split_model(name)
    except ValueError:
        return False
    return KNOWN_PROVIDERS.get(provider, ("openai_compatible", None))[0] == "anthropic"


class ProviderRegistry:
    def __init__(self, providers: Iterable[Provider] = ()) -> None:
        self._providers = {p.name: p for p in providers}

    def get(self, name: str) -> Provider | None:
        return self._providers.get(name)

    def resolve(self, model_name: str) -> tuple[Provider, str]:
        """The provider serving `model_name` and the model id to send it."""
        provider_name, model = split_model(model_name)
        provider = self._providers.get(provider_name)
        if provider is None:
            raise RuntimeError(
                _MISSING_KEY.get(provider_name)
                or (
                    f"model {model_name!r} needs the {provider_name} provider, which has no API key"
                )
            )
        return provider, model

    def offered(self) -> list[str]:
        """Every model a configured provider offers, as runs name them."""
        return [qualified(p.name, m.id) for p in self._providers.values() for m in p.models]

    def default_model(self) -> str | None:
        """The model the platform owner marked as the default, if any."""
        for p in self._providers.values():
            for m in p.models:
                if m.default:
                    return qualified(p.name, m.id)
        return None

    def spec(self, model_name: str) -> ModelSpec | None:
        """The offered model's spec (prices), or None when not offered."""
        try:
            provider_name, model = split_model(model_name)
        except ValueError:
            return None
        provider = self._providers.get(provider_name)
        if provider is None:
            return None
        return next((m for m in provider.models if m.id == model), None)

    @property
    def version(self) -> tuple[Provider, ...]:
        """Compares unequal whenever any provider, key or model changes."""
        return tuple(self._providers[name] for name in sorted(self._providers))

    def merged(self, other: ProviderRegistry) -> ProviderRegistry:
        """These providers, with `other`'s replacing any of the same name."""
        return ProviderRegistry({**self._providers, **other._providers}.values())


def registry_from_settings(
    *,
    anthropic_api_key: str | None,
    openai_api_key: str | None,
    providers_json: str,
    environ: dict[str, str] | None = None,
) -> ProviderRegistry:
    """Providers from the environment.

    `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` configure those two providers.
    `MIOT_HARNESS_MODEL_PROVIDERS` adds or overrides any of them: a JSON list
    of `{"provider", "api_key_env", "models", "base_url"?}`. The key is read
    from the variable `api_key_env` names, never from the JSON itself.
    """
    env = os.environ if environ is None else environ
    providers: dict[str, Provider] = {}
    if anthropic_api_key:
        providers["anthropic"] = Provider("anthropic", "anthropic", anthropic_api_key)
    if openai_api_key:
        providers["openai"] = Provider(
            "openai", "openai_compatible", openai_api_key, KNOWN_PROVIDERS["openai"][1]
        )
    for entry in json.loads(providers_json) if providers_json.strip() else []:
        name = str(entry["provider"])
        if name not in KNOWN_PROVIDERS:
            raise ValueError(f"unknown model provider {name!r}; known: {sorted(KNOWN_PROVIDERS)}")
        key_env = str(entry["api_key_env"])
        key = env.get(key_env, "").strip()
        if not key:
            raise ValueError(f"model provider {name!r}: {key_env} is not set")
        kind, default_url = KNOWN_PROVIDERS[name]
        providers[name] = Provider(
            name,
            kind,
            key,
            entry.get("base_url") or default_url,
            tuple(ModelSpec(str(m)) for m in entry.get("models") or ()),
        )
    return ProviderRegistry(providers.values())


def registry_from_modulith(payload: dict[str, Any]) -> ProviderRegistry:
    """Providers from the modulith's `GET /internal/model-providers` answer.
    Providers the harness does not know are skipped."""
    providers: list[Provider] = []
    for entry in payload.get("providers") or []:
        name = str(entry.get("provider", ""))
        if name not in KNOWN_PROVIDERS or not entry.get("apiKey"):
            continue
        kind, default_url = KNOWN_PROVIDERS[name]
        providers.append(
            Provider(
                name,
                kind,
                str(entry["apiKey"]),
                entry.get("baseUrl") or default_url,
                tuple(
                    ModelSpec(
                        str(m["id"]),
                        _decimal(m.get("inputPerMtok")),
                        _decimal(m.get("outputPerMtok")),
                        bool(m.get("default")),
                    )
                    for m in entry.get("models") or ()
                ),
            )
        )
    return ProviderRegistry(providers)


async def fetch_modulith_registry(
    modulith_url: str, provider_key: str, *, client: Any = None, timeout: float = 10.0
) -> ProviderRegistry:
    """The platform owner's providers, read from the modulith."""
    import httpx

    url = modulith_url.rstrip("/") + "/internal/model-providers"
    headers = {"x-miot-harness-key": provider_key}
    if client is not None:
        response = await client.get(url, headers=headers, timeout=timeout)
    else:
        async with httpx.AsyncClient() as own:
            response = await own.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    return registry_from_modulith(response.json())


def _decimal(value: Any) -> Decimal | None:
    return None if value is None else Decimal(str(value))
