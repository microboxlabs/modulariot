"use client";

import { Checkbox } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { LuTrash2 } from "react-icons/lu";
import { useState, type FC } from "react";
import type { Session } from "../harness-chat-types";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";

export const HistoryList: FC<{
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (ids: string[]) => void;
  locale: string;
}> = ({ sessions, activeId, onSelect, onDelete, locale }) => {
  const tr = useHarnessChatTr();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = sessions.length > 0 && selectedIds.size === sessions.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sessions.map((s) => s.id)));
  };

  const deleteSelected = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-1.5 dark:border-gray-800">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <Checkbox checked={allSelected} onChange={toggleSelectAll} />
          {tr("harnessChat.ui.history.selectAll")}
        </label>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:text-gray-300 dark:text-red-400 dark:hover:bg-red-900/20 dark:disabled:text-gray-600"
        >
          <LuTrash2 className="h-3 w-3" />
          {selectedIds.size > 0
            ? tr("harnessChat.ui.history.deleteCount", { count: String(selectedIds.size) })
            : tr("harnessChat.ui.history.delete")}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={twMerge(
              "group flex items-center gap-1.5 rounded-md pl-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700",
              session.id === activeId && "bg-gray-50 dark:bg-gray-700"
            )}
          >
            <Checkbox
              checked={selectedIds.has(session.id)}
              onChange={() => toggleOne(session.id)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            />
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              className={twMerge(
                "flex min-w-0 flex-1 items-center justify-between gap-2 px-1 py-2 text-left text-xs text-gray-600 dark:text-gray-300",
                session.id === activeId && "font-medium text-gray-900 dark:text-white"
              )}
            >
              <span className="truncate">
                {session.title ?? tr("harnessChat.ui.emptyChatTitle")}
              </span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {new Date(session.createdAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete([session.id]);
              }}
              aria-label={tr("harnessChat.ui.history.deleteChat")}
              className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100 dark:hover:bg-gray-600 dark:hover:text-gray-100"
            >
              <LuTrash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
