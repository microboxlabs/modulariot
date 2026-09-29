"""Streamed chunks reach the run as they arrive, through the run's callbacks."""

import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessageChunk, HumanMessage
from langchain_core.outputs import ChatGenerationChunk

from miot_harness.runtime.agent_loop import _stream_turn
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.instrumentation import instrument_model


class SlowStreamModel(BaseChatModel):
    """Streams `parts` with a pause before each, reporting tokens like a provider does."""

    parts: list[str]
    gap: float = 0.05

    @property
    def _llm_type(self) -> str:
        return "slow-stream"

    def _generate(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    async def _astream(self, messages: Any, stop: Any = None, run_manager: Any = None, **kwargs):
        for part in self.parts:
            await asyncio.sleep(self.gap)
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=part))
            if run_manager is not None:
                await run_manager.on_llm_new_token(part, chunk=chunk)
            yield chunk


@pytest.mark.asyncio
async def test_chunks_stream_while_the_default_thread_pool_is_busy():
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=1)
    loop.set_default_executor(pool)
    release = threading.Event()
    loop.run_in_executor(None, release.wait, 2)
    model = SlowStreamModel(parts=["x" * 450, " a", " b", " c", " d"])
    wrapped = instrument_model(
        model, "agent_loop", UserRequest(message="q", tenant_id="t").to_context()
    )
    times: list[float] = []
    start = time.monotonic()
    try:
        await _stream_turn(
            wrapped,
            [HumanMessage(content="q")],
            progress=lambda e: times.append(time.monotonic()) if e.type == "answer.delta" else None,
            run_id="r",
        )
    finally:
        release.set()
        pool.shutdown(wait=False)

    assert len(times) == 5
    assert times[0] - start < 1
    assert times[-1] - times[0] >= 0.15
