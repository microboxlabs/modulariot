"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { HttpAgent } from "@ag-ui/client";
import { twMerge } from "tailwind-merge";
import { LuArrowLeft, LuHistory, LuPlus, LuSparkles, LuX } from "react-icons/lu";
import { createHarnessAttachmentAdapter } from "./harness-chat-attachments";
import { useHarnessChatContext } from "./context/harness-chat-context";
import {
  HarnessChatI18nProvider,
  useHarnessChatTr,
} from "./context/harness-chat-i18n-context";
import { useResizablePanelWidth } from "./hooks/use-resizable-panel-width";
import { buildHarnessToolkit, type HarnessExtension } from "./harness-extension";
import { DEFAULT_HARNESS_EXTENSIONS } from "./extensions";
import { HistoryList } from "./components/history-list";
import { InitialMessageSender } from "./components/initial-message-sender";
import { PendingAttachmentReceiver } from "./components/pending-attachment-receiver";
import { SessionTitleWatcher } from "./components/session-title-watcher";
import type { HarnessSkill, Session, View } from "./harness-chat-types";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { StandaloneDictionaryProvider } from "@/features/dashboard/context/standalone-dictionary-context";
import type { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
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
  dict,
  locale,
}: Readonly<{
  extensions?: HarnessExtension[];
  /**
   * Slash-command skills the composer's "/" menu offers. No built-in
   * default — the caller owns this list (e.g. wire it to the harness's
   * real skill set once available).
   */
  skills: HarnessSkill[];
  dict: I18nDictionary;
  locale: string;
}>) {
  // create_story is testing scaffolding for the storytelling feature (see
  // ENABLE_STORYTELLING) — strip it out via the same runtime-config flag
  // that hides the Storytelling nav entry (useVisiblePages), so the tool
  // isn't reachable from chat when the feature itself isn't. Fails closed:
  // useRuntimeConfig() is null until the fetch resolves, which hides the
  // tool a beat longer rather than exposing it early.
  const runtimeConfig = useRuntimeConfig();
  const storytellingEnabled = runtimeConfig?.ENABLE_STORYTELLING === "true";
  const effectiveExtensions = useMemo(
    () =>
      storytellingEnabled
        ? extensions
        : extensions.filter((ext) => ext.toolName !== "create_story"),
    [extensions, storytellingEnabled]
  );

  return (
    <HarnessChatI18nProvider dict={dict}>
      {/* Dashlets rendered by show_dashlet cards sit outside any
          DashboardProvider and would otherwise translate against an empty
          dictionary, printing raw key paths. */}
      <StandaloneDictionaryProvider dictionary={dict as I18nRecord}>
        <HarnessChatPanel extensions={effectiveExtensions} skills={skills} locale={locale} />
      </StandaloneDictionaryProvider>
    </HarnessChatI18nProvider>
  );
}

