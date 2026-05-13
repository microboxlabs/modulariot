from __future__ import annotations

from pathlib import Path

import pytest

from miot_harness.integrations.nexo.credentials import (
    NexoCredentials,
    load_nexo_credentials,
)


def _write_env(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def test_load_credentials_happy_path(tmp_path: Path):
    alias = "coordinador-prod-harness"
    _write_env(
        tmp_path / "databases" / alias / ".env",
        "PGHOST=localhost\nPGPORT=6434\nPGDATABASE=citus\nPGUSER=harness\nPGPASSWORD=secret\n",
    )

    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)

    assert isinstance(creds, NexoCredentials)
    assert creds.host == "localhost"
    assert creds.port == 6434
    assert creds.database == "citus"
    assert creds.user == "harness"
    assert creds.password == "secret"


def test_dsn_url_encodes_password_special_chars(tmp_path: Path):
    alias = "x"
    _write_env(
        tmp_path / "databases" / alias / ".env",
        "PGHOST=h\nPGPORT=5432\nPGDATABASE=d\nPGUSER=u\nPGPASSWORD=p@ss/w:rd\n",
    )

    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    dsn = creds.dsn

    # asyncpg accepts URL-encoded passwords; raw special chars would be ambiguous
    assert "p%40ss%2Fw%3Ard" in dsn
    assert dsn.startswith("postgresql://u:")
    assert "@h:5432/d" in dsn


def test_missing_env_file_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        load_nexo_credentials(db_scripts_root=tmp_path, alias="missing-alias")


def test_missing_required_var_raises(tmp_path: Path):
    alias = "incomplete"
    _write_env(
        tmp_path / "databases" / alias / ".env",
        "PGHOST=localhost\nPGPORT=6434\nPGDATABASE=citus\nPGUSER=harness\n",  # no password
    )

    with pytest.raises(ValueError, match="PGPASSWORD"):
        load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)


def test_default_port_when_omitted(tmp_path: Path):
    alias = "no-port"
    _write_env(
        tmp_path / "databases" / alias / ".env",
        "PGHOST=h\nPGDATABASE=d\nPGUSER=u\nPGPASSWORD=p\n",
    )

    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.port == 5432


def test_ignores_blank_lines_and_comments(tmp_path: Path):
    alias = "with-comments"
    _write_env(
        tmp_path / "databases" / alias / ".env",
        "# header\nPGHOST=h\n\nPGPORT=5432\n# trailing\nPGDATABASE=d\nPGUSER=u\nPGPASSWORD=p\n",
    )

    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.host == "h"
    assert creds.user == "u"


# --- Quote-stripping cases (T02) -------------------------------------------
# Files written by shell-oriented tooling commonly wrap values in quotes.
# The parser must unwrap a single matching pair so the password reaches
# Postgres without literal quote characters (SASL auth otherwise fails).


def _base_env(extra_password_line: str) -> str:
    return (
        "PGHOST=h\nPGPORT=5432\nPGDATABASE=d\nPGUSER=u\n"
        f"{extra_password_line}\n"
    )


def test_unquoted_password_unchanged(tmp_path: Path):
    alias = "unquoted"
    _write_env(tmp_path / "databases" / alias / ".env", _base_env("PGPASSWORD=plain-secret"))
    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.password == "plain-secret"


def test_single_quoted_password_unwrapped(tmp_path: Path):
    alias = "single"
    _write_env(tmp_path / "databases" / alias / ".env", _base_env("PGPASSWORD='shell-style'"))
    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.password == "shell-style"


def test_double_quoted_password_unwrapped(tmp_path: Path):
    alias = "double"
    _write_env(tmp_path / "databases" / alias / ".env", _base_env('PGPASSWORD="dotenv-style"'))
    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.password == "dotenv-style"


def test_unbalanced_quote_preserved_verbatim(tmp_path: Path):
    """An opening quote without a matching close is preserved literally
    (no silent data loss) — the user's file is malformed and we surface
    the raw value rather than guessing intent."""
    alias = "unbalanced"
    _write_env(tmp_path / "databases" / alias / ".env", _base_env("PGPASSWORD='unbalanced"))
    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.password == "'unbalanced"


def test_embedded_equals_in_password(tmp_path: Path):
    """`partition('=')` splits at the first `=`, so a value containing
    `=` survives intact — important for tokens / API keys."""
    alias = "embedded-eq"
    _write_env(
        tmp_path / "databases" / alias / ".env", _base_env("PGPASSWORD=key=value=trailer")
    )
    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.password == "key=value=trailer"


def test_trailing_hash_not_stripped(tmp_path: Path):
    """Per the parser's contract (no shell expansion), a `#` after the
    value is part of the value. Comments must live on their own line.
    This documents that contract so future readers don't expect dotenv-
    style trailing-comment behavior."""
    alias = "trailing-hash"
    _write_env(
        tmp_path / "databases" / alias / ".env", _base_env("PGPASSWORD=value#nope")
    )
    creds = load_nexo_credentials(db_scripts_root=tmp_path, alias=alias)
    assert creds.password == "value#nope"
