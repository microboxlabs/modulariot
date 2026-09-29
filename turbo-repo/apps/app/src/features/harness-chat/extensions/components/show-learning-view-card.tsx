"use client";

import { useEffect, useMemo, useRef, type FC } from "react";
import {
  useAuiState,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { HiArrowsPointingOut } from "react-icons/hi2";
import { LuFolderTree, LuGitCompare } from "react-icons/lu";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import { useHarnessThreadId } from "../../context/harness-session-context";
import { useWorkArea, type WorkItem } from "../../context/work-area-context";
import type { ShowLearningViewArgs } from "../learning-view-args";

/**
 * `/layers` or `/diff` in a learning session: opens the editable knowledge,
 * or the session's changes, in the working area — at once while the answer
 * is being written, and again from the card later.
 */
export const ShowLearningViewCard: FC<
  ToolCallMessagePartProps<ShowLearningViewArgs, Record<string, never>>
> = ({ args, result, addResult }) => {
  const tr = useHarnessChatTr();
  const workArea = useWorkArea();
  const threadId = useHarnessThreadId();
  const live = useAuiState((s) => s.thread.isRunning && s.message.isLast);
  const opened = useRef(false);

  const view = args?.view === "diff" ? "diff" : "layers";
  const item = useMemo<WorkItem | null>(() => {
    if (view === "layers") return { kind: "layers" };
    return threadId ? { kind: "changes", threadId } : null;
  }, [view, threadId]);

  useEffect(() => {
    if (!result) addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!live || opened.current || !workArea || !item) return;
    opened.current = true;
    workArea.open(item);
  }, [live, workArea, item]);

  if (!workArea || !item) return null;
  const Icon = view === "layers" ? LuFolderTree : LuGitCompare;
  const label =
    view === "layers"
      ? tr("harnessChat.learning.view.layers")
      : tr("harnessChat.learning.view.diff");
  return (
    <button
      type="button"
      onClick={() => workArea.open(item)}
      className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700/60"
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-gray-400" />
      <span className="flex-1 font-medium text-gray-800 dark:text-gray-100">
        {label}
      </span>
      <HiArrowsPointingOut aria-hidden className="h-3.5 w-3.5 text-gray-400" />
    </button>
  );
};
