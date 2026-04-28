"use client";

import { Tooltip } from "flowbite-react";
import type { RowStatus } from "../engine/types";

interface StatusStyle {
  glyph: string;
  className: string;
}

const STYLES: Record<RowStatus, StatusStyle> = {
  unprocessed: {
    glyph: "○",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
  },
  wait: {
    glyph: "⟳",
    className:
      "bg-amber-100 text-amber-700 animate-spin dark:bg-amber-900/40 dark:text-amber-300",
  },
  processed: {
    glyph: "✓",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  updated: {
    glyph: "↻",
    className:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  skipped: {
    glyph: "⤼",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
  },
  failed: {
    glyph: "✕",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

export function StatusIcon({
  status,
  tooltip,
  label,
}: Readonly<{ status: RowStatus; tooltip?: string; label: string }>) {
  const style = STYLES[status];
  const glyph = (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold leading-none ${style.className}`}
    >
      {style.glyph}
    </span>
  );

  const text = tooltip || label;
  const lines = text.split("\n").filter((l) => l.length > 0);

  return (
    <Tooltip
      content={
        lines.length > 1 ? (
          <ul className="space-y-0.5 text-left">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <span>{text}</span>
        )
      }
      placement="right"
      className="max-w-sm whitespace-normal break-words text-xs"
    >
      {glyph}
    </Tooltip>
  );
}
