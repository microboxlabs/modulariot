"use client";

/**
 * PROTOTYPE — the "a quién llamar" contact row (avatar, name + role badge,
 * phone, last-call time + accepted/denied badges), shared between the
 * clickable contacts list (`call-center-menu.tsx`, passing `onClick`) and a
 * plain static display of the chosen contact elsewhere (e.g. the dialing
 * step's top card — see `call-dialing-step.tsx`).
 */

import type { KeyboardEvent } from "react";
import { FormattedDate } from "@/features/common/components/formatted-date";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import CallStatsBadges from "./call-stats-badges";
import type { CallStats } from "./call-targets";

export default function ContactRow({
  personName,
  roleLabel,
  phone,
  stats,
  onClick,
  onKeyDown,
  title,
  ariaLabel,
  pulsing,
  recentlyCalled,
  justCalledLabel,
  bgClassName = "bg-gray-50 dark:bg-gray-800/40",
}: {
  personName: string;
  roleLabel?: string;
  phone?: string;
  stats?: CallStats | null;
  /** Only the clickable "a quién llamar" list variant passes these. */
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  title?: string;
  ariaLabel?: string;
  /** Live-call indicator ring, sized to the avatar itself (not guessed from
   *  the outside) — see `call-dialing-step.tsx`. */
  pulsing?: boolean;
  /** True when `stats.lastCallAt` is a real call made this session (as
   *  opposed to the usual stable mock history) — highlights that time in
   *  green instead of the usual muted gray. */
  recentlyCalled?: boolean;
  /** Shown instead of the relative time (which would otherwise read a flat
   *  "0 min") for the first minute after a real call — e.g. "Recién
   *  llamado". Only used while `recentlyCalled` is true. */
  justCalledLabel?: string;
  /** Default matches the "a quién llamar" list's own row tier. The dialing
   *  step's standalone header (`call-dialing-step.tsx`) overrides this to a
   *  plain white — it's the one card-level "call element" there, not a row
   *  in a list of them, so it doesn't need to sit a shade back from the
   *  card behind it. */
  bgClassName?: string;
}) {
  const interactive = !!onClick;
  const lastCallAt = stats?.lastCallAt ?? null;
  const justCalled =
    recentlyCalled &&
    !!justCalledLabel &&
    lastCallAt !== null &&
    Date.now() - lastCallAt.getTime() < 60_000;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`flex w-full items-center justify-between gap-3 border-b border-gray-200 px-3 py-2.5 text-left dark:border-gray-700 ${bgClassName} ${
        interactive ? "cursor-pointer transition-colors hover:bg-white dark:hover:bg-gray-700" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          {pulsing && (
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-400/40 dark:bg-blue-500/30" />
          )}
          <InitialIdentifier name={personName || "?"} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {personName}
            </p>
            {roleLabel && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {roleLabel}
              </span>
            )}
          </div>
          {phone && (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{phone}</p>
          )}
        </div>
      </div>

      {stats && (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
          {justCalled && (
            <span className="font-medium text-green-500 dark:text-green-400">
              {justCalledLabel}
            </span>
          )}
          {!justCalled && lastCallAt && (
            <FormattedDate
              date={lastCallAt}
              format="relative"
              className={recentlyCalled ? "font-medium text-green-500 dark:text-green-400" : undefined}
            />
          )}
          <CallStatsBadges accepted={stats.accepted} denied={stats.denied} />
        </div>
      )}
    </div>
  );
}
