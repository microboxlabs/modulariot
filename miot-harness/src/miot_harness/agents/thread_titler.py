"""Short titles for chat threads, from the first exchange."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.agents.chat_models import response_text

ThreadTitler = Callable[[str, str], Awaitable[str]]

MAX_TITLE_WORDS = 6
MAX_TITLE_CHARS = 80
# Enough of each side to know the topic; the rest only costs tokens.
_MAX_INPUT_CHARS = 2_000

_SYSTEM_PROMPT = (
    "You name chat conversations. Reply with a title of at most "
    f"{MAX_TITLE_WORDS} words that says what the user asked about. "
    "Write it in the language of the user's message. "
    "Reply with the title only: no quotes, no trailing period, no prefix."
)


def build_thread_titler(model: BaseChatModel) -> ThreadTitler:
    async def title(message: str, answer: str) -> str:
        prompt = f"User: {message[:_MAX_INPUT_CHARS]}\n\nAssistant: {answer[:_MAX_INPUT_CHARS]}"
        response = await model.ainvoke(
            [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=prompt)]
        )
        cleaned = clean_title(response_text(response))
        if not cleaned:
            raise ValueError("thread titler returned nothing")
        return cleaned

    return title


def clean_title(text: str) -> str:
    """First non-empty line, unquoted, capped to the word and length limits."""
    line = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    if line.lower().startswith("title:"):
        line = line[len("title:") :].strip()
    line = line.strip("\"'`*#“”‘’«» ").rstrip(".").strip()
    words = line.split()[:MAX_TITLE_WORDS]
    return " ".join(words)[:MAX_TITLE_CHARS].strip()
