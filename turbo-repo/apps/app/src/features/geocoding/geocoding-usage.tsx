"use client";

import { useMemo, useState } from "react";
import { Button, Spinner } from "flowbite-react";
import {
  HiChevronLeft,
  HiChevronRight,
  HiOutlineCurrencyDollar,
} from "react-icons/hi";
import {
  HiChartBar,
  HiInformationCircle,
  HiOutlineMapPin,
  HiOutlineServerStack,
} from "react-icons/hi2";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  cacheHitRate,
  effectiveQuota,
  formatUsd,
  monthOf,
  quotaLevel,
  quotaPercent,
  shiftMonth,
  type QuotaLevel,
} from "./geocoding-plan-view";
import type {
  GeocodingSourceUse,
  OrgGeocodingPlan,
} from "./geocoding-plan.types";
import { useOrgGeocodingPlan } from "./use-org-geocoding-plan";

const cardClass =
  "flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";
const cardHeaderClass =
  "flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700";
const cardTitleClass =
  "text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white";
const footerClass =
  "border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400";

const BAR_COLORS: Record<QuotaLevel, string> = {
  ok: "bg-blue-500",
  alert: "bg-amber-500",
  exhausted: "bg-red-500",
};

function monthLabel(month: string, lang: string) {
  return new Intl.DateTimeFormat(lang, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function MonthPicker({
  month,
  onMonth,
  lang,
  d,
}: Readonly<{
  month: string;
  onMonth: (month: string) => void;
  lang: string;
  d: I18nRecord;
}>) {
  const isCurrent = month >= monthOf(new Date());
  return (
    <div className="flex items-center gap-2">
      <Button
        size="xs"
        color="light"
        aria-label={tr("previousMonth", d)}
        onClick={() => onMonth(shiftMonth(month, -1))}
      >
        <HiChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium capitalize text-gray-900 dark:text-white">
        {monthLabel(month, lang)}
      </span>
      <Button
        size="xs"
        color="light"
        aria-label={tr("nextMonth", d)}
        disabled={isCurrent}
        onClick={() => onMonth(shiftMonth(month, 1))}
      >
        <HiChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function QuotaCard({
  data,
  d,
}: Readonly<{ data: OrgGeocodingPlan; d: I18nRecord }>) {
  const { usage, plan, subscription } = data;
  const quota = effectiveQuota(usage, plan);
  const level = quotaLevel(usage.used, quota, plan.alertPct);
  const mode = subscription?.onExhausted ?? "review";
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={HiOutlineServerStack} />
        <div className="min-w-0 flex-1">
          <h2 className={cardTitleClass}>{tr("quota.title", d)}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("quota.description", d)}
          </p>
        </div>
      </div>
      <div className="flex-1 px-4 py-3">
        <p className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {usage.used.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            / {quota.toLocaleString()} {tr("quota.unit", d)}
          </span>
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${BAR_COLORS[level]}`}
            style={{ width: `${quotaPercent(usage.used, quota)}%` }}
          />
        </div>
      </div>
      <div className={footerClass}>
        {tr("quota.remaining", d, {
          count: Math.max(0, quota - usage.used).toLocaleString(),
        })}
        {" · "}
        {trDynamic(`quota.onExhausted.${mode}`, d)}
      </div>
    </section>
  );
}

function ResolutionsCard({
  data,
  d,
}: Readonly<{ data: OrgGeocodingPlan; d: I18nRecord }>) {
  const { usage } = data;
  const rate = cacheHitRate(usage);
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={HiOutlineMapPin} />
        <div className="min-w-0 flex-1">
          <h2 className={cardTitleClass}>{tr("resolutions.title", d)}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("resolutions.description", d)}
          </p>
        </div>
      </div>
      <div className="flex-1 px-4 py-3">
        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {usage.resolutions.toLocaleString()}
        </p>
      </div>
      <div className={footerClass}>
        {tr("resolutions.cacheHits", d, {
          count: usage.cacheHits.toLocaleString(),
          rate: rate === null ? "—" : `${rate}%`,
        })}
      </div>
    </section>
  );
}

function CostCard({
  data,
  lang,
  d,
}: Readonly<{ data: OrgGeocodingPlan; lang: string; d: I18nRecord }>) {
  const { usage, plan } = data;
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={HiOutlineCurrencyDollar} />
        <div className="min-w-0 flex-1">
          <h2 className={cardTitleClass}>{tr("cost.title", d)}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("cost.description", d)}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-4 px-4 py-3">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {tr("cost.provider", d)}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {formatUsd(usage.providerCostUsd, lang)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {tr("cost.overage", d)}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {formatUsd(usage.overageUsd, lang)}
          </p>
        </div>
      </div>
      <div className={footerClass}>
        {tr("cost.overageCalls", d, {
          count: usage.overageCalls.toLocaleString(),
          price: formatUsd(plan.overagePriceUsd, lang),
        })}
      </div>
    </section>
  );
}

function SourceTable({
  rows,
  lang,
  d,
}: Readonly<{ rows: GeocodingSourceUse[]; lang: string; d: I18nRecord }>) {
  const sources = d.sources as I18nRecord;
  const results = d.results as I18nRecord;
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={HiChartBar} />
        <h2 className={cardTitleClass}>{tr("bySource.title", d)}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("bySource.empty", d)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">
                  {tr("bySource.source", d)}
                </th>
                <th className="px-4 py-2 font-medium">
                  {tr("bySource.result", d)}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {tr("bySource.resolutions", d)}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {tr("bySource.cacheHits", d)}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {tr("bySource.providerCalls", d)}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {tr("bySource.cost", d)}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.source}-${row.result}`}
                  className="border-t border-gray-100 dark:border-gray-700"
                >
                  <td className="px-4 py-2">
                    {trDynamic(row.source, sources)}
                  </td>
                  <td className="px-4 py-2">
                    {trDynamic(row.result, results)}
                  </td>
                  <td className="px-4 py-2 text-right">{row.resolutions}</td>
                  <td className="px-4 py-2 text-right">{row.cacheHits}</td>
                  <td className="px-4 py-2 text-right">{row.providerCalls}</td>
                  <td className="px-4 py-2 text-right">
                    {formatUsd(row.providerCostUsd, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Notices({
  data,
  lang,
  d,
}: Readonly<{ data: OrgGeocodingPlan; lang: string; d: I18nRecord }>) {
  return (
    <>
      {!data.enforced && (
        <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/20">
          <HiInformationCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {tr("notEnforced", d)}
          </p>
        </div>
      )}
      {data.subscription === null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          {tr("noSubscription", d, {
            quota: data.plan.resolutionsPerMonth.toLocaleString(),
            price: formatUsd(data.plan.overagePriceUsd, lang),
          })}
        </p>
      )}
    </>
  );
}

/** This month's geocoding: provider calls against the quota, resolutions by source, and cost. */
export default function GeocodingUsage({
  orgSlug,
  lang,
  d,
}: Readonly<{ orgSlug: string | null; lang: string; d: I18nRecord }>) {
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const { data, isLoading, error } = useOrgGeocodingPlan(orgSlug, month);
  const rows = useMemo(
    () =>
      [...(data?.usage.bySource ?? [])].sort(
        (a, b) => b.resolutions - a.resolutions
      ),
    [data]
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("title", d)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", d)}
          </p>
        </div>
        <MonthPicker month={month} onMonth={setMonth} lang={lang} d={d} />
      </div>

      {isLoading && <Spinner size="md" />}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error.status === 403 ? tr("forbidden", d) : tr("loadError", d)}
        </p>
      )}
      {data && <Notices data={data} lang={lang} d={d} />}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <QuotaCard data={data} d={d} />
          <ResolutionsCard data={data} d={d} />
          <CostCard data={data} lang={lang} d={d} />
        </div>
      )}
      {data && <SourceTable rows={rows} lang={lang} d={d} />}
    </section>
  );
}
