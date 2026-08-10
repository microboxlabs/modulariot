"use client";

import { useCallback, useEffect, useState, type FC } from "react";
import {
  AssistantRuntimeProvider,
  useAuiState,
  useLocalRuntime,
} from "@assistant-ui/react";
import { Checkbox } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import {
  LuArrowLeft,
  LuHistory,
  LuPlus,
  LuSparkles,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { harnessChatAdapter } from "./harness-chat-adapter";
import { harnessAttachmentAdapter } from "./harness-chat-attachments";
import { useHarnessChatContext } from "./context/harness-chat-context";
import { Thread } from "./thread";

type Session = { id: string; createdAt: number; title: string | null };
type View = "chat" | "history";

function createSession(): Session {
  return { id: crypto.randomUUID(), createdAt: Date.now(), title: null };
}

const headerButtonClass =
  "flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100";

export default function HarnessChat() {
  const { isOpen, close } = useHarnessChatContext();
  const [sessions, setSessions] = useState<Session[]>(() => [createSession()]);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [view, setView] = useState<View>("chat");

  const newChat = useCallback(() => {
    const session = createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setView("chat");
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
    setView("chat");
  }, []);

  const updateSessionTitle = useCallback((id: string, title: string | null) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1 || prev[idx].title === title) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title };
      return next;
    });
  }, []);

  const deleteSessions = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setSessions((prev) => {
      const filtered = prev.filter((s) => !idSet.has(s.id));
      const nextSessions = filtered.length > 0 ? filtered : [createSession()];
      setActiveId((current) => (idSet.has(current) ? nextSessions[0].id : current));
      return nextSessions;
    });
  }, []);

  const activeTitle = sessions.find((s) => s.id === activeId)?.title ?? "Empty chat";

  return (
    <div
      className={twMerge(
        "mt-16 mb-12 hidden shrink-0 overflow-hidden border-l border-gray-200 bg-white transition-[width,opacity] duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 lg:flex",
        isOpen ? "w-1/4 opacity-100" : "w-0 opacity-0"
      )}
    >
      <div className="flex w-[25vw] min-w-72 flex-col text-gray-700 antialiased dark:text-gray-300">
        <div className="h-15 flex shrink-0 items-center gap-1 border-b border-gray-200 px-3 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {view === "history" ? (
            <>
              <button
                type="button"
                onClick={() => setView("chat")}
                aria-label="Back to chat"
                className={headerButtonClass}
              >
                <LuArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="flex-1">History</span>
            </>
          ) : (
            <>
              <LuSparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate" title={activeTitle}>
                {activeTitle}
              </span>
              <button
                type="button"
                onClick={() => setView("history")}
                aria-label="Chat history"
                className={headerButtonClass}
              >
                <LuHistory className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className={headerButtonClass}
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close harness panel"
            className={headerButtonClass}
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>

        {view === "history" && (
          <HistoryList
            sessions={sessions}
            activeId={activeId}
            onSelect={selectSession}
            onDelete={(ids) => deleteSessions(ids)}
          />
        )}
        <div className={twMerge("flex min-h-0 flex-1 flex-col", view === "history" && "hidden")}>
          {sessions.map((session) => (
            <SessionHost
              key={session.id}
              sessionId={session.id}
              active={session.id === activeId}
              onTitleChange={updateSessionTitle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const SessionHost: FC<{
  sessionId: string;
  active: boolean;
  onTitleChange: (id: string, title: string | null) => void;
}> = ({ sessionId, active, onTitleChange }) => {
  const runtime = useLocalRuntime(harnessChatAdapter, {
    adapters: { attachments: harnessAttachmentAdapter },
  });

  return (
    <div
      data-session-active={active}
      className={twMerge("flex min-h-0 flex-1 flex-col", !active && "hidden")}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <SessionTitleWatcher sessionId={sessionId} onTitleChange={onTitleChange} />
        <Thread />
      </AssistantRuntimeProvider>
    </div>
  );
};

const SessionTitleWatcher: FC<{
  sessionId: string;
  onTitleChange: (id: string, title: string | null) => void;
}> = ({ sessionId, onTitleChange }) => {
  const messages = useAuiState((s) => s.thread.messages);

  useEffect(() => {
    const firstUser = messages.find((m) => m.role === "user");
    const text = firstUser?.content.find((part) => part.type === "text")?.text;
    onTitleChange(sessionId, text?.trim() ? text : null);
  }, [messages, onTitleChange, sessionId]);

  return null;
};

const HistoryList: FC<{
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (ids: string[]) => void;
}> = ({ sessions, activeId, onSelect, onDelete }) => {
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
          Select all
        </label>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:text-gray-300 dark:text-red-400 dark:hover:bg-red-900/20 dark:disabled:text-gray-600"
        >
          <LuTrash2 className="h-3 w-3" />
          {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : "Delete"}
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
              <span className="truncate">{session.title ?? "Empty chat"}</span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {new Date(session.createdAt).toLocaleTimeString([], {
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
              aria-label="Delete chat"
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
