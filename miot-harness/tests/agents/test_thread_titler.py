from __future__ import annotations

import asyncio
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.agents.thread_titler import build_thread_titler, clean_title


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Trips delayed last week", "Trips delayed last week"),
        ('"Viajes con retraso."', "Viajes con retraso"),
        ("Title: Fleet usage by region\nextra line", "Fleet usage by region"),
        ("\n\n**Resumen de ventas**", "Resumen de ventas"),
        ("one two three four five six seven eight", "one two three four five six"),
        ("", ""),
    ],
)
def test_clean_title(raw: str, expected: str) -> None:
    assert clean_title(raw) == expected


def test_titler_rejects_an_empty_answer() -> None:
    class Empty:
        async def ainvoke(self, messages: Any) -> AIMessage:
            return AIMessage(content="  ")

    titler = build_thread_titler(Empty())  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        asyncio.run(titler("hi", "hello"))
