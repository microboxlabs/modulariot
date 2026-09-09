"use client";

import { Checkbox } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { LuTrash2, LuUsers, LuX } from "react-icons/lu";
import { useState, type FC } from "react";
import type { Session } from "../harness-chat-types";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";

export const HistoryList: FC<{
  sessions: Session[];
  activeId: string;
  isLoading: boolean;
  hasFailed: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onDelete: (ids: string[]) => void;
  onShare: (id: string, principal: string) => void;
  onUnshare: (id: string, principal: string) => void;
  locale: string;
}> = ({
  sessions,
  activeId,
  isLoading,
  hasFailed,
  onRetry,
  onSelect,
  onDelete,
  onShare,
  onUnshare,
  locale,
}) => {
  const tr = useHarnessChatTr();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Only a thread's owner can delete it, so a shared one is not selectable —
  // ticking it would offer a delete that does nothing.
  const deletable = sessions.filter((session) => session.owned);
  const allSelected = deletable.length > 0 && selectedIds.size === deletable.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(deletable.map((s) => s.id)));
  };

  const deleteSelected = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  /** Row-level delete. Drops the id from the selection too — left behind, it
   * keeps the toolbar enabled and counting a session that no longer exists
   * (whose own Delete is then a no-op), and skews `allSelected`, which
   * compares the selection size against the live session count. */
  const deleteOne = (id: string) => {
    onDelete([id]);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
        {isLoading && (
          <p className="px-2 py-3 text-[11px] text-gray-400">
            {tr("harnessChat.ui.history.loading")}
          </p>
        )}
        {/* Stored chats are missing from the list below, not absent. Saying so
            beats an empty panel that reads as "you have no past chats". */}
        {hasFailed && !isLoading && (
          <div className="px-2 py-3">
            <p className="text-[11px] text-amber-600 dark:text-amber-500">
              {tr("harnessChat.ui.history.loadFailed")}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {tr("harnessChat.ui.history.retry")}
            </button>
          </div>
        )}
        {sessions.map((session) => (
          <div key={session.id} className="flex flex-col">
            <div
              className={twMerge(
                "group flex items-center gap-1.5 rounded-md pl-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700",
                session.id === activeId && "bg-gray-50 dark:bg-gray-700"
              )}
            >
              <Checkbox
                checked={selectedIds.has(session.id)}
                onChange={() => toggleOne(session.id)}
                onClick={(e) => e.stopPropagation()}
                disabled={!session.owned}
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
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-gray-400">
                  {/* A thread someone else owns: readable, and labelled so it
                      is clear why it cannot be renamed or shared on. */}
                  {!session.owned && (
                    <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-500 dark:bg-gray-600 dark:text-gray-300">
                      {tr("harnessChat.ui.history.sharedWithYou")}
                    </span>
                  )}
                  {new Date(session.createdAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
              {session.owned && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareOpenId((prev) => (prev === session.id ? null : session.id));
                  }}
                  aria-label={tr("harnessChat.ui.history.share")}
                  aria-expanded={shareOpenId === session.id}
                  className={twMerge(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-opacity hover:bg-gray-200 hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-gray-600 dark:hover:text-gray-100",
                    // Kept visible while it has something to say, so a shared
                    // thread does not look private until someone hovers it.
                    shareOpenId === session.id || session.sharedWith.length > 0
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                >
                  <LuUsers className="h-3 w-3" />
                </button>
              )}
              {session.owned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteOne(session.id);
                }}
                aria-label={tr("harnessChat.ui.history.deleteChat")}
                // focus-visible alongside group-hover: this button is in the tab
                // order regardless, so without it keyboard users land on an
                // invisible destructive control.
                className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-gray-600 dark:hover:text-gray-100"
              >
                <LuTrash2 className="h-3 w-3" />
              </button>
              )}
            </div>

            {shareOpenId === session.id && (
              <SharePanel
                session={session}
                onShare={onShare}
                onUnshare={onUnshare}
                onClose={() => setShareOpenId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Read access for one thread: who has it, and a field to give it to one more
 * person. Chats are private until their owner does this. */
const SharePanel: FC<{
  session: Session;
  onShare: (id: string, principal: string) => void;
  onUnshare: (id: string, principal: string) => void;
  onClose: () => void;
}> = ({ session, onShare, onUnshare, onClose }) => {
  const tr = useHarnessChatTr();
  const [principal, setPrincipal] = useState("");

  const submit = () => {
    const trimmed = principal.trim();
    if (!trimmed) return;
    onShare(session.id, trimmed);
    setPrincipal("");
  };

  return (
    <div className="mx-2 mb-1 rounded-md border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-1">
        <input
          type="email"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder={tr("harnessChat.ui.history.sharePlaceholder")}
          aria-label={tr("harnessChat.ui.history.share")}
          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={submit}
          disabled={principal.trim() === ""}
          className="rounded-md px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 disabled:pointer-events-none disabled:text-gray-300 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:disabled:text-gray-600"
        >
          {tr("harnessChat.ui.history.shareSubmit")}
        </button>
      </div>
      {session.sharedWith.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {session.sharedWith.map((person) => (
            <li
              key={person}
              className="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400"
            >
              <span className="truncate">{person}</span>
              <button
                type="button"
                onClick={() => onUnshare(session.id, person)}
                aria-label={tr("harnessChat.ui.history.revokeShare")}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-100"
              >
                <LuX className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
