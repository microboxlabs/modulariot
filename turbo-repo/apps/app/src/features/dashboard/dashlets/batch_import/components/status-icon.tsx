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

/**
 * Failed rows mount a real Tooltip; everything else stays a bare span. The
 * native `title` we used before inherits an OS-controlled show delay (often
 * 1–2s, occasionally much longer) and resets that timer on every cursor move
 * or DOM update beneath the pointer — which made errors take tens of seconds
 * to appear during a streaming import. The popper-cost concern that drove the
 * native-only choice is addressed by virtualization (only ~12 rows rendered)
 * + this `tooltip ?` gate (only failed rows mount one), so the live count is
 * a handful, not thousands.
 */
export function StatusIcon({
  status,
  tooltip,
  label,
}: Readonly<{ status: RowStatus; tooltip?: string; label: string }>) {
  const style = STYLES[status];
  const icon = (
    <span
      className={`inline-flex h-6 w-6 ${tooltip ? "cursor-help" : ""} items-center justify-center rounded-full text-sm font-bold leading-none ${style.className}`}
      aria-label={label}
    >
      {style.glyph}
    </span>
  );

  if (!tooltip) return icon;

  return (
    <Tooltip
      content={
        <div className="max-w-sm whitespace-pre-line text-left">
          <div className="font-semibold">{label}</div>
          <div>{tooltip}</div>
        </div>
      }
      placement="right"
      style="light"
      arrow={false}
    >
      {icon}
    </Tooltip>
  );
}
