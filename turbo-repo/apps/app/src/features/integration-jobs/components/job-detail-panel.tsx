"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { HiOutlineX, HiLightningBolt, HiCheck } from "react-icons/hi";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  canRetry,
  countdownTo,
  jobTypeLabel,
  relativeAge,
  shortJobId,
  sortChain,
  JOB_STATE_DOT,
  type AsyncJob,
  type AsyncJobAttempt,
} from "../integration-job.types";
import { useIntegrationJob, useIntegrationJobChain, useRetryJob } from "../use-integration-jobs";
import JobStateBadge from "./job-state-badge";

type DetailTab = "overview" | "attempts" | "payload" | "chain";

interface JobDetailPanelProps {
  readonly orgSlug: string;
  readonly jobId: string;
  readonly dict: I18nRecord;
  readonly nowMs: number;
  readonly onClose: () => void;
  readonly onSelectJob: (jobId: string) => void;
}

function Stat({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 min-w-0">
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
      <div
        className={`mt-0.5 truncate text-gray-900 dark:text-white ${
          mono ? "font-mono text-xs" : "text-sm font-semibold"
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

interface TimelineNode {
  readonly key: string;
  readonly dotClass: string;
  readonly hollow?: boolean;
  readonly title: string;
  readonly meta: string;
  readonly error?: string | null;
}

function historyDotClass(outcome: string): string {
  if (outcome === "RETRY_REQUESTED") return "bg-amber-500";
  if (outcome === "FAILED") return "bg-rose-500";
  return "bg-green-500";
}

function chainBadgeClass(memberState: string, isCurrent: boolean): string {
  if (memberState === "SUCCEEDED") return "bg-green-500 text-white";
  if (isCurrent) return "bg-gray-900 text-white dark:bg-white dark:text-gray-900";
  return "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

function timelineNodes(job: AsyncJob, dict: I18nRecord, nowMs: number): TimelineNode[] {
  const nodes: TimelineNode[] = [
    {
      key: "enqueued",
      dotClass: "bg-gray-400",
      title: `${tr("timeline.enqueuedBy", dict)} ${job.enqueuedBy}`,
      meta: `${job.sourceInstance} · ${relativeAge(job.createdAt, nowMs)}`,
    },
  ];
  job.attemptHistory.forEach((entry: AsyncJobAttempt, index) => {
    const outcome = typeof entry.outcome === "string" ? entry.outcome : "";
    const isFailure = outcome === "FAILED";
    const isManual = outcome === "RETRY_REQUESTED";
    nodes.push({
      key: `h-${index}`,
      dotClass: historyDotClass(outcome),
      title: isManual ? tr("timeline.manualRetry", dict) : `${tr("timeline.report", dict)} — ${outcome.toLowerCase()}`,
      meta: [entry.by, entry.at ? relativeAge(entry.at, nowMs) : null].filter(Boolean).join(" · "),
      error: isFailure && typeof entry.detail === "string" ? entry.detail : null,
    });
  });
  if (job.state === "RUNNING") {
    nodes.push({
      key: "running",
      dotClass: "bg-blue-500 animate-pulse",
      title: `${tr("timeline.running", dict)} · ${tr("detail.attempt", dict)} ${job.attempts}`,
      meta: job.lockedBy ?? "",
    });
  }
  if (job.state === "PENDING" && job.nextRetryAt) {
    nodes.push({
      key: "scheduled",
      dotClass: "border-2 border-dashed border-amber-500 bg-transparent",
      hollow: true,
      title: `${tr("timeline.retryScheduled", dict)} ${Math.min(job.attempts + 1, job.maxAttempts)}`,
      meta: `${tr("timeline.backoff", dict)} · ${countdownTo(job.nextRetryAt, nowMs)}`,
    });
  }
  return nodes;
}

export default function JobDetailPanel({
  orgSlug,
  jobId,
  dict,
  nowMs,
  onClose,
  onSelectJob,
}: JobDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const { job, isLoading, error } = useIntegrationJob(orgSlug, jobId);
  const { chain } = useIntegrationJobChain(orgSlug, job?.chainKey ?? null);
  const { retry, retrying, retryError } = useRetryJob(orgSlug);

  if (isLoading || !job) {
    return (
      <aside className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 h-fit">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {error ? tr("detail.loadError", dict) : tr("detail.loading", dict)}
        </div>
      </aside>
    );
  }

  const handleTabChange = (key: DetailTab) => () => setTab(key);
  const handleSelectChainJob = (id: string) => () => onSelectJob(id);
  const handleRetry = () => void retry(job.id);

  const chainMembers = sortChain(chain);
  const tabs: Array<[DetailTab, string]> = [
    ["overview", tr("detail.overview", dict)],
    ["attempts", `${tr("detail.attempts", dict)} · ${job.attempts}`],
    ["payload", tr("detail.payload", dict)],
  ];
  if (chainMembers.length > 1) {
    tabs.push(["chain", `${tr("detail.chain", dict)} · ${chainMembers.length}`]);
  }
  const stateLabel = tr(`states.${job.state}`, dict);
  const nodes = timelineNodes(job, dict, nowMs);

  return (
    <aside className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 flex flex-col max-h-[calc(100vh-10rem)] sticky top-4">
      {/* header */}
      <div className="px-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                {jobTypeLabel(job.jobType)}
              </span>
              <JobStateBadge state={job.state} label={stateLabel} />
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-gray-400 dark:text-gray-500" title={job.id}>
              {job.id}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              {job.correlationKey && <span className="font-mono">{job.correlationKey}</span>}
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {job.executor}
              </span>
              <span>{job.enqueuedBy}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("detail.close", dict)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <HiOutlineX className="h-4 w-4" />
          </button>
        </div>
        {/* tabs */}
        <div className="mt-2 flex gap-1 border-b border-gray-100 dark:border-gray-700">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={handleTabChange(key)}
              className={twMerge(
                "-mb-px border-b-2 px-2.5 py-2 text-xs font-medium",
                tab === key
                  ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                  : "border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === "overview" && (
          <div className="flex flex-col gap-2">
            {job.lastError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-900/20">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                  {tr("detail.lastError", dict)}
                </div>
                <div className="mt-0.5 text-xs text-red-700 dark:text-red-300">{job.lastError}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Stat label={tr("detail.attemptsLabel", dict)} value={`${job.attempts} / ${job.maxAttempts}`} />
              <Stat label={tr("detail.lane", dict)} value={job.executor} mono />
              <Stat label={tr("detail.created", dict)} value={relativeAge(job.createdAt, nowMs)} />
              <Stat label={tr("detail.updated", dict)} value={relativeAge(job.updatedAt, nowMs)} />
              {job.nextRetryAt && (
                <Stat label={tr("detail.nextRetry", dict)} value={countdownTo(job.nextRetryAt, nowMs)} />
              )}
              {job.state === "RUNNING" && job.lockedBy && (
                <Stat label={tr("detail.lease", dict)} value={job.lockedBy} mono />
              )}
              <Stat label={tr("detail.source", dict)} value={job.sourceInstance} mono />
              <Stat label={tr("detail.tenant", dict)} value={job.tenantCode} mono />
            </div>
            {job.dedupeKey && <Stat label={tr("detail.dedupe", dict)} value={job.dedupeKey} mono />}
            {job.chainKey && (
              <Stat
                label={`${tr("detail.chain", dict)} · ${tr("detail.step", dict)} ${job.chainSequence}`}
                value={job.chainKey}
                mono
              />
            )}
          </div>
        )}

        {tab === "attempts" && (
          <ol className="relative flex flex-col">
            {nodes.map((node, index) => (
              <li key={node.key} className="relative flex gap-3 pb-4 last:pb-0">
                {index < nodes.length - 1 && (
                  <span className="absolute left-[5px] top-4 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                )}
                <span className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${node.dotClass}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">{node.title}</div>
                  {node.meta && (
                    <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{node.meta}</div>
                  )}
                  {node.error && (
                    <div className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
                      {node.error}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {tab === "payload" && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                payload · jsonb
              </div>
              <pre className="overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-gray-200">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
            {job.attemptHistory.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  attempt_history · jsonb
                </div>
                <pre className="overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-gray-400">
                  {JSON.stringify(job.attemptHistory, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {tab === "chain" && (
          <div className="flex flex-col">
            <div className="mb-3 break-all font-mono text-[11px] text-gray-500 dark:text-gray-400">
              {job.chainKey}
            </div>
            {chainMembers.map((member, index) => (
              <div key={member.id} className="relative flex gap-3 pb-3 last:pb-0">
                {index < chainMembers.length - 1 && (
                  <span className="absolute left-[10px] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                )}
                <span
                  className={twMerge(
                    "mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    chainBadgeClass(member.state, member.id === job.id),
                  )}
                >
                  {member.state === "SUCCEEDED" ? <HiCheck className="h-3 w-3" /> : member.chainSequence}
                </span>
                <button
                  type="button"
                  onClick={handleSelectChainJob(member.id)}
                  className={twMerge(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left",
                    member.id === job.id
                      ? "border-gray-900 dark:border-white"
                      : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-gray-900 dark:text-white">
                      {jobTypeLabel(member.jobType)}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-gray-400 dark:text-gray-500">
                      {shortJobId(member.id)}
                      {member.correlationKey ? ` · ${member.correlationKey}` : ""}
                    </span>
                  </span>
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${JOB_STATE_DOT[member.state]}`} />
                </button>
              </div>
            ))}
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
              {tr("detail.chainHint", dict)}
            </p>
          </div>
        )}
      </div>

      {canRetry(job) && (
        <div className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-gray-700">
          {retryError && (
            <span className="min-w-0 flex-1 truncate text-xs text-red-600 dark:text-red-400" title={retryError.message}>
              {retryError.message}
            </span>
          )}
          <span className="flex-1" />
          <Button
            size="xs"
            color="blue"
            disabled={retrying === job.id}
            onClick={handleRetry}
          >
            <HiLightningBolt className="mr-1 h-3.5 w-3.5" />
            {job.state === "PENDING" ? tr("detail.runNow", dict) : tr("detail.retry", dict)}
          </Button>
        </div>
      )}
    </aside>
  );
}
