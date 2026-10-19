"use client";

import { useState, type FC } from "react";
import {
  LuArrowRight,
  LuMinus,
  LuTrendingDown,
  LuTrendingUp,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import {
  caseTrend,
  formatScore,
  type EvalResult,
  type EvalRun,
  type EvalSummary,
} from "../../extensions/learning-eval-args";

const TREND_TONE = {
  improved: "text-green-700 dark:text-green-400",
  regressed: "text-red-600 dark:text-red-400",
  unchanged: "text-gray-500 dark:text-gray-400",
  unknown: "text-gray-400 dark:text-gray-500",
} as const;

const TREND_ICON = {
  improved: LuTrendingUp,
  regressed: LuTrendingDown,
  unchanged: LuMinus,
  unknown: LuMinus,
} as const;

/** Baseline and candidate averages, and how many cases moved each way. */
export const EvalSummaryView: FC<{
  summary: EvalSummary;
  model?: string | null;
}> = ({ summary, model }) => {
  const tr = useHarnessChatTr();
  const before = summary.baseline_avg;
  const after = summary.candidate_avg;
  let trend: keyof typeof TREND_TONE = "unknown";
  if (typeof before === "number" && typeof after === "number") {
    if (after > before) trend = "improved";
    else if (after < before) trend = "regressed";
    else trend = "unchanged";
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {tr("harnessChat.learning.eval.baseline")}
          </span>
          <span className="text-lg font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {formatScore(before)}
          </span>
        </div>
        <LuArrowRight aria-hidden className="mb-1.5 h-4 w-4 text-gray-400" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {tr("harnessChat.learning.eval.candidate")}
          </span>
          <span
            className={twMerge(
              "text-lg font-semibold tabular-nums",
              TREND_TONE[trend]
            )}
          >
            {formatScore(after)}
          </span>
        </div>
        <span className="mb-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          / 5
        </span>
        {model && (
          <span
            className="mb-1.5 ml-auto truncate text-[10px] text-gray-400 dark:text-gray-500"
            title={model}
          >
            {tr("harnessChat.learning.eval.model")}: {model}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {tr("harnessChat.learning.eval.improved", {
            count: String(summary.improved),
          })}
        </span>
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {tr("harnessChat.learning.eval.regressed", {
            count: String(summary.regressed),
          })}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {tr("harnessChat.learning.eval.unchanged", {
            count: String(summary.unchanged),
          })}
        </span>
      </div>
    </div>
  );
};

const RunCell: FC<{ run: EvalRun | null; tone: string }> = ({ run, tone }) => {
  const tr = useHarnessChatTr();
  if (!run) {
    return (
      <p className="text-gray-400 dark:text-gray-500">
        {tr("harnessChat.learning.eval.noAnswer")}
      </p>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={twMerge("text-sm font-semibold tabular-nums", tone)}>
        {formatScore(run.score)}
      </span>
      {run.reason && (
        <p className="italic text-gray-500 dark:text-gray-400">{run.reason}</p>
      )}
      {run.error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {run.error}
        </p>
      )}
      {run.trigger && (
        <p
          className={twMerge(
            "text-[10px]",
            run.trigger.ok
              ? "text-green-700 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          )}
        >
          {run.trigger.ok
            ? tr("harnessChat.learning.eval.triggerOk")
            : tr("harnessChat.learning.eval.triggerMiss", {
                missing: run.trigger.missing.join(", ") || "–",
                unexpected: run.trigger.unexpected.join(", ") || "–",
              })}
        </p>
      )}
      <MarkdownContent className="max-h-60 overflow-auto rounded bg-gray-50 p-1.5 text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {run.answer || tr("harnessChat.learning.eval.noAnswer")}
      </MarkdownContent>
      {(run.skills_used?.length ?? 0) > 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {tr("harnessChat.learning.eval.skills")}:{" "}
          {run.skills_used?.join(", ")}
        </p>
      )}
      {run.model && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {tr("harnessChat.learning.eval.model")}: {run.model}
        </p>
      )}
    </div>
  );
};

type Filter = "all" | "improved" | "regressed";

/** One row per case: the question and expectation, then both answers with
 * their scores and the judge's reasons. */
export const EvalTable: FC<{ results: EvalResult[] }> = ({ results }) => {
  const tr = useHarnessChatTr();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = results.filter(
    (r) => filter === "all" || caseTrend(r) === filter
  );
  if (results.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("harnessChat.learning.eval.noResults")}
      </p>
    );
  }
  const filters: [Filter, string][] = [
    ["all", tr("harnessChat.learning.eval.all")],
    ["improved", tr("harnessChat.learning.eval.onlyImproved")],
    ["regressed", tr("harnessChat.learning.eval.onlyRegressed")],
  ];
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex gap-1">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className="rounded-md px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 aria-pressed:bg-gray-800 aria-pressed:text-white dark:text-gray-400 dark:hover:bg-gray-700 dark:aria-pressed:bg-gray-200 dark:aria-pressed:text-gray-900"
          >
            {label}
          </button>
        ))}
      </div>
      <ol className="flex flex-col gap-3">
        {shown.map((result) => {
          const n = results.indexOf(result) + 1;
          const trend = caseTrend(result);
          const TrendIcon = TREND_ICON[trend];
          return (
            <li
              key={result.case.id ?? `${n}:${result.case.question}`}
              className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700"
            >
              <div className="mb-2 flex items-start gap-2">
                <TrendIcon
                  aria-hidden
                  className={twMerge(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    TREND_TONE[trend]
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {tr("harnessChat.learning.eval.case", { n: String(n) })}
                  </p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {result.case.question}
                  </p>
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                    <span className="font-medium">
                      {tr("harnessChat.learning.eval.expectation")}:
                    </span>{" "}
                    {result.case.expectation}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {tr("harnessChat.learning.eval.baseline")}
                  </p>
                  <RunCell
                    run={result.baseline}
                    tone="text-gray-700 dark:text-gray-200"
                  />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {tr("harnessChat.learning.eval.candidate")}
                  </p>
                  <RunCell run={result.candidate} tone={TREND_TONE[trend]} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
