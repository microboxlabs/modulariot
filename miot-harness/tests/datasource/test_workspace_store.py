from pathlib import Path

import pytest

from miot_harness.datasource import workspace_store as ws


def test_a_note_round_trips_with_its_provenance(tmp_path: Path) -> None:
    ws.write_note(
        tmp_path,
        "tenant-a",
        title="Horas de conducción",
        body="Minutos en movimiento del GPS / 60, sumando todos los tractos.",
        kind="definition",
        author="ana@example.com",
        conversation_id="c1",
    )
    [note] = ws.list_notes(tmp_path, "tenant-a")
    assert (note.id, note.kind) == ("horas-de-conducci-n", "definition")
    assert note.meta["author"] == "ana@example.com"
    assert ws.read_note(tmp_path, "tenant-a", note.id).body.startswith("Minutos")


def test_notes_are_kept_per_tenant(tmp_path: Path) -> None:
    ws.write_note(tmp_path, "a", title="x", body="y", kind="fact", author="u", conversation_id=None)
    assert ws.list_notes(tmp_path, "b") == []


def test_a_note_with_row_level_data_is_refused(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="row-level value"):
        ws.write_note(
            tmp_path,
            "a",
            title="x",
            body="call ana@example.com",
            kind="fact",
            author="u",
            conversation_id=None,
        )


def test_rewriting_a_note_keeps_its_creation_date(tmp_path: Path) -> None:
    first = ws.write_note(
        tmp_path, "a", title="t", body="one", kind="fact", author="u", conversation_id=None
    )
    second = ws.write_note(
        tmp_path, "a", title="t", body="two", kind="fact", author="u", conversation_id=None
    )
    assert second.meta["created"] == first.meta["created"]
    assert second.body == "two"


SQL = (
    "SELECT carrier, count(*) AS n FROM ops.trips"
    " WHERE year = :year AND carrier ILIKE :who GROUP BY 1"
)
PARAMS = [
    {"name": "year", "type": "int", "default": 2026},
    {"name": "who", "type": "text", "default": "%"},
]


def test_binding_renders_typed_literals_and_escapes_text() -> None:
    sql = ws.bind(SQL, PARAMS, {"who": "O'Brien%"})
    assert "year = 2026" in sql
    assert "ILIKE 'O''Brien%'" in sql


def test_casts_are_not_placeholders() -> None:
    assert ws.bind(
        "SELECT x::text FROM t WHERE y = :v", [{"name": "v", "type": "int"}], {"v": 3}
    ) == ("SELECT x::text FROM t WHERE y = 3")


@pytest.mark.parametrize(
    ("kind", "value"),
    [
        ("int", "1; DROP TABLE x"),
        ("numeric", "1e9 OR 1=1"),
        ("date", "2026-13-01"),
        ("bool", "maybe"),
    ],
)
def test_a_value_that_does_not_match_its_type_is_refused(kind: str, value: str) -> None:
    with pytest.raises(ValueError, match="parameter v"):
        ws.bind("SELECT :v", [{"name": "v", "type": kind}], {"v": value})


def test_parameters_must_match_the_placeholders() -> None:
    with pytest.raises(ValueError, match="undeclared parameters: who"):
        ws.validate_params([PARAMS[0]], SQL)
    with pytest.raises(ValueError, match="not used in the SQL: extra"):
        ws.validate_params([*PARAMS, {"name": "extra", "type": "int"}], SQL)


def test_an_analysis_is_versioned_on_save(tmp_path: Path) -> None:
    for _ in range(2):
        saved = ws.save_analysis(
            tmp_path,
            "a",
            name="Trips by carrier",
            description="Trips per carrier in a year",
            sql=SQL + ";",
            params=PARAMS,
            author="u",
            conversation_id="c",
            columns=["carrier", "n"],
        )
    assert saved.name == "trips_by_carrier"
    assert saved.meta["version"] == 2
    assert saved.sql.endswith("GROUP BY 1")
    [listed] = ws.list_analyses(tmp_path, "a")
    assert listed.params == PARAMS
    assert ws.read_analysis(tmp_path, "a", "trips by carrier") is not None


def test_colons_in_strings_comments_and_dollar_quotes_are_not_parameters() -> None:
    sql = (
        "SELECT ':year' AS label, \"a:b\" AS q, $$ :x $$ AS body -- :note\n"
        "FROM t /* :old */ WHERE y = :year"
    )
    assert ws.placeholders(sql) == {"year"}
    bound = ws.bind(sql, [{"name": "year", "type": "int"}], {"year": 2026})
    assert bound.startswith("SELECT ':year' AS label")
    assert bound.endswith("WHERE y = 2026")
    assert "-- :note" in bound and "/* :old */" in bound and "$$ :x $$" in bound
