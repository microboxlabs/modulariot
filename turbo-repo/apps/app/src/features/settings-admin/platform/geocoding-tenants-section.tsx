"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineCurrencyDollar,
  HiOutlineDatabase,
  HiOutlineOfficeBuilding,
  HiOutlineGlobeAlt,
} from "react-icons/hi";
import { KpiStat } from "@/features/common/components/kpi-stat";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { formatUsd } from "@/features/metered-usage/usage-view";
import GeocodingQuotaModal, { type QuotaTarget } from "./geocoding-quota-modal";
import {
  tenantRows,
  tenantTotals,
  visibleRows,
  type TenantFilters,
  type TenantRow,
  type TenantSort,
} from "./geocoding-tenants-view";
import { useUsageQuotaEditor } from "./usage-quota-modal";
import UsageTenantsTable, { UsageTenantTableRow } from "./usage-tenants-table";
import { isFiltering, pageOf, switcherOrgs } from "./usage-tenants-view";
import {
  useGeocodingPlan,
  useGeocodingSubscriptions,
} from "./use-geocoding-plan";
import { usePlatformOrganizations } from "./use-platform-organizations";

interface GeocodingTenantsSectionProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  /** Set in the page's filter strip, like the other catalogs. */
  readonly filters: TenantFilters;
  readonly sort: TenantSort;
  readonly month: string;
  /** The header's Assign quota button opens the modal for a new organization. */
  readonly assigning: boolean;
  readonly onAssignDone: () => void;
}

/**
 * Every organization with a geocoding subscription or usage in a month: totals,
 * a filtered, paged table, and a modal to give or change a quota.
 */
export default function GeocodingTenantsSection({
  dict,
  lang,
  filters,
  sort,
  month,
  assigning,
  onAssignDone,
}: Readonly<GeocodingTenantsSectionProps>) {
  const [page, setPage] = useState(1);
  const editor = useUsageQuotaEditor<QuotaTarget>(assigning, onAssignDone);

  const { plan } = useGeocodingPlan();
  const {
    organizations: usage,
    isLoading,
    error,
    saveSubscription,
  } = useGeocodingSubscriptions(month);
  const { organizations } = usePlatformOrganizations(true);

  const rows = useMemo(
    () => (plan ? tenantRows(usage, organizations, plan) : []),
    [usage, organizations, plan]
  );
  const totals = useMemo(() => tenantTotals(rows), [rows]);
  const alertPct = plan?.alertPct ?? 80;
  const shown = useMemo(
    () => visibleRows(rows, filters, sort, alertPct),
    [rows, filters, sort, alertPct]
  );
  const current = pageOf(shown, page);
  const orgs = useMemo(() => switcherOrgs(organizations), [organizations]);
  const subscribed = useMemo(
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
                text: numbers.format(totals.subscribed),
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
              icon={{ icon: HiOutlineGlobeAlt }}
              title={{
                text: tr("kpi.providerCalls", dict),
                className: "text-xs",
              }}
              value={{
                text: numbers.format(totals.providerCalls),
                className: "text-2xl",
              }}
              description={{
                text: tr("kpi.resolutions", dict, {
                  count: numbers.format(totals.resolutions),
                }),
              }}
              variant="horizontal"
            />
            <KpiStat
              icon={{ icon: HiOutlineDatabase }}
              title={{ text: tr("kpi.cache", dict), className: "text-xs" }}
              value={{
                text:
                  totals.cacheHitPct === null ? "—" : `${totals.cacheHitPct}%`,
                className: "text-2xl",
              }}
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
          tr("columns.cache", dict),
          tr("columns.providerCost", dict),
          tr("columns.charge", dict),
          tr("columns.onExhausted", dict),
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
            alertPct={alertPct}
            lang={lang}
            dict={dict}
            onEdit={() => editor.open(targetOf(row))}
          >
            <GeocodingCells row={row} lang={lang} dict={dict} />
          </UsageTenantTableRow>
        ))}
      </UsageTenantsTable>

      <GeocodingQuotaModal
        show={editor.show}
        target={editor.editing}
        orgs={orgs}
        subscribed={subscribed}
        planQuota={plan?.resolutionsPerMonth ?? 0}
        onClose={editor.close}
        onSave={async (organization, value) => {
          await saveSubscription(organization, value);
        }}
        dict={dict}
      />
    </>
  );
}

function targetOf(row: TenantRow): QuotaTarget {
  return {
    slug: row.slug,
    name: row.displayName,
    ownQuota: row.ownQuota,
    onExhausted: row.onExhausted,
  };
}

function GeocodingCells({
  row,
  lang,
  dict,
}: Readonly<{ row: TenantRow; lang: string; dict: I18nRecord }>) {
  const cache =
    row.resolutions === 0
      ? "—"
      : `${Math.round((row.cacheHits / row.resolutions) * 100)}%`;
  return (
    <>
      <td className="px-4 py-2.5">{cache}</td>
      <td className="px-4 py-2.5">{formatUsd(row.providerCostUsd, lang)}</td>
      <td className="px-4 py-2.5">
        {row.chargeUsd === null ? "—" : formatUsd(row.chargeUsd, lang)}
      </td>
      <td className="px-4 py-2.5">
        {row.subscribed
          ? trDynamic(`modes.${row.onExhausted}.label`, dict)
          : "—"}
      </td>
    </>
  );
}
