"use client";

import { memo } from "react";
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
}

export const Row = memo(function Row({
  row,
  state,
  headers,
  statusLabel,
  gridTemplate,
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
      {headers.map((h) => (
        <div
          key={h}
          className="overflow-hidden border-r border-gray-200 p-2 align-top dark:border-gray-700"
        >
          {row.fields[h] || <span className="text-gray-400">—</span>}
        </div>
      ))}
    </div>
  );
});
