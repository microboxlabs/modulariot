"use client";

import { useEffect, type FC } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { LuFileDiff } from "react-icons/lu";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import { useHarnessThreadId } from "../../context/harness-session-context";
import { useWorkArea } from "../../context/work-area-context";
import { KnowledgeChangeList } from "../../components/learning/knowledge-change-list";
import {
  SCRATCHPAD_WRITE_TOOLS,
  type ShowKnowledgeChangeArgs,
} from "../knowledge-change-args";

/** What a trainer tool, or the scratchpad, changed: each file with its diff. */
export const ShowKnowledgeChangeCard: FC<
  ToolCallMessagePartProps<ShowKnowledgeChangeArgs, Record<string, never>>
> = ({ args, result, addResult }) => {
  const tr = useHarnessChatTr();
  const workArea = useWorkArea();
  const threadId = useHarnessThreadId();
  const changes = Array.isArray(args?.changes) ? args.changes : null;
  const scratchpad = (SCRATCHPAD_WRITE_TOOLS as readonly string[]).includes(
    args?.tool ?? ""
  );

  useEffect(() => {
    if (!result) addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!workArea || !threadId || !changes || scratchpad) return;
    for (const change of changes) workArea.recordChange(threadId, change);
  }, [workArea, threadId, changes, scratchpad]);

  if (!changes || changes.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <LuFileDiff aria-hidden className="h-4 w-4 shrink-0 text-gray-400" />
        <p className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">
          {scratchpad
            ? tr("harnessChat.learning.change.scratchpad")
            : tr("harnessChat.learning.change.heading")}
        </p>
        {changes.length > 1 && (
          <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
            {tr("harnessChat.learning.change.count", {
              count: String(changes.length),
            })}
          </span>
        )}
      </div>
      {args.summary && (
        <p className="text-gray-600 dark:text-gray-300">{args.summary}</p>
      )}
      <KnowledgeChangeList changes={changes} />
      {args.truncated && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {tr("harnessChat.learning.change.truncated")}
        </p>
      )}
    </div>
  );
};
