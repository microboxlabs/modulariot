"use client";

import type { FC } from "react";
import { useHarnessChatTr } from "@/features/harness-chat/context/harness-chat-i18n-context";
import { KnowledgeChangeList } from "@/features/harness-chat/components/learning/knowledge-change-list";
import type { KnowledgeChange } from "@/features/harness-chat/extensions/knowledge-change-args";

/** What this session's approved tool calls changed, oldest first. */
export const ChangesView: FC<{ changes: KnowledgeChange[] }> = ({
  changes,
}) => {
  const tr = useHarnessChatTr();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
      {changes.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("harnessChat.learning.changesView.empty")}
        </p>
      ) : (
        <KnowledgeChangeList changes={changes} />
      )}
    </div>
  );
};
