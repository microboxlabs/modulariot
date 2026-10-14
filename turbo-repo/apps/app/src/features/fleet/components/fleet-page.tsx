"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Pagination,
  Select,
  Spinner,
  TextInput,
} from "flowbite-react";
import type { IconType } from "react-icons";
import { BsStars } from "react-icons/bs";
import {
  HiOutlineDocumentText,
  HiOutlineMap,
  HiOutlineSearch,
  HiOutlineStatusOffline,
  HiOutlineTruck,
} from "react-icons/hi";
import CustomTable from "@/features/common/components/custom-table/custom-table";
import { KpiStat } from "@/features/common/components/kpi-stat";
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
  DocumentBadge,
  FleetHeader,
  HarnessCard,
  StatusBadge,
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <FleetHeader crumbs={[{ label: tr("title", d) }]} filterDict={d} />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
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

/** A KPI tile that filters the table when pressed. */
function KpiFilter({
  icon,
  label,
  value,
  hint,
  active,
  onClick,
}: {
  readonly icon: IconType;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly active?: boolean;
  readonly onClick?: () => void;
}) {
  const stat = (
    <KpiStat
      icon={{ icon }}
      title={{ text: label, className: "text-xs whitespace-normal" }}
      value={{ text: value, className: "text-2xl" }}
      description={{ text: hint, className: "text-xs" }}
      variant="horizontal"
      className={`min-h-24 ${active ? "border-blue-600 ring-1 ring-blue-600 dark:border-blue-500" : ""}`}
    />
  );
  if (!onClick) return stat;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className="rounded-lg text-left focus:ring-2 focus:ring-blue-300 focus:outline-none dark:focus:ring-blue-800"
    >
      {stat}
    </button>
  );
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
  const toggleStatus = (status: AssetStatus) =>
    onChange({ status: filters.status === status ? undefined : status });

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr("title", d)}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("subtitle", d, {
            assets: formatNumber(summary.assets, lang),
            carriers: formatNumber(data.carriers.length, lang),
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="grid min-w-0 flex-[999_1_640px] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiFilter
            icon={HiOutlineTruck}
            label={tr("kpis.assets", d)}
            value={formatNumber(summary.assets, lang)}
            hint={tr("kpis.withSignal", d, {
              n: formatNumber(summary.withSignal, lang),
            })}
          />
          <KpiFilter
            icon={HiOutlineMap}
            label={tr("kpis.inTrip", d)}
            value={formatNumber(summary.inTrip, lang)}
            hint={tr("kpis.plannedToday", d, {
              n: formatNumber(summary.plannedToday, lang),
            })}
            active={filters.status === "IN_TRIP"}
            onClick={() => toggleStatus("IN_TRIP")}
          />
          <KpiFilter
            icon={HiOutlineDocumentText}
            label={tr("kpis.documentsDue", d)}
            value={formatNumber(summary.documentsDue, lang)}
            hint={tr("kpis.documentsDueHint", d)}
            active={!!filters.documentsDue}
            onClick={() => onChange({ documentsDue: !filters.documentsDue })}
          />
          <KpiFilter
            icon={HiOutlineStatusOffline}
            label={tr("kpis.noSignal", d)}
            value={formatNumber(summary.noSignal, lang)}
            hint={tr("kpis.noSignalHint", d)}
            active={filters.status === "NO_SIGNAL"}
            onClick={() => toggleStatus("NO_SIGNAL")}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px]">
          <HarnessCard
            title={tr("agent.title", d)}
            subtitle={tr("agent.subtitle", d)}
          >
            {summary.suggestions > 0 ? (
              <>
                <p className="text-sm text-gray-900 dark:text-white">
                  {tr("agent.listHeadline", d, {
                    n: formatNumber(summary.suggestions, lang),
                  })}{" "}
                  <span className="text-gray-600 dark:text-gray-300">
                    {tr("agent.listBody", d)}
                  </span>
                </p>
                <div>
                  <Button
                    size="xs"
                    color="dark"
                    onClick={() =>
                      onChange({ suggestions: !filters.suggestions })
                    }
                  >
                    {filters.suggestions
                      ? tr("agent.showAll", d)
                      : tr("agent.review", d)}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {tr("agent.listEmpty", d)}
              </p>
            )}
          </HarnessCard>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="xs"
          color={filters.kind ? "light" : "dark"}
          onClick={() => onChange({ kind: undefined })}
        >
          {tr("filters.all", d)} · {formatNumber(summary.assets, lang)}
        </Button>
        {kinds.map((kind) => (
          <Button
            key={kind}
            size="xs"
            color={filters.kind === kind ? "dark" : "light"}
            onClick={() => onChange({ kind })}
          >
            {trDynamic(`kindsPlural.${kind}`, d)} ·{" "}
            {formatNumber(kindCount(kind), lang)}
          </Button>
        ))}
        <div className="flex-[1_1_24px]" />
        <Select
          sizing="sm"
          aria-label={tr("filters.status", d)}
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
        </Select>
        <Select
          sizing="sm"
          className="max-w-64"
          aria-label={tr("filters.carrier", d)}
          value={filters.carrier ?? ""}
          onChange={(e) => onChange({ carrier: e.target.value || undefined })}
        >
          <option value="">{tr("filters.anyCarrier", d)}</option>
          {data.carriers.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value} ({formatNumber(c.count, lang)})
            </option>
          ))}
        </Select>
        <Select
          sizing="sm"
          aria-label={tr("filters.sort", d)}
          value={filters.sort ?? "id"}
          onChange={(e) =>
            onChange({ sort: e.target.value as AssetFilters["sort"] })
          }
        >
          <option value="id">{tr("filters.sortId", d)}</option>
          <option value="signal">{tr("filters.sortSignal", d)}</option>
          <option value="km">{tr("filters.sortKm", d)}</option>
        </Select>
        <TextInput
          sizing="sm"
          icon={HiOutlineSearch}
          className="w-full sm:w-72"
          aria-label={tr("filters.search", d)}
          placeholder={tr("filters.search", d)}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <AssetTable data={data} d={d} lang={lang} onPage={onPage} />
    </>
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
  const totalPages = Math.max(1, Math.ceil(data.total / data.size));
  const from = data.total === 0 ? 0 : data.page * data.size + 1;
  const to = Math.min((data.page + 1) * data.size, data.total);
  const header = [
    "asset",
    "carrier",
    "status",
    "driver",
    "nextTrip",
    "accreditation",
    "km30d",
    "lastSignal",
  ].map((key) => trDynamic(`table.${key}`, d));

  return (
    <div className="flex flex-col">
      <div className="min-h-32 max-h-[70vh] w-full overflow-y-auto rounded-lg border-2 border-gray-300 bg-gray-50 shadow-md dark:border-gray-600 dark:bg-gray-700">
        <CustomTable
          hoverable
          header={header}
          content={data.items.map((row) => cells(row, d, lang))}
          no_data_message={tr("table.empty", d)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("table.range", d, {
            from: formatNumber(from, lang),
            to: formatNumber(to, lang),
            total: formatNumber(data.total, lang),
          })}
        </p>
        {data.total > data.size && (
          <Pagination
            layout="pagination"
            nextLabel=""
            previousLabel=""
            showIcons
            currentPage={data.page + 1}
            totalPages={totalPages}
            onPageChange={(p) => onPage(p - 1)}
            theme={{
              pages: {
                base: "mt-1 mb-1 inline-flex items-center -space-x-px",
                selector: { active: "bg-blue-100 text-blue-500" },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

function cells(row: AssetRow, d: I18nRecord, lang: string) {
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
  return [
    <Link
      key="asset"
      href={`/${lang}/fleet/${encodeURIComponent(row.id)}`}
      className="flex flex-col"
      prefetch={false}
    >
      <span className="font-mono font-medium text-blue-600 hover:underline dark:text-blue-500">
        {row.id}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {row.label ?? trDynamic(`kinds.${row.kind}`, d)}
        {row.suggestions > 0 && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-amber-700 dark:text-amber-400">
            <BsStars className="h-3 w-3" aria-hidden />
            {row.suggestions}
          </span>
        )}
      </span>
    </Link>,
    <span key="carrier" className="text-gray-900 dark:text-white">
      {row.carrier ?? "—"}
    </span>,
    <StatusBadge key="status" status={row.status} d={d} />,
    <span key="driver">{row.driver ?? "—"}</span>,
    route ? (
      <span key="trip" className="flex flex-col">
        <span className="text-gray-900 dark:text-white">{route}</span>
        <span className="text-xs">{when}</span>
      </span>
    ) : (
      <span key="trip">{tr("table.noTrip", d)}</span>
    ),
    <DocumentBadge
      key="accreditation"
      status={row.accreditation.status}
      expiresAt={row.accreditation.expiresAt}
      d={d}
      lang={lang}
    />,
    <span key="km" className="tabular-nums">
      {formatNumber(row.km30d, lang)}
    </span>,
    <span key="signal">{ago(row.lastSignalAt, lang)}</span>,
  ];
}
