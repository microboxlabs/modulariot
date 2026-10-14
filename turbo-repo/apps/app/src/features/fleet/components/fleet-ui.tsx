"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { AssetStatus, DocumentStatus, FieldSource } from "../fleet-api";
import { formatDay } from "../fleet-api";

/** Gray panel used for every block of the fleet pages. */
export const PANEL = "rounded-2xl bg-gray-50 dark:bg-gray-800";

/** Primary action: ink, never the blue accent. */
export const PRIMARY_BUTTON =
  "inline-flex min-h-10 items-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 focus:ring-4 focus:ring-gray-300 focus:outline-none disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:ring-gray-600";

export const SECONDARY_BUTTON =
  "inline-flex min-h-10 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700";

export const CAPTION =
  "text-xs font-medium tracking-wide text-gray-600 uppercase dark:text-gray-400";

const STATUS_DOT: Record<AssetStatus, string> = {
  IN_TRIP: "bg-blue-600",
  AVAILABLE: "bg-green-600",
  NO_SIGNAL: "bg-rose-600",
};

const STATUS_TEXT: Record<AssetStatus, string> = {
  IN_TRIP: "text-blue-700 dark:text-blue-400",
  AVAILABLE: "text-green-700 dark:text-green-400",
  NO_SIGNAL: "text-rose-700 dark:text-rose-400",
};

const DOCUMENT_TEXT: Record<DocumentStatus, string> = {
  MISSING: "text-gray-600 dark:text-gray-400",
  VALID: "text-green-700 dark:text-green-400",
  EXPIRING: "text-amber-700 dark:text-amber-400",
  EXPIRED: "text-rose-700 dark:text-rose-400",
};

const SOURCE_TAG: Record<FieldSource, string> = {
  SIGNAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  TRIP: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  MANUAL: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  NONE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function StatusPill({
  status,
  d,
}: {
  readonly status: AssetStatus;
  readonly d: I18nRecord;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${STATUS_TEXT[status]}`}
    >
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      {trDynamic(`status.${status}`, d)}
    </span>
  );
}

export function DocumentText({
  status,
  expiresAt,
  d,
  lang,
}: {
  readonly status: DocumentStatus;
  readonly expiresAt: string | null;
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  return (
    <span className={`text-sm whitespace-nowrap ${DOCUMENT_TEXT[status]}`}>
      {trDynamic(`documentStatus.${status}`, d, {
        date: formatDay(expiresAt, lang),
      })}
    </span>
  );
}

export function SourceTag({
  source,
  d,
}: {
  readonly source: FieldSource;
  readonly d: I18nRecord;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_TAG[source]}`}
    >
      {trDynamic(`sources.${source}`, d)}
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "muted",
  onClick,
  active = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: string;
  readonly tone?: "muted" | "good" | "warn" | "bad";
  readonly onClick?: () => void;
  readonly active?: boolean;
}) {
  const hintClass = {
    muted: "text-gray-600 dark:text-gray-400",
    good: "text-green-700 dark:text-green-400",
    warn: "text-amber-700 dark:text-amber-400",
    bad: "text-rose-700 dark:text-rose-400",
  }[tone];
  const body = (
    <>
      <span className={CAPTION}>{label}</span>
      <span className="text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
        {value}
      </span>
      {hint && <span className={`text-xs ${hintClass}`}>{hint}</span>}
    </>
  );
  const shape = `${PANEL} flex min-w-0 flex-col gap-1.5 p-4 text-left`;
  if (!onClick) return <div className={shape}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${shape} ring-gray-900 hover:bg-gray-100 focus:ring-2 focus:outline-none dark:ring-white dark:hover:bg-gray-700 ${active ? "ring-2" : ""}`}
    >
      {body}
    </button>
  );
}

/** Suggestions from the integrations, on the accent's soft tint. */
export function AgentCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl bg-blue-50 p-5 dark:bg-blue-900/20">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 dark:bg-white">
          <span className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-600" />
        </span>
        <span className="text-xs font-medium tracking-wide text-blue-700 uppercase dark:text-blue-300">
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

export function PageHeader({
  caption,
  title,
  backHref,
  backLabel,
  actions,
}: {
  readonly caption: string;
  readonly title: ReactNode;
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
          >
            <HiArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0">
          <div className={CAPTION}>{caption}</div>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Label on the left, value on the right, hairline between rows. */
export function InfoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-200 py-2.5 text-sm last:border-b-0 dark:border-gray-700">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="min-w-0 text-right text-gray-900 dark:text-white">
        {children}
      </span>
    </div>
  );
}
