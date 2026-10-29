"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import {
  HiOutlineCurrencyDollar,
  HiOutlineDatabase,
  HiOutlineOfficeBuilding,
  HiOutlineGlobeAlt,
  HiPencil,
  HiPlus,
} from "react-icons/hi";
import CatalogTable from "@/features/common/components/catalog-table";
import FilterSearch from "@/features/common/components/filter-search";
import { KpiStat } from "@/features/common/components/kpi-stat";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  formatUsd,
  monthOf,
  quotaLevel,
  quotaPercent,
  type QuotaLevel,
} from "@/features/geocoding/geocoding-plan-view";
import { MonthPicker } from "@/features/geocoding/geocoding-usage";
import GeocodingQuotaModal, { type QuotaTarget } from "./geocoding-quota-modal";
import {
  pageOf,
  switcherOrgs,
  tenantRows,
  tenantTotals,
  visibleRows,
  type TenantRow,
} from "./geocoding-tenants-view";
import {
  useGeocodingPlan,
  useGeocodingSubscriptions,
} from "./use-geocoding-plan";
import { usePlatformOrganizations } from "./use-platform-organizations";

interface GeocodingTenantsSectionProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

const BAR: Record<QuotaLevel, string> = {
  ok: "bg-blue-500",
  alert: "bg-amber-500",
  exhausted: "bg-red-500",
};

/**
 * Every organization with a geocoding subscription or usage in a month: totals,
 * a searchable, paged table, and a modal to give or change a quota.
 */
export default function GeocodingTenantsSection({
  dict,
  lang,
}: GeocodingTenantsSectionProps) {
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<QuotaTarget | null>(null);
  const [showModal, setShowModal] = useState(false);

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
  const shown = useMemo(() => visibleRows(rows, query), [rows, query]);
  const current = pageOf(shown, page);
  const orgs = useMemo(() => switcherOrgs(organizations), [organizations]);
  const subscribed = useMemo(
    () => new Set(rows.filter((r) => r.subscribed).map((r) => r.slug)),
    [rows]
  );

  useEffect(() => setPage(1), [query, month]);

  const open = (row: TenantRow | null) => {
    setEditing(
      row && {
        slug: row.slug,
        name: row.displayName,
        ownQuota: row.ownQuota,
        onExhausted: row.onExhausted,
      }
    );
    setShowModal(true);
  };

  const numbers = new Intl.NumberFormat(lang);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker month={month} onMonth={setMonth} lang={lang} d={dict} />
        <div className="min-w-56 flex-1">
          <FilterSearch
            value={query}
            onChange={setQuery}
            label={tr("search", dict)}
            placeholder={tr("search", dict)}
          />
        </div>
        <Button size="sm" color="blue" onClick={() => open(null)}>
          <HiPlus className="mr-1 h-4 w-4" />
          {tr("assign", dict)}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          title={{ text: tr("kpi.providerCalls", dict), className: "text-xs" }}
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
            text: totals.cacheHitPct === null ? "—" : `${totals.cacheHitPct}%`,
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
      </div>

      {isLoading && <Spinner size="md" />}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <CatalogTable
            columns={[
              tr("columns.organization", dict),
              tr("columns.quota", dict),
              tr("columns.cache", dict),
              tr("columns.providerCost", dict),
              tr("columns.charge", dict),
              tr("columns.onExhausted", dict),
              "",
            ]}
          >
            {current.rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  {query ? tr("noMatches", dict) : tr("empty", dict)}
                </td>
              </tr>
            )}
            {current.rows.map((row) => (
              <TenantTableRow
                key={row.slug}
                row={row}
                alertPct={plan?.alertPct ?? 80}
                lang={lang}
                dict={dict}
                onEdit={() => open(row)}
              />
            ))}
          </CatalogTable>

          {current.pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {tr("page", dict, {
                  page: String(Math.min(page, current.pages)),
                  pages: String(current.pages),
                  count: numbers.format(shown.length),
                })}
              </span>
              <Button
                size="xs"
                color="light"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {tr("previous", dict)}
              </Button>
              <Button
                size="xs"
                color="light"
                disabled={page >= current.pages}
                onClick={() => setPage(page + 1)}
              >
                {tr("next", dict)}
              </Button>
            </div>
          )}
        </>
      )}

      <GeocodingQuotaModal
        show={showModal}
        target={editing}
        orgs={orgs}
        subscribed={subscribed}
        planQuota={plan?.resolutionsPerMonth ?? 0}
        onClose={() => setShowModal(false)}
        onSave={async (organization, value) => {
          await saveSubscription(organization, value);
        }}
        dict={dict}
      />
    </div>
  );
}

function TenantTableRow({
  row,
  alertPct,
  lang,
  dict,
  onEdit,
}: Readonly<{
  row: TenantRow;
  alertPct: number;
  lang: string;
  dict: I18nRecord;
  onEdit: () => void;
}>) {
  const level = quotaLevel(row.used, row.quota, alertPct);
  const cache =
    row.resolutions === 0
      ? "—"
      : `${Math.round((row.cacheHits / row.resolutions) * 100)}%`;
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
      <td className="max-w-72 px-4 py-2.5">
        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {row.displayName}
        </div>
        <div className="truncate font-mono text-gray-400">{row.slug}</div>
      </td>
      <td className="min-w-48 px-4 py-2.5">
        {row.subscribed ? (
          <>
            <div className="flex justify-between gap-2">
              <span>
                {row.used.toLocaleString(lang)} /{" "}
                {row.quota.toLocaleString(lang)}
              </span>
              <span className="text-gray-400">
                {row.ownQuota === null ? tr("fromPlan", dict) : ""}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full ${BAR[level]}`}
                style={{ width: `${quotaPercent(row.used, row.quota)}%` }}
              />
            </div>
          </>
        ) : (
          <Badge color="warning" size="xs" className="w-fit">
            {tr("noSubscription", dict)}
          </Badge>
        )}
      </td>
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
      <td className="px-2 py-2.5 text-right">
        <Button
          size="xs"
          color="light"
          onClick={onEdit}
          aria-label={tr("edit", dict)}
        >
          <HiPencil className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
