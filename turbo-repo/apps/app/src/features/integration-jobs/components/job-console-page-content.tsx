"use client";

import { useEffect, useMemo, useState } from "react";
import { HiOutlineChevronRight, HiOutlineSearch, HiOutlineRefresh } from "react-icons/hi";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import {
  JOB_STATES,
  JOB_STATE_DOT,
  jobContextLine,
  jobTypeLabel,
  relativeAge,
  shortJobId,
  type AsyncJob,
  type JobState,
} from "../integration-job.types";
import { useIntegrationJobs, useIntegrationJobsOverview } from "../use-integration-jobs";
import { useJobEvents } from "../use-job-events";
import JobDetailPanel from "./job-detail-panel";
import JobStateBadge from "./job-state-badge";

interface JobConsolePageContentProps {
  readonly dict: I18nRecord;
}

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
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Countdown/age labels tick every 5s without refetching.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const { overview, isLoading: overviewLoading } = useIntegrationJobsOverview(orgSlug);
  const { jobs, isLoading, error, refresh } = useIntegrationJobs(orgSlug, {
    state: stateFilter ?? undefined,
    jobType: typeFilter || undefined,
    limit: 100,
  });
  const { connected, liveConfigured } = useJobEvents(orgSlug);

  const jobTypes = useMemo(() => {
    const types = new Set<string>(jobs.map((job) => job.jobType));
    if (typeFilter) types.add(typeFilter);
    return [...types].sort((a, b) => a.localeCompare(b));
  }, [jobs, typeFilter]);

  const lanes = useMemo(() => [...new Set(jobs.map((job) => job.executor))].sort((a, b) => a.localeCompare(b)), [jobs]);

  const visibleJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter(
      (job) =>
        (!laneFilter || job.executor === laneFilter) &&
        (!query ||
          job.id.startsWith(query) ||
          (job.correlationKey ?? "").toLowerCase().includes(query) ||
          (job.chainKey ?? "").toLowerCase().includes(query)),
    );
  }, [jobs, laneFilter, search]);

  const counts = overview?.counts;

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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tr("filters.searchPlaceholder", dict)}
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
        className={`grid grid-cols-1 items-start gap-4 ${selectedJobId ? "xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}
      >
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr("table.title", dict)} · {visibleJobs.length}
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
                {!isLoading && visibleJobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                      {tr("table.empty", dict)}
                    </td>
                  </tr>
                )}
                {visibleJobs.map((job: AsyncJob) => (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
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
                        onClick={() => setSelectedJobId(job.id)}
                        className="block text-left"
                      >
                        <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">
                          {jobTypeLabel(job.jobType)}
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
                    <td className="px-2 py-2.5 text-right text-[11px] text-gray-400 dark:text-gray-500">
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
        </div>

        {selectedJobId && orgSlug && (
          <JobDetailPanel
            orgSlug={orgSlug}
            jobId={selectedJobId}
            dict={dict}
            nowMs={nowMs}
            onClose={() => setSelectedJobId(null)}
            onSelectJob={setSelectedJobId}
          />
        )}
      </div>
    </div>
  );
}
