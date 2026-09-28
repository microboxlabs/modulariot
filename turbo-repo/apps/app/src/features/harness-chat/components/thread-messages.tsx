"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  type ReasoningMessagePartProps,
  type TextMessagePartProps,
} from "@assistant-ui/react";
import { BsStars } from "react-icons/bs";
import {
  LuChevronDown,
  LuCopy,
  LuFileDown,
  LuGitBranch,
  LuPause,
  LuPencil,
  LuRotateCcw,
  LuSparkles,
  LuThumbsDown,
  LuThumbsUp,
} from "react-icons/lu";
import { useEffect, useState, type FC } from "react";
import { twMerge } from "tailwind-merge";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { useRunCancel } from "../context/run-cancel-context";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";
import { useHarnessFork } from "../context/harness-fork-context";
import { useHarnessReadOnly } from "../context/harness-read-only-context";
import { useMessageRunId } from "../context/harness-run-lookup-context";
import { useRunStartedAt } from "../context/harness-session-context";
import {
  formatElapsed,
  runElapsedSince,
  splitNarration,
  withoutStatusLines,
} from "../run-progress";
import { REQUEST_APPROVAL_TOOL } from "../extensions/request-approval-args";
import { SentAttachment } from "./attachments";
import { RunActivityRow } from "./run-activity";

const actionButtonClass =
  "flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200";

export const ThreadEmpty: FC = () => {
  const tr = useHarnessChatTr();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-gray-400 dark:text-gray-500">
      <LuSparkles className="h-5 w-5" />
      <p className="text-xs">{tr("harnessChat.ui.thread.empty")}</p>
    </div>
  );
};

