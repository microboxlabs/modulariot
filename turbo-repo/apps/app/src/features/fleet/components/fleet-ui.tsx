"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, Breadcrumb, BreadcrumbItem } from "flowbite-react";
import { BsStars } from "react-icons/bs";
import { HiOutlineTruck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { AssetStatus, DocumentStatus, FieldSource } from "../fleet-api";
import { formatDay } from "../fleet-api";

/** Same card as the rest of the app's panels. */
export const CARD =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

export const CARD_TITLE =
  "text-base font-semibold text-gray-900 dark:text-white";

const STATUS_COLOR: Record<AssetStatus, string> = {
  IN_TRIP: "info",
  AVAILABLE: "success",
  NO_SIGNAL: "failure",
};

const DOCUMENT_COLOR: Record<DocumentStatus, string> = {
  MISSING: "gray",
  VALID: "success",
  EXPIRING: "warning",
  EXPIRED: "failure",
};

const SOURCE_COLOR: Record<FieldSource, string> = {
  SIGNAL: "info",
  TRIP: "indigo",
  MANUAL: "dark",
  NONE: "gray",
};

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/** The app's section header, with the fleet breadcrumb and the page actions on the right. */
export function FleetHeader({
  crumbs,
  actions,
  filterDict,
}: {
  readonly crumbs: Crumb[];
  readonly actions?: ReactNode;
  readonly filterDict: I18nRecord;
}) {
  return (
    <SectionHeader
      filterDict={filterDict}
      leftContent={
        <Breadcrumb aria-label="breadcrumb">
          {crumbs.map((crumb, i) => (
            <BreadcrumbItem
              key={`${i}-${crumb.label}`}
              icon={i === 0 ? HiOutlineTruck : undefined}
            >
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-gray-900 dark:hover:text-white"
                >
                  {crumb.label}
                </Link>
              ) : (
                crumb.label
              )}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      }
      rightContent={actions}
    />
  );
}

export function StatusBadge({
  status,
  d,
}: {
  readonly status: AssetStatus;
  readonly d: I18nRecord;
}) {
  return (
    <Badge color={STATUS_COLOR[status]} className="w-fit whitespace-nowrap">
      {trDynamic(`status.${status}`, d)}
    </Badge>
  );
}

export function DocumentBadge({
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
    <Badge color={DOCUMENT_COLOR[status]} className="w-fit whitespace-nowrap">
      {trDynamic(`documentStatus.${status}`, d, {
        date: formatDay(expiresAt, lang),
      })}
    </Badge>
  );
}

export function SourceBadge({
  source,
  d,
}: {
  readonly source: FieldSource;
  readonly d: I18nRecord;
}) {
  return (
    <Badge color={SOURCE_COLOR[source]} size="xs" className="w-fit">
      {trDynamic(`sources.${source}`, d)}
    </Badge>
  );
}

/** The Harness mark: stars on the gold gradient. */
export function HarnessMark() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#D18900] to-[#F1B300] text-white">
      <BsStars className="h-4 w-4" aria-hidden />
    </span>
  );
}

/** What Harness suggests from the integrations. */
export function HarnessCard({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-900/20">
      <div className="flex items-center gap-2.5">
        <HarnessMark />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </div>
          <div className="text-xs text-amber-800 dark:text-amber-300">
            {subtitle}
          </div>
        </div>
      </div>
      {children}
    </section>
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
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="min-w-0 text-right font-medium text-gray-900 dark:text-white">
        {children}
      </span>
    </div>
  );
}
