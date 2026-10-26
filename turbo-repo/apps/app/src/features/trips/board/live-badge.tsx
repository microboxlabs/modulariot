"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/** Green while the board receives changes as they happen; gray while it only polls. */
export function LiveBadge({
  connected,
  d,
}: Readonly<{ connected: boolean; d: I18nRecord }>) {
  const dot = connected ? "bg-green-500" : "bg-gray-400";
  const label = connected ? tr("live.on", d) : tr("live.off", d);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400"
      title={label}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
