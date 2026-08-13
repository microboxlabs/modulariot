"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { HttpAgent } from "@ag-ui/client";
import { twMerge } from "tailwind-merge";
import { LuArrowLeft, LuHistory, LuPlus, LuSparkles, LuX } from "react-icons/lu";
import { harnessAttachmentAdapter } from "./harness-chat-attachments";
import { useHarnessChatContext } from "./context/harness-chat-context";
import { buildHarnessToolkit, type HarnessExtension } from "./harness-extension";
import { DEFAULT_HARNESS_EXTENSIONS } from "./extensions";
import { HistoryList } from "./components/history-list";
import { InitialMessageSender } from "./components/initial-message-sender";
import { SessionTitleWatcher } from "./components/session-title-watcher";
import type { HarnessSkill, Session, View } from "./harness-chat-types";
import { Thread } from "./thread";

function createSession(initialMessage: string | null = null): Session {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: null,
    initialMessage,
  };
}

const headerButtonClass =
  "flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100";

export default function HarnessChat({
  extensions = DEFAULT_HARNESS_EXTENSIONS,
  skills,
}: {
  extensions?: HarnessExtension[];
  /**
   * Slash-command skills the composer's "/" menu offers. No built-in
   * default — the caller owns this list (e.g. wire it to the harness's
   * real skill set once available).
   */
  skills: HarnessSkill[];
}) {
  const { isOpen, close, pendingMessage, clearPendingMessage } =
    useHarnessChatContext();
  const [sessions, setSessions] = useState<Session[]>(() => [createSession()]);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [view, setView] = useState<View>("chat");

  const newChat = useCallback((initialMessage: string | null = null) => {
    const session = createSession(initialMessage);
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setView("chat");
  }, []);

  // A search-bar "open chat" action landed while we were mounted — start a
  // fresh conversation with that text as the first (auto-sent) message.
  useEffect(() => {
    if (!pendingMessage) return;
    newChat(pendingMessage);
    clearPendingMessage();
  }, [pendingMessage, newChat, clearPendingMessage]);

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
            onClick={() => newChat()}
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
              shouldFocus={isOpen && view === "chat"}
              initialMessage={session.initialMessage}
              onTitleChange={updateSessionTitle}
              extensions={extensions}
              skills={skills}
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
  shouldFocus: boolean;
  initialMessage: string | null;
  onTitleChange: (id: string, title: string | null) => void;
  extensions: HarnessExtension[];
  skills: HarnessSkill[];
}> = ({
  sessionId,
  active,
  shouldFocus,
  initialMessage,
  onTitleChange,
  extensions,
  skills,
}) => {
  // One agent instance per session — its conversation state (threadId, the
  // harness's round-tripped conversationId) shouldn't leak across concurrent
  // chat sessions.
  const agent = useMemo(
    () => new HttpAgent({ url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/chat/stream` }),
    [],
  );
  const runtime = useAgUiRuntime({
    agent,
    adapters: { attachments: harnessAttachmentAdapter },
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const toolkit = useMemo(() => buildHarnessToolkit(extensions), [extensions]);

  // Panel just opened (button or ⌘/Ctrl+C) while this is the active session —
  // send focus straight to the composer input. When it closes (or this stops
  // being the active session) again, blur it back out — otherwise keystrokes
  // typed elsewhere would silently land in the now-hidden textarea.
  useEffect(() => {
    const textarea = containerRef.current?.querySelector("textarea");
    if (!textarea) return;
    if (active && shouldFocus) {
      textarea.focus();
    } else if (document.activeElement === textarea) {
      textarea.blur();
    }
  }, [active, shouldFocus]);

  return (
    <div
      ref={containerRef}
      data-session-active={active}
      className={twMerge("flex min-h-0 flex-1 flex-col", !active && "hidden")}
    >
      <AssistantRuntimeProvider
        runtime={runtime}
        config={AuiConfig({ tools: Tools({ toolkit }) })}
      >
        <SessionTitleWatcher sessionId={sessionId} onTitleChange={onTitleChange} />
        <InitialMessageSender initialMessage={initialMessage} />
        <Thread skills={skills} />
      </AssistantRuntimeProvider>
    </div>
  );
};
