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
  LuPencil,
  LuRotateCcw,
  LuSparkles,
  LuThumbsDown,
  LuThumbsUp,
} from "react-icons/lu";
import { useState, type FC } from "react";
import { twMerge } from "tailwind-merge";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { useRunCancel } from "../context/run-cancel-context";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";
import { SentAttachment } from "./attachments";

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

const UserActionBar: FC = () => (
  // focus-within reveals the bar for keyboard users — Edit and Copy are
  // tabbable whether or not a pointer happens to be over the message.
  <ActionBarPrimitive.Root className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
    <ActionBarPrimitive.Edit className={actionButtonClass}>
      <LuPencil className="h-3 w-3" />
    </ActionBarPrimitive.Edit>
    <ActionBarPrimitive.Copy className={actionButtonClass}>
      <LuCopy className="h-3 w-3" />
    </ActionBarPrimitive.Copy>
  </ActionBarPrimitive.Root>
);

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
// lists…) via the same MarkdownContent the spotlight search answer uses,
// so a harness reply reads the same wherever it shows up.
const AssistantText: FC<TextMessagePartProps> = ({ text }) => (
  <div className="max-w-[90%] text-xs leading-relaxed text-gray-700 dark:text-gray-300">
    <MarkdownContent>{text}</MarkdownContent>
  </div>
);

// Live "what the harness is doing" narration, above the reply it belongs to.
// While the run is still going, it's plain growing text — no toggle, no
// cursor — small and gray so it reads as distinct from the reply, and with
// no height cap of its own so it just grows with the thread's own scroll
// (ThreadPrimitive.Viewport) rather than clipping into its own scrollbox.
// Only once the message settles does it collapse into a "Thought process"
// toggle, peeking the same text back open in a small scrollable panel.
//
// Only the *last* message renders it — reasoning is per-message content in
// assistant-ui's model, so every past reply still carries its own reasoning
// part; without this gate every one of them would show its own text/toggle
// as the conversation grows. Gating on `isLast` keeps exactly one, and it
// naturally moves with whichever message is newest.
const AssistantReasoning: FC<ReasoningMessagePartProps> = ({ text, status }) => {
  const tr = useHarnessChatTr();
  const [expanded, setExpanded] = useState(false);
  const isLast = useAuiState((s) => s.message.isLast);
  if (!isLast || !text.trim()) return null;

  if (status?.type !== "complete") {
    return (
      <div className="mb-1 max-w-[90%] whitespace-pre-wrap text-[10px] leading-snug text-gray-400 dark:text-gray-500">
        {text}
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
          {text}
        </div>
      )}
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

export const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="group/message flex flex-col gap-1">
    <div className="flex gap-2">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)]">
        <BsStars className="h-3 w-3 text-white" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <MessagePrimitive.Parts
          components={{ Text: AssistantText, Reasoning: AssistantReasoning }}
        />
        <CancelledNotice />
      </div>
    </div>
    <AssistantActionBar />
  </MessagePrimitive.Root>
);

const AssistantActionBar: FC = () => (
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
    <ActionBarPrimitive.Reload className={actionButtonClass}>
      <LuRotateCcw className="h-3 w-3" />
    </ActionBarPrimitive.Reload>
    <ActionBarPrimitive.ExportMarkdown className={actionButtonClass}>
      <LuFileDown className="h-3 w-3" />
    </ActionBarPrimitive.ExportMarkdown>
  </ActionBarPrimitive.Root>
);