export const UserMessage: FC = () => {
  const isEditing = useAuiState((s) => s.composer.isEditing);

  return (
    <MessagePrimitive.Root className="group/message flex flex-col items-end gap-1">
      <MessagePrimitive.Attachments>
        {({ attachment }) => <SentAttachment attachment={attachment} />}
      </MessagePrimitive.Attachments>
      {isEditing ? (
        <EditComposer />
      ) : (
        <AuiIf condition={(s) => s.message.parts.length > 0}>
          <div className="flex items-center justify-end gap-1.5">
            <UserActionBar />
            <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              <MessagePrimitive.Parts />
            </div>
          </div>
        </AuiIf>
      )}
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  const readOnly = useHarnessReadOnly();
  return (
  // focus-within reveals the bar for keyboard users — Edit and Copy are
  // tabbable whether or not a pointer happens to be over the message.
  <ActionBarPrimitive.Root className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
    {!readOnly && (
      <ActionBarPrimitive.Edit className={actionButtonClass}>
        <LuPencil className="h-3 w-3" />
      </ActionBarPrimitive.Edit>
    )}
    <ActionBarPrimitive.Copy className={actionButtonClass}>
      <LuCopy className="h-3 w-3" />
    </ActionBarPrimitive.Copy>
  </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  const tr = useHarnessChatTr();
  return (
    <ComposerPrimitive.Root className="flex w-full flex-col gap-1.5 rounded-lg border border-gray-300 bg-white p-1.5 dark:border-gray-600 dark:bg-gray-800">
      <ComposerPrimitive.Input
        autoFocus
        rows={1}
        className="max-h-32 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-gray-800 outline-none dark:text-gray-100"
      />
      <div className="flex justify-end gap-1.5">
        <ComposerPrimitive.Cancel className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          {tr("harnessChat.ui.thread.editCancel")}
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send className="rounded-md bg-gray-800 px-2 py-1 text-xs text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300">
          {tr("harnessChat.ui.thread.editSave")}
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

// Plain text replies stay bubble-width, but non-text parts (like an
// ask-user-question card) render outside this cap, at the full row width —
// see the flex-1 wrapper below. Rendered as real markdown (bold, links,
// lists, tables…) via the same MarkdownContent + "compact" variant the
// spotlight search answer uses, so a harness reply reads the same wherever
// it shows up.
const AssistantText: FC<TextMessagePartProps> = ({ text }) => (
  <div className="max-w-[95%] animate-harness-enter text-xs leading-relaxed text-gray-700 dark:text-gray-300">
    <MarkdownContent>{text}</MarkdownContent>
  </div>
);

// Live "what the harness is doing" narration, above the reply it belongs to.
// While the run is still going, it's plain growing text — no toggle, no
// cursor — small and gray so it reads as distinct from the reply, and with
// no height cap of its own so it just grows with the thread's own scroll
// (ThreadPrimitive.Viewport) rather than clipping into its own scrollbox.
// Once the message settles it collapses into a "Thought process" toggle,
// peeking the same text back open in a small scrollable panel, with the run's
// activity row under it. Every past reply keeps its own collapsed toggle.
const AssistantReasoning: FC<ReasoningMessagePartProps> = ({ text, status }) => {
  const tr = useHarnessChatTr();
  const [expanded, setExpanded] = useState(false);
  const isLast = useAuiState((s) => s.message.isLast);
  const live = useLiveRun();
  const runId = useMessageRunId();
  const statusLines = [
    tr("harnessChat.stream.progress.connecting"),
    tr("harnessChat.stream.progress.thinking"),
  ];
  if (!text.trim()) return null;

  if (isLast && status?.type !== "complete") {
    // While RunStatus shows the step in progress, only the finished ones stay here.
    const shown = live
      ? splitNarration(text, statusLines).earlier
      : withoutStatusLines(text, statusLines);
    if (!shown) return null;
    return (
      <div className="mb-1 max-w-[90%] whitespace-pre-wrap text-[10px] leading-snug text-gray-400 dark:text-gray-500">
        {shown}
      </div>
    );
  }

  return (
    <div className="mb-1 flex max-w-[90%] flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-fit items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <span>{tr("harnessChat.ui.thread.thoughtProcess")}</span>
        <LuChevronDown
          className={twMerge("h-3 w-3 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="max-h-48 overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[10px] leading-snug text-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500">
          {withoutStatusLines(text, statusLines)}
        </div>
      )}
      {runId && <RunActivityRow runId={runId} />}
    </div>
  );
};

// A reply with no narration still gets its activity row, once it settled.
const ActivityWithoutReasoning: FC = () => {
  const runId = useMessageRunId();
  const settled = useAuiState(
    (s) =>
      s.message.status?.type !== "running" &&
      !s.message.parts.some((part) => part.type === "reasoning" && part.text.trim() !== "")
  );
  if (!runId || !settled) return null;
  return <RunActivityRow runId={runId} />;
};

/** True while this is the newest message, its run is going and no answer
 * text has arrived yet: from the moment of sending, before the first byte. */
function useLiveRun(): boolean {
  return useAuiState(
    (s) =>
      s.message.isLast &&
      s.message.status?.type === "running" &&
      !s.message.parts.some((part) => part.type === "text" && part.text.trim() !== "")
  );
}

function useElapsedMs(since: Date | undefined, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return since ? now - since.getTime() : 0;
}

// The step in progress, with a soft pulse, a shimmer and the time so far.
const RunStatus: FC = () => {
  const tr = useHarnessChatTr();
  const live = useLiveRun();
  const narration = useAuiState((s) =>
    s.message.parts.map((part) => (part.type === "reasoning" ? part.text : "")).join("\n")
  );
  const createdAt = useAuiState((s) => s.message.createdAt);
  // A reply rebuilt after a reload counts from where the harness started.
  const runStartedAt = useRunStartedAt();
  const elapsed = useElapsedMs(runElapsedSince(runStartedAt, createdAt), live);
  const awaitingApproval = useAuiState((s) =>
    s.message.parts.some(
      (part) =>
        part.type === "tool-call" &&
        part.toolName === REQUEST_APPROVAL_TOOL &&
        part.result === undefined
    )
  );
  if (!live) return null;

  if (awaitingApproval) {
    return (
      <div className="flex max-w-[90%] animate-harness-enter items-center gap-2 text-[11px] leading-snug">
        <LuPause aria-hidden className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
        <output className="min-w-0 truncate font-medium text-amber-600 dark:text-amber-400">
          {tr("harnessChat.ui.thread.awaitingApproval")}
        </output>
        <time
          title={tr("harnessChat.ui.thread.elapsed")}
          className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
        >
          {formatElapsed(elapsed)}
        </time>
      </div>
    );
  }

  const step = splitNarration(narration).current ?? tr("harnessChat.ui.thread.working");
  return (
    <div className="flex max-w-[90%] animate-harness-enter items-center gap-2 text-[11px] leading-snug">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 motion-safe:animate-pulse dark:bg-amber-400"
      />
      <output className="min-w-0 truncate animate-harness-shimmer">{step}</output>
      <time
        title={tr("harnessChat.ui.thread.elapsed")}
        className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
      >
        {formatElapsed(elapsed)}
      </time>
    </div>
  );
};

// Tracks the composer's Cancel click directly (see run-cancel-context.tsx)
// rather than the runtime's own message `status`: when the fetch aborts
// without surfacing as a client-side error (our relay just closes the
// stream quietly), the AG-UI runtime's finalize-fallback synthesizes a
// RUN_FINISHED right behind the local RUN_CANCELLED, silently flipping
// status back to "complete" — so status alone isn't reliable here.
const CancelledNotice: FC = () => {
  const tr = useHarnessChatTr();
  const { canceled } = useRunCancel();
  const isLast = useAuiState((s) => s.message.isLast);
  if (!canceled || !isLast) return null;
  return (
    <p className="max-w-[90%] text-xs italic text-gray-400 dark:text-gray-500">
      {tr("harnessChat.ui.thread.executionCanceled")}
    </p>
  );
};

// A run that ended in RUN_ERROR leaves an assistant message with no parts,
// which renders as nothing at all: the user's question sits there with no
// answer and no hint that one was attempted. Cancelled runs are the
// CancelledNotice above; this is the other way a message ends incomplete.
const FailedRunNotice: FC = () => {
  const tr = useHarnessChatTr();
  const readOnly = useHarnessReadOnly();
  const status = useAuiState((s) => s.message.status);
  if (status?.type !== "incomplete" || status.reason !== "error") return null;
  // The harness lost the run (it restarted): nothing was wrong with the question.
  const interrupted = status.error === "interrupted";
  return (
    <div className="flex max-w-[90%] flex-col gap-1">
      <p
        className={
          interrupted
            ? "text-xs text-gray-500 dark:text-gray-400"
            : "text-xs text-amber-600 dark:text-amber-500"
        }
      >
        {interrupted
          ? tr("harnessChat.ui.thread.runInterrupted")
          : tr("harnessChat.ui.thread.runFailed")}
      </p>
      {!readOnly && (
        <ActionBarPrimitive.Reload className="w-fit text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
          {tr("harnessChat.ui.thread.retry")}
        </ActionBarPrimitive.Reload>
      )}
    </div>
  );
};

export const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="group/message flex flex-col gap-1">
    <div className="flex gap-2">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)]">
        <BsStars className="h-3 w-3 text-white" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <ActivityWithoutReasoning />
        <MessagePrimitive.Parts
          components={{ Text: AssistantText, Reasoning: AssistantReasoning }}
        />
        <RunStatus />
        <CancelledNotice />
        <FailedRunNotice />
      </div>
    </div>
    <AssistantActionBar />
  </MessagePrimitive.Root>
);

const AssistantActionBar: FC = () => {
  const readOnly = useHarnessReadOnly();
  return (
  // Same as UserActionBar: tabbable controls have to become visible on focus.
  <ActionBarPrimitive.Root className="ml-6 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
    <ActionBarPrimitive.Copy className={actionButtonClass}>
      <LuCopy className="h-3 w-3" />
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.FeedbackPositive className={actionButtonClass}>
      <LuThumbsUp className="h-3 w-3" />
    </ActionBarPrimitive.FeedbackPositive>
    <ActionBarPrimitive.FeedbackNegative className={actionButtonClass}>
      <LuThumbsDown className="h-3 w-3" />
    </ActionBarPrimitive.FeedbackNegative>
    {!readOnly && (
      <ActionBarPrimitive.Reload className={actionButtonClass}>
        <LuRotateCcw className="h-3 w-3" />
      </ActionBarPrimitive.Reload>
    )}
    <ActionBarPrimitive.ExportMarkdown className={actionButtonClass}>
      <LuFileDown className="h-3 w-3" />
    </ActionBarPrimitive.ExportMarkdown>
    <ForkFromHere />
  </ActionBarPrimitive.Root>
  );
};

/** Starts a new thread holding this answer and everything above it. Offered on
 * shared threads too: forking is how a reader continues someone else's chat. */
const ForkFromHere: FC = () => {
  const tr = useHarnessChatTr();
  const fork = useHarnessFork();
  const messageId = useAuiState((s) => s.message.id);
  const settled = useAuiState(
    (s) => s.message.status?.type === "complete" && !s.thread.isRunning,
  );
  if (!fork) return null;
  const label = tr("harnessChat.ui.thread.forkFromHere");
  return (
    <button
      type="button"
      onClick={() => fork(messageId)}
      disabled={!settled}
      aria-label={label}
      title={label}
      className={actionButtonClass}
    >
      <LuGitBranch className="h-3 w-3" />
    </button>
  );
};
