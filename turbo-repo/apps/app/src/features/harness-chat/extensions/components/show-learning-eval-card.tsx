"use client";

import { useEffect, useState, type FC } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { HiArrowsPointingOut } from "react-icons/hi2";
import { LuFlaskConical } from "react-icons/lu";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import { useWorkArea } from "../../context/work-area-context";
import {
  EvalSummaryView,
  EvalTable,
} from "../../components/learning/eval-results";
import { useEvaluation } from "../../hooks/use-evaluation";
import type { ShowLearningEvalArgs } from "../learning-eval-args";

const actionClass =
  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-gray-700";

/**
 * A before/after evaluation: averages and how many cases moved, kept up to
 * date while it runs. Its cases open in the working area, or inline where
 * there is none.
 */
export const ShowLearningEvalCard: FC<
  ToolCallMessagePartProps<ShowLearningEvalArgs, Record<string, never>>
> = ({ args, result, addResult }) => {
  const tr = useHarnessChatTr();
  const workArea = useWorkArea();
  const [inline, setInline] = useState(false);
  const evaluationId = args?.evaluationId ?? null;
  const { data, error } = useEvaluation(evaluationId);

  useEffect(() => {
    if (!result) addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!args) return null;
  const summary = data?.summary ?? args.summary ?? null;
  const status = data?.status ?? args.status;
  const model = data?.model ?? args.model ?? null;
  const running = status === "running";

  const openCases = () => {
    if (!evaluationId) return;
    if (workArea) workArea.open({ kind: "eval", evaluationId, card: args });
    else setInline((open) => !open);
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <LuFlaskConical
          aria-hidden
          className="h-4 w-4 shrink-0 text-gray-400"
        />
        <p className="flex-1 font-medium text-gray-800 dark:text-gray-100">
          {tr("harnessChat.learning.eval.heading")}
        </p>
        {evaluationId && workArea && (
          <button
            type="button"
            onClick={openCases}
            title={tr("harnessChat.learning.eval.open")}
            aria-label={tr("harnessChat.learning.eval.open")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <HiArrowsPointingOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {running && (
        <output className="text-[11px] text-amber-600 animate-harness-shimmer dark:text-amber-400">
          {data?.progress
            ? tr("harnessChat.learning.eval.running", {
                done: String(data.progress.done),
                total: String(data.progress.total),
              })
            : tr("harnessChat.learning.eval.runningShort")}
        </output>
      )}
      {status === "failed" && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {data?.error ?? tr("harnessChat.learning.eval.failed")}
        </p>
      )}
      {summary && <EvalSummaryView summary={summary} model={model} />}
      {error && !summary && (
        <p className="text-gray-500 dark:text-gray-400">
          {tr("harnessChat.learning.eval.loadFailed")}
        </p>
      )}
      {evaluationId && !workArea && (
        <button
          type="button"
          onClick={openCases}
          aria-expanded={inline}
          className={`${actionClass} self-start`}
        >
          {tr("harnessChat.learning.eval.open")}
        </button>
      )}
      {inline && data && <EvalTable results={data.results ?? []} />}
    </div>
  );
};
