"use client";

import { HiCheck, HiStar } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * UI-facing accreditation level for a resource (carrier / driver / truck /
 * trailer). Mirrors the three states the upstream `is_acredited` column emits
 * — `ACCREDITED`, `NOT_ACCREDITED`, `SUPER_ACCREDITED` — but normalized to a
 * closed, lowercase union so the badge/label lookups can be exhaustive maps.
 */
export type AccreditationLevel =
  | "accredited"
  | "notAccredited"
  | "superAccredited";

const RAW_TO_LEVEL: Record<string, AccreditationLevel> = {
  ACCREDITED: "accredited",
  NOT_ACCREDITED: "notAccredited",
  SUPER_ACCREDITED: "superAccredited",
};

/**
 * Map the raw upstream `is_acredited` string onto an {@link AccreditationLevel}.
 * Any value the contract doesn't recognize (including null/empty) collapses to
 * `notAccredited` so an unexpected upstream code never renders the resource as
 * accredited by accident.
 */
export function toAccreditationLevel(
  raw: string | null | undefined
): AccreditationLevel {
  if (!raw) return "notAccredited";
  return RAW_TO_LEVEL[raw] ?? "notAccredited";
}

const LABEL_KEY: Record<AccreditationLevel, string> = {
  accredited: "pages.planning.sidebar.assignment.enabled",
  notAccredited: "pages.planning.sidebar.assignment.notEnabled",
  superAccredited: "pages.planning.sidebar.assignment.superAccredited",
};

/** Translated label for an accreditation level (used by the searchable field). */
export function accreditationLabel(
  level: AccreditationLevel,
  dict: I18nRecord
): string {
  return tr(LABEL_KEY[level], dict);
}

// Color scheme (with dark-mode contrast):
//   accredited      → neutral / "normal" gray (the baseline state)
//   notAccredited   → amber (caution)
//   superAccredited → green (the standout positive state)
const BADGE_TONE: Record<AccreditationLevel, string> = {
  accredited:
    "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  notAccredited:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  superAccredited:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

// Inner icon-circle tint, paired with BADGE_TONE. `notAccredited` renders no
// circle so it stays visually quieter than the other two.
const DOT_TONE: Record<AccreditationLevel, string> = {
  accredited: "bg-gray-200 dark:bg-gray-600",
  notAccredited: "",
  superAccredited: "bg-green-200 dark:bg-green-800/50",
};

interface AccreditationBadgeProps {
  readonly level: AccreditationLevel;
  readonly dict: I18nRecord;
  /** Extra classes merged onto the badge wrapper (e.g. layout tweaks). */
  readonly className?: string;
}

/**
 * Colored accreditation chip shown on every resource card. `accredited` and
 * `superAccredited` carry a leading icon-in-circle (check / star); the quieter
 * `notAccredited` state is text-only, matching the original "No Acreditado"
 * badge.
 */
export function AccreditationBadge({
  level,
  dict,
  className,
}: AccreditationBadgeProps) {
  const base =
    "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1";
  const label = accreditationLabel(level, dict);

  if (level === "notAccredited") {
    return (
      <span className={twMerge(base, BADGE_TONE[level], className)}>
        {label}
      </span>
    );
  }

  const Icon = level === "superAccredited" ? HiStar : HiCheck;

  return (
    <span className={twMerge(base, BADGE_TONE[level], className)}>
      <span
        className={twMerge(
          "flex items-center justify-center w-3.5 h-3.5 rounded-full",
          DOT_TONE[level]
        )}
      >
        <Icon className="w-2.5 h-2.5" />
      </span>
      {label}
    </span>
  );
}
