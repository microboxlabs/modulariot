"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { twMerge } from "tailwind-merge";
import {
  LuArrowLeft,
  LuEllipsisVertical,
  LuHistory,
  LuLink,
  LuPencil,
  LuPlus,
  LuSparkles,
  LuX,
} from "react-icons/lu";
import { Dropdown, DropdownItem } from "flowbite-react";
import { toast } from "sonner";
import type { RunSummary } from "@microboxlabs/miot-harness-client";
import { copyShareLink } from "@/features/share-links/share-links-api";
import { createHarnessAttachmentAdapter } from "./harness-chat-attachments";
import {
  useHarnessChatContext,
  type PendingAttachment,
} from "./context/harness-chat-context";
import {
  HarnessChatI18nProvider,
  useHarnessChatTr,
} from "./context/harness-chat-i18n-context";
import { useResizablePanelWidth } from "./hooks/use-resizable-panel-width";
import { useThreadModel } from "./hooks/use-thread-model";
import { buildHarnessToolkit, type HarnessExtension } from "./harness-extension";
import { resolveDefaultHarnessExtensions } from "./extensions";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { ActiveRunResumer } from "./components/active-run-resumer";
import { ActivityButton, ActivityList } from "./components/activity-panel";
import { PromptSender } from "./components/prompt-sender";
import { useHarnessActivity } from "./hooks/use-harness-activity";
import { HistoryList } from "./components/history-list";
import { InitialMessageSender } from "./components/initial-message-sender";
import { PendingAttachmentReceiver } from "./components/pending-attachment-receiver";
import { SessionModelWatcher } from "./components/session-model-watcher";
import { SessionSummaryWatcher } from "./components/session-summary-watcher";
import { SessionTitleWatcher } from "./components/session-title-watcher";
import { TitleInput } from "./components/title-input";
import { HarnessForkProvider } from "./context/harness-fork-context";
import { HarnessModelProvider } from "./context/harness-model-context";
import { HarnessReadOnlyProvider } from "./context/harness-read-only-context";
import { HarnessSessionProvider, type HarnessSession } from "./context/harness-session-context";
import {
  HarnessRunLookupProvider,
  type HarnessRunLookup,
} from "./context/harness-run-lookup-context";
import type { HarnessSkill, Session, View } from "./harness-chat-types";
import { readActiveRun } from "./harness-active-run";
import { createHarnessHistoryAdapter } from "./harness-history-adapter";
import type { FirstExchange } from "./session-title";
import { HarnessRunAgent } from "./harness-run-agent";
import {
  autoTitleThread,
  createThread,
  deleteThread,
  getThread,
  forkThread,
  listThreads,
  renameThread,
  revokeShare,
  shareThread,
  type StoredThread,
} from "./harness-thread-store";
import { StandaloneDictionaryProvider } from "@/features/dashboard/context/standalone-dictionary-context";
import type { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
import { Thread } from "./thread";

function createSession(initialMessage: string | null = null): Session {
  return {
    // A UUID, not any id: it is stored as the thread's primary key and sent to
    // the harness as the conversation id.
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: null,
    initialMessage,
    owned: true,
    sharedWith: [],
    titleEdited: false,
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
    owned: thread.owned,
    sharedWith: thread.sharedWith ?? [],
    titleEdited: thread.titleEdited ?? false,
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
  // against runtime config so storytelling-only cards aren't registered (and offered
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
    pendingAttachment,
    clearPendingAttachment,
    pendingThreadId,
    clearPendingThreadId,
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
  // Sessions whose title is settled: loaded with one, generated, renamed or
  // forked. The first-message placeholder only fills an untitled session.
  const titledIds = useRef(new Set<string>());
  // Sessions a generated title was already asked for, so it is asked once.
  const autoTitled = useRef(new Set<string>());
  // The placeholder title's write, which a generated title must land after or
  // the late upsert would put the placeholder back.
  const placeholderWrites = useRef(new Map<string, Promise<unknown>>());
  const [renamingHeader, setRenamingHeader] = useState(false);
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const openingSessionId = useRef(activeId);

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
        for (const thread of threads) {
          if (thread.title) titledIds.current.add(thread.id);
        }
        if (threads.length > 0) setSessions((prev) => mergeStoredThreads(prev, threads));
        // A reload in the middle of a run reopens that chat, which then
        // re-attaches to the run.
        const running = threads.find((thread) => thread.owned && readActiveRun(thread.id));
        if (!running) return;
        mount(running.id);
        setActiveId((current) => (current === openingSessionId.current ? running.id : current));
      })
      .finally(() => {
        if (!signal?.aborted) setIsLoadingHistory(false);
      });
  }, [mount]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  const newChat = useCallback(
    (initialMessage: string | null = null) => {
      const session = createSession(initialMessage);
      setSessions((prev) => [session, ...prev]);
      setActiveId(session.id);
      mount(session.id);
      setView("chat");
    },
    [mount],
  );

  // A search-bar "open chat" action landed while we were mounted — start a
  // fresh conversation with that text as the first (auto-sent) message.
  useEffect(() => {
    if (!pendingMessage) return;
    newChat(pendingMessage);
    clearPendingMessage();
  }, [pendingMessage, newChat, clearPendingMessage]);

  const selectSession = useCallback(
    (id: string) => {
      setActiveId(id);
      mount(id);
      setView("chat");
    },
    [mount],
  );

  // "Open conversation" from elsewhere in the app (a story's source thread).
  // A thread the panel has not listed yet is read on its own and added.
  useEffect(() => {
    if (!pendingThreadId) return;
    clearPendingThreadId();
    if (sessions.some((s) => s.id === pendingThreadId)) {
      selectSession(pendingThreadId);
      return;
    }
    void getThread(pendingThreadId).then((thread) => {
      if (!thread) return;
      setSessions((prev) => (prev.some((s) => s.id === thread.id) ? prev : [toSession(thread), ...prev]));
      selectSession(thread.id);
    });
  }, [pendingThreadId, clearPendingThreadId, sessions, selectSession]);

  const setSessionTitle = useCallback((id: string, title: string, titleEdited: boolean) => {
    titledIds.current.add(id);
    persistedTitles.current.set(id, title);
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title, titleEdited: s.titleEdited || titleEdited } : s)),
    );
  }, []);

  const updateSessionTitle = useCallback((id: string, title: string | null) => {
    if (!title || titledIds.current.has(id)) return;
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
      const write = createThread({ id, title }).then((saved) => {
        if (!saved) persistedTitles.current.delete(id);
      });
      placeholderWrites.current.set(id, write);
    }
  }, []);

  // After the first answer, a generated title replaces the first-message
  // placeholder — unless the person has named the thread, which the store
  // enforces too.
  const autoTitleSession = useCallback(
    (id: string, exchange: FirstExchange) => {
      const session = sessionsRef.current.find((s) => s.id === id);
      if (!session?.owned || session.titleEdited || autoTitled.current.has(id)) return;
      autoTitled.current.add(id);
      const placeholder = placeholderWrites.current.get(id) ?? Promise.resolve();
      void placeholder
        .then(() => autoTitleThread(id, exchange))
        .then((saved) => {
          if (!saved?.title) return;
          // A rename made while this was in flight wins; the store kept it too.
          const current = sessionsRef.current.find((s) => s.id === id);
          if (current?.titleEdited && !saved.titleEdited) return;
          setSessionTitle(id, saved.title, saved.titleEdited ?? false);
        });
    },
    [setSessionTitle],
  );

  const renameSession = useCallback(
    (id: string, title: string) => {
      const previous = sessionsRef.current.find((s) => s.id === id);
      setSessionTitle(id, title, true);
      void renameThread(id, title).then((ok) => {
        if (ok || !previous) return;
        // Undone in full: left behind, these would stop the first message
        // from titling a thread that was never stored.
        if (previous.title === null) {
          titledIds.current.delete(id);
          persistedTitles.current.delete(id);
        } else {
          persistedTitles.current.set(id, previous.title);
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, title: previous.title, titleEdited: previous.titleEdited } : s,
          ),
        );
      });
    },
    [setSessionTitle],
  );

  const forkSession = useCallback(
    async (id: string, atMessageId?: string) => {
      const saved = await forkThread(id, atMessageId);
      if (!saved) return;
      titledIds.current.add(saved.id);
      setSessions((prev) => [toSession(saved), ...prev]);
      setActiveId(saved.id);
      mount(saved.id);
      setView("chat");
    },
    [mount],
  );

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
        titledIds.current.delete(session.id);
        // Only the owner may delete upstream. A thread someone shared just
        // leaves this list until the next load; giving it back is the owner's
        // call, not the reader's.
        if (session.owned) void deleteThread(session.id);
      }
    },
    [sessions, activeId, mount],
  );

  // Like Claude Code's or Codex's share links: one link any member of the
  // organization can open, copied straight to the clipboard.
  const copyThreadLink = useCallback(
    (id: string) => {
      copyShareLink("thread", id, locale).then(
        () => toast.success(tr("harnessChat.ui.history.linkCopied")),
        () => toast.error(tr("harnessChat.ui.history.linkFailed")),
      );
    },
    [locale, tr],
  );

  const activeSession = sessions.find((s) => s.id === activeId);
  // A thread is stored once it has a title, so only then is there anything to link to.
  const canLinkActive = Boolean(activeSession?.owned && activeSession.title);
  const activeTitle = activeSession?.title ?? tr("harnessChat.ui.emptyChatTitle");

  const [activityOpen, setActivityOpen] = useState(false);

  const titleOf = useCallback(
    (conversationId: string | null) =>
      sessions.find((s) => s.id === conversationId)?.title ?? null,
    [sessions],
  );
  const openThread = useCallback(
    (conversationId: string) => {
      if (!sessions.some((s) => s.id === conversationId)) return;
      selectSession(conversationId);
      setActivityOpen(false);
    },
    [sessions, selectSession],
  );

  // Read by the finish notification, which fires from a poll, not a render.
  const watching = useRef({ activeId, isOpen, view, titleOf, openThread, tr });
  useEffect(() => {
    watching.current = { activeId, isOpen, view, titleOf, openThread, tr };
  });
  const notifyFinished = useCallback((run: RunSummary) => {
    const current = watching.current;
    const onScreen =
      current.isOpen && current.view === "chat" && run.conversation_id === current.activeId;
    if (onScreen || !run.conversation_id) return;
    const conversationId = run.conversation_id;
    const title = current.titleOf(conversationId) ?? current.tr("harnessChat.ui.jobs.untitled");
    const message =
      run.status === "completed"
        ? current.tr("harnessChat.ui.jobs.toastDone", { title })
        : current.tr("harnessChat.ui.jobs.toastFailed", { title });
    toast(message, {
      action: {
        label: current.tr("harnessChat.ui.jobs.toastOpen"),
        onClick: () => watching.current.openThread(conversationId),
      },
    });
  }, []);

  const activity = useHarnessActivity({ panelOpen: activityOpen, onFinished: notifyFinished });
  const activeRunning = activity.runs.some(
    (run) => run.status === "running" && run.conversation_id === activeId,
  );

  const [pendingPrompt, setPendingPrompt] = useState<{ id: string; text: string } | null>(null);
  const clearPendingPrompt = useCallback(() => setPendingPrompt(null), []);
  const askSessionSummary = () =>
    setPendingPrompt({ id: activeId, text: tr("harnessChat.ui.menu.sessionSummaryPrompt") });

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
              {renamingHeader && activeSession ? (
                <TitleInput
                  key={activeSession.id}
                  initial={activeSession.title ?? ""}
                  label={tr("harnessChat.ui.history.rename")}
                  onSubmit={(title) => renameSession(activeSession.id, title)}
                  onDone={() => setRenamingHeader(false)}
                />
              ) : (
                <span className="group/title flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate" title={activeTitle}>
                    {activeTitle}
                  </span>
                  {activeSession?.owned && activeSession.title && (
                    <button
                      type="button"
                      onClick={() => setRenamingHeader(true)}
                      aria-label={tr("harnessChat.ui.history.rename")}
                      title={tr("harnessChat.ui.history.rename")}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 group-hover/title:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                    >
                      <LuPencil className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )}
              {canLinkActive && (
                <button
                  type="button"
                  onClick={() => copyThreadLink(activeId)}
                  aria-label={tr("harnessChat.ui.history.shareLink")}
                  title={tr("harnessChat.ui.history.shareLink")}
                  className={headerButtonClass}
                >
                  <LuLink className="h-3.5 w-3.5" />
                </button>
              )}
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
          <ActivityButton
            open={activityOpen}
            onOpenChange={setActivityOpen}
            runningCount={activity.runningCount}
            className={headerButtonClass}
          >
            <ActivityList
              runs={activity.runs}
              failed={activity.failed}
              titleOf={titleOf}
              onOpen={openThread}
            />
          </ActivityButton>
          <button
            type="button"
            onClick={() => newChat()}
            aria-label={tr("harnessChat.ui.history.newChat")}
            className={headerButtonClass}
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
          <Dropdown
            label=""
            dismissOnClick
            placement="bottom-end"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={tr("harnessChat.ui.menu.open")}
                className={headerButtonClass}
              >
                <LuEllipsisVertical className="h-3.5 w-3.5" />
              </button>
            )}
          >
            <DropdownItem
              onClick={askSessionSummary}
              disabled={view !== "chat" || !activeSession?.owned || activeRunning}
              className="text-xs"
            >
              {tr("harnessChat.ui.menu.sessionSummary")}
            </DropdownItem>
          </Dropdown>
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
            onRename={renameSession}
            onFork={(id) => void forkSession(id)}
            onCopyLink={copyThreadLink}
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
              // Only the active session should receive it — every session's
              // SessionHost stays mounted (just hidden), so a session-agnostic
              // prop would add the same attachment to all of them at once.
              pendingAttachment={session.id === activeId ? pendingAttachment : null}
              onAttachmentConsumed={clearPendingAttachment}
              pendingPrompt={pendingPrompt?.id === session.id ? pendingPrompt.text : null}
              onPromptSent={clearPendingPrompt}
              onTitleChange={updateSessionTitle}
              onFirstExchange={autoTitleSession}
              onFork={forkSession}
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
  pendingAttachment: PendingAttachment | null;
  onAttachmentConsumed: () => void;
  pendingPrompt: string | null;
  onPromptSent: () => void;
  onTitleChange: (id: string, title: string | null) => void;
  onFirstExchange: (id: string, exchange: FirstExchange) => void;
  onFork: (id: string, atMessageId?: string) => Promise<void>;
  readOnly: boolean;
  extensions: HarnessExtension[];
  skills: HarnessSkill[];
}> = ({
  sessionId,
  active,
  shouldFocus,
  initialMessage,
  pendingAttachment,
  onAttachmentConsumed,
  pendingPrompt,
  onPromptSent,
  onTitleChange,
  onFirstExchange,
  onFork,
  readOnly,
  extensions,
  skills,
}) => {
  // One agent instance per session — its conversation state (threadId, the
  // harness's round-tripped conversationId) shouldn't leak across concurrent
  // chat sessions. The session id is handed over as the AG-UI threadId, which
  // is what the chat route falls back to for the harness conversation id: the
  // same value survives a reload, so a reopened thread continues its
  // conversation instead of starting a new one.
  const agent = useMemo(
    () =>
      new HarnessRunAgent({
        url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/chat/stream`,
        threadId: sessionId,
      }),
    [sessionId],
  );
  const tr = useHarnessChatTr();
  // The adapter is built before the runtime it counts attachments on.
  const runtimeRef = useRef<ReturnType<typeof useAgUiRuntime> | null>(null);
  const attachmentAdapter = useMemo(
    () =>
      createHarnessAttachmentAdapter(
        tr,
        () => runtimeRef.current?.thread.composer.getState().attachments.length ?? 0,
      ),
    [tr],
  );
  const history = useMemo(() => createHarnessHistoryAdapter(sessionId, agent), [sessionId, agent]);
  const runtime = useAgUiRuntime({
    agent,
    adapters: { attachments: attachmentAdapter, history },
  });
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolkit = useMemo(() => buildHarnessToolkit(extensions), [extensions]);
  // The picked model rides on the agent so every run of this session carries
  // it; null keeps the harness default.
  const [model, setModel] = useState<string | null>(null);
  useEffect(() => {
    agent.model = model;
  }, [agent, model]);
  useThreadModel(sessionId, setModel);
  const session = useMemo<HarnessSession>(
    () => ({
      threadId: sessionId,
      runStartedAt: () => agent.runStartedAt,
      subscribeRunClock: agent.subscribeClock,
    }),
    [sessionId, agent],
  );
  const fork = useCallback(
    (atMessageId?: string) => void onFork(sessionId, atMessageId),
    [onFork, sessionId],
  );
  const stopRun = useCallback(() => agent.cancelHarnessRun(), [agent]);
  const runLookup = useCallback<HarnessRunLookup>(
    (messageId, isLast) => history.runIdOf(messageId) ?? (isLast ? agent.harnessRunId : null),
    [history, agent],
  );

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
          <HarnessForkProvider onFork={fork}>
          <HarnessModelProvider model={model} onChange={setModel}>
          <HarnessSessionProvider session={session}>
          {/* A shared thread is somebody else's conversation: it has a title
              already, takes no pending message, and offers nothing that runs. */}
          {!readOnly && (
            <>
              <SessionTitleWatcher
                sessionId={sessionId}
                onTitleChange={onTitleChange}
                onFirstExchange={onFirstExchange}
              />
              <SessionSummaryWatcher sessionId={sessionId} />
              <SessionModelWatcher sessionId={sessionId} />
              <ActiveRunResumer runtime={runtime} history={history} agent={agent} />
              <InitialMessageSender initialMessage={initialMessage} />
              <PromptSender prompt={pendingPrompt} onSent={onPromptSent} />
              <PendingAttachmentReceiver
                attachment={pendingAttachment}
                onConsumed={onAttachmentConsumed}
              />
            </>
          )}
          <HarnessRunLookupProvider lookup={runLookup}>
            <Thread skills={skills} onStop={stopRun} />
          </HarnessRunLookupProvider>
          </HarnessSessionProvider>
          </HarnessModelProvider>
          </HarnessForkProvider>
        </HarnessReadOnlyProvider>
      </AssistantRuntimeProvider>
    </div>
  );
};
