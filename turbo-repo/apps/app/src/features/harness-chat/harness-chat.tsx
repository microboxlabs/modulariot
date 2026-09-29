"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
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
import { useHarnessChatContext } from "./context/harness-chat-context";
import {
  HarnessChatI18nProvider,
  useHarnessChatTr,
} from "./context/harness-chat-i18n-context";
import { useResizablePanelWidth } from "./hooks/use-resizable-panel-width";
import { useSessionTitles } from "./hooks/use-session-titles";
import type { HarnessExtension } from "./harness-extension";
import { resolveDefaultHarnessExtensions } from "./extensions";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { ActivityButton, ActivityList } from "./components/activity-panel";
import { useHarnessActivity } from "./hooks/use-harness-activity";
import { HistoryList } from "./components/history-list";
import { PanelResizeHandle } from "./components/panel-resize-handle";
import { SessionHost } from "./components/session-host";
import { TitleInput } from "./components/title-input";
import type { HarnessSkill, Session, View } from "./harness-chat-types";
import { readActiveRun } from "./harness-active-run";
import {
  deleteThread,
  getThread,
  forkThread,
  listThreads,
  revokeShare,
  shareThread,
} from "./harness-thread-store";
import { createSession, mergeStoredThreads, toSession } from "./harness-sessions";
import { StandaloneDictionaryProvider } from "@/features/dashboard/context/standalone-dictionary-context";
import type { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";

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
  const resizable = useResizablePanelWidth();
  const { width, isDragging } = resizable;
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
  const [renamingHeader, setRenamingHeader] = useState(false);
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const openingSessionId = useRef(activeId);
  const {
    markTitled,
    forget,
    updateSessionTitle,
    autoTitleSession,
    renameSession,
  } = useSessionTitles({ sessionsRef, setSessions });

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
    return listThreads(signal, "chat")
      .then((threads) => {
        if (signal?.aborted) return;
        // null is the store reporting a failure; [] is a user with no threads.
        if (threads === null) {
          setHistoryFailed(true);
          return;
        }
        for (const thread of threads) {
          if (thread.title) markTitled(thread.id);
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
  }, [mount, markTitled]);

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

  const forkSession = useCallback(
    async (id: string, atMessageId?: string) => {
      const saved = await forkThread(id, atMessageId);
      if (!saved) return;
      markTitled(saved.id);
      setSessions((prev) => [toSession(saved), ...prev]);
      setActiveId(saved.id);
      mount(saved.id);
      setView("chat");
    },
    [mount, markTitled],
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
        forget(session.id);
        // Only the owner may delete upstream. A thread someone shared just
        // leaves this list until the next load; giving it back is the owner's
        // call, not the reader's.
        if (session.owned) void deleteThread(session.id);
      }
    },
    [sessions, activeId, mount, forget],
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
        <PanelResizeHandle label={tr("harnessChat.ui.resizePanel")} resizable={resizable} />
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
