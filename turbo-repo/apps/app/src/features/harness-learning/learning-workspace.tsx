"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type FC,
} from "react";
import { Spinner } from "flowbite-react";
import { toast } from "sonner";
import {
  LuGraduationCap,
  LuLink,
  LuPanelLeft,
  LuPanelRight,
  LuPlus,
  LuX,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import { StandaloneDictionaryProvider } from "@/features/dashboard/context/standalone-dictionary-context";
import type {
  I18nDictionary,
  I18nRecord,
} from "@/features/i18n/i18n.service.types";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { copyShareLink } from "@/features/share-links/share-links-api";
import { useKnowledgeTrainer } from "@/features/knowledge/hooks/use-knowledge-trainer";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import {
  HarnessChatI18nProvider,
  useHarnessChatTr,
} from "@/features/harness-chat/context/harness-chat-i18n-context";
import {
  WorkAreaProvider,
  type WorkArea,
  type WorkItem,
} from "@/features/harness-chat/context/work-area-context";
import { resolveDefaultHarnessExtensions } from "@/features/harness-chat/extensions";
import {
  changeKey,
  type KnowledgeChange,
} from "@/features/harness-chat/extensions/knowledge-change-args";
import { HistoryList } from "@/features/harness-chat/components/history-list";
import { SessionHost } from "@/features/harness-chat/components/session-host";
import { learningCommands } from "./learning-commands";
import { useLearningSessions } from "./use-learning-sessions";
import { INITIAL_WORK_AREA, workAreaReducer } from "./work-area-state";
import { WorkAreaPanel } from "./work-area/work-area-panel";

const headerButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 aria-pressed:bg-gray-100 aria-pressed:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white";

const noop = () => undefined;

/** Changes recorded per session, without repeats. */
function useSessionChanges() {
  const [byThread, setByThread] = useState<Map<string, KnowledgeChange[]>>(
    () => new Map()
  );
  const record = useCallback((threadId: string, change: KnowledgeChange) => {
    setByThread((prev) => {
      const list = prev.get(threadId) ?? [];
      const key = changeKey(change);
      if (list.some((c) => changeKey(c) === key)) return prev;
      return new Map(prev).set(threadId, [...list, change]);
    });
  }, []);
  const changesOf = useCallback(
    (threadId: string) => byThread.get(threadId) ?? [],
    [byThread]
  );
  return { record, changesOf };
}

const CommandsCheatSheet: FC = () => {
  const tr = useHarnessChatTr();
  const commands = useMemo(() => learningCommands(tr), [tr]);
  return (
    <div className="w-full max-w-xl">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {tr("harnessChat.learning.commandsHeading")}
      </h2>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-lg border border-gray-200 bg-white p-3 text-xs sm:grid-cols-[auto_1fr] dark:border-gray-700 dark:bg-gray-800">
        {commands.map((command) => (
          <div key={command.id} className="contents">
            <dt className="font-mono text-gray-800 dark:text-gray-100">
              /{command.id}
              {command.usage && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">
                  {command.usage}
                </span>
              )}
            </dt>
            <dd className="text-gray-500 dark:text-gray-400">
              {command.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

const LearningWorkspaceBody: FC<{ locale: string }> = ({ locale }) => {
  const tr = useHarnessChatTr();
  const runtimeConfig = useRuntimeConfig();
  const { close: closeChatPanel } = useHarnessChatContext();
  const learning = useLearningSessions();
  const [workArea, dispatch] = useReducer(workAreaReducer, INITIAL_WORK_AREA);
  const { record, changesOf } = useSessionChanges();
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // The page is the chat: the side panel would be a second one.
  useEffect(() => closeChatPanel(), [closeChatPanel]);

  const extensions = useMemo(
    () =>
      resolveDefaultHarnessExtensions({
        storytellingEnabled: runtimeConfig?.ENABLE_STORYTELLING === "true",
      }),
    [runtimeConfig]
  );
  const commands = useMemo(() => learningCommands(tr), [tr]);

  const open = useCallback(
    (item: WorkItem) => dispatch({ type: "open", item }),
    []
  );
  const area = useMemo<WorkArea>(
    () => ({ open, recordChange: record }),
    [open, record]
  );

  const newSession = async () => {
    setCreating(true);
    const ok = await learning.create();
    setCreating(false);
    if (ok) setSessionsOpen(false);
    else toast.error(tr("harnessChat.learning.newSessionFailed"));
  };

  const active =
    learning.sessions.find((s) => s.id === learning.activeId) ?? null;
  const copyLink = (id: string) =>
    copyShareLink("thread", id, locale).then(
      () => toast.success(tr("harnessChat.ui.history.linkCopied")),
      () => toast.error(tr("harnessChat.ui.history.linkFailed"))
    );

  const sessionsColumn = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <h2 className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {tr("harnessChat.learning.sessions")}
        </h2>
        <button
          type="button"
          onClick={() => void newSession()}
          disabled={creating}
          className="flex items-center gap-1 rounded-md bg-blue-700 px-2 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          <LuPlus aria-hidden className="h-3.5 w-3.5" />
          {tr("harnessChat.learning.newSession")}
        </button>
      </div>
      {learning.status === "ready" && learning.sessions.length === 0 ? (
        <p className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400">
          {tr("harnessChat.learning.noSessions")}
        </p>
      ) : (
        <HistoryList
          sessions={learning.sessions}
          activeId={learning.activeId ?? ""}
          isLoading={learning.status === "loading"}
          hasFailed={learning.status === "failed"}
          onRetry={() => void learning.load()}
          onSelect={(id) => {
            learning.select(id);
            setSessionsOpen(false);
          }}
          onDelete={learning.remove}
          onShare={(id, principal) => void learning.share(id, principal)}
          onUnshare={(id, principal) => void learning.unshare(id, principal)}
          onRename={learning.rename}
          onFork={(id) => void learning.fork(id)}
          onCopyLink={(id) => void copyLink(id)}
          locale={locale}
        />
      )}
    </div>
  );

  return (
    <WorkAreaProvider value={area}>
      <div className="flex h-full min-h-0 w-full bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 md:flex dark:border-gray-700">
          {sessionsColumn}
        </aside>
        {sessionsOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="flex w-72 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-gray-900">
              <div className="flex justify-end px-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSessionsOpen(false)}
                  aria-label={tr("harnessChat.learning.hideSessions")}
                  className={headerButtonClass}
                >
                  <LuX className="h-4 w-4" />
                </button>
              </div>
              {sessionsColumn}
            </div>
            <button
              type="button"
              aria-label={tr("harnessChat.learning.hideSessions")}
              onClick={() => setSessionsOpen(false)}
              className="flex-1 bg-gray-900/40"
            />
          </div>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setSessionsOpen(true)}
              aria-label={tr("harnessChat.learning.showSessions")}
              className={twMerge(headerButtonClass, "md:hidden")}
            >
              <LuPanelLeft className="h-4 w-4" />
            </button>
            <LuGraduationCap
              aria-hidden
              className="h-4 w-4 shrink-0 text-amber-500"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {active
                  ? (active.title ?? tr("harnessChat.learning.untitled"))
                  : tr("harnessChat.learning.title")}
              </h1>
            </div>
            {active?.owned && active.title && (
              <button
                type="button"
                onClick={() => void copyLink(active.id)}
                aria-label={tr("harnessChat.ui.history.shareLink")}
                title={tr("harnessChat.ui.history.shareLink")}
                className={headerButtonClass}
              >
                <LuLink className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-pressed={workArea.open}
              onClick={() => dispatch({ type: "toggle" })}
              aria-label={tr("harnessChat.learning.work.title")}
              title={tr("harnessChat.learning.work.title")}
              className={headerButtonClass}
            >
              <LuPanelRight className="h-4 w-4" />
            </button>
          </header>

          {learning.sessions
            .filter((session) => learning.mountedIds.has(session.id))
            .map((session) => (
              <SessionHost
                key={session.id}
                sessionId={session.id}
                active={session.id === learning.activeId}
                shouldFocus={session.id === learning.activeId}
                initialMessage={null}
                pendingAttachment={null}
                onAttachmentConsumed={noop}
                pendingPrompt={null}
                onPromptSent={noop}
                onTitleChange={learning.onTitleChange}
                onFirstExchange={learning.onFirstExchange}
                onFork={learning.fork}
                readOnly={!session.owned}
                extensions={extensions}
                skills={commands}
                learning
              />
            ))}

          {!active && (
            <div className="flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto bg-gray-50 px-4 py-10 dark:bg-gray-900">
              <div className="flex max-w-xl flex-col items-center gap-2 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                  <LuGraduationCap className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {tr("harnessChat.learning.emptyTitle")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tr("harnessChat.learning.emptyText")}
                </p>
                <button
                  type="button"
                  onClick={() => void newSession()}
                  disabled={creating}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {creating ? (
                    <Spinner size="sm" />
                  ) : (
                    <LuPlus aria-hidden className="h-4 w-4" />
                  )}
                  {tr("harnessChat.learning.newSession")}
                </button>
              </div>
              <CommandsCheatSheet />
            </div>
          )}
        </section>

        <WorkAreaPanel
          state={workArea}
          dispatch={dispatch}
          onOpen={open}
          changesOf={changesOf}
        />
      </div>
    </WorkAreaProvider>
  );
};

const TrainerGate: FC<{ locale: string }> = ({ locale }) => {
  const tr = useHarnessChatTr();
  const { isTrainer, isLoading } = useKnowledgeTrainer();
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" aria-label={tr("harnessChat.learning.loading")} />
      </div>
    );
  }
  if (!isTrainer) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {tr("harnessChat.learning.notTrainer")}
        </p>
      </div>
    );
  }
  return <LearningWorkspaceBody locale={locale} />;
};

/**
 * The learning workspace: a trainer's sessions, the chat of the open one, and
 * the working area its cards open things in.
 */
export default function LearningWorkspace({
  dict,
  locale,
}: Readonly<{ dict: I18nDictionary; locale: string }>) {
  return (
    <HarnessChatI18nProvider dict={dict}>
      <StandaloneDictionaryProvider dictionary={dict as I18nRecord}>
        <TrainerGate locale={locale} />
      </StandaloneDictionaryProvider>
    </HarnessChatI18nProvider>
  );
}
