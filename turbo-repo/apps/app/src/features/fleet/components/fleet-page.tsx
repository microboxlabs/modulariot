"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Spinner } from "flowbite-react";
import { HiOutlineSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "@/features/settings-admin/data/json-client";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import {
  ASSET_KINDS,
  ago,
  formatDateTime,
  formatNumber,
  useFleetAssets,
  type AssetFilters,
  type AssetKind,
  type AssetPage,
  type AssetRow,
  type AssetStatus,
} from "../fleet-api";
import {
  AgentCard,
  CAPTION,
  DocumentText,
  Kpi,
  PANEL,
  PageHeader,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  StatusPill,
} from "./fleet-ui";

const VIEW = "fleet:assets.view";
const PAGE_SIZE = 50;
const STATUSES: AssetStatus[] = ["IN_TRIP", "AVAILABLE", "NO_SIGNAL"];

interface FleetPageProps {
  /** `pages.fleet` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** A 503 means no fleet source is configured; anything else is a load failure. */
export function errorMessage(error: unknown, d: I18nRecord): string {
  if (error instanceof ApiError && error.status === 503) {
    return tr("unavailable", d);
  }
  if (error instanceof ApiError && error.status === 404) {
    return tr("notFound", d);
  }
  return tr("loadFailed", d);
}

/** Waits until typing pauses before the value changes. */
function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Fleet: every asset the organization sees, filled from its integrations. */
export default function FleetPage({ dict, lang }: FleetPageProps) {
  const d = dict ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can(VIEW);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [filters, setFilters] = useState<AssetFilters>({ sort: "id" });
  const [page, setPage] = useState(0);
  const query: AssetFilters = { ...filters, q, page, size: PAGE_SIZE };
  const { data, error, isLoading } = useFleetAssets(query, allowed);

  const change = (next: Partial<AssetFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(0);
  };
  useEffect(() => setPage(0), [q]);

  const loading = !accessError && (!access || (isLoading && !data));
  const failure = accessError ?? (data ? undefined : error);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
        <PageHeader
          caption={tr("breadcrumb.fleet", d)}
          title={tr("title", d)}
        />
        {loading && <Spinner className="mx-auto" />}
        {!loading && failure && (
          <Alert color="gray">{errorMessage(failure, d)}</Alert>
        )}
        {!loading && !failure && !allowed && (
          <Alert color="gray">{tr("notAllowed", d)}</Alert>
        )}
        {data && allowed && (
          <FleetContent
            data={data}
            d={d}
            lang={lang}
            filters={filters}
            search={search}
            onSearch={setSearch}
            onChange={change}
            onPage={setPage}
          />
        )}
      </div>
    </div>
  );
}

interface ContentProps {
  readonly data: AssetPage;
  readonly d: I18nRecord;
  readonly lang: string;
  readonly filters: AssetFilters;
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly onChange: (next: Partial<AssetFilters>) => void;
  readonly onPage: (page: number) => void;
}

function FleetContent({
  data,
  d,
  lang,
  filters,
  search,
  onSearch,
  onChange,
  onPage,
}: ContentProps) {
  const { summary } = data;
  const kindCount = (kind: AssetKind) =>
    data.kinds.find((k) => k.value === kind)?.count ?? 0;
  const kinds = ASSET_KINDS.filter((k) => kindCount(k) > 0);

  return (
    <>
      <p className="-mt-4 text-sm text-gray-600 dark:text-gray-400">
        {tr("subtitle", d, {
          assets: formatNumber(summary.assets, lang),
          carriers: formatNumber(data.carriers.length, lang),
        })}
      </p>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="grid min-w-0 flex-[999_1_640px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <Kpi
            label={tr("kpis.assets", d)}
            value={formatNumber(summary.assets, lang)}
            hint={tr("kpis.withSignal", d, {
              n: formatNumber(summary.withSignal, lang),
            })}
            tone="good"
          />
          <Kpi
            label={tr("kpis.inTrip", d)}
            value={formatNumber(summary.inTrip, lang)}
            hint={tr("kpis.plannedToday", d, {
              n: formatNumber(summary.plannedToday, lang),
            })}
            onClick={() =>
              onChange({
                status: filters.status === "IN_TRIP" ? undefined : "IN_TRIP",
              })
            }
            active={filters.status === "IN_TRIP"}
          />
          <Kpi
            label={tr("kpis.documentsDue", d)}
            value={formatNumber(summary.documentsDue, lang)}
            hint={tr("kpis.documentsDueHint", d)}
            tone={summary.documentsDue > 0 ? "warn" : "muted"}
            onClick={() => onChange({ documentsDue: !filters.documentsDue })}
            active={!!filters.documentsDue}
          />
          <Kpi
            label={tr("kpis.noSignal", d)}
            value={formatNumber(summary.noSignal, lang)}
            hint={tr("kpis.noSignalHint", d)}
            tone={summary.noSignal > 0 ? "bad" : "muted"}
            onClick={() =>
              onChange({
                status:
                  filters.status === "NO_SIGNAL" ? undefined : "NO_SIGNAL",
              })
            }
            active={filters.status === "NO_SIGNAL"}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px]">
          <AgentCard title={tr("agent.title", d)}>
            {summary.suggestions > 0 ? (
              <>
                <p className="text-base leading-snug font-medium text-gray-900 dark:text-white">
                  {tr("agent.listHeadline", d, {
                    n: formatNumber(summary.suggestions, lang),
                  })}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {tr("agent.listBody", d)}
                </p>
                <div>
                  <button
                    type="button"
                    className={PRIMARY_BUTTON}
                    onClick={() =>
                      onChange({ suggestions: !filters.suggestions })
                    }
                    aria-pressed={!!filters.suggestions}
                  >
                    {filters.suggestions
                      ? tr("agent.showAll", d)
                      : tr("agent.review", d)}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {tr("agent.listEmpty", d)}
              </p>
            )}
          </AgentCard>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label={tr("filters.all", d)}
          count={summary.assets}
          active={!filters.kind}
          onClick={() => onChange({ kind: undefined })}
          lang={lang}
        />
        {kinds.map((kind) => (
          <FilterChip
            key={kind}
            label={trDynamic(`kindsPlural.${kind}`, d)}
            count={kindCount(kind)}
            active={filters.kind === kind}
            onClick={() => onChange({ kind })}
            lang={lang}
          />
        ))}
        <div className="flex-[1_1_24px]" />
        <label className="sr-only" htmlFor="fleet-status">
          {tr("filters.status", d)}
        </label>
        <select
          id="fleet-status"
          className={`${SECONDARY_BUTTON} pr-8`}
          value={filters.status ?? ""}
          onChange={(e) =>
            onChange({ status: (e.target.value || undefined) as AssetStatus })
          }
        >
          <option value="">{tr("filters.anyStatus", d)}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {trDynamic(`status.${s}`, d)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="fleet-carrier">
          {tr("filters.carrier", d)}
        </label>
        <select
          id="fleet-carrier"
          className={`${SECONDARY_BUTTON} max-w-64 pr-8`}
          value={filters.carrier ?? ""}
          onChange={(e) => onChange({ carrier: e.target.value || undefined })}
        >
          <option value="">{tr("filters.anyCarrier", d)}</option>
          {data.carriers.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value} ({formatNumber(c.count, lang)})
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="fleet-sort">
          {tr("filters.sort", d)}
        </label>
        <select
          id="fleet-sort"
          className={`${SECONDARY_BUTTON} pr-8`}
          value={filters.sort ?? "id"}
          onChange={(e) =>
            onChange({ sort: e.target.value as AssetFilters["sort"] })
          }
        >
          <option value="id">{tr("filters.sortId", d)}</option>
          <option value="signal">{tr("filters.sortSignal", d)}</option>
          <option value="km">{tr("filters.sortKm", d)}</option>
        </select>
        <label className="flex min-h-10 flex-[0_1_300px] items-center gap-2 rounded-full border border-gray-300 bg-white px-4 dark:border-gray-600 dark:bg-gray-800">
          <HiOutlineSearch
            className="h-4 w-4 shrink-0 text-gray-500"
            aria-hidden
          />
          <input
            aria-label={tr("filters.search", d)}
            placeholder={tr("filters.search", d)}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full border-0 bg-transparent p-0 text-sm text-gray-900 focus:ring-0 dark:text-white"
          />
        </label>
      </div>

      <AssetTable data={data} d={d} lang={lang} onPage={onPage} />
    </>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  lang,
}: {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly lang: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "inline-flex min-h-10 items-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
          : SECONDARY_BUTTON
      }
    >
      {label}
      <span className="opacity-70">{formatNumber(count, lang)}</span>
    </button>
  );
}

