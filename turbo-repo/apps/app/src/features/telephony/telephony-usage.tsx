"use client";

import { useMemo, useState } from "react";
import { HiOutlineCurrencyDollar, HiOutlinePhone } from "react-icons/hi";
import { HiChartBar, HiOutlineClock } from "react-icons/hi2";
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
import {
  DESTINATIONS,
  TELEPHONY_ALERT_PCT,
  type OrgTelephonyPlan,
  type TelephonyUsageLine,
} from "./telephony-plan";
import { useOrgTelephonyUsage } from "./use-org-telephony-usage";

/** `CL_MOBILE`, …, or the channel for WhatsApp lines. */
function destinationOf(line: TelephonyUsageLine): string {
  return line.channel === "VOICE" ? line.destinationType : line.channel;
}

/** Charges of calls (line and WhatsApp) and of WhatsApp templates. */
export function chargeSplit(lines: readonly TelephonyUsageLine[]) {
  const templates = lines
    .filter((l) => l.channel === "WHATSAPP_TEMPLATE")
    .reduce((s, l) => s + l.chargeUsd, 0);
  const all = lines.reduce((s, l) => s + l.chargeUsd, 0);
  return { calls: all - templates, templates };
}

function MinutesCard({
  data,
  d,
}: Readonly<{ data: OrgTelephonyPlan; d: I18nRecord }>) {
  const { usage, subscription } = data;
  const own = subscription?.monthlyMinutes != null;
  return (
    <UsageQuotaCard
      icon={HiOutlinePhone}
      title={tr("quota.title", d)}
      description={tr("quota.description", d)}
      used={usage.usedMinutes}
      quota={usage.quotaMinutes}
      unit={tr("quota.unit", d)}
      alertPct={TELEPHONY_ALERT_PCT}
      unavailable=""
      footer={
        <>
          {tr("quota.remaining", d, {
            count: Math.max(
              0,
              usage.quotaMinutes - usage.usedMinutes
            ).toLocaleString(),
          })}
          {" · "}
          {own ? tr("quota.own", d) : tr("quota.fromPlan", d)}
        </>
      }
    />
  );
}

function CallsCard({
  data,
  d,
}: Readonly<{ data: OrgTelephonyPlan; d: I18nRecord }>) {
  const calls = data.usage.lines
    .filter((l) => l.channel !== "WHATSAPP_TEMPLATE")
    .reduce((s, l) => s + l.calls, 0);
  return (
    <UsageCard
      icon={HiOutlineClock}
      title={tr("calls.title", d)}
      description={tr("calls.description", d)}
      footer={tr("calls.pending", d, {
        count: data.usage.pending.toLocaleString(),
      })}
    >
      <UsageNumber>{calls.toLocaleString()}</UsageNumber>
    </UsageCard>
  );
}

function ChargeCard({
  data,
  lang,
  d,
}: Readonly<{ data: OrgTelephonyPlan; lang: string; d: I18nRecord }>) {
  const split = chargeSplit(data.usage.lines);
  return (
    <UsageCard
      icon={HiOutlineCurrencyDollar}
      title={tr("charge.title", d)}
      description={tr("charge.description", d)}
      bodyClassName="grid flex-1 grid-cols-2 gap-4 px-4 py-3"
      footer={
        <p>
          {tr("charge.total", d, {
            total: formatUsd(data.usage.chargeUsd, lang),
          })}
        </p>
      }
    >
      <UsageFigure
        label={tr("charge.calls", d)}
        value={formatUsd(split.calls, lang)}
      />
      <UsageFigure
        label={tr("charge.templates", d)}
        value={formatUsd(split.templates, lang)}
      />
    </UsageCard>
  );
}

function DestinationTable({
  lines,
  lang,
  d,
}: Readonly<{
  lines: readonly TelephonyUsageLine[];
  lang: string;
  d: I18nRecord;
}>) {
  const names = d.destinations as I18nRecord;
  return (
    <UsageBreakdownCard
      icon={HiChartBar}
      title={tr("byDestination.title", d)}
      empty={tr("byDestination.empty", d)}
      columns={[
        { label: tr("byDestination.destination", d) },
        { label: tr("byDestination.count", d), align: "right" },
        { label: tr("byDestination.minutes", d), align: "right" },
        { label: tr("byDestination.charge", d), align: "right" },
      ]}
      rows={lines.map((l) => ({
        key: `${l.channel}-${l.destinationType}`,
        cells: [
          trDynamic(destinationOf(l), names),
          l.calls,
          l.channel === "WHATSAPP_TEMPLATE" ? "—" : l.billedMinutes,
          formatUsd(l.chargeUsd, lang),
        ],
      }))}
    />
  );
}

function Notices({
  data,
  ownLine,
  d,
}: Readonly<{
  data: OrgTelephonyPlan;
  ownLine: OwnLine | null;
  d: I18nRecord;
}>) {
  const { plan, usage } = data;
  return (
    <>
      {ownLine === "TEAMS_PHONE" && (
        <UsageNotice tone="info">{tr("ownTeams", d)}</UsageNotice>
      )}
      {ownLine === "TELNYX" && (
        <UsageNotice tone="info">{tr("ownTelnyx", d)}</UsageNotice>
      )}
      {!plan.enforced && (
        <UsageNotice tone="info">{tr("notEnforced", d)}</UsageNotice>
      )}
      {plan.enforced &&
        usage.usedMinutes >= usage.quotaMinutes &&
        usage.periodStart.slice(0, 7) === monthOf(new Date()) && (
          <UsageNotice tone="danger">{tr("quotaExhausted", d)}</UsageNotice>
        )}
    </>
  );
}

/** The organization's own line in use, whose calls the platform does not bill. */
export type OwnLine = "TEAMS_PHONE" | "TELNYX";

/**
 * An organization's month on the platform's telephony line: minutes against
 * its quota, calls, the plan charge and the usage by destination. The same
 * cards as geocoding's "Uso del mes". With `ownLine`, a notice says those
 * calls are billed elsewhere and not counted here.
 */
export default function TelephonyUsage({
  orgSlug,
  lang,
  d,
  ownLine = null,
  setupUnavailable = false,
}: Readonly<{
  orgSlug: string | null;
  lang: string;
  d: I18nRecord;
  ownLine?: OwnLine | null;
  setupUnavailable?: boolean;
}>) {
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const { data, isLoading, error } = useOrgTelephonyUsage(orgSlug, month);
  const lines = useMemo(() => {
    const order = (l: TelephonyUsageLine) =>
      DESTINATIONS.indexOf(destinationOf(l) as (typeof DESTINATIONS)[number]);
    return [...(data?.usage.lines ?? [])].sort((a, b) => order(a) - order(b));
  }, [data]);

  return (
    <UsageMonthSection
      dict={d}
      month={month}
      onMonth={setMonth}
      lang={lang}
      isLoading={isLoading}
      error={error}
    >
      {setupUnavailable && (
        <UsageNotice tone="warning">{tr("setupUnavailable", d)}</UsageNotice>
      )}
      {data && <Notices data={data} ownLine={ownLine} d={d} />}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MinutesCard data={data} d={d} />
          <CallsCard data={data} d={d} />
          <ChargeCard data={data} lang={lang} d={d} />
        </div>
      )}
      {data && <DestinationTable lines={lines} lang={lang} d={d} />}
    </UsageMonthSection>
  );
}
