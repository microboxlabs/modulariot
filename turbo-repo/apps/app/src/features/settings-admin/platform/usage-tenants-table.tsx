"use client";

import type { ReactNode } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import { HiPencil } from "react-icons/hi";
import CatalogTable from "@/features/common/components/catalog-table";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import QuotaBar from "@/features/metered-usage/quota-bar";
import type { UsageTenantRow } from "./usage-tenants-view";

/**
 * A platform usage screen's body: the KPI tiles, then the table of
 * organizations with its loading, error, empty and no-match states and the
 * pager. Texts come from `dict`: `loadError`, `empty`, `noMatches`, `page`,
 * `previous`, `next`.
 */
export default function UsageTenantsTable({
  kpis,
  columns,
  isLoading,
  failed,
  filtering,
  rows,
  pages,
  page,
  onPage,
  total,
  dict,
  lang,
  children,
}: Readonly<{
  kpis: ReactNode;
  columns: string[];
  isLoading: boolean;
  failed: boolean;
  filtering: boolean;
  /** Rows on this page; used only to tell when the page is empty. */
  rows: readonly unknown[];
  pages: number;
  page: number;
  onPage: (page: number) => void;
  /** Rows across all pages. */
  total: number;
  dict: I18nRecord;
  lang: string;
  /** The rows, as `<tr>`. */
  children: ReactNode;
}>) {
  const numbers = new Intl.NumberFormat(lang);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {kpis}
      </div>

      {isLoading && <Spinner size="md" />}
      {failed && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {!isLoading && !failed && (
        <>
          <CatalogTable columns={columns}>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  {filtering ? tr("noMatches", dict) : tr("empty", dict)}
                </td>
              </tr>
            )}
            {children}
          </CatalogTable>

          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {tr("page", dict, {
                  page: String(Math.min(page, pages)),
                  pages: String(pages),
                  count: numbers.format(total),
                })}
              </span>
              <Button
                size="xs"
                color="light"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
              >
                {tr("previous", dict)}
              </Button>
              <Button
                size="xs"
                color="light"
                disabled={page >= pages}
                onClick={() => onPage(page + 1)}
              >
                {tr("next", dict)}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ROW =
  "border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40";

/**
 * One organization's row: name and slug, used against the quota, the
 * consumer's own cells, then the edit button. `quotaWithoutSubscription`
 * shows the bar for an organization on the plan's quota (telephony);
 * otherwise it gets a "no subscription" badge (geocoding).
 */
export function UsageTenantTableRow({
  row,
  alertPct,
  quotaWithoutSubscription = false,
  lang,
  dict,
  onEdit,
  children,
}: Readonly<{
  row: UsageTenantRow;
  alertPct: number;
  quotaWithoutSubscription?: boolean;
  lang: string;
  /** Uses `fromPlan`, `noSubscription`, `edit`. */
  dict: I18nRecord;
  onEdit: () => void;
  /** The cells between the quota and the edit button, as `<td>`. */
  children: ReactNode;
}>) {
  return (
    <tr className={ROW}>
      <td className="max-w-72 px-4 py-2.5">
        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {row.displayName}
        </div>
        <div className="truncate font-mono text-gray-400">{row.slug}</div>
      </td>
      <td className="min-w-48 px-4 py-2.5">
        {row.subscribed || quotaWithoutSubscription ? (
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
            <QuotaBar
              used={row.used}
              quota={row.quota}
              alertPct={alertPct}
              size="sm"
              className="mt-1"
            />
          </>
        ) : (
          <Badge color="warning" size="xs" className="w-fit">
            {tr("noSubscription", dict)}
          </Badge>
        )}
      </td>
      {children}
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