function AssetTable({
  data,
  d,
  lang,
  onPage,
}: {
  readonly data: AssetPage;
  readonly d: I18nRecord;
  readonly lang: string;
  readonly onPage: (page: number) => void;
}) {
  const from = data.total === 0 ? 0 : data.page * data.size + 1;
  const to = Math.min((data.page + 1) * data.size, data.total);
  return (
    <section className={`${PANEL} p-1.5`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead>
            <tr>
              {[
                "asset",
                "carrier",
                "status",
                "driver",
                "nextTrip",
                "accreditation",
                "km30d",
                "lastSignal",
              ].map((key) => (
                <th key={key} className={`${CAPTION} px-4 py-3`} scope="col">
                  {trDynamic(`table.${key}`, d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {data.items.map((row) => (
              <AssetTableRow key={row.id} row={row} d={d} lang={lang} />
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 && (
        <p className="p-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {tr("table.empty", d)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm text-gray-600 dark:text-gray-400">
        <span>
          {tr("table.range", d, {
            from: formatNumber(from, lang),
            to: formatNumber(to, lang),
            total: formatNumber(data.total, lang),
          })}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={data.page === 0}
            onClick={() => onPage(data.page - 1)}
          >
            {tr("table.previous", d)}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={to >= data.total}
            onClick={() => onPage(data.page + 1)}
          >
            {tr("table.next", d)}
          </button>
        </div>
      </div>
    </section>
  );
}

function AssetTableRow({
  row,
  d,
  lang,
}: {
  readonly row: AssetRow;
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  const trip = row.currentTrip ?? row.nextTrip;
  const route = trip
    ? [trip.origin, trip.destination].filter(Boolean).join(" → ") || trip.id
    : null;
  let when = "";
  if (row.currentTrip) {
    when = tr("table.inProgress", d);
  } else if (row.nextTrip) {
    when = formatDateTime(row.nextTrip.start, lang);
  }
  return (
    <tr className="border-t border-gray-200 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
      <td className="px-4 py-3.5">
        <Link
          href={`/${lang}/fleet/${encodeURIComponent(row.id)}`}
          className="flex flex-col gap-0.5 text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
          prefetch={false}
        >
          <span className="font-mono text-sm font-medium">{row.id}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {row.label ?? trDynamic(`kinds.${row.kind}`, d)}
            {row.suggestions > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-1.5 text-[11px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {row.suggestions}
              </span>
            )}
          </span>
        </Link>
      </td>
      <td className="px-4 py-3.5 text-gray-900 dark:text-white">
        {row.carrier ?? "—"}
      </td>
      <td className="px-4 py-3.5">
        <StatusPill status={row.status} d={d} />
      </td>
      <td className="px-4 py-3.5 text-gray-900 dark:text-white">
        {row.driver ?? "—"}
      </td>
      <td className="px-4 py-3.5">
        {route ? (
          <>
            <div className="text-gray-900 dark:text-white">{route}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {when}
            </div>
          </>
        ) : (
          <span className="text-gray-600 dark:text-gray-400">
            {tr("table.noTrip", d)}
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <DocumentText
          status={row.accreditation.status}
          expiresAt={row.accreditation.expiresAt}
          d={d}
          lang={lang}
        />
      </td>
      <td className="px-4 py-3.5 text-gray-900 tabular-nums dark:text-white">
        {formatNumber(row.km30d, lang)}
      </td>
      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400">
        {ago(row.lastSignalAt, lang)}
      </td>
    </tr>
  );
}
