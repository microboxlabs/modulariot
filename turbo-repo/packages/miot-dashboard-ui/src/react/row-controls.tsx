"use client";
import { useId } from "react";
export interface FilterPillRowProps {
  item: Readonly<{ column: string; label: string }>;
  options: readonly string[];
  selected: string;
  allLabel: string;
  onClear: (column: string) => void;
  onSelect: (column: string, value: string) => void;
  disabled?: boolean;
}
/** Controlled, instance-scoped filter choices; data and permissions remain host-owned. */
export function FilterPillRow({
  item,
  options,
  selected,
  allLabel,
  onClear,
  onSelect,
  disabled = false,
}: Readonly<FilterPillRowProps>) {
  const labelId = useId();
  return (
    <div className="miot-row-controls" role="group" aria-labelledby={labelId}>
      <span id={labelId}>{item.label}</span>
      <button
        type="button"
        className="miot-row-controls__pill no-drag"
        aria-pressed={selected === ""}
        disabled={disabled}
        onClick={() => onClear(item.column)}
      >
        {allLabel}
      </button>
      {[...new Set(options)].filter(Boolean).map((value) => (
        <button
          key={value}
          type="button"
          className="miot-row-controls__pill no-drag"
          aria-pressed={selected === value}
          disabled={disabled}
          onClick={() => onSelect(item.column, value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
export interface SortPillRowProps {
  label: string;
  columns: readonly string[];
  sortKey: string | null;
  sortDir: "asc" | "desc";
  directionLabels: Readonly<{ asc: string; desc: string }>;
  getColumnLabel: (key: string) => string;
  onSortClick: (key: string) => void;
  disabled?: boolean;
}
/** Sort state is controlled by the host; direction is included in the active button name. */
export function SortPillRow({
  label,
  columns,
  sortKey,
  sortDir,
  directionLabels,
  getColumnLabel,
  onSortClick,
  disabled = false,
}: Readonly<SortPillRowProps>) {
  const labelId = useId();
  if (columns.length === 0) return null;
  return (
    <div className="miot-row-controls" role="group" aria-labelledby={labelId}>
      <span id={labelId}>{label}</span>
      {[...new Set(columns)].map((key) => {
        const active = key === sortKey;
        const name = getColumnLabel(key);
        return (
          <button
            key={key}
            type="button"
            className="miot-row-controls__pill no-drag"
            aria-pressed={active}
            disabled={disabled}
            aria-label={active ? `${name}: ${directionLabels[sortDir]}` : name}
            onClick={() => onSortClick(key)}
          >
            {name}
            {active && (
              <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
