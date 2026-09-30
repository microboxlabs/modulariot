"""Source tools against a local git repository (no network)."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from miot_harness.config import HarnessSettings, SourceRepo
from miot_harness.runtime.context import HarnessContext
from miot_harness.tools.registry import build_default_registry
from miot_harness.tools.source import (
    SourceError,
    SourceListInput,
    SourceReadInput,
    SourceRepos,
    SourceSearchInput,
    _web_url,
    build_source_tools,
    list_source,
    read_source,
    search_source,
)

_ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "t",
    "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "t",
    "GIT_COMMITTER_EMAIL": "t@example.com",
    "GIT_CONFIG_GLOBAL": os.devnull,
}


def _git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, env=_ENV, check=True, capture_output=True)


def _commit(origin: Path, files: dict[str, str | bytes], message: str) -> None:
    for name, content in files.items():
        path = origin / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content)
    _git(origin, "add", "-A")
    _git(origin, "commit", "-q", "-m", message)


@pytest.fixture
def origin(tmp_path: Path) -> Path:
    origin = tmp_path / "origin"
    origin.mkdir()
    _git(origin, "init", "-q", "-b", "trunk")
    _commit(
        origin,
        {
            "README.md": "# Product\n",
            "docs/en/eta.mdx": "# ETA\nThe ETA is computed from the route.\n",
            "src/eta.py": "".join(f"line {i}\n" for i in range(1, 11))
            + "def compute_eta(route):\n    return route.distance / route.speed\n",
            "assets/logo.png": b"\x89PNG\x00\x00binary",
        },
        "initial",
    )
    return origin


def _repos(origin: Path, workspace: Path, **kwargs: float) -> SourceRepos:
    repo = SourceRepo(name="product", url=origin.as_uri(), ref="trunk")
    return SourceRepos(
        [repo],
        workspace / "sources",
        refresh_seconds=kwargs.get("refresh_seconds", 3600),
        timeout_seconds=kwargs.get("timeout_seconds", 60),
    )


@pytest.mark.asyncio
async def test_first_use_clones_without_binaries_and_lists(origin: Path, tmp_path: Path) -> None:
    repos = _repos(origin, tmp_path / "ws")
    out = await list_source(repos, SourceListInput())
    assert out.entries == ["README.md", "docs/", "src/"]
    assert len(out.commit) == 12
    assert (tmp_path / "ws/sources/product/.git").is_dir()
    assert not (tmp_path / "ws/sources/product/assets/logo.png").exists()

    docs = await list_source(repos, SourceListInput(path="docs", glob="**/*.mdx"))
    assert docs.entries == ["docs/en/eta.mdx"]


@pytest.mark.asyncio
async def test_search_returns_paths_and_line_numbers(origin: Path, tmp_path: Path) -> None:
    repos = _repos(origin, tmp_path / "ws")
    out = await search_source(repos, SourceSearchInput(pattern=r"def compute_\w+"))
    assert [(m.path, m.line) for m in out.matches] == [("src/eta.py", 11)]
    assert out.matches[0].text == "def compute_eta(route):"

    scoped = await search_source(
        repos, SourceSearchInput(pattern="eta", ignore_case=True, path="docs")
    )
    assert {m.path for m in scoped.matches} == {"docs/en/eta.mdx"}

    none = await search_source(repos, SourceSearchInput(pattern="--no-such-thing"))
    assert none.matches == []

    capped = await search_source(repos, SourceSearchInput(pattern="^line", max_results=3))
    assert len(capped.matches) == 3
    assert capped.truncated


@pytest.mark.asyncio
async def test_read_returns_a_line_range(origin: Path, tmp_path: Path) -> None:
    repos = _repos(origin, tmp_path / "ws")
    out = await read_source(repos, SourceReadInput(path="src/eta.py", start_line=11, line_count=2))
    assert out.text == "def compute_eta(route):\n    return route.distance / route.speed"
    assert (out.start_line, out.end_line, out.total_lines) == (11, 12, 12)
    assert not out.truncated
    assert out.url is None

    head = await read_source(repos, SourceReadInput(path="src/eta.py", line_count=3))
    assert head.text == "line 1\nline 2\nline 3"
    assert head.truncated


@pytest.mark.parametrize(
    "path", ["../origin/README.md", "/etc/passwd", ".git/config", "src/../../x", "~/x"]
)
@pytest.mark.asyncio
async def test_paths_outside_the_repository_are_refused(
    origin: Path, tmp_path: Path, path: str
) -> None:
    repos = _repos(origin, tmp_path / "ws")
    value = SourceReadInput(path=path)
    with pytest.raises(SourceError):
        await read_source(repos, value)


@pytest.mark.asyncio
async def test_a_symlink_out_of_the_repository_is_refused(origin: Path, tmp_path: Path) -> None:
    secret = tmp_path / "secret.txt"
    secret.write_text("secret")
    (origin / "leak").symlink_to(secret)
    _git(origin, "add", "leak")
    _git(origin, "commit", "-q", "-m", "link")
    repos = _repos(origin, tmp_path / "ws")
    leak = SourceReadInput(path="leak")
    with pytest.raises(SourceError, match="leaves the repository"):
        await read_source(repos, leak)
    parent = SourceListInput(path="docs", glob="../*")
    with pytest.raises(SourceError, match="not allowed"):
        await list_source(repos, parent)
    listed = await list_source(repos, SourceListInput(glob="*"))
    assert "leak" not in listed.entries
    assert "README.md" in listed.entries


@pytest.mark.asyncio
async def test_a_file_past_the_size_cap_is_not_read(
    origin: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("miot_harness.tools.source._MAX_FILE_BYTES", 10)
    repos = _repos(origin, tmp_path / "ws")
    value = SourceReadInput(path="src/eta.py")
    with pytest.raises(SourceError, match="too large"):
        await read_source(repos, value)


@pytest.mark.asyncio
async def test_a_failed_clone_says_so_and_leaves_nothing(tmp_path: Path) -> None:
    repos = _repos(tmp_path / "missing", tmp_path / "ws")
    value = SourceSearchInput(pattern="x")
    with pytest.raises(SourceError, match="could not get repository 'product'"):
        await search_source(repos, value)
    assert not (tmp_path / "ws/sources/product").exists()


@pytest.mark.asyncio
async def test_an_old_copy_is_fetched_again(origin: Path, tmp_path: Path) -> None:
    repos = _repos(origin, tmp_path / "ws", refresh_seconds=0.0)
    assert (await search_source(repos, SourceSearchInput(pattern="arrival"))).matches == []
    _commit(origin, {"src/arrival.py": "ARRIVAL = 1\n"}, "second")
    out = await search_source(repos, SourceSearchInput(pattern="arrival", ignore_case=True))
    assert [m.path for m in out.matches] == ["src/arrival.py"]


@pytest.mark.asyncio
async def test_tools_run_through_invoke(origin: Path, tmp_path: Path) -> None:
    tools = {t.name: t for t in build_source_tools(_repos(origin, tmp_path / "ws"))}
    ctx = HarnessContext(thread_id="t", tenant_id="acme", user_id="u1")
    out = await tools["source_search"].invoke(ctx, {"pattern": "compute_eta"}, lambda _: None)
    assert out.matches[0].path == "src/eta.py"
    with pytest.raises(SourceError, match="unknown repository"):
        await tools["source_read"].invoke(ctx, {"repo": "other", "path": "x"}, lambda _: None)


def test_github_links_point_at_the_ref_and_lines() -> None:
    repo = SourceRepo(name="p", url="https://github.com/acme/product.git", ref="trunk")
    assert _web_url(repo, "src/a.py", (3, 9)) == (
        "https://github.com/acme/product/blob/trunk/src/a.py#L3-L9"
    )
    assert _web_url(SourceRepo(name="p", url="https://git.example/p.git"), "a") is None


def test_source_tools_are_registered_by_default_and_can_be_turned_off() -> None:
    names = build_default_registry().names()
    assert {"source_list", "source_search", "source_read"} <= set(names)
    off = build_default_registry(HarnessSettings(source_enabled=False)).names()
    assert "source_search" not in off
