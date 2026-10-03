import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";

import type { VersionBump as Bump } from "../maintainer-api";

const BUMP_CLASS: Record<Bump, string> = {
  MAJOR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MINOR: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PATCH: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const BUMP_KEY: Record<Bump, string> = {
  MAJOR: "bumpMajor",
  MINOR: "bumpMinor",
  PATCH: "bumpPatch",
};

/** MAYOR / MENOR / PARCHE in the version's colour. */
export function BumpBadge({
  bump,
  d,
  className = "",
}: Readonly<{ bump: Bump; d: I18nRecord; className?: string }>) {
  return (
    <span
      className={`rounded px-1.5 text-[11px] font-semibold ${BUMP_CLASS[bump]} ${className}`}
    >
      {trDynamic(BUMP_KEY[bump], d)}
    </span>
  );
}

/** The amber ✦ square that marks text written by Harness. */
export function Spark({
  size = "h-5 w-5 text-[10px]",
  title,
  pulse = false,
  className = "",
}: Readonly<{
  size?: string;
  title?: string;
  pulse?: boolean;
  className?: string;
}>) {
  return (
    <span
      title={title}
      className={`flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)] text-white ${pulse ? "animate-pulse" : ""} ${size} ${className}`}
    >
      <span aria-hidden>✦</span>
      {title && <span className="sr-only">{title}</span>}
    </span>
  );
}
