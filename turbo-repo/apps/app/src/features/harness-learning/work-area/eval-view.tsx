"use client";

import type { FC } from "react";
import { Spinner } from "flowbite-react";
import { useHarnessChatTr } from "@/features/harness-chat/context/harness-chat-i18n-context";
import type { WorkItem } from "@/features/harness-chat/context/work-area-context";
import {
  EvalSummaryView,
  EvalTable,
} from "@/features/harness-chat/components/learning/eval-results";
import { useEvaluation } from "@/features/harness-chat/hooks/use-evaluation";

type EvalItem = Extract<WorkItem, { kind: "eval" }>;

/** An evaluation's summary over its cases, both answers side by side. */
export const EvalView: FC<{ item: EvalItem }> = ({ item }) => {
  const tr = useHarnessChatTr();
  const { data, error, isLoading } = useEvaluation(item.evaluationId);
  const summary = data?.summary ?? item.card?.summary ?? null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
      {summary && (
        <EvalSummaryView
          summary={summary}
          model={data?.model ?? item.card?.model}
        />
      )}
      {data?.status === "running" && (
        <output className="text-[11px] text-amber-600 animate-harness-shimmer dark:text-amber-400">
          {data.progress
            ? tr("harnessChat.learning.eval.running", {
                done: String(data.progress.done),
                total: String(data.progress.total),
              })
            : tr("harnessChat.learning.eval.runningShort")}
        </output>
      )}
      {data?.status === "failed" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {data.error ?? tr("harnessChat.learning.eval.failed")}
        </p>
      )}
      {isLoading && <Spinner size="md" className="self-center" />}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {tr("harnessChat.learning.eval.loadFailed")}
        </p>
      )}
      {data && <EvalTable results={data.results ?? []} />}
    </div>
  );
};
