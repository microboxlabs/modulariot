"""File tools over a tenant's editable knowledge, for a trainer's run.

Paths are relative to a virtual root that shows only what the tenant may
edit (`rules/<id>.md`, `skills/<id>/SKILL.md`, `facts/<conn>/<id>.md`,
`primers/<conn>.md`, `evals/<id>.yaml`), its notes (`notes/<conn>/<id>.md`,
read and delete only) and read-only views of the shipped context and skills
(`base/context/...`, `base/skills/...`). Every write goes through the
knowledge store (versions, history, personal-data check, path confinement)
after the trainer approves it; the approval card and the result carry the
unified diff.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field

from miot_harness.knowledge.store import KnowledgeError, KnowledgeStore, VirtualRef
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress
from miot_harness.tools.knowledge_tools import StoreFor, provenance, trainer_only
from miot_harness.utils.text_diff import diff_fields

WS_WRITE_TOOLS = ("ws_write", "ws_edit", "ws_delete")

_LS_CAP = 500
_READ_LIMIT = 400
_GREP_CAP = 200
_GREP_LINE_CHARS = 300

Op = Literal["write", "edit", "delete"]


class WsLsInput(BaseModel):
    path: str = Field(default="", description="A folder, e.g. `skills` or `base/skills`.")


class WsFile(BaseModel):
    path: str
    layer: str | None
    writable: bool


class WsLsOutput(BaseModel):
    files: list[WsFile]
    truncated: bool = False


class WsReadInput(BaseModel):
    path: str
    offset: int = Field(default=1, ge=1, description="First line to read, from 1.")
    limit: int = Field(default=_READ_LIMIT, ge=1, le=2000)


class WsReadOutput(BaseModel):
    path: str
    layer: str | None
    writable: bool
    content: str
    total_lines: int
    offset: int
    lines: int


class WsGrepInput(BaseModel):
    pattern: str = Field(min_length=1, max_length=500, description="A regular expression.")
    path: str = Field(default="", description="Search only under this folder.")
    ignore_case: bool = False


class WsMatch(BaseModel):
    path: str
    line: int
    text: str


class WsGrepOutput(BaseModel):
    matches: list[WsMatch]
    truncated: bool = False


class WsWriteInput(BaseModel):
    path: str
    content: str = Field(description="The whole file, frontmatter included.")
    reason: str = Field(default="", max_length=2000)


class WsEditInput(BaseModel):
    path: str
    old_string: str = Field(min_length=1)
    new_string: str
    replace_all: bool = False
    reason: str = Field(default="", max_length=2000)


class WsDeleteInput(BaseModel):
    path: str
    reason: str = Field(default="", max_length=2000)


class WsChangeOutput(BaseModel):
    path: str
    layer: str
    id: str
    target: str | None
    op: Op
    version: int | None = None
    diff: str
    old_lines: int
    new_lines: int
    message: str


def _under(path: str, folder: str) -> bool:
    prefix = folder.strip().strip("/")
    return not prefix or path == prefix or path.startswith(prefix + "/")


def _numbered(text: str, offset: int, limit: int) -> tuple[str, int, int]:
    lines = text.splitlines()
    window = lines[offset - 1 : offset - 1 + limit]
    body = "\n".join(f"{n:>6}\t{line}" for n, line in enumerate(window, start=offset))
    return body, len(lines), len(window)


def _read_or_none(store: KnowledgeStore, ref: VirtualRef) -> str | None:
    try:
        return store.read_file(str(ref.layer), str(ref.id), ref.target)
    except KnowledgeError as exc:
        if exc.status == 404:
            return None
        raise


def _edited(text: str, value: WsEditInput) -> str:
    count = text.count(value.old_string)
    if count == 0:
        raise KnowledgeError(400, "old_string is not in the file")
    if count > 1 and not value.replace_all:
        raise KnowledgeError(
            400, f"old_string occurs {count} times; add context or pass replace_all"
        )
    return text.replace(value.old_string, value.new_string, -1 if value.replace_all else 1)


@dataclass(frozen=True)
class _Plan:
    ref: VirtualRef
    before: str | None
    after: str | None


def _plan(store: KnowledgeStore, op: Op, value: BaseModel) -> _Plan:
    """What a write would change, checked as the store checks it."""
    ref = store.resolve_path(str(getattr(value, "path", "")))
    if ref.layer is None:
        raise KnowledgeError(405, f"{ref.path} is a read-only view of a shipped file")
    before = _read_or_none(store, ref)
    after: str | None
    if op == "delete":
        if before is None:
            raise KnowledgeError(404, f"no such file {ref.path!r}")
        if ref.layer == "primer":
            raise KnowledgeError(405, "a data source description cannot be deleted")
        after = None
    else:
        if op == "edit":
            if before is None:
                raise KnowledgeError(404, f"no such file {ref.path!r}")
            assert isinstance(value, WsEditInput)
            after = _edited(before, value)
        else:
            assert isinstance(value, WsWriteInput)
            after = value.content
        if not ref.writable:
            raise KnowledgeError(405, f"layer {ref.layer!r} is read-only")
        store.check_file(ref.layer, str(ref.id), after, ref.target)
    return _Plan(ref=ref, before=before, after=after)


def _details(plan: _Plan, op: Op) -> dict[str, Any]:
    ref = plan.ref
    return {
        "path": ref.path,
        "layer": ref.layer,
        "id": ref.id,
        "target": ref.target,
        "op": op,
        **diff_fields(plan.before, plan.after, ref.path),
    }


def ws_ls_tool(store_for: StoreFor) -> HarnessTool[WsLsInput, WsLsOutput]:
    async def check(ctx: HarnessContext, _: WsLsInput) -> PermissionResult:  # NOSONAR
        return trainer_only(ctx) or PermissionResult.allow("read only")

    async def call(ctx: HarnessContext, value: WsLsInput, _: Progress) -> WsLsOutput:
        tree = await asyncio.to_thread(store_for(ctx.tenant_id).tree)
        files = [
            WsFile(path=e["path"], layer=e["layer"], writable=e["writable"])
            for e in tree
            if _under(e["path"], value.path)
        ]
        return WsLsOutput(files=files[:_LS_CAP], truncated=len(files) > _LS_CAP)

    return HarnessTool(
        name="ws_ls",
        description=(
            "List the files of the organization's knowledge workspace under a folder: "
            "rules/, skills/, facts/<connection>/, primers/, evals/, notes/ (read and "
            "delete only) and base/context/, base/skills/ (shipped files, read only)."
        ),
        input_model=WsLsInput,
        output_model=WsLsOutput,
        kind="trainer",
        check_permission=check,
        call=call,
    )


def ws_read_tool(store_for: StoreFor) -> HarnessTool[WsReadInput, WsReadOutput]:
    async def check(ctx: HarnessContext, _: WsReadInput) -> PermissionResult:  # NOSONAR
        return trainer_only(ctx) or PermissionResult.allow("read only")

    async def call(ctx: HarnessContext, value: WsReadInput, _: Progress) -> WsReadOutput:
        store = store_for(ctx.tenant_id)
        ref = store.resolve_path(value.path)
        text = await asyncio.to_thread(store.read_path, value.path)
        body, total, count = _numbered(text, value.offset, value.limit)
        return WsReadOutput(
            path=ref.path,
            layer=ref.layer,
            writable=ref.writable,
            content=body,
            total_lines=total,
            offset=value.offset,
            lines=count,
        )

    return HarnessTool(
        name="ws_read",
        description=(
            "Read a workspace file with line numbers (`offset` is the first line, from "
            "1; `limit` the number of lines). Works on base/ files too, so you can copy "
            "a shipped skill into skills/ and edit it."
        ),
        input_model=WsReadInput,
        output_model=WsReadOutput,
        kind="trainer",
        check_permission=check,
        call=call,
    )


def ws_grep_tool(store_for: StoreFor) -> HarnessTool[WsGrepInput, WsGrepOutput]:
    async def check(ctx: HarnessContext, value: WsGrepInput) -> PermissionResult:  # NOSONAR
        refused = trainer_only(ctx)
        if refused is not None:
            return refused
        try:
            re.compile(value.pattern)
        except re.error as exc:
            return PermissionResult.deny(f"invalid pattern: {exc}")
        return PermissionResult.allow("read only")

    def search(store: KnowledgeStore, value: WsGrepInput) -> WsGrepOutput:
        regex = re.compile(value.pattern, re.IGNORECASE if value.ignore_case else 0)
        matches: list[WsMatch] = []
        for entry in store.tree():
            if not _under(entry["path"], value.path):
                continue
            try:
                text = store.read_path(entry["path"])
            except KnowledgeError:
                continue
            for number, line in enumerate(text.splitlines(), start=1):
                if regex.search(line):
                    matches.append(
                        WsMatch(path=entry["path"], line=number, text=line[:_GREP_LINE_CHARS])
                    )
                    if len(matches) > _GREP_CAP:
                        return WsGrepOutput(matches=matches[:_GREP_CAP], truncated=True)
        return WsGrepOutput(matches=matches)

    async def call(ctx: HarnessContext, value: WsGrepInput, _: Progress) -> WsGrepOutput:
        return await asyncio.to_thread(search, store_for(ctx.tenant_id), value)

    return HarnessTool(
        name="ws_grep",
        description="Search the workspace files for a regular expression; returns matching lines.",
        input_model=WsGrepInput,
        output_model=WsGrepOutput,
        kind="trainer",
        check_permission=check,
        call=call,
    )


_VERBS: dict[str, str] = {"write": "Write", "edit": "Edit", "delete": "Delete"}


def _write_tool(
    store_for: StoreFor,
    *,
    name: str,
    op: Op,
    input_model: type[BaseModel],
    description: str,
) -> HarnessTool[Any, WsChangeOutput]:
    async def check(ctx: HarnessContext, value: Any) -> PermissionResult:  # NOSONAR
        refused = trainer_only(ctx)
        if refused is not None:
            return refused
        try:
            plan = await asyncio.to_thread(_plan, store_for(ctx.tenant_id), op, value)
        except KnowledgeError as exc:
            return PermissionResult.deny(exc.detail)
        return PermissionResult.ask(f"{_VERBS[op]} {plan.ref.path}")

    async def details(ctx: HarnessContext, value: Any) -> dict[str, Any]:
        try:
            plan = await asyncio.to_thread(_plan, store_for(ctx.tenant_id), op, value)
        except KnowledgeError:
            return {}
        return _details(plan, op)

    def apply(ctx: HarnessContext, value: Any) -> WsChangeOutput:
        store = store_for(ctx.tenant_id)
        plan = _plan(store, op, value)
        ref = plan.ref
        layer, item_id = str(ref.layer), str(ref.id)
        version: int | None = None
        if plan.after is None:
            store.delete(
                layer,
                item_id,
                target=ref.target,
                reason=value.reason,
                author=ctx.user_id,
                provenance=provenance(ctx),
            )
        else:
            item = store.write_file(
                layer,
                item_id,
                plan.after,
                target=ref.target,
                reason=value.reason,
                author=ctx.user_id,
                provenance=provenance(ctx),
            )
            version = item.get("version")
        return WsChangeOutput(
            **_details(plan, op),
            version=version,
            message="The trainer approved the change. It applies from the next question on.",
        )

    async def call(ctx: HarnessContext, value: Any, _: Progress) -> WsChangeOutput:
        return await asyncio.to_thread(apply, ctx, value)

    return HarnessTool(
        name=name,
        description=description,
        input_model=input_model,
        output_model=WsChangeOutput,
        read_only=False,
        destructive=True,
        always_ask=True,
        carries_diff=True,
        declined_message=(
            "The trainer declined this change. Ask what to change before proposing it again."
        ),
        kind="trainer",
        check_permission=check,
        approval_details=details,
        call=call,
    )


def ws_write_tool(store_for: StoreFor) -> HarnessTool[Any, WsChangeOutput]:
    return _write_tool(
        store_for,
        name="ws_write",
        op="write",
        input_model=WsWriteInput,
        description=(
            "Create or replace a workspace file with `content` (the whole file, "
            "frontmatter included). The trainer approves the diff first. A skill is "
            "skills/<id>/SKILL.md with frontmatter `name` and `description`; a rule is "
            "rules/<id>.md with frontmatter `title`; an eval is evals/<id>.yaml with "
            "`question`, `expectation` and optional `expect_skill` / `expect_no_skill`. "
            "Ids are lowercase slugs."
        ),
    )


def ws_edit_tool(store_for: StoreFor) -> HarnessTool[Any, WsChangeOutput]:
    return _write_tool(
        store_for,
        name="ws_edit",
        op="edit",
        input_model=WsEditInput,
        description=(
            "Edit a workspace file by exact string replacement. `old_string` must occur "
            "once unless `replace_all` is set. The trainer approves the diff first."
        ),
    )


def ws_delete_tool(store_for: StoreFor) -> HarnessTool[Any, WsChangeOutput]:
    return _write_tool(
        store_for,
        name="ws_delete",
        op="delete",
        input_model=WsDeleteInput,
        description=(
            "Delete a workspace file (not a data source description). The trainer "
            "approves first; earlier versions stay in the history."
        ),
    )
