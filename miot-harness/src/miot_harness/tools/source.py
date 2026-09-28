"""`source_list`, `source_search`, `source_read`: read configured git repositories.

Each repository is cloned shallow on first use into
`<workspace_dir>/sources/<name>` without its binary files, and fetched again
when the copy is older than the refresh interval. git runs with a fixed
argument list (never a shell) and a timeout. Paths are relative to the
repository root; a path that leaves the root, directly or through a
symlink, or that points into `.git`, is refused.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import time
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from miot_harness.config import HarnessSettings, SourceRepo
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

logger = logging.getLogger(__name__)

# Files never checked out: binaries nobody reads as text.
_SPARSE = (
    "/*",
    "!*.png",
    "!*.jpg",
    "!*.jpeg",
    "!*.gif",
    "!*.webp",
    "!*.ico",
    "!*.pdf",
    "!*.mp4",
    "!*.woff",
    "!*.woff2",
    "!*.ttf",
    "!*.tgz",
    "!*.zip",
    "!*.jar",
    "!*.node",
    "!*.so",
    "!*.dylib",
)
_MAX_GREP_OUTPUT = 2_000_000
_MAX_LINE_CHARS = 300
_LIST_LIMIT = 300
_GITHUB = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


class SourceError(Exception):
    pass


class _GitError(SourceError):
    pass


class SourceRepos:
    """The configured repositories and their local clones."""

    def __init__(
        self,
        repos: list[SourceRepo],
        root: Path,
        *,
        refresh_seconds: float,
        timeout_seconds: float,
    ) -> None:
        self._repos = {repo.name: repo for repo in repos}
        self._root = root
        self._refresh_seconds = refresh_seconds
        self._timeout = timeout_seconds
        self._locks: dict[str, asyncio.Lock] = {}

    def available(self) -> bool:
        return bool(self._repos) and shutil.which("git") is not None

    def names(self) -> list[str]:
        return list(self._repos)

    def repo(self, name: str | None) -> SourceRepo:
        if not name:
            return next(iter(self._repos.values()))
        if name not in self._repos:
            raise SourceError(f"unknown repository {name!r}; configured: {', '.join(self._repos)}")
        return self._repos[name]

    async def checkout(self, repo: SourceRepo) -> Path:
        """The clone's root, cloned or refreshed first when needed."""
        lock = self._locks.setdefault(repo.name, asyncio.Lock())
        async with lock:
            path = self._root / repo.name
            stamp = self._root / f"{repo.name}.fetched"
            if not (path / ".git").is_dir():
                await self._clone(repo, path)
                stamp.touch()
            elif not stamp.exists() or time.time() - stamp.stat().st_mtime > self._refresh_seconds:
                try:
                    await self._refresh(repo, path)
                except SourceError as exc:
                    logger.warning(
                        "source %s: refresh failed, using the old copy: %s", repo.name, exc
                    )
                stamp.touch()
            return path

    async def commit(self, path: Path) -> str:
        return (await self.git(path, "rev-parse", "--short=12", "HEAD")).strip()

    async def _clone(self, repo: SourceRepo, path: Path) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        partial = self._root / f".{repo.name}.partial"
        shutil.rmtree(partial, ignore_errors=True)
        try:
            await self.git(
                self._root,
                "clone",
                "--quiet",
                "--depth=1",
                "--filter=blob:none",
                "--no-checkout",
                "--single-branch",
                f"--branch={repo.ref}",
                "--",
                repo.url,
                str(partial),
            )
            await self.git(partial, "sparse-checkout", "set", "--no-cone", "--", *_SPARSE)
            await self.git(partial, "checkout", "--quiet")
        except SourceError as exc:
            shutil.rmtree(partial, ignore_errors=True)
            raise SourceError(f"could not get repository {repo.name!r}: {exc}") from exc
        shutil.rmtree(path, ignore_errors=True)
        partial.rename(path)

    async def _refresh(self, repo: SourceRepo, path: Path) -> None:
        await self.git(
            path, "fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", repo.ref
        )
        await self.git(path, "reset", "--quiet", "--hard", "FETCH_HEAD")

    async def git(self, cwd: Path, *args: str, ok_codes: tuple[int, ...] = (0,)) -> str:
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(self._root),
            "LC_ALL": "C",
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
        }
        process = await asyncio.create_subprocess_exec(
            "git",
            *args,
            cwd=cwd,
            env=env,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), self._timeout)
        except TimeoutError as exc:
            process.kill()
            await process.wait()
            raise _GitError(f"git {args[0]} timed out after {self._timeout:.0f}s") from exc
        if process.returncode not in ok_codes:
            message = stderr.decode(errors="replace").strip().splitlines()
            raise _GitError(message[-1] if message else f"git {args[0]} failed")
        return stdout[:_MAX_GREP_OUTPUT].decode(errors="replace")


