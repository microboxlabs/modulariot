"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineBell,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineSearch,
  HiOutlineRefresh,
} from "react-icons/hi";
import { useDebounce } from "use-debounce";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import {
  JOB_STATES,
  JOB_STATE_DOT,
  formatDateTime,
  jobContextLine,
  jobLabel,
  jobTypeLabel,
  readJobOp,
  relativeAge,
  shortJobId,
  type AsyncJob,
  type JobState,
} from "../integration-job.types";
import {
  useIntegrationJobs,
  useIntegrationJobsCount,
  useIntegrationJobsOverview,
} from "../use-integration-jobs";
import { useJobEvents } from "../use-job-events";
import JobDetailPanel from "./job-detail-panel";
import JobStateBadge from "./job-state-badge";
import NotificationRulesPanel from "./notification-rules-panel";

interface JobConsolePageContentProps {
  readonly dict: I18nRecord;
}

const PAGE_SIZES = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;
/** Long enough that typing a correlation key is one request, not eight. */
const SEARCH_DEBOUNCE_MS = 350;

const CONTEXT_TONE: Record<JobState, string> = {
  PENDING: "text-amber-600 dark:text-amber-400",
  RUNNING: "text-blue-600 dark:text-blue-400",
  SUCCEEDED: "text-green-700 dark:text-green-400",
  FAILED: "text-rose-600 dark:text-rose-400",
  CANCELLED: "text-gray-500 dark:text-gray-400",
};

