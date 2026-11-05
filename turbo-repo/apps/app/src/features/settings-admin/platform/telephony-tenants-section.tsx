"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineOfficeBuilding,
  HiOutlinePhone,
} from "react-icons/hi";
import { KpiStat } from "@/features/common/components/kpi-stat";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatUsd } from "@/features/metered-usage/usage-view";
import {
  parseMonthlyMinutes,
  TELEPHONY_ALERT_PCT,
} from "@/features/telephony/telephony-plan";
import {
  telephonyTenantRows,
  telephonyTotals,
  visibleTelephonyRows,
  type TelephonyFilters,
  type TelephonyTenantRow,
} from "./telephony-tenants-view";
import UsageQuotaModal, {
  useUsageQuotaEditor,
  type UsageQuotaTarget,
} from "./usage-quota-modal";
import UsageTenantsTable, { UsageTenantTableRow } from "./usage-tenants-table";
import {
  isFiltering,
  pageOf,
  switcherOrgs,
  type UsageSort,
} from "./usage-tenants-view";
import { useTelephonyPlan, useTelephonyTenants } from "./use-telephony-plan";
import { usePlatformOrganizations } from "./use-platform-organizations";

interface TelephonyTenantsSectionProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  /** Set in the page's filter strip. */
  readonly filters: TelephonyFilters;
  readonly sort: UsageSort;
  readonly month: string;
  /** The header's Assign minutes button opens the modal for a new organization. */
  readonly assigning: boolean;
  readonly onAssignDone: () => void;
}

/**
 * Every organization on the platform's telephony line in a month: totals, a
 * filtered, paged table of minutes against the quota, and a modal to give or
 * change an organization's minutes. Same parts as geocoding's Organizaciones.
 */
export default function TelephonyTenantsSection({
  dict,
  lang,
  filters,
  sort,
  month,
  assigning,
  onAssignDone,
}: TelephonyTenantsSectionProps) {
  const [page, setPage] = useState(1);
  const editor = useUsageQuotaEditor<UsageQuotaTarget>(assigning, onAssignDone);

  const { plan } = useTelephonyPlan();
  const {
    organizations: usage,
    isLoading,
    error,
    saveMinutes,
  } = useTelephonyTenants(month);
  const { organizations } = usePlatformOrganizations(true);

  const rows = useMemo(
    () => telephonyTenantRows(usage, organizations),
    [usage, organizations]
  );
  const totals = useMemo(() => telephonyTotals(rows), [rows]);
  const shown = useMemo(
    () => visibleTelephonyRows(rows, filters, sort),
    [rows, filters, sort]
  );
  const current = pageOf(shown, page);
  const orgs = useMemo(() => switcherOrgs(organizations), [organizations]);
  const ownMinutes = useMemo(
    () => new Set(rows.filter((r) => r.subscribed).map((r) => r.slug)),
    [rows]
  );

  useEffect(() => setPage(1), [filters, sort, month]);

  const numbers = new Intl.NumberFormat(lang);

  return (
    <>
      <UsageTenantsTable
        kpis={
          <>
            <KpiStat
              icon={{ icon: HiOutlineOfficeBuilding }}
              title={{ text: tr("kpi.subscribed", dict), className: "text-xs" }}
              value={{
                text: numbers.format(totals.ownMinutes),
                className: "text-2xl",
              }}
              description={{
                text: tr("kpi.withUsage", dict, {
                  count: numbers.format(rows.length),
                }),
              }}
              variant="horizontal"
            />
            <KpiStat
              icon={{ icon: HiOutlinePhone }}
              title={{ text: tr("kpi.minutes", dict), className: "text-xs" }}
              value={{
                text: numbers.format(totals.minutes),
                className: "text-2xl",
              }}
              description={{
                text: tr("kpi.calls", dict, {
                  count: numbers.format(totals.calls),
                }),
              }}
              variant="horizontal"
            />
            <KpiStat
              icon={{ icon: HiOutlineClock }}
              title={{ text: tr("kpi.pending", dict), className: "text-xs" }}
              value={{
                text: numbers.format(totals.pending),
                className: "text-2xl",
              }}
              description={{ text: tr("kpi.pendingHelp", dict) }}
              variant="horizontal"
            />
            <KpiStat
              icon={{ icon: HiOutlineCurrencyDollar }}
              title={{ text: tr("kpi.margin", dict), className: "text-xs" }}
              value={{
                text: formatUsd(totals.chargeUsd, lang),
                className: "text-2xl",
              }}
              description={{
                text: tr("kpi.providerCost", dict, {
                  cost: formatUsd(totals.providerCostUsd, lang),
                }),
              }}
              variant="horizontal"
            />
          </>
        }
        columns={[
          tr("columns.organization", dict),
          tr("columns.quota", dict),
          tr("columns.calls", dict),
          tr("columns.pending", dict),
          tr("columns.providerCost", dict),
          tr("columns.charge", dict),
          "",
        ]}
        isLoading={isLoading}
        failed={error !== null}
        filtering={isFiltering(filters)}
        rows={current.rows}
        pages={current.pages}
        page={page}
        onPage={setPage}
        total={shown.length}
        dict={dict}
        lang={lang}
      >
        {current.rows.map((row) => (
          <UsageTenantTableRow
            key={row.slug}
            row={row}
            alertPct={TELEPHONY_ALERT_PCT}
            quotaWithoutSubscription
            lang={lang}
            dict={dict}
            onEdit={() =>
              editor.open({
                slug: row.slug,
                name: row.displayName,
                ownQuota: row.ownQuota,
              })
            }
          >
            <TelephonyCells row={row} lang={lang} />
          </UsageTenantTableRow>
        ))}
      </UsageTenantsTable>

      <UsageQuotaModal<number | null>
        show={editor.show}
        target={editor.editing}
        orgs={orgs}
        subscribed={ownMinutes}
        planQuota={plan?.minutesPerMonth ?? 0}
        idPrefix="telephony-quota"
        toRequest={(quota) => {
          const parsed = parseMonthlyMinutes(quota);
          return parsed.ok
            ? parsed
            : { ok: false, error: tr("errors.quota", dict) };
        }}
        onClose={editor.close}
        onSave={async (organization, minutes) => {
          await saveMinutes(organization, minutes);
        }}
        dict={dict}
      />
    </>
  );
}

function TelephonyCells({
  row,
  lang,
}: Readonly<{ row: TelephonyTenantRow; lang: string }>) {
  return (
    <>
      <td className="px-4 py-2.5">{row.calls.toLocaleString(lang)}</td>
      <td className="px-4 py-2.5">{row.pending.toLocaleString(lang)}</td>
      <td className="px-4 py-2.5">{formatUsd(row.providerCostUsd, lang)}</td>
      <td className="px-4 py-2.5">
        {row.chargeUsd === null ? "—" : formatUsd(row.chargeUsd, lang)}
      </td>
    </>
  );
}
