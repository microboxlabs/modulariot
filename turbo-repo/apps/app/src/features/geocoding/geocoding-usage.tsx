"use client";

import { useMemo, useState } from "react";
import { HiOutlineCurrencyDollar } from "react-icons/hi";
import {
  HiChartBar,
  HiOutlineMapPin,
  HiOutlineServerStack,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  UsageBreakdownCard,
  UsageCard,
  UsageFigure,
  UsageNumber,
  UsageQuotaCard,
} from "@/features/metered-usage/usage-card";
import UsageMonthSection from "@/features/metered-usage/usage-month-section";
import UsageNotice from "@/features/metered-usage/usage-notice";
import { formatUsd, monthOf } from "@/features/metered-usage/usage-view";
import { cacheHitRate } from "./geocoding-plan-view";
import type {
  GeocodingSourceUse,
  OrgGeocodingPlan,
} from "./geocoding-plan.types";
import { useOrgGeocodingPlan } from "./use-org-geocoding-plan";

function QuotaCard({
  data,
  d,
}: Readonly<{ data: OrgGeocodingPlan; d: I18nRecord }>) {
  const { usage, plan, subscription } = data;
  const quota = usage.quota;
  const mode = subscription?.onExhausted ?? "review";
  return (
    <UsageQuotaCard
      icon={HiOutlineServerStack}
      title={tr("quota.title", d)}
      description={tr("quota.description", d)}
      used={usage.used}
      quota={quota}
      unit={tr("quota.unit", d)}
      alertPct={plan.alertPct}
      unavailable={tr("quota.unavailable", d)}
      footer={
        <>
          {tr("quota.remaining", d, {
            count: Math.max(0, (quota ?? 0) - usage.used).toLocaleString(),
          })}
          {" · "}
          {trDynamic(`quota.onExhausted.${mode}`, d)}
        </>
      }
    />
  );
}

function ResolutionsCard({
  data,
  d,
}: Readonly<{ data: OrgGeocodingPlan; d: I18nRecord }>) {
  const { usage } = data;
  const rate = cacheHitRate(usage);
  return (
    <UsageCard
      icon={HiOutlineMapPin}
      title={tr("resolutions.title", d)}
      description={tr("resolutions.description", d)}
      footer={tr("resolutions.cacheHits", d, {
        count: usage.cacheHits.toLocaleString(),
        rate: rate === null ? "—" : `${rate}%`,
      })}
    >
      <UsageNumber>{usage.resolutions.toLocaleString()}</UsageNumber>
    </UsageCard>
  );
}

function ChargeCard({
  data,
  lang,
  d,
}: Readonly<{ data: OrgGeocodingPlan; lang: string; d: I18nRecord }>) {
  const { usage, plan, subscription } = data;
  const knownCharge = subscription !== null && usage.chargeUsd !== null;
  return (
    <UsageCard
      icon={HiOutlineCurrencyDollar}
      title={tr("charge.title", d)}
      description={tr("charge.description", d)}
      bodyClassName="grid flex-1 grid-cols-2 gap-4 px-4 py-3"
      footer={
        <>
          <p>
            {tr("charge.total", d, {
              total: formatUsd(usage.chargeUsd, lang),
            })}
          </p>
          <p>
            {knownCharge
              ? tr("charge.overageCalls", d, {
                  count: usage.overageCalls.toLocaleString(),
                  price: formatUsd(plan.overagePriceUsd, lang),
                })
              : tr("charge.unavailable", d)}
          </p>
        </>
      }
    >
      <UsageFigure
        label={tr("charge.monthly", d)}
        value={formatUsd(knownCharge ? plan.monthlyPriceUsd : null, lang)}
      />
      <UsageFigure
        label={tr("charge.overage", d)}
        value={formatUsd(knownCharge ? usage.overageUsd : null, lang)}
      />
    </UsageCard>
  );
}

function SourceTable({
  rows,
  d,
}: Readonly<{ rows: GeocodingSourceUse[]; d: I18nRecord }>) {
  const sources = d.sources as I18nRecord;
  const results = d.results as I18nRecord;
  return (
    <UsageBreakdownCard
      icon={HiChartBar}
      title={tr("bySource.title", d)}
      empty={tr("bySource.empty", d)}
      columns={[
        { label: tr("bySource.source", d) },
        { label: tr("bySource.result", d) },
        { label: tr("bySource.resolutions", d), align: "right" },
        { label: tr("bySource.cacheHits", d), align: "right" },
        { label: tr("bySource.providerCalls", d), align: "right" },
      ]}
      rows={rows.map((row) => ({
        key: `${row.source}-${row.result}`,
        cells: [
          trDynamic(row.source, sources),
          trDynamic(row.result, results),
          row.resolutions,
          row.cacheHits,
          row.providerCalls,
        ],
      }))}
    />
  );
}

function Notices({
  data,
  d,
}: Readonly<{ data: OrgGeocodingPlan; d: I18nRecord }>) {
  return (
    <>
      {!data.enforced && (
        <UsageNotice tone="info">{tr("notEnforced", d)}</UsageNotice>
      )}
      {data.enforced &&
        data.subscription &&
        data.usage.quota !== null &&
        data.usage.used >= data.usage.quota &&
        data.usage.periodStart.slice(0, 7) === monthOf(new Date()) && (
          <UsageNotice tone="danger">
            {data.subscription.onExhausted === "overage"
              ? tr("quotaExhaustedOverage", d)
              : tr("quotaExhaustedReview", d)}
          </UsageNotice>
        )}
      {data.subscription === null && (
        <UsageNotice tone="warning">
          {data.enforced
            ? tr("noSubscriptionEnforced", d)
            : tr("noSubscriptionNotEnforced", d)}
        </UsageNotice>
      )}
    </>
  );
}

/** This month's geocoding: provider calls against the quota, resolutions by source, and the plan charge. */
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

  let errorText: string | null = null;
  if (error) {
    errorText = error.status === 403 ? tr("forbidden", d) : tr("loadError", d);
  }

  return (
    <UsageMonthSection
      title={tr("title", d)}
      description={tr("description", d)}
      month={month}
      onMonth={setMonth}
      lang={lang}
      previousLabel={tr("previousMonth", d)}
      nextLabel={tr("nextMonth", d)}
      isLoading={isLoading}
      error={errorText}
    >
      {data && <Notices data={data} d={d} />}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <QuotaCard data={data} d={d} />
          <ResolutionsCard data={data} d={d} />
          <ChargeCard data={data} lang={lang} d={d} />
        </div>
      )}
      {data && <SourceTable rows={rows} d={d} />}
    </UsageMonthSection>
  );
}
