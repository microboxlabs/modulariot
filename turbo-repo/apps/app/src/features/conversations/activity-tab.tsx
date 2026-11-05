"use client";

import { Fragment, useState } from "react";
import { HiChevronDown, HiChevronRight } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import ChannelIcon from "./channel-icon";
import { useConversationRules, useConversationRuns } from "./conversations-api";
import type {
  ConversationRun,
  RuleSummary,
  RunStatus,
} from "./conversations-types";
import { channelLabel } from "./rule-model";

const RUN_STATUSES: RunStatus[] = [
  "WAITING",
  "REPLIED",
  "DONE",
  "FAILED",
  "CANCELLED",
];

const CHIP =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";

const RUN_TONE: Record<RunStatus, string> = {
  WAITING:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  REPLIED:
    "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400",
  DONE: "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300",
  FAILED:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
  CANCELLED:
    "border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function statusLabel(prefix: string, status: string, d: I18nRecord) {
  const key = `${prefix}${cap(status)}`;
  const text = trDynamic(key, d);
  return text === key ? status : text;
}

export function RunStatusChip({
  status,
  d,
}: Readonly<{ status: RunStatus; d: I18nRecord }>) {
  return (
    <span className={`${CHIP} ${RUN_TONE[status] ?? RUN_TONE.DONE}`}>
      {statusLabel("runStatus", status, d)}
    </span>
  );
}

function when(at: string | null | undefined, lang: string) {
  if (!at) return "—";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" });
}

function contextText(run: ConversationRun, d: I18nRecord) {
  if (!run.contextKind) return "—";
  const named = [run.symptomName, run.assetId].filter(Boolean).join(" · ");
  if (named) return named;
  if (run.contextKind === "symptom_case")
    return tr("contextSymptomCase", d, { key: run.contextKey ?? "" });
  return `${run.contextKind} ${run.contextKey ?? ""}`.trim();
}

function RunMessages({
  run,
  lang,
  d,
}: Readonly<{ run: ConversationRun; lang: string; d: I18nRecord }>) {
  if (run.messages.length === 0) {
    return <p className={`text-sm ${MUTED}`}>{tr("runNoMessages", d)}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {run.messages.map((m) => (
        <li key={m.id} className="flex items-start gap-3">
          <ChannelIcon
            channel={m.channel}
            label={channelLabel(m.channel, d)}
            size={6}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-gray-900 dark:text-white">
                {m.toName || m.to}
              </span>
              {m.toName && <span className={MUTED}>{m.to}</span>}
              <span className={MUTED}>
                {tr("stepN", d, { n: String(m.step + 1) })}
              </span>
              <span className="rounded border border-gray-300 px-1.5 text-gray-700 dark:border-gray-600 dark:text-gray-300">
                {statusLabel("messageStatus", m.status, d)}
              </span>
              <span className={`ml-auto ${MUTED}`}>{when(m.at, lang)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {m.text}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The runs as rows; a row opens to its messages. */
export function RunsTable({
  runs,
  lang,
  d,
}: Readonly<{ runs: ConversationRun[]; lang: string; d: I18nRecord }>) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full min-w-[40rem] text-left text-sm text-gray-700 dark:text-gray-300">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            <th className="w-8 px-3 py-2">
              <span className="sr-only">{tr("expand", d)}</span>
            </th>
            <th className="px-3 py-2">{tr("colTime", d)}</th>
            <th className="px-3 py-2">{tr("colRule", d)}</th>
            <th className="px-3 py-2">{tr("colContext", d)}</th>
            <th className="px-3 py-2">{tr("colStatus", d)}</th>
            <th className="px-3 py-2">{tr("colStep", d)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {runs.map((r) => {
            const expanded = open === r.id;
            const panelId = `run-${r.id}-messages`;
            return (
              <Fragment key={r.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      aria-label={tr("runMessages", d, { rule: r.ruleName })}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      onClick={() => setOpen(expanded ? null : r.id)}
                    >
                      {expanded ? (
                        <HiChevronDown className="h-4 w-4" />
                      ) : (
                        <HiChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {when(r.createdAt, lang)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {r.ruleName}
                    </span>
                    {r.test && (
                      <span className="ml-2 rounded-full border border-violet-300 px-1.5 text-xs text-violet-700 dark:border-violet-800 dark:text-violet-300">
                        {tr("testRun", d)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{contextText(r, d)}</td>
                  <td className="px-3 py-2">
                    <RunStatusChip status={r.status} d={d} />
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "WAITING"
                      ? tr("runNextStep", d, { n: String(r.step + 1) })
                      : tr("runStepsDone", d, { n: String(r.step) })}
                  </td>
                </tr>
                {expanded && (
                  <tr id={panelId}>
                    <td />
                    <td colSpan={5} className="px-3 pt-1 pb-4">
                      {r.lastError && (
                        <p className="mb-2 text-xs text-red-600 dark:text-red-400">
                          {r.lastError}
                        </p>
                      )}
                      <RunMessages run={r} lang={lang} d={d} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type ActivityFilterKey = "rule" | "status";
export type ActivityFilters = Record<ActivityFilterKey, string>;

export const NO_ACTIVITY_FILTERS: ActivityFilters = { rule: "", status: "" };

/** A rule's name, with its key when another rule has the same name. */
function ruleOption(rule: RuleSummary, rules: RuleSummary[]) {
  const shared = rules.some((r) => r.id !== rule.id && r.name === rule.name);
  return shared ? `${rule.name} (${rule.key})` : rule.name;
}

/** The filter chips over the runs: by rule name and by run status. */
export function activityFilterDefs(
  rules: RuleSummary[],
  d: I18nRecord
): { key: ActivityFilterKey; label: string; options: string[] }[] {
  return [
    {
      key: "rule",
      label: tr("filterRule", d),
      options: rules.map((r) => ruleOption(r, rules)),
    },
    {
      key: "status",
      label: tr("filterStatus", d),
      options: RUN_STATUSES.map((s) => statusLabel("runStatus", s, d)),
    },
  ];
}

/** "Actividad": the runs of every rule, filtered by rule and status. */
export default function ActivityTab({
  lang,
  filters,
  d,
}: Readonly<{ lang: string; filters: ActivityFilters; d: I18nRecord }>) {
  const { data: rules } = useConversationRules();
  const rule =
    rules?.find((r) => ruleOption(r, rules) === filters.rule)?.id ?? null;
  const status =
    RUN_STATUSES.find(
      (s) => statusLabel("runStatus", s, d) === filters.status
    ) ?? null;
  const {
    data: runs,
    error,
    isLoading,
  } = useConversationRuns({ rule, status });
  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tr("loadFailed", d)}
        </p>
      )}
      {isLoading && <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>}
      {runs && runs.length === 0 && (
        <p
          className={`rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm dark:border-gray-600 dark:bg-gray-800 ${MUTED}`}
        >
          {rule || status ? tr("runsEmptyFiltered", d) : tr("noRuns", d)}
        </p>
      )}
      {runs && runs.length > 0 && <RunsTable runs={runs} lang={lang} d={d} />}
    </div>
  );
}
