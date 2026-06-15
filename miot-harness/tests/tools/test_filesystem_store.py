from __future__ import annotations

import pytest

from miot_harness.tools.filesystem import FileStoreError, VirtualFileStore

CONV = "conv-1"
OTHER = "conv-2"


def test_write_then_read_round_trip() -> None:
    store = VirtualFileStore()
    res = store.write(CONV, "notes.md", "hello")
    assert res.path == "notes.md"
    assert res.bytes == 5
    assert res.created is True
    assert store.read(CONV, "notes.md") == "hello"


def test_overwrite_reports_not_created() -> None:
    store = VirtualFileStore()
    store.write(CONV, "a.txt", "one")
    res = store.write(CONV, "a.txt", "two-longer")
    assert res.created is False
    assert store.read(CONV, "a.txt") == "two-longer"


def test_read_missing_returns_none() -> None:
    store = VirtualFileStore()
    assert store.read(CONV, "nope.txt") is None


def test_ls_returns_only_this_conversation_sorted() -> None:
    store = VirtualFileStore()
    store.write(CONV, "b.txt", "b")
    store.write(CONV, "a.txt", "aa")
    store.write(OTHER, "secret.txt", "x")
    listing = store.ls(CONV)
    assert listing == [("a.txt", 2), ("b.txt", 1)]


def test_ls_prefix_filter() -> None:
    store = VirtualFileStore()
    store.write(CONV, "plans/p1.md", "1")
    store.write(CONV, "plans/p2.md", "2")
    store.write(CONV, "notes.md", "3")
    assert [p for p, _ in store.ls(CONV, prefix="plans/")] == ["plans/p1.md", "plans/p2.md"]


def test_cross_conversation_isolation() -> None:
    store = VirtualFileStore()
    store.write(CONV, "f.txt", "mine")
    assert store.read(OTHER, "f.txt") is None
    assert store.ls(OTHER) == []


def test_edit_single_occurrence() -> None:
    store = VirtualFileStore()
    store.write(CONV, "f.txt", "the quick brown fox")
    res = store.edit(CONV, "f.txt", "quick", "slow")
    assert res.replacements == 1
    assert store.read(CONV, "f.txt") == "the slow brown fox"


def test_edit_replace_all() -> None:
    store = VirtualFileStore()
    store.write(CONV, "f.txt", "a a a")
    res = store.edit(CONV, "f.txt", "a", "b", replace_all=True)
    assert res.replacements == 3
    assert store.read(CONV, "f.txt") == "b b b"


def test_edit_not_unique_without_replace_all() -> None:
    store = VirtualFileStore()
    store.write(CONV, "f.txt", "x x")
    with pytest.raises(FileStoreError) as exc:
        store.edit(CONV, "f.txt", "x", "y")
    assert exc.value.code == "not_unique"


def test_edit_missing_file() -> None:
    store = VirtualFileStore()
    with pytest.raises(FileStoreError) as exc:
        store.edit(CONV, "ghost.txt", "a", "b")
    assert exc.value.code == "not_found"


def test_edit_absent_old_string() -> None:
    store = VirtualFileStore()
    store.write(CONV, "f.txt", "hello")
    with pytest.raises(FileStoreError) as exc:
        store.edit(CONV, "f.txt", "zzz", "y")
    assert exc.value.code == "not_found"


def test_edit_empty_old_string_rejected() -> None:
    store = VirtualFileStore()
    store.write(CONV, "f.txt", "hello")
    with pytest.raises(FileStoreError) as exc:
        store.edit(CONV, "f.txt", "", "y")
    assert exc.value.code == "invalid_edit"


@pytest.mark.parametrize("bad", ["/abs/path", "../escape", "a/../b", "", "   ", "/"])
def test_path_normalization_rejects_unsafe(bad: str) -> None:
    store = VirtualFileStore()
    with pytest.raises(FileStoreError) as exc:
        store.write(CONV, bad, "x")
    assert exc.value.code == "invalid_path"


def test_path_normalization_strips_redundant_segments() -> None:
    store = VirtualFileStore()
    store.write(CONV, "./dir//file.txt", "x")
    assert store.read(CONV, "dir/file.txt") == "x"


def test_per_file_byte_cap() -> None:
    store = VirtualFileStore(max_file_bytes=4)
    with pytest.raises(FileStoreError) as exc:
        store.write(CONV, "f.txt", "12345")
    assert exc.value.code == "file_too_large"


def test_total_byte_cap() -> None:
    store = VirtualFileStore(max_total_bytes=6)
    store.write(CONV, "a.txt", "abc")
    with pytest.raises(FileStoreError) as exc:
        store.write(CONV, "b.txt", "defg")
    assert exc.value.code == "workspace_full"


def test_overwrite_counts_against_total_minus_existing() -> None:
    # Existing file's bytes are reclaimed when overwriting, so an
    # overwrite that fits within the cap is allowed.
    store = VirtualFileStore(max_total_bytes=5)
    store.write(CONV, "a.txt", "abcde")
    res = store.write(CONV, "a.txt", "xy")
    assert res.bytes == 2


def test_max_files_cap() -> None:
    store = VirtualFileStore(max_files=2)
    store.write(CONV, "a", "1")
    store.write(CONV, "b", "2")
    with pytest.raises(FileStoreError) as exc:
        store.write(CONV, "c", "3")
    assert exc.value.code == "too_many_files"


def test_edit_total_cap_enforced() -> None:
    store = VirtualFileStore(max_total_bytes=5)
    store.write(CONV, "a.txt", "abcde")
    with pytest.raises(FileStoreError) as exc:
        store.edit(CONV, "a.txt", "abcde", "abcdefgh")
    assert exc.value.code == "workspace_full"


def test_global_conversation_lru_eviction() -> None:
    store = VirtualFileStore(max_conversations=2)
    store.write("c1", "f", "1")
    store.write("c2", "f", "2")
    store.write("c3", "f", "3")  # exceeds cap → evicts c1 (least recently used)
    assert store.read("c1", "f") is None
    assert store.read("c2", "f") == "2"
    assert store.read("c3", "f") == "3"


def test_access_marks_conversation_most_recently_used() -> None:
    store = VirtualFileStore(max_conversations=2)
    store.write("c1", "f", "1")
    store.write("c2", "f", "2")
    # Touch c1 so c2 becomes the LRU victim instead.
    assert store.read("c1", "f") == "1"
    store.write("c3", "f", "3")
    assert store.read("c2", "f") is None
    assert store.read("c1", "f") == "1"
    assert store.read("c3", "f") == "3"


def test_failed_write_does_not_evict_or_create_bucket() -> None:
    # A write that violates a per-conversation cap must not evict an existing
    # conversation or leave behind an empty bucket for the failed one.
    store = VirtualFileStore(max_conversations=1, max_file_bytes=2)
    store.write("c1", "f", "ok")
    with pytest.raises(FileStoreError) as exc:
        store.write("c2", "f", "toolong")
    assert exc.value.code == "file_too_large"
    assert store.read("c1", "f") == "ok"  # c1 not evicted
    assert store.ls("c2") == []  # c2 never materialized
