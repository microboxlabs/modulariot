"""Virtual filesystem scratchpad tools for the harness.

An in-memory, per-conversation scratchpad so agents can offload notes,
plans, and intermediate findings to files instead of carrying them in
the LLM context window across a multi-turn run. Files never touch real
disk and never cross conversation/tenant boundaries.

The backing store mirrors `runtime/conversation.InMemoryConversationStore`:
a process-local dict, lost on restart — acceptable for v1. A disk- or
Redis-backed implementation can slot behind the same surface later.

The four tools (`fs_write` / `fs_read` / `fs_ls` / `fs_edit`) follow the
`HarnessTool` factory pattern (see `tools/dashboard.py`) and capture a
shared `VirtualFileStore` via closure (the same way
`integrations/nexo/tool_factory` captures `pool`/`tenant_lock`). The
conversation key is derived from `HarnessContext` inside each call — no
change to the `call(ctx, input, progress)` signature.

Cap / validation violations raise `FileStoreError` inside the store; the
tool wrappers catch it and return a typed `ok=False` output so the agent
gets a structured result it can react to rather than an aborting
exception. A missing read returns `found=False` (also not an error).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

# Defaults mirror config.py's fs_* settings so a bare VirtualFileStore()
# (tests, evals) behaves like the wired-up one.
_DEFAULT_MAX_FILE_BYTES = 65_536
_DEFAULT_MAX_TOTAL_BYTES = 1_048_576
_DEFAULT_MAX_FILES = 64


class FileStoreError(Exception):
    """Carries a stable `code` so callers can branch without string-matching."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class FileEntry:
    content: str

    @property
    def bytes(self) -> int:
        return len(self.content.encode("utf-8"))


@dataclass(frozen=True, slots=True)
class WriteResult:
    path: str
    bytes: int
    created: bool


@dataclass(frozen=True, slots=True)
class EditResult:
    path: str
    bytes: int
    replacements: int


def _normalize_path(path: str) -> str:
    """Normalize a virtual path into a clean key.

    Even though the store is virtual, we keep the key namespace clean and
    reject absolute paths and parent traversal so an agent can't construct
    surprising keys (and so a future disk-backed impl inherits a safe rule).
    """
    raw = path.strip()
    if not raw:
        raise FileStoreError("invalid_path", "path must not be empty")
    if raw.startswith("/") or raw.startswith("\\"):
        raise FileStoreError("invalid_path", "absolute paths are not allowed")
    parts = [seg for seg in raw.replace("\\", "/").split("/") if seg not in ("", ".")]
    if any(seg == ".." for seg in parts):
        raise FileStoreError("invalid_path", "parent traversal ('..') is not allowed")
    if not parts:
        raise FileStoreError("invalid_path", "path resolves to empty")
    return "/".join(parts)