def _relative(path: str) -> str:
    """A clean relative path, or a SourceError."""
    cleaned = path.strip().strip("/") or "."
    parts = [p for p in cleaned.split("/") if p not in ("", ".")]
    if cleaned.startswith(("~", ":")) or ".." in parts or (parts and parts[0] == ".git"):
        raise SourceError(
            f"path {path!r} is not allowed: use a path relative to the repository root"
        )
    return "/".join(parts)


def _inside(root: Path, relative: str) -> Path:
    target = (root / relative).resolve()
    real_root = root.resolve()
    if target != real_root and real_root not in target.parents:
        raise SourceError(f"path {relative!r} leaves the repository")
    if real_root / ".git" in (target, *target.parents):
        raise SourceError(f"path {relative!r} is not allowed")
    return target


def _pathspec(path: str, glob: str | None) -> str:
    relative = _relative(path)
    if glob:
        pattern = _relative(glob)
        relative = pattern if relative == "" else f"{relative}/{pattern}"
    return f":(glob){relative}" if relative else "."


def _web_url(repo: SourceRepo, path: str, lines: tuple[int, int] | None = None) -> str | None:
    match = _GITHUB.match(repo.url)
    if match is None:
        return None
    anchor = f"#L{lines[0]}-L{lines[1]}" if lines else ""
    return f"https://github.com/{match[1]}/{match[2]}/blob/{repo.ref}/{path}{anchor}"


_REPO_HELP = "Repository name; empty for the first one."


class SourceListInput(BaseModel):
    repo: str | None = Field(default=None, description=_REPO_HELP)
    path: str = Field(default="", description="Directory relative to the repository root.")
    glob: str | None = Field(
        default=None,
        description=(
            "Optional file pattern under `path`, e.g. `**/*.mdx`. With it the result "
            "is every matching file path; without it, the directory's entries."
        ),
    )


class SourceListOutput(BaseModel):
    repo: str
    commit: str
    path: str
    entries: list[str]
    truncated: bool = False


class SourceSearchInput(BaseModel):
    repo: str | None = Field(default=None, description=_REPO_HELP)
    pattern: str = Field(min_length=1, max_length=300, description="Perl-style regular expression.")
    path: str = Field(default="", description="Directory to search, relative to the root.")
    glob: str | None = Field(
        default=None, description="Optional file pattern under `path`, e.g. `**/*.java`."
    )
    ignore_case: bool = False
    max_results: int = Field(default=50, ge=1, le=200)


class SourceMatch(BaseModel):
    path: str
    line: int
    text: str


class SourceSearchOutput(BaseModel):
    repo: str
    commit: str
    matches: list[SourceMatch]
    truncated: bool = False


class SourceReadInput(BaseModel):
    repo: str | None = Field(default=None, description=_REPO_HELP)
    path: str = Field(min_length=1, description="File path relative to the repository root.")
    start_line: int = Field(default=1, ge=1)
    line_count: int = Field(default=200, ge=1, le=1_000)
    max_bytes: int = Field(default=40_000, ge=1_000, le=100_000)


class SourceReadOutput(BaseModel):
    repo: str
    commit: str
    path: str
    start_line: int
    end_line: int
    total_lines: int
    text: str
    truncated: bool = False
    url: str | None = None


async def list_source(repos: SourceRepos, value: SourceListInput) -> SourceListOutput:
    repo = repos.repo(value.repo)
    relative = _relative(value.path)
    pathspec = _pathspec(value.path, value.glob)
    root = await repos.checkout(repo)
    if value.glob:
        out = await repos.git(root, "ls-files", "-z", "--", pathspec)
        entries = sorted(f for f in out.split("\0") if f and (root / f).is_file())
    else:
        directory = _inside(root, relative)
        if not directory.is_dir():
            raise SourceError(f"{relative or '.'} is not a directory")
        entries = sorted(
            f"{e.name}/" if e.is_dir(follow_symlinks=False) else e.name
            for e in os.scandir(directory)
            if e.name != ".git"
        )
    return SourceListOutput(
        repo=repo.name,
        commit=await repos.commit(root),
        path=relative,
        entries=entries[:_LIST_LIMIT],
        truncated=len(entries) > _LIST_LIMIT,
    )


