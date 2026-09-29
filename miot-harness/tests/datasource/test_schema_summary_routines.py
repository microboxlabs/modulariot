from miot_harness.datasource.schema_introspect import SchemaSummary


def test_render_mentions_functions_only_when_surveyed() -> None:
    base = SchemaSummary(connection="gps", schemas=("public",), tables=(), total_tables=0)
    assert "functions" not in base.render()
    with_fns = SchemaSummary(
        connection="gps", schemas=("public",), tables=(), total_tables=0, routine_count=191
    )
    text = with_fns.render()
    assert "191 callable" in text and "gps_functions" in text and "gps_definition" in text