class VirtualFileStore:
    """Process-local, per-conversation virtual file store.

    Concurrency: single event loop, no locks (same posture as
    `InMemoryConversationStore`). If the harness ever runs multi-worker,
    a shared backend becomes the seam.
    """

    def __init__(
        self,
        *,
        max_file_bytes: int = _DEFAULT_MAX_FILE_BYTES,
        max_total_bytes: int = _DEFAULT_MAX_TOTAL_BYTES,
        max_files: int = _DEFAULT_MAX_FILES,
    ) -> None:
        self._files: dict[str, dict[str, FileEntry]] = {}
        self._max_file_bytes = max_file_bytes
        self._max_total_bytes = max_total_bytes
        self._max_files = max_files

    def _total_bytes(self, conv_key: str) -> int:
        return sum(entry.bytes for entry in self._files.get(conv_key, {}).values())

    def write(self, conv_key: str, path: str, content: str) -> WriteResult:
        norm = _normalize_path(path)
        size = len(content.encode("utf-8"))
        if size > self._max_file_bytes:
            raise FileStoreError(
                "file_too_large",
                f"file is {size} bytes; per-file cap is {self._max_file_bytes}",
            )
        bucket = self._files.setdefault(conv_key, {})
        existing = bucket.get(norm)
        created = existing is None
        if created and len(bucket) >= self._max_files:
            raise FileStoreError(
                "too_many_files",
                f"scratchpad already holds {len(bucket)} files (cap {self._max_files})",
            )
        existing_bytes = existing.bytes if existing else 0
        projected = self._total_bytes(conv_key) - existing_bytes + size
        if projected > self._max_total_bytes:
            raise FileStoreError(
                "workspace_full",
                f"write would use {projected} bytes; total cap is {self._max_total_bytes}",
            )
        bucket[norm] = FileEntry(content=content)
        return WriteResult(path=norm, bytes=size, created=created)

    def read(self, conv_key: str, path: str) -> str | None:
        norm = _normalize_path(path)
        entry = self._files.get(conv_key, {}).get(norm)
        return entry.content if entry is not None else None

    def ls(self, conv_key: str, prefix: str | None = None) -> list[tuple[str, int]]:
        bucket = self._files.get(conv_key, {})
        pfx = (prefix or "").strip().lstrip("/")
        return [
            (path, entry.bytes)
            for path, entry in sorted(bucket.items())
            if not pfx or path.startswith(pfx)
        ]

    def edit(
        self,
        conv_key: str,
        path: str,
        old_string: str,
        new_string: str,
        *,
        replace_all: bool = False,
    ) -> EditResult:
        norm = _normalize_path(path)
        if old_string == "":
            raise FileStoreError("invalid_edit", "old_string must not be empty")
        bucket = self._files.get(conv_key, {})
        entry = bucket.get(norm)
        if entry is None:
            raise FileStoreError("not_found", f"no such file: {norm}")
        count = entry.content.count(old_string)
        if count == 0:
            raise FileStoreError("not_found", "old_string not present in file")
        if count > 1 and not replace_all:
            raise FileStoreError(
                "not_unique",
                f"old_string occurs {count} times; pass replace_all=true to replace all",
            )
        if replace_all:
            updated = entry.content.replace(old_string, new_string)
            replacements = count
        else:
            updated = entry.content.replace(old_string, new_string, 1)
            replacements = 1
        size = len(updated.encode("utf-8"))
        if size > self._max_file_bytes:
            raise FileStoreError(
                "file_too_large",
                f"edit would make the file {size} bytes; per-file cap is {self._max_file_bytes}",
            )
        projected = self._total_bytes(conv_key) - entry.bytes + size
        if projected > self._max_total_bytes:
            raise FileStoreError(
                "workspace_full",
                f"edit would use {projected} bytes; total cap is {self._max_total_bytes}",
            )
        bucket[norm] = FileEntry(content=updated)
        return EditResult(path=norm, bytes=size, replacements=replacements)


def _conv_key(ctx: HarnessContext) -> str:
    """Scratchpad partition key: the conversation if set, else the thread.

    `thread_id` is always populated, so one-shot runs still get an isolated
    partition; multi-turn conversations share one so a later turn can read
    an earlier turn's note.
    """
    return ctx.conversation_id or ctx.thread_id


# --- Pydantic I/O models -------------------------------------------------


class FsWriteInput(BaseModel):
    path: str
    content: str


class FsWriteOutput(BaseModel):
    ok: bool
    path: str
    bytes: int = 0
    created: bool = False
    error: str | None = None


class FsReadInput(BaseModel):
    path: str


class FsReadOutput(BaseModel):
    ok: bool
    path: str
    found: bool = False
    content: str | None = None
    bytes: int = 0
    error: str | None = None


class FsFileInfo(BaseModel):
    path: str
    bytes: int


class FsLsInput(BaseModel):
    prefix: str | None = None


class FsLsOutput(BaseModel):
    ok: bool
    files: list[FsFileInfo] = Field(default_factory=list)
    error: str | None = None


class FsEditInput(BaseModel):
    path: str
    old_string: str
    new_string: str
    replace_all: bool = False


class FsEditOutput(BaseModel):
    ok: bool
    path: str
    bytes: int = 0
    replacements: int = 0
    error: str | None = None


async def _allow(_: HarnessContext, __: BaseModel) -> PermissionResult:
    return PermissionResult.allow("Virtual scratchpad — sandboxed, no real disk.")


