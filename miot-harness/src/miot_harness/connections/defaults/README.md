# Packaged connections defaults

This directory intentionally ships **no** connection definitions.

Connections are operator-authored and supplied at deploy time via
`MIOT_HARNESS_CONNECTIONS_DIR` (e.g. a mounted ConfigMap), each as a
`<name>/connection.md`. No client- or tenant-specific configuration is baked
into the published image/wheel.

When no connection files are discovered (this default dir, or an operator dir
with none), the loader falls back to **synthesizing a single connection from the
legacy `MIOT_HARNESS_DATASOURCE_*` env** (see `connections/loader.py`), so
existing single-datasource deployments keep working with zero authored files.

This file's only purpose is to keep the directory present in the package so the
loader sees an existing-but-empty dir (no "dir does not exist" boot warning). It
is not a connection file (the loader only reads `connection.md`).
