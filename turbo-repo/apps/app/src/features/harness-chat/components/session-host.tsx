"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Tools,
} from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { twMerge } from "tailwind-merge";
import type {
  PendingAttachment,
  PendingHarnessConversation,
} from "../context/harness-chat-context";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";
import { HarnessForkProvider } from "../context/harness-fork-context";
import { HarnessModelProvider } from "../context/harness-model-context";
import { HarnessReadOnlyProvider } from "../context/harness-read-only-context";
import {
  HarnessRunLookupProvider,
  type HarnessRunLookup,
} from "../context/harness-run-lookup-context";
import {
  HarnessSessionProvider,
  type HarnessSession,
} from "../context/harness-session-context";
import { createHarnessAttachmentAdapter } from "../harness-chat-attachments";
import type { HarnessSkill } from "../harness-chat-types";
import {
  buildHarnessToolkit,
  type HarnessExtension,
} from "../harness-extension";
import { createHarnessHistoryAdapter } from "../harness-history-adapter";
import { HarnessRunAgent } from "../harness-run-agent";
import { useThreadModel } from "../hooks/use-thread-model";
import type { FirstExchange } from "../session-title";
import { Thread } from "../thread";
import { ActiveRunResumer } from "./active-run-resumer";
import { InitialConversationSeeder } from "./initial-conversation-seeder";
import { InitialMessageSender } from "./initial-message-sender";
import { PendingAttachmentReceiver } from "./pending-attachment-receiver";
import { PromptSender } from "./prompt-sender";
import { SessionModelWatcher } from "./session-model-watcher";
import { SessionSummaryWatcher } from "./session-summary-watcher";
import { SessionTitleWatcher } from "./session-title-watcher";

/** One chat session: its agent, runtime and transcript. */
export const SessionHost: FC<{
  sessionId: string;
  active: boolean;
  shouldFocus: boolean;
  initialMessage: string | null;
  initialConversation: PendingHarnessConversation | null;
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
  /** A trainer's learning session: its runs say so to the relay. */
  learning?: boolean;
}> = ({
  sessionId,
  active,
  shouldFocus,
  initialMessage,
  initialConversation,
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
  learning = false,
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
          initialState: {
            harnessConversationId: initialConversation.conversationId,
          },
        }),
      }),
    // `initialConversation` is read once at session creation, same as sessionId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId]
  );
  useEffect(() => {
    agent.learning = learning;
  }, [agent, learning]);
  const tr = useHarnessChatTr();
  // The adapter is built before the runtime it counts attachments on.
  const runtimeRef = useRef<ReturnType<typeof useAgUiRuntime> | null>(null);
  const attachmentAdapter = useMemo(
    () =>
      createHarnessAttachmentAdapter(
        tr,
        () =>
          runtimeRef.current?.thread.composer.getState().attachments.length ?? 0
      ),
    [tr]
  );
  const history = useMemo(
    () => createHarnessHistoryAdapter(sessionId, agent),
    [sessionId, agent]
  );
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
    [sessionId, agent]
  );
  const fork = useCallback(
    (atMessageId?: string) => void onFork(sessionId, atMessageId),
    [onFork, sessionId]
  );
  const stopRun = useCallback(() => agent.cancelHarnessRun(), [agent]);
  const runLookup = useCallback<HarnessRunLookup>(
    (messageId, isLast) =>
      history.runIdOf(messageId) ?? (isLast ? agent.harnessRunId : null),
    [history, agent]
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
                    <ActiveRunResumer
                      runtime={runtime}
                      history={history}
                      agent={agent}
                    />
                    <InitialMessageSender initialMessage={initialMessage} />
                    <InitialConversationSeeder
                      conversation={initialConversation}
                    />
                    <PromptSender
                      prompt={pendingPrompt}
                      onSent={onPromptSent}
                    />
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
