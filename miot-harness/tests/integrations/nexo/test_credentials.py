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
