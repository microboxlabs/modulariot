"""`write_todos`: the model's task list for multi-step work.

The model sends the whole list each time it changes, and gets it back. The
list is kept per conversation, under the tenant and user, in a bounded
in-memory store like the scratchpad's; it is lost on restart.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Literal

from pydantic import BaseModel, Field

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

_MAX_TODOS = 30
_MAX_CONVERSATIONS = 512

TodoStatus = Literal["pending", "in_progress", "completed"]


class Todo(BaseModel):
    content: str = Field(min_length=1, max_length=300)
    status: TodoStatus = "pending"


class WriteTodosInput(BaseModel):
    todos: list[Todo] = Field(max_length=_MAX_TODOS)


class WriteTodosOutput(BaseModel):
    todos: list[Todo]
    pending: int
    in_progress: int
    completed: int


class TodoStore:
    """The latest list per conversation; least recently used evicted first."""

    def __init__(self, *, max_conversations: int = _MAX_CONVERSATIONS) -> None:
        self._lists: OrderedDict[str, list[Todo]] = OrderedDict()
        self._max = max(1, max_conversations)

    def set(self, key: str, todos: list[Todo]) -> None:
        self._lists[key] = list(todos)
        self._lists.move_to_end(key)
        while len(self._lists) > self._max:
            self._lists.popitem(last=False)

    def get(self, key: str) -> list[Todo]:
        return list(self._lists.get(key, []))


def _key(ctx: HarnessContext) -> str:
    return f"{ctx.tenant_id}/{ctx.user_id}/{ctx.conversation_id or ctx.thread_id}"


async def _allow(_: HarnessContext, __: BaseModel) -> PermissionResult:
    return PermissionResult.allow("Task list held in memory for this conversation.")


def write_todos_tool(store: TodoStore) -> HarnessTool[WriteTodosInput, WriteTodosOutput]:
    async def call(ctx: HarnessContext, value: WriteTodosInput, _: Progress) -> WriteTodosOutput:
        store.set(_key(ctx), value.todos)
        return WriteTodosOutput(
            todos=value.todos,
            pending=sum(t.status == "pending" for t in value.todos),
            in_progress=sum(t.status == "in_progress" for t in value.todos),
            completed=sum(t.status == "completed" for t in value.todos),
        )

    return HarnessTool(
        name="write_todos",
        description=(
            "Keep a task list for work that takes three or more steps. Send the "
            "whole list every time it changes: each item's content and status "
            "(pending, in_progress, completed). Keep one item in_progress at a "
            "time, and mark items completed as soon as they are done. Skip it "
            "for a question one or two tool calls answer."
        ),
        input_model=WriteTodosInput,
        output_model=WriteTodosOutput,
        read_only=False,
        kind="utility",
        source="todos",
        check_permission=_allow,
        call=call,
    )