async def search_source(repos: SourceRepos, value: SourceSearchInput) -> SourceSearchOutput:
    repo = repos.repo(value.repo)
    pathspec = _pathspec(value.path, value.glob)
    root = await repos.checkout(repo)
    flags = ["-i"] if value.ignore_case else []
    try:
        out = await _grep(repos, root, "-P", flags, value.pattern, pathspec)
    except SourceError as exc:
        if "perl" not in str(exc).lower():
            raise SourceError(f"search failed: {exc}") from exc
        out = await _grep(repos, root, "-E", flags, value.pattern, pathspec)
    matches: list[SourceMatch] = []
    lines = out.splitlines()
    for line in lines[: value.max_results]:
        path, _, rest = line.partition("\0")
        number, _, text = rest.partition("\0")
        if number.isdigit():
            matches.append(SourceMatch(path=path, line=int(number), text=text[:_MAX_LINE_CHARS]))
    return SourceSearchOutput(
        repo=repo.name,
        commit=await repos.commit(root),
        matches=matches,
        truncated=len(lines) > value.max_results,
    )


async def _grep(
    repos: SourceRepos, root: Path, syntax: str, flags: list[str], pattern: str, pathspec: str
) -> str:
    return await repos.git(
        root,
        "grep",
        "-n",
        "-I",
        "-z",
        "--no-color",
        syntax,
        *flags,
        "-e",
        pattern,
        "--",
        pathspec,
        ok_codes=(0, 1),
    )


async def read_source(repos: SourceRepos, value: SourceReadInput) -> SourceReadOutput:
    repo = repos.repo(value.repo)
    relative = _relative(value.path)
    root = await repos.checkout(repo)
    target = _inside(root, relative)
    if not target.is_file():
        raise SourceError(f"{relative} is not a file in {repo.name}")
    raw = target.read_bytes()
    if b"\0" in raw[:8_192]:
        raise SourceError(f"{relative} is a binary file")
    all_lines = raw.decode(errors="replace").splitlines()
    start = value.start_line
    picked = all_lines[start - 1 : start - 1 + value.line_count]
    text = "\n".join(picked)
    truncated = start - 1 + len(picked) < len(all_lines)
    if len(text.encode()) > value.max_bytes:
        text = text.encode()[: value.max_bytes].decode(errors="ignore")
        picked = text.splitlines()
        truncated = True
    end = start + len(picked) - 1 if picked else start - 1
    return SourceReadOutput(
        repo=repo.name,
        commit=await repos.commit(root),
        path=relative,
        start_line=start,
        end_line=end,
        total_lines=len(all_lines),
        text=text,
        truncated=truncated,
        url=_web_url(repo, relative, (start, end) if picked else None),
    )


# HarnessTool.check_permission must return an awaitable.
async def _allow(_: HarnessContext, __: BaseModel) -> PermissionResult:  # NOSONAR
    return PermissionResult.allow("Reads configured source repositories.")


def build_source_tools(repos: SourceRepos) -> list[HarnessTool[Any, Any]]:
    names = ", ".join(repos.names())
    about = (
        f"Repositories: {names}. The first call may take a minute while the "
        "repository is downloaded."
    )

    async def call_list(ctx: HarnessContext, value: SourceListInput, _: Progress) -> Any:
        return await list_source(repos, value)

    async def call_search(ctx: HarnessContext, value: SourceSearchInput, _: Progress) -> Any:
        return await search_source(repos, value)

    async def call_read(ctx: HarnessContext, value: SourceReadInput, _: Progress) -> Any:
        return await read_source(repos, value)

    common: dict[str, Any] = {
        "read_only": True,
        "kind": "utility",
        "source": "source",
        "check_permission": _allow,
        "available": repos.available,
    }
    return [
        HarnessTool(
            name="source_list",
            description=(
                "List a directory of the product's source code and documentation, or "
                f"every file matching a glob. {about}"
            ),
            input_model=SourceListInput,
            output_model=SourceListOutput,
            call=call_list,
            **common,
        ),
        HarnessTool(
            name="source_search",
            description=(
                "Search the product's source code and documentation with a regular "
                "expression (git grep). Returns file paths, line numbers and the "
                "matching lines. Use it to find where something is defined, computed "
                f"or documented, then source_read the file. {about}"
            ),
            input_model=SourceSearchInput,
            output_model=SourceSearchOutput,
            call=call_search,
            **common,
        ),
        HarnessTool(
            name="source_read",
            description=(
                "Read lines of a file from the product's source code or documentation. "
                "Returns the text, the line range and, when the repository is public "
                f"on GitHub, a link to cite. {about}"
            ),
            input_model=SourceReadInput,
            output_model=SourceReadOutput,
            call=call_read,
            **common,
        ),
    ]


def source_repos(settings: HarnessSettings) -> SourceRepos:
    return SourceRepos(
        settings.source_repos,
        Path(settings.workspace_dir) / "sources",
        refresh_seconds=settings.source_refresh_hours * 3600,
        timeout_seconds=settings.source_git_timeout_seconds,
    )
