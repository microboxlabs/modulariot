"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { twMerge } from "tailwind-merge";
import { LuArrowLeft, LuHistory, LuPlus, LuSparkles, LuX } from "react-icons/lu";
import { createHarnessAttachmentAdapter } from "./harness-chat-attachments";
import {
  useHarnessChatContext,
  type PendingHarnessConversation,
} from "./context/harness-chat-context";
import {
  HarnessChatI18nProvider,
  useHarnessChatTr,
} from "./context/harness-chat-i18n-context";
import { useResizablePanelWidth } from "./hooks/use-resizable-panel-width";
import { buildHarnessToolkit, type HarnessExtension } from "./harness-extension";
import { resolveDefaultHarnessExtensions } from "./extensions";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { HistoryList } from "./components/history-list";
import { InitialMessageSender } from "./components/initial-message-sender";
import { InitialConversationSeeder } from "./components/initial-conversation-seeder";
import { PendingAttachmentReceiver } from "./components/pending-attachment-receiver";
import { SessionSummaryWatcher } from "./components/session-summary-watcher";
import { SessionTitleWatcher } from "./components/session-title-watcher";
import { HarnessReadOnlyProvider } from "./context/harness-read-only-context";
import type { HarnessSkill, Session, View } from "./harness-chat-types";
import { createHarnessHistoryAdapter } from "./harness-history-adapter";
import { HarnessRunAgent } from "./harness-run-agent";
import {
  createThread,
  deleteThread,
  listThreads,
  revokeShare,
  shareThread,
  type StoredThread,
} from "./harness-thread-store";
import { StandaloneDictionaryProvider } from "@/features/dashboard/context/standalone-dictionary-context";
import type { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
import { Thread } from "./thread";

function createSession(
  initialMessage: string | null = null,
  initialConversation: PendingHarnessConversation | null = null,
): Session {
  return {
    // A UUID, not any id: it is stored as the thread's primary key and sent to
    // the harness as the conversation id.
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: null,
    initialMessage,
    initialConversation,
    owned: true,
    sharedWith: [],
  };
}

/** Keeps whatever the panel already has — the fresh session it opened with,
 * and anything started since the fetch went out — and appends the rest. */
function mergeStoredThreads(current: Session[], threads: StoredThread[]): Session[] {
  const known = new Set(current.map((session) => session.id));
  return [...current, ...threads.filter((t) => !known.has(t.id)).map(toSession)];
}

function toSession(thread: StoredThread): Session {
  return {
    id: thread.id,
    createdAt: Date.parse(thread.lastMessageAt ?? thread.createdAt),
    title: thread.title,
    initialMessage: null,
    initialConversation: null,
    owned: thread.owned,
    sharedWith: thread.sharedWith ?? [],
  };
}

const headerButtonClass =
  "flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100";

export default function HarnessChat({
  extensions,
  skills,
  dict,
  locale,
}: Readonly<{
  /** Override the built-in card set. When omitted, the default list is
   * resolved from runtime config (see `resolveDefaultHarnessExtensions`) so
   * flag-gated cards aren't registered while their feature is off. */
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
  return (
    <HarnessChatI18nProvider dict={dict}>
      {/* Dashlets rendered by show_dashlet cards sit outside any
          DashboardProvider and would otherwise translate against an empty
          dictionary, printing raw key paths. */}
      <StandaloneDictionaryProvider dictionary={dict as I18nRecord}>
        <HarnessChatPanel extensions={extensions} skills={skills} locale={locale} />
      </StandaloneDictionaryProvider>
    </HarnessChatI18nProvider>
  );
}

const HarnessChatPanel: FC<{
  extensions?: HarnessExtension[];
  skills: HarnessSkill[];
  locale: string;
}> = ({ extensions, skills, locale }) => {
  const tr = useHarnessChatTr();
  const runtimeConfig = useRuntimeConfig();
  // An explicit `extensions` prop wins; otherwise resolve the default set
  // against runtime config so `create_story` isn't registered (and offered
  // to the harness) while ENABLE_STORYTELLING is off. `null` config (still
  // loading) is treated as off, same as use-visible-pages.
  const resolvedExtensions = useMemo(
    () =>
      extensions ??
      resolveDefaultHarnessExtensions({
        storytellingEnabled: runtimeConfig?.ENABLE_STORYTELLING === "true",
      }),
    [extensions, runtimeConfig],
  );
  const {
    isOpen,
    close,
    pendingMessage,
    clearPendingMessage,
    pendingConversation,
    clearPendingConversation,
    pendingAttachment,
    clearPendingAttachment,
  } = useHarnessChatContext();
  const { width, isDragging, startDrag, toggleMinMax, onHandleKeyDown, bounds } =
    useResizablePanelWidth();
  const [sessions, setSessions] = useState<Session[]>(() => [createSession()]);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [view, setView] = useState<View>("chat");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  // Only the sessions the user has actually opened carry a runtime. Every
  // mounted session loads its own transcript, so mounting all of them would
  // fetch the whole history on boot; keeping the opened ones mounted is what
  // lets a run finish while the user reads another chat.
  const [mountedIds, setMountedIds] = useState<Set<string>>(() => new Set([activeId]));
  // Titles already written upstream. The watcher fires on every message
  // change; without this every one of them would be a PATCH.
  const persistedTitles = useRef(new Map<string, string>());

  const mount = useCallback((id: string) => {
    setMountedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  // Stored threads land under the fresh session the panel opens with, so the
  // user starts on an empty chat with their history one click away. A store
  // that cannot be reached leaves the panel working on this session alone —
  // but it says so, because "you have no past chats" and "we could not read
  // them" are the same empty list otherwise.
  const loadHistory = useCallback((signal?: AbortSignal) => {
    setIsLoadingHistory(true);
    setHistoryFailed(false);
    return listThreads(signal)
      .then((threads) => {
        if (signal?.aborted) return;
        // null is the store reporting a failure; [] is a user with no threads.
        if (threads === null) {
          setHistoryFailed(true);
          return;
        }
        if (threads.length > 0) setSessions((prev) => mergeStoredThreads(prev, threads));
      })
      .finally(() => {
        if (!signal?.aborted) setIsLoadingHistory(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  const newChat = useCallback(
    (
      initialMessage: string | null = null,
      initialConversation: PendingHarnessConversation | null = null,
    ) => {
      const session = createSession(initialMessage, initialConversation);
      setSessions((prev) => [session, ...prev]);
      setActiveId(session.id);
      mount(session.id);
      setView("chat");
    },
    [mount],
  );

  // A search-bar "open chat" action, or a spotlight "Take to chat" handoff,
  // landed while we were mounted — start a fresh conversation for it. Both
  // pending slots are handled by this one effect (rather than two independent
  // ones) so that if they were ever both set at once, only one `newChat` ever
  // fires per render — `pendingMessage` takes precedence — instead of two
  // sessions racing to become the active one.
  useEffect(() => {
    if (pendingMessage) {
      newChat(pendingMessage);
      clearPendingMessage();
      return;
    }
    if (pendingConversation) {
      newChat(null, pendingConversation);
      clearPendingConversation();
    }
  }, [
    pendingMessage,
    pendingConversation,
    newChat,
    clearPendingMessage,
    clearPendingConversation,
  ]);

  const selectSession = useCallback(
    (id: string) => {
      setActiveId(id);
      mount(id);
      setView("chat");
    },
    [mount],
  );

  const updateSessionTitle = useCallback((id: string, title: string | null) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1 || prev[idx].title === title) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title };
      return next;
    });
    // An upsert, so this doubles as "make sure the thread row exists" — the
    // title arrives with the first user message, which may still be racing its
    // own append.
    if (title && persistedTitles.current.get(id) !== title) {
      // Recorded up front so the watcher's next call does not re-send it, and
      // dropped again if the write failed — otherwise one lost request leaves
      // the thread permanently untitled while its messages save fine.
      persistedTitles.current.set(id, title);
      void createThread({ id, title }).then((saved) => {
        if (!saved) persistedTitles.current.delete(id);
      });
    }
  }, []);

  const shareSession = useCallback(async (id: string, principal: string) => {
    if (!(await shareThread(id, principal))) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id && !s.sharedWith.includes(principal)
          ? { ...s, sharedWith: [...s.sharedWith, principal] }
          : s,
      ),
    );
  }, []);

  const unshareSession = useCallback(async (id: string, principal: string) => {
    if (!(await revokeShare(id, principal))) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, sharedWith: s.sharedWith.filter((p) => p !== principal) } : s,
      ),
    );
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
      if (idSet.has(activeId)) {
        setActiveId(nextSessions[0].id);
        mount(nextSessions[0].id);
      }
      for (const session of sessions) {
        if (!idSet.has(session.id)) continue;
        persistedTitles.current.delete(session.id);
        // Only the owner may delete upstream. A thread someone shared just
        // leaves this list until the next load; giving it back is the owner's
        // call, not the reader's.
        if (session.owned) void deleteThread(session.id);
      }
    },
    [sessions, activeId, mount],
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
            isLoading={isLoadingHistory}
            hasFailed={historyFailed}
            onRetry={() => void loadHistory()}
            onSelect={selectSession}
            onDelete={(ids) => deleteSessions(ids)}
            onShare={shareSession}
            onUnshare={unshareSession}
            locale={locale}
          />
        )}
        <div className={twMerge("flex min-h-0 flex-1 flex-col", view === "history" && "hidden")}>
          {sessions.filter((session) => mountedIds.has(session.id)).map((session) => (
            <SessionHost
              key={session.id}
              sessionId={session.id}
              active={session.id === activeId}
              shouldFocus={isOpen && view === "chat"}
              initialMessage={session.initialMessage}
              initialConversation={session.initialConversation}
              // Only the active session should receive it — every session's
              // SessionHost stays mounted (just hidden), so a session-agnostic
              // prop would add the same attachment to all of them at once.
              pendingAttachmentLabel={session.id === activeId ? pendingAttachment : null}
              onAttachmentConsumed={clearPendingAttachment}
              onTitleChange={updateSessionTitle}
              readOnly={!session.owned}
              extensions={resolvedExtensions}
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
  initialConversation: PendingHarnessConversation | null;
  pendingAttachmentLabel: string | null;
  onAttachmentConsumed: () => void;
  onTitleChange: (id: string, title: string | null) => void;
  readOnly: boolean;
  extensions: HarnessExtension[];
  skills: HarnessSkill[];
}> = ({
  sessionId,
  active,
  shouldFocus,
  initialMessage,
  initialConversation,
  pendingAttachmentLabel,
  onAttachmentConsumed,
  onTitleChange,
  readOnly,
  extensions,
  skills,
}) => {
  // One agent instance per session — its conversation state (threadId, the
  // harness's round-tripped conversationId) shouldn't leak across concurrent
  // chat sessions. The session id is handed over as the AG-UI threadId, which
  // is what the chat route falls back to for the harness conversation id: the
  // same value survives a reload, so a reopened thread continues its
  // conversation instead of starting a new one. A spotlight "Take to chat"
  // handoff instead seeds the specific conversation id its answer came from,
  // so the user's next message continues that conversation server-side.
  const agent = useMemo(
    () =>
      new HarnessRunAgent({
        url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/chat/stream`,
        threadId: sessionId,
        ...(initialConversation?.conversationId && {
          initialState: { harnessConversationId: initialConversation.conversationId },
        }),
      }),
    // `initialConversation` is read once at session creation, same as sessionId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );
  const tr = useHarnessChatTr();
  const attachmentAdapter = useMemo(() => createHarnessAttachmentAdapter(tr), [tr]);
  const history = useMemo(() => createHarnessHistoryAdapter(sessionId), [sessionId]);
  const runtime = useAgUiRuntime({
    agent,
    adapters: { attachments: attachmentAdapter, history },
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
        <HarnessReadOnlyProvider readOnly={readOnly}>
          {/* A shared thread is somebody else's conversation: it has a title
              already, takes no pending message, and offers nothing that runs. */}
          {!readOnly && (
            <>
              <SessionTitleWatcher sessionId={sessionId} onTitleChange={onTitleChange} />
              <SessionSummaryWatcher sessionId={sessionId} />
              <InitialMessageSender initialMessage={initialMessage} />
              <InitialConversationSeeder conversation={initialConversation} />
              <PendingAttachmentReceiver
                label={pendingAttachmentLabel}
                onConsumed={onAttachmentConsumed}
              />
            </>
          )}
          <Thread skills={skills} />
        </HarnessReadOnlyProvider>
      </AssistantRuntimeProvider>
    </div>
  );
};
