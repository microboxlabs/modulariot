"""Connections subsystem.

A *connection* is a named binding to one datasource, authored as content in
`.miot-workspace` (a `connection.md` file) exactly like skills and context —
not as a code change or a separate ConfigMap. The file is both machine config
(YAML frontmatter) and the connection's agent-facing primer (Markdown body).

Phase 0 (connection abstraction): this package introduces the `Connection`
model and a file-backed source/loader. The lifespan iterates the loaded
connections and boots each one's `DataSourceProvider`. With a single connection
(the default `nexo`) behaviour is identical to the previous single-datasource
boot. See `.cursor/plans/ai-first/14-generic-data-access/`.
"""