const HarnessChatPanel: FC<{
  extensions: HarnessExtension[];
  skills: HarnessSkill[];
  locale: string;
}> = ({ extensions, skills, locale }) => {
  const tr = useHarnessChatTr();
  const {
    isOpen,
    close,
    pendingMessage,
    clearPendingMessage,
    pendingAttachment,
    clearPendingAttachment,
  } = useHarnessChatContext();
  const { width, isDragging, startDrag, toggleMinMax, onHandleKeyDown, bounds } =
    useResizablePanelWidth();
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

  // Computed from the current `sessions` closure rather than inside
  // setSessions's updater — an updater must be pure (no other setters, no
  // side effects like createSession()'s crypto.randomUUID()/Date.now()),
  // since React may invoke it more than once for the same commit.
  const deleteSessions = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const filtered = sessions.filter((s) => !idSet.has(s.id));
      const nextSessions = filtered.length > 0 ? filtered : [createSession()];
      setSessions(nextSessions);
      setActiveId((current) => (idSet.has(current) ? nextSessions[0].id : current));
    },
    [sessions],
  );

  const activeTitle =
    sessions.find((s) => s.id === activeId)?.title ?? tr("harnessChat.ui.emptyChatTitle");

  return (
    <div
      className={twMerge(
        "relative mt-16 mb-12 hidden shrink-0 overflow-hidden border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:flex",
        isOpen ? "opacity-100" : "w-0 opacity-0",
        isDragging ? "transition-opacity duration-300 ease-in-out" : "transition-[width,opacity] duration-300 ease-in-out"
      )}
      style={isOpen ? { width } : undefined}
    >
      {isOpen && (
        // This is the WAI-ARIA window-splitter pattern: a *focusable*
        // separator, which ARIA classes as a widget role — hence the
        // tabIndex, the value attributes and the key handler below. Sonar's
        // S6845/S6847 (and jsx-a11y, which they mirror) read `separator` off
        // a static role map that has no way to know this one is focusable,
        // so they see a non-interactive div carrying tabIndex and handlers.
        // The NOSONAR markers are for those two false positives; removing
        // them would mean giving up either the keyboard resize or the
        // correct role.
        <div /* NOSONAR */
          role="separator"
          aria-orientation="vertical"
          aria-label={tr("harnessChat.ui.resizePanel")}
          // Dragging is pointer-only, so without this the panel is stuck at
          // whatever width a keyboard user finds it at. Arrows nudge (Shift
          // for a coarser step), Home/End snap to the bounds.
          tabIndex={0 /* NOSONAR */}
          aria-valuenow={Math.round(width)}
          aria-valuemin={Math.round(bounds.min)}
          aria-valuemax={Math.round(bounds.max)}
          onKeyDown={onHandleKeyDown}
          onPointerDown={startDrag}
          onDoubleClick={toggleMinMax}
          className={twMerge(
            // Stays inside the panel's own bounds (not straddling the
            // border) — the wrapper's overflow-hidden, needed for the
            // open/close collapse animation, would clip anything hanging
            // outside it.
            "group absolute inset-y-0 left-0 z-20 flex w-2.5 cursor-col-resize touch-none select-none items-center justify-center"
          )}
        >
          <div
            className={twMerge(
              "h-8 w-1 rounded-full transition-colors duration-150",
              isDragging
                ? "bg-gray-500 dark:bg-gray-300"
                : "bg-gray-300 group-hover:bg-gray-400 group-focus-visible:bg-gray-500 dark:bg-gray-600 dark:group-hover:bg-gray-400 dark:group-focus-visible:bg-gray-300"
            )}
          />
        </div>
      )}
      <div className="flex w-full min-w-0 flex-col text-gray-700 antialiased dark:text-gray-300">
        <div className="h-15 flex shrink-0 items-center gap-1 border-b border-gray-200 px-3 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {view === "history" ? (
            <>
              <button
                type="button"
                onClick={() => setView("chat")}
                aria-label={tr("harnessChat.ui.history.backToChat")}
                className={headerButtonClass}
              >
                <LuArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="flex-1">{tr("harnessChat.ui.history.label")}</span>
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
                aria-label={tr("harnessChat.ui.history.chatHistory")}
                className={headerButtonClass}
              >
                <LuHistory className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => newChat()}
            aria-label={tr("harnessChat.ui.history.newChat")}
            className={headerButtonClass}
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={tr("harnessChat.ui.history.closePanel")}
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
            locale={locale}
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
              // Only the active session should receive it — every session's
              // SessionHost stays mounted (just hidden), so a session-agnostic
              // prop would add the same attachment to all of them at once.
              pendingAttachmentLabel={session.id === activeId ? pendingAttachment : null}
              onAttachmentConsumed={clearPendingAttachment}
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
  pendingAttachmentLabel: string | null;
  onAttachmentConsumed: () => void;
  onTitleChange: (id: string, title: string | null) => void;
  extensions: HarnessExtension[];
  skills: HarnessSkill[];
}> = ({
  sessionId,
  active,
  shouldFocus,
  initialMessage,
  pendingAttachmentLabel,
  onAttachmentConsumed,
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
  const tr = useHarnessChatTr();
  const attachmentAdapter = useMemo(() => createHarnessAttachmentAdapter(tr), [tr]);
  const runtime = useAgUiRuntime({
    agent,
    adapters: { attachments: attachmentAdapter },
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
        <PendingAttachmentReceiver
          label={pendingAttachmentLabel}
          onConsumed={onAttachmentConsumed}
        />
        <Thread skills={skills} />
      </AssistantRuntimeProvider>
    </div>
  );
};
