"""Parse db-scripts `.env` files into asyncpg-ready credentials.

Each `databases/<alias>/.env` is a flat KEY=VALUE file (no shell
expansion). We read PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD and
assemble a URL-encoded DSN suitable for `asyncpg.create_pool(dsn=...)`.

Values may be optionally wrapped in a single matching pair of ASCII
quotes (`'...'` or `"..."`) — both styles are accepted and unwrapped.
Files written by shell-oriented tooling commonly quote values that
contain shell metacharacters; without unwrapping, the literal quotes
were sent to Postgres and produced SASL auth failures.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote


@dataclass(frozen=True)
class NexoCredentials:
    host: str
    port: int
    database: str
    user: str
    password: str

    @property
    def dsn(self) -> str:
        u = quote(self.user, safe="")
        p = quote(self.password, safe="")
        return f"postgresql://{u}:{p}@{self.host}:{self.port}/{self.database}"


_REQUIRED = ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD")


def _strip_matching_quotes(value: str) -> str:
    """Strip a single matching pair of surrounding ASCII quotes.

    Examples::

        "abc"        -> abc
        'abc'        -> abc
        "ab'cd"      -> ab'cd      (inner quote preserved)
        'abc         -> 'abc       (unbalanced, preserved verbatim)
        abc"         -> abc"       (unbalanced, preserved verbatim)
        ""           -> ""         (empty, preserved)
        "            -> "          (single char, preserved)
    """
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = _strip_matching_quotes(value.strip())
    return out


def load_nexo_credentials(*, db_scripts_root: Path, alias: str) -> NexoCredentials:
    env_path = Path(db_scripts_root) / "databases" / alias / ".env"
    if not env_path.is_file():
        raise FileNotFoundError(
            f"Nexo credentials file not found: {env_path}. "
            "Run `db-scripts/bin/setup-database.sh <alias>` or copy the .env.example."
        )

    parsed = _parse_env_file(env_path)
    missing = [key for key in _REQUIRED if not parsed.get(key)]
    if missing:
        raise ValueError(
            f"Nexo credentials at {env_path} missing required vars: {', '.join(missing)}"
        )

    return NexoCredentials(
        host=parsed["PGHOST"],
        port=int(parsed.get("PGPORT", "5432")),
        database=parsed["PGDATABASE"],
        user=parsed["PGUSER"],
        password=parsed["PGPASSWORD"],
    )
