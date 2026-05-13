"use client";

import { memo } from "react";
import dayjs from "dayjs";
import type { ParsedRow, RowState, RowStatus } from "../engine/types";
import { StatusIcon } from "./status-icon";

const ROW_BG: Record<RowStatus, string> = {
  unprocessed: "",
  wait: "bg-amber-50 dark:bg-amber-900/10",
  processed: "bg-green-50 dark:bg-green-900/10",
  updated: "bg-indigo-50 dark:bg-indigo-900/10",
  skipped: "bg-gray-50 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  failed: "bg-red-50 dark:bg-red-900/10",
};

interface RowProps {
  row: ParsedRow;
  state: RowState;
  headers: string[];
  statusLabel: string;
  gridTemplate: string;
  /** Mapped column names whose RPC schema declares a date / date-time format.
   *  Cells in these columns render the date portion only; the original ISO
   *  string is exposed via `title` so a hover-tooltip still shows the time.
   *  Identity-stable across renders so React.memo can skip cleanly. */
  dateColumns: ReadonlySet<string>;
  /** Optional per-column display-only date format (dayjs tokens) keyed by
   *  mapped column name. Only consulted for columns in `dateColumns`. The
   *  underlying `row.fields[h]` value is left untouched, so `/bulk` still
   *  POSTs the original timestamp. */
  dateDisplayFormats: Record<string, string>;
}

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})T/;

/** For a cell that maps to a date-typed RPC parameter, render a friendlier
 *  display string while keeping the original value in `title` so hover
 *  surfaces the precision. Priority:
 *   1. Caller-supplied dayjs `format` (per-column display preference).
 *   2. Cheap regex slice that extracts the YYYY-MM-DD prefix of an ISO 8601
 *      string — the historical default.
 *  Either way, the underlying `row.fields` value is unchanged so submission
 *  to `/bulk` still passes the validator's `datetime({ offset: true })`. */
function renderDateCell(
  value: string,
  format?: string,
): { display: string; title: string } {
  if (format) {
    const d = dayjs(value);
    if (d.isValid()) return { display: d.format(format), title: value };
  }
  const match = ISO_DATE_PREFIX.exec(value);
  return match ? { display: match[1], title: value } : { display: value, title: value };
}

export const Row = memo(function Row({
  row,
  state,
  headers,
  statusLabel,
  gridTemplate,
  dateColumns,
  dateDisplayFormats,
}: Readonly<RowProps>) {
  return (
    <div
      className={`grid border-b border-gray-200 text-xs dark:border-gray-700 ${ROW_BG[state.status]}`}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="flex items-start justify-center border-r border-gray-200 p-2 dark:border-gray-700">
        <StatusIcon
          status={state.status}
          tooltip={state.errorMessage}
          label={statusLabel}
        />
      </div>
      {headers.map((h) => {
        const raw = row.fields[h];
        if (!raw) {
          return (
            <div
              key={h}
              className="overflow-hidden border-r border-gray-200 p-2 align-top dark:border-gray-700"
            >
              <span className="text-gray-400">—</span>
            </div>
          );
        }
        if (dateColumns.has(h)) {
          const { display, title } = renderDateCell(raw, dateDisplayFormats[h]);
          return (
            <div
              key={h}
              title={title}
              className="overflow-hidden border-r border-gray-200 p-2 align-top dark:border-gray-700"
            >
              {display}
            </div>
          );
        }
        return (
          <div
            key={h}
            className="overflow-hidden border-r border-gray-200 p-2 align-top dark:border-gray-700"
          >
            {raw}
          </div>
        );
      })}
    </div>
  );
});