def _error_text(exc: FileStoreError) -> str:
    return f"{exc.code}: {exc.message}"


# --- Tool factories ------------------------------------------------------


def fs_write_tool(store: VirtualFileStore) -> HarnessTool[FsWriteInput, FsWriteOutput]:
    async def call(ctx: HarnessContext, value: FsWriteInput, _: Progress) -> FsWriteOutput:
        try:
            res = store.write(_conv_key(ctx), value.path, value.content)
        except FileStoreError as exc:
            return FsWriteOutput(ok=False, path=value.path, error=_error_text(exc))
        return FsWriteOutput(ok=True, path=res.path, bytes=res.bytes, created=res.created)

    return HarnessTool(
        name="fs_write",
        description=(
            "Write a note/plan/intermediate finding to a file in your private "
            "scratchpad (create or overwrite). Use it to keep working memory "
            "out of the prompt across turns."
        ),
        input_model=FsWriteInput,
        output_model=FsWriteOutput,
        read_only=False,
        destructive=False,
        source="scratchpad",
        check_permission=_allow,
        call=call,
    )


def fs_read_tool(store: VirtualFileStore) -> HarnessTool[FsReadInput, FsReadOutput]:
    async def call(ctx: HarnessContext, value: FsReadInput, _: Progress) -> FsReadOutput:
        try:
            content = store.read(_conv_key(ctx), value.path)
        except FileStoreError as exc:
            return FsReadOutput(ok=False, path=value.path, error=_error_text(exc))
        if content is None:
            return FsReadOutput(ok=True, path=value.path, found=False)
        return FsReadOutput(
            ok=True,
            path=value.path,
            found=True,
            content=content,
            bytes=len(content.encode("utf-8")),
        )

    return HarnessTool(
        name="fs_read",
        description="Read a file back from your private scratchpad by path.",
        input_model=FsReadInput,
        output_model=FsReadOutput,
        read_only=True,
        source="scratchpad",
        check_permission=_allow,
        call=call,
    )


def fs_ls_tool(store: VirtualFileStore) -> HarnessTool[FsLsInput, FsLsOutput]:
    async def call(ctx: HarnessContext, value: FsLsInput, _: Progress) -> FsLsOutput:
        files = store.ls(_conv_key(ctx), value.prefix)
        return FsLsOutput(
            ok=True,
            files=[FsFileInfo(path=path, bytes=size) for path, size in files],
        )

    return HarnessTool(
        name="fs_ls",
        description="List the files currently in your private scratchpad (optionally by prefix).",
        input_model=FsLsInput,
        output_model=FsLsOutput,
        read_only=True,
        source="scratchpad",
        check_permission=_allow,
        call=call,
    )


def fs_edit_tool(store: VirtualFileStore) -> HarnessTool[FsEditInput, FsEditOutput]:
    async def call(ctx: HarnessContext, value: FsEditInput, _: Progress) -> FsEditOutput:
        try:
            res = store.edit(
                _conv_key(ctx),
                value.path,
                value.old_string,
                value.new_string,
                replace_all=value.replace_all,
            )
        except FileStoreError as exc:
            return FsEditOutput(ok=False, path=value.path, error=_error_text(exc))
        return FsEditOutput(ok=True, path=res.path, bytes=res.bytes, replacements=res.replacements)

    return HarnessTool(
        name="fs_edit",
        description=(
            "Edit a scratchpad file by exact string replacement. Fails if "
            "old_string is absent or non-unique (unless replace_all=true)."
        ),
        input_model=FsEditInput,
        output_model=FsEditOutput,
        read_only=False,
        destructive=False,
        source="scratchpad",
        check_permission=_allow,
        call=call,
    )


def build_filesystem_tools(store: VirtualFileStore) -> list[HarnessTool[Any, Any]]:
    """All four scratchpad tools, sharing one `VirtualFileStore`."""
    return [
        fs_write_tool(store),
        fs_read_tool(store),
        fs_ls_tool(store),
        fs_edit_tool(store),
    ]
