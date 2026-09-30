"""Trainer tools over the editable knowledge layers (`knowledge.store`).

Offered only on a trainer's run. `knowledge_list` and `knowledge_read` look;
`propose_knowledge_change` applies a batch of changes after the trainer
approves it, whatever the run's permission mode. The approval card and the
result carry each change's unified diff.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field, model_validator

from miot_harness.knowledge.changes import MAX_OVERLAY_CHANGES, KnowledgeChange, Layer
from miot_harness.knowledge.shown import ShownFiles
from miot_harness.knowledge.store import KnowledgeError, KnowledgeStore, virtual_path
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress
from miot_harness.utils.text_diff import diff_fields

KNOWLEDGE_LIST_TOOL = "knowledge_list"
KNOWLEDGE_READ_TOOL = "knowledge_read"
PROPOSE_KNOWLEDGE_CHANGE_TOOL = "propose_knowledge_change"

StoreFor = Callable[[str], KnowledgeStore]


def provenance(ctx: HarnessContext) -> dict[str, Any]:
    return {
        "source": "chat",
        "run_id": ctx.run_id,
        "conversation_id": ctx.conversation_id or ctx.thread_id,
        "user": ctx.user_id,
    }


def trainer_only(ctx: HarnessContext) -> PermissionResult | None:
    return None if ctx.trainer else PermissionResult.deny("only a trainer can use this tool")


class KnowledgeListInput(BaseModel):
    layer: Layer | None = Field(default=None, description="Only this layer; all when omitted.")


class KnowledgeListOutput(BaseModel):
    layers: list[dict[str, Any]]


class KnowledgeReadInput(BaseModel):
    layer: Layer
    id: str = Field(min_length=1, max_length=128)
    target: str | None = Field(
        default=None, description="The connection, for the fact and note layers."
    )


class KnowledgeReadOutput(BaseModel):
    path: str
    item: dict[str, Any]


class ProposeKnowledgeChangeInput(BaseModel):
    changes: list[KnowledgeChange] = Field(min_length=1, max_length=MAX_OVERLAY_CHANGES)
    summary: str = Field(
        min_length=1, max_length=500, description="One line: what the batch teaches and why."
    )

    @model_validator(mode="after")
    def _one_change_per_item(self) -> ProposeKnowledgeChangeInput:
        items = [(c.layer, c.id, c.target) for c in self.changes]
        if len(set(items)) != len(items):
            raise ValueError("each item may appear once in a batch")
        return self


class AppliedChange(BaseModel):
    layer: str
    id: str
    target: str | None
    path: str
    op: str
    title: str = ""
    reason: str = ""
    version: int | None = None
    diff: str
    old_lines: int
    new_lines: int


class ProposeKnowledgeChangeOutput(BaseModel):
    summary: str
    changes: list[AppliedChange]
    message: str


def _current(store: KnowledgeStore, change: KnowledgeChange) -> str | None:
    try:
        return store.read_file(change.layer, change.id, change.target)
    except KnowledgeError as exc:
        if exc.status == 404:
            return None
        raise


def _planned(store: KnowledgeStore, change: KnowledgeChange, ctx: HarnessContext) -> dict[str, Any]:
    """The change with its path and diff, checked without writing."""
    if change.op == "delete":
        before: str | None = store.read_file(change.layer, change.id, change.target)
        after: str | None = None
    else:
        before, after = store.preview_put(
            change.layer,
            change.id,
            target=change.target,
            title=change.title,
            content=change.content,
            author=ctx.user_id,
            provenance=provenance(ctx),
        )
    path = virtual_path(change.layer, change.id, change.target)
    return {**change.model_dump(), "path": path, **diff_fields(before, after, path)}


def _plan_all(
    store: KnowledgeStore, ctx: HarnessContext, changes: list[KnowledgeChange]
) -> list[dict[str, Any]]:
    return [_planned(store, change, ctx) for change in changes]


def _shown_plan(
    store: KnowledgeStore,
    ctx: HarnessContext,
    changes: list[KnowledgeChange],
    shown: ShownFiles,
) -> list[dict[str, Any]]:
    planned = _plan_all(store, ctx, changes)
    for change, entry in zip(changes, planned, strict=True):
        shown.remember(ctx.run_id, entry["path"], _current(store, change))
    return planned


def _apply_all(
    store: KnowledgeStore,
    ctx: HarnessContext,
    changes: list[KnowledgeChange],
    shown: ShownFiles,
) -> list[AppliedChange]:
    """In order. A failure stops the batch and names what was already applied."""
    applied: list[AppliedChange] = []
    for change in changes:
        try:
            path = virtual_path(change.layer, change.id, change.target)
            shown.check(ctx.run_id, path, _current(store, change))
            applied.append(_apply(store, ctx, change))
        except KnowledgeError as exc:
            done = ", ".join(a.path for a in applied) or "none"
            raise KnowledgeError(exc.status, f"{exc.detail} (already applied: {done})") from exc
    return applied


def _apply(store: KnowledgeStore, ctx: HarnessContext, change: KnowledgeChange) -> AppliedChange:
    path = virtual_path(change.layer, change.id, change.target)
    before = _current(store, change)
    version: int | None = None
    after: str | None = None
    if change.op == "delete":
        store.delete(
            change.layer,
            change.id,
            target=change.target,
            reason=change.reason,
            author=ctx.user_id,
            provenance=provenance(ctx),
        )
    else:
        item = store.put(
            change.layer,
            change.id,
            target=change.target,
            title=change.title,
            content=change.content,
            reason=change.reason,
            author=ctx.user_id,
            provenance=provenance(ctx),
        )
        version = item.get("version")
        after = store.read_file(change.layer, change.id, change.target)
    return AppliedChange(
        layer=change.layer,
        id=change.id,
        target=change.target,
        path=path,
        op=change.op,
        title=change.title,
        reason=change.reason,
        version=version,
        **diff_fields(before, after, path),
    )


def knowledge_list_tool(
    store_for: StoreFor,
) -> HarnessTool[KnowledgeListInput, KnowledgeListOutput]:
    async def check(ctx: HarnessContext, _: KnowledgeListInput) -> PermissionResult:  # NOSONAR
        return trainer_only(ctx) or PermissionResult.allow("read only")

    async def call(
        ctx: HarnessContext, value: KnowledgeListInput, _: Progress
    ) -> KnowledgeListOutput:
        layers = await asyncio.to_thread(store_for(ctx.tenant_id).layers)
        chosen = [entry for entry in layers if value.layer in (None, entry["layer"])]
        for entry in chosen:
            for item in entry["items"]:
                item["path"] = virtual_path(entry["layer"], item["id"], item["target"])
        return KnowledgeListOutput(layers=chosen)

    return HarnessTool(
        name=KNOWLEDGE_LIST_TOOL,
        description=(
            "List the organization's editable knowledge by layer: fact (data facts per "
            "connection), rule (rules and glossary), skill (procedures), primer (data "
            "source descriptions), note (your own notes, read and delete only) and eval "
            "(evaluation cases). Each item has its file path for the ws_* tools."
        ),
        input_model=KnowledgeListInput,
        output_model=KnowledgeListOutput,
        kind="trainer",
        check_permission=check,
        call=call,
    )


def knowledge_read_tool(
    store_for: StoreFor,
) -> HarnessTool[KnowledgeReadInput, KnowledgeReadOutput]:
    async def check(ctx: HarnessContext, _: KnowledgeReadInput) -> PermissionResult:  # NOSONAR
        return trainer_only(ctx) or PermissionResult.allow("read only")

    async def call(
        ctx: HarnessContext, value: KnowledgeReadInput, _: Progress
    ) -> KnowledgeReadOutput:
        store = store_for(ctx.tenant_id)
        item = await asyncio.to_thread(store.read, value.layer, value.id, value.target)
        return KnowledgeReadOutput(
            path=virtual_path(value.layer, item["id"], item["target"]), item=item
        )

    return HarnessTool(
        name=KNOWLEDGE_READ_TOOL,
        description=(
            "Read one knowledge item (title, content, metadata, version history). "
            "`target` is the connection for the fact and note layers."
        ),
        input_model=KnowledgeReadInput,
        output_model=KnowledgeReadOutput,
        kind="trainer",
        check_permission=check,
        call=call,
    )


def propose_knowledge_change_tool(
    store_for: StoreFor,
) -> HarnessTool[ProposeKnowledgeChangeInput, ProposeKnowledgeChangeOutput]:
    async def check(  # NOSONAR
        ctx: HarnessContext, value: ProposeKnowledgeChangeInput
    ) -> PermissionResult:
        refused = trainer_only(ctx)
        if refused is not None:
            return refused
        try:
            await asyncio.to_thread(_plan_all, store_for(ctx.tenant_id), ctx, value.changes)
        except KnowledgeError as exc:
            return PermissionResult.deny(exc.detail)
        count = len(value.changes)
        noun = "change" if count == 1 else "changes"
        return PermissionResult.ask(f"Apply {count} knowledge {noun}: {value.summary}")

    shown = ShownFiles()

    async def details(ctx: HarnessContext, value: ProposeKnowledgeChangeInput) -> dict[str, Any]:
        try:
            store = store_for(ctx.tenant_id)
            planned = await asyncio.to_thread(_shown_plan, store, ctx, value.changes, shown)
            return {"changes": planned}
        except KnowledgeError:
            return {}

    async def call(
        ctx: HarnessContext, value: ProposeKnowledgeChangeInput, _: Progress
    ) -> ProposeKnowledgeChangeOutput:
        store = store_for(ctx.tenant_id)
        applied = await asyncio.to_thread(_apply_all, store, ctx, value.changes, shown)
        return ProposeKnowledgeChangeOutput(
            summary=value.summary,
            changes=applied,
            message="The trainer approved the changes. They apply from the next question on.",
        )

    return HarnessTool(
        name=PROPOSE_KNOWLEDGE_CHANGE_TOOL,
        description=(
            "Propose changes to the organization's knowledge, applied in order once the "
            "trainer approves them; each item at most once per batch. Each change: "
            "layer (fact, rule, skill, primer, eval; "
            "note for deletes only), id (a slug), target (the connection, for facts), op "
            "(upsert or delete), title, content (the item's text, without frontmatter) "
            "and reason. For a skill the title is its trigger description. For an eval "
            "the title is the question and the content the expected answer as plain "
            "text, or a YAML mapping with the keys question, expectation (text), and "
            "optional expect_skill, expect_no_skill and checks; never put a whole case "
            "inside expectation. Read an item first when changing it."
        ),
        input_model=ProposeKnowledgeChangeInput,
        output_model=ProposeKnowledgeChangeOutput,
        read_only=False,
        destructive=True,
        always_ask=True,
        carries_diff=True,
        declined_message=(
            "The trainer declined these changes. Ask what to change before proposing again."
        ),
        kind="trainer",
        check_permission=check,
        approval_details=details,
        call=call,
    )
