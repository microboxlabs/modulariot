"use client";
import { useMemo, useState } from "react";
import type {
  QueryColumn,
  SourceSchema,
  SourceTable,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import type { QueryWorkbenchLabels } from "./labels";

export interface SchemaExplorerProps {
  readonly schema: SourceSchema | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly labels: QueryWorkbenchLabels;
  readonly onInsert: (text: string) => void;
  readonly onRefresh: () => void;
}

const matches = (name: string, search: string) =>
  name.toLowerCase().includes(search);

function columnMatches(column: QueryColumn, search: string): boolean {
  return (
    matches(column.name, search) ||
    (column.fields ?? []).some((field) => columnMatches(field, search))
  );
}

function tableMatches(table: SourceTable, search: string) {
  return (
    !search ||
    matches(table.name, search) ||
    table.columns.some((column) => columnMatches(column, search))
  );
}

function ColumnItem({
  column,
  path,
  onInsert,
}: {
  readonly column: QueryColumn;
  readonly path: string;
  readonly onInsert: (text: string) => void;
}) {
  const name = path ? `${path}.${column.name}` : column.name;
  return (
    <li>
      <button
        type="button"
        className="miot-qw-tree__leaf"
        onClick={() => onInsert(name)}
      >
        <span>{column.name}</span>
        <span className="miot-qw-tree__type">
          {column.mode === "REPEATED" ? `ARRAY<${column.type}>` : column.type}
        </span>
      </button>
      {column.fields && column.fields.length > 0 && (
        <ul className="miot-qw-tree__children">
          {column.fields.map((field) => (
            <ColumnItem
              key={field.name}
              column={field}
              path={name}
              onInsert={onInsert}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Datasets › tables › columns. A click inserts the qualified name. */
export function SchemaExplorer({
  schema,
  loading,
  error,
  labels,
  onInsert,
  onRefresh,
}: SchemaExplorerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const needle = search.trim().toLowerCase();
  const datasets = useMemo(
    () =>
      (schema?.datasets ?? [])
        .map((dataset) => ({
          ...dataset,
          tables: dataset.tables.filter((table) => tableMatches(table, needle)),
        }))
        .filter(
          (dataset) =>
            !needle || matches(dataset.name, needle) || dataset.tables.length,
        ),
    [schema, needle],
  );
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const expanded = (key: string) => Boolean(needle) || open.has(key);

  return (
    <section className="miot-qw-panel" aria-label={labels.explorer}>
      <header className="miot-qw-panel__header">
        <h3>{labels.explorer}</h3>
        <button
          type="button"
          className="miot-qw-icon-button"
          aria-label={labels.refreshSchema}
          title={labels.refreshSchema}
          disabled={loading}
          onClick={onRefresh}
        >
          ↻
        </button>
      </header>
      <input
        type="search"
        className="miot-qw-input"
        placeholder={labels.search}
        aria-label={labels.search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {loading && <p className="miot-qw-muted">{labels.loadingSchema}</p>}
      {error && <p className="miot-qw-error">{error}</p>}
      {schema?.truncated && (
        <p className="miot-qw-muted">{labels.schemaTruncated}</p>
      )}
      <ul className="miot-qw-tree" title={labels.insertHint}>
        {datasets.map((dataset) => (
          <li key={dataset.name}>
            <div className="miot-qw-tree__node">
              <button
                type="button"
                className="miot-qw-tree__toggle"
                aria-expanded={expanded(dataset.name)}
                aria-label={`${labels.expand} ${dataset.name}`}
                onClick={() => toggle(dataset.name)}
              >
                {expanded(dataset.name) ? "▾" : "▸"}
              </button>
              <button
                type="button"
                className="miot-qw-tree__name"
                onClick={() => onInsert(`\`${dataset.name}\``)}
              >
                {dataset.name}
              </button>
            </div>
            {expanded(dataset.name) && (
              <ul className="miot-qw-tree__children">
                {dataset.tables.length === 0 && (
                  <li className="miot-qw-muted">{labels.emptyDataset}</li>
                )}
                {dataset.tables.map((table) => {
                  const key = `${dataset.name}.${table.name}`;
                  return (
                    <li key={table.name}>
                      <div className="miot-qw-tree__node">
                        <button
                          type="button"
                          className="miot-qw-tree__toggle"
                          aria-expanded={expanded(key)}
                          aria-label={`${labels.expand} ${key}`}
                          onClick={() => toggle(key)}
                        >
                          {expanded(key) ? "▾" : "▸"}
                        </button>
                        <button
                          type="button"
                          className="miot-qw-tree__name"
                          onClick={() => onInsert(`\`${key}\``)}
                        >
                          {table.name}
                          {table.type !== "TABLE" && (
                            <span className="miot-qw-tree__type">
                              {table.type}
                            </span>
                          )}
                        </button>
                      </div>
                      {expanded(key) && (
                        <ul className="miot-qw-tree__children">
                          {table.columns.map((column) => (
                            <ColumnItem
                              key={column.name}
                              column={column}
                              path=""
                              onInsert={onInsert}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