export default function JobConsolePageContent({ dict }: JobConsolePageContentProps) {
  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;

  const [stateFilter, setStateFilter] = useState<JobState | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [laneFilter, setLaneFilter] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search] = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // One right-hand panel at a time: a job opens the detail, the bell opens
  // the notification rules — each closes the other.
  const openJob = (jobId: string) => {
    setRulesOpen(false);
    setSelectedJobId(jobId);
  };

  // Countdown/age labels tick every 5s without refetching.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const { overview, isLoading: overviewLoading } = useIntegrationJobsOverview(orgSlug);

  // Every filter is applied by the backend over the whole ledger — a console
  // that sifted only the loaded page would hide the rows being looked for.
  const filters = useMemo(
    () => ({
      state: stateFilter ?? undefined,
      jobType: typeFilter || undefined,
      executor: laneFilter || undefined,
      search: search.trim() || undefined,
    }),
    [stateFilter, typeFilter, laneFilter, search],
  );

  // A filter change re-slices the ledger, so the first page is the only one we
  // can know exists. Reset during render rather than in an effect: an effect
  // would let one request go out at the previous filters' offset first.
  const [pagedFilters, setPagedFilters] = useState(filters);
  if (pagedFilters !== filters) {
    setPagedFilters(filters);
    setPage(0);
  }

  const { jobs, isLoading, error, refresh } = useIntegrationJobs(orgSlug, {
    ...filters,
    limit: pageSize,
    offset: page * pageSize,
  });
  const { total } = useIntegrationJobsCount(orgSlug, filters);
  const { connected, liveConfigured } = useJobEvents(orgSlug);

  // Dropdown options are facets of the whole ledger, not of the rows on
  // screen — otherwise they would change as the operator pages. Older
  // backends don't send them; fall back to what this page holds.
  const jobTypes = useMemo(() => {
    const types = new Set<string>(overview?.jobTypes ?? jobs.map((job) => job.jobType));
    if (typeFilter) types.add(typeFilter);
    return [...types].sort((a, b) => a.localeCompare(b));
  }, [overview?.jobTypes, jobs, typeFilter]);

  const lanes = useMemo(() => {
    const executors = new Set<string>(overview?.executors ?? jobs.map((job) => job.executor));
    if (laneFilter) executors.add(laneFilter);
    return [...executors].sort((a, b) => a.localeCompare(b));
  }, [overview?.executors, jobs, laneFilter]);

  const counts = overview?.counts;
  const firstRow = jobs.length === 0 ? 0 : page * pageSize + 1;
  const lastRow = page * pageSize + jobs.length;
  // With no total (older backend), a full page is the only hint there is more.
  const hasNextPage = total === null ? jobs.length === pageSize : lastRow < total;

  let liveDotClass = "bg-gray-400";
  if (connected) liveDotClass = "animate-pulse bg-green-500";
  else if (liveConfigured) liveDotClass = "bg-amber-500";

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tr("title", dict)}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr("subtitle", dict)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            title={liveConfigured ? undefined : tr("live.notConfigured", dict)}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${liveDotClass}`} />
            {connected ? tr("live.connected", dict) : tr("live.disconnected", dict)}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedJobId(null);
              setRulesOpen((open) => !open);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              rulesOpen
                ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <HiOutlineBell className="h-3.5 w-3.5" />
            {tr("notifications.button", dict)}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiOutlineRefresh className="h-3.5 w-3.5" />
            {tr("refresh", dict)}
          </button>
        </div>
      </div>

      {/* state summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {JOB_STATES.map((state) => {
          const active = stateFilter === state;
          const count = counts?.[state];
          return (
            <button
              key={state}
              type="button"
              onClick={() => setStateFilter(active ? null : state)}
              className={`rounded-lg border bg-white p-3 text-left transition-colors dark:bg-gray-800 ${
                active
                  ? "border-gray-900 ring-2 ring-gray-900/10 dark:border-white dark:ring-white/10"
                  : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {count ?? (overviewLoading ? "…" : 0)}
                </span>
                <span className={`h-2 w-2 rounded-full ${JOB_STATE_DOT[state]}`} />
              </div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tr(`states.${state}`, dict)}</div>
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStateFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs ${
              stateFilter === null
                ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {tr("filters.all", dict)}
          </button>
          {JOB_STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setStateFilter(stateFilter === state ? null : state)}
              className={`rounded-full border px-3 py-1 text-xs ${
                stateFilter === state
                  ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tr(`states.${state}`, dict)}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <select
          value={laneFilter}
          onChange={(event) => setLaneFilter(event.target.value)}
          className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">{tr("filters.allLanes", dict)}</option>
          {lanes.map((lane) => (
            <option key={lane} value={lane}>
              {lane}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">{tr("filters.allTypes", dict)}</option>
          {jobTypes.map((type) => (
            <option key={type} value={type}>
              {jobTypeLabel(type)}
            </option>
          ))}
        </select>
        <label className="relative">
          <HiOutlineSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={tr("filters.searchPlaceholder", dict)}
            title={tr("filters.searchHint", dict)}
            className="h-8 w-56 rounded-lg border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {tr("loadError", dict)}
        </div>
      )}

      {/* table + detail */}
      <div
        className={`grid grid-cols-1 items-start gap-4 ${selectedJobId || rulesOpen ? "xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}
      >
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr("table.title", dict)} · {(total ?? jobs.length).toLocaleString()}
            </span>
            <span className="flex-1" />
            <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
              async_jobs · miot_integrations
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  <th className="px-4 py-2 font-semibold">{tr("table.job", dict)}</th>
                  <th className="px-2 py-2 font-semibold">{tr("table.correlation", dict)}</th>
                  <th className="px-2 py-2 font-semibold">{tr("table.lane", dict)}</th>
                  <th className="px-2 py-2 font-semibold">{tr("table.state", dict)}</th>
                  <th className="px-2 py-2 font-semibold">{tr("table.attempts", dict)}</th>
                  <th className="px-2 py-2 font-semibold">{tr("table.detail", dict)}</th>
                  <th className="px-2 py-2 text-right font-semibold">{tr("table.age", dict)}</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {isLoading && jobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                      {tr("table.loading", dict)}
                    </td>
                  </tr>
                )}
                {!isLoading && jobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                      {tr("table.empty", dict)}
                    </td>
                  </tr>
                )}
                {jobs.map((job: AsyncJob) => (
                  <tr
                    key={job.id}
                    onClick={() => openJob(job.id)}
                    className={`cursor-pointer border-b border-gray-50 last:border-0 dark:border-gray-700/50 ${
                      selectedJobId === job.id
                        ? "bg-gray-100 dark:bg-gray-700/60"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      {/* Native button = the keyboard/AT path for opening the
                          detail panel; the row onClick is mouse convenience. */}
                      <button
                        type="button"
                        onClick={() => openJob(job.id)}
                        className="block text-left"
                      >
                        <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">
                          {jobLabel(job.jobType, readJobOp(job.payload))}
                        </span>
                        <span className="block font-mono text-[10px] text-gray-400 dark:text-gray-500">
                          {shortJobId(job.id)}
                          {job.chainKey ? ` · ${tr("table.chainStep", dict)} ${job.chainSequence}` : ""}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {job.correlationKey ?? "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {job.executor}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <JobStateBadge state={job.state} label={tr(`states.${job.state}`, dict)} />
                    </td>
                    <td
                      className={`px-2 py-2.5 font-mono text-xs ${
                        job.attempts > 1 ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className={`max-w-[220px] truncate px-2 py-2.5 text-xs ${CONTEXT_TONE[job.state]}`}>
                      {jobContextLine(job, nowMs)}
                    </td>
                    <td
                      className="px-2 py-2.5 text-right text-[11px] text-gray-400 dark:text-gray-500"
                      title={formatDateTime(job.createdAt)}
                    >
                      {relativeAge(job.createdAt, nowMs)}
                    </td>
                    <td className="px-2 py-2.5 text-gray-300 dark:text-gray-600">
                      <HiOutlineChevronRight className="h-3.5 w-3.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pager — the table shows one window of a ledger that runs to tens
              of thousands of rows, so the range and the controls are the only
              way to reach anything but the newest jobs. */}
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2.5 dark:border-gray-700">
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {total === null
                ? tr("pagination.rangeUnknown", dict, {
                    from: firstRow.toLocaleString(),
                    to: lastRow.toLocaleString(),
                  })
                : tr("pagination.range", dict, {
                    from: firstRow.toLocaleString(),
                    to: lastRow.toLocaleString(),
                    total: total.toLocaleString(),
                  })}
            </span>
            <span className="flex-1" />
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
                className="h-7 rounded-lg border border-gray-300 bg-white px-1.5 text-xs text-gray-700 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              {tr("pagination.perPage", dict)}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <HiOutlineChevronLeft className="h-3.5 w-3.5" />
                {tr("pagination.previous", dict)}
              </button>
              <button
                type="button"
                disabled={!hasNextPage}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tr("pagination.next", dict)}
                <HiOutlineChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {selectedJobId && orgSlug && (
          <JobDetailPanel
            orgSlug={orgSlug}
            jobId={selectedJobId}
            dict={dict}
            nowMs={nowMs}
            onClose={() => setSelectedJobId(null)}
            onSelectJob={openJob}
          />
        )}
        {rulesOpen && orgSlug && (
          <NotificationRulesPanel
            orgSlug={orgSlug}
            jobTypes={jobTypes}
            dict={dict}
            onClose={() => setRulesOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
