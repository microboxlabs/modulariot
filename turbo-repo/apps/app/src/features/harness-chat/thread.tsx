"use client";

import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type CompleteAttachment,
} from "@assistant-ui/react";
import { BsStars } from "react-icons/bs";
import {
  LuCopy,
  LuFile,
  LuFileDown,
  LuPaperclip,
  LuPencil,
  LuRotateCcw,
  LuSendHorizontal,
  LuSparkles,
  LuSquare,
  LuThumbsDown,
  LuThumbsUp,
  LuX,
} from "react-icons/lu";
import type { FC } from "react";

const actionButtonClass =
  "flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        <ThreadPrimitive.Empty>
          <ThreadEmpty />
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <Composer />
    </ThreadPrimitive.Root>
  );
};

const ThreadEmpty: FC = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-gray-400 dark:text-gray-500">
    <LuSparkles className="h-5 w-5" />
    <p className="text-xs">Ask the harness about this workspace.</p>
  </div>
);

const UserMessage: FC = () => {
  const isEditing = useAuiState((s) => s.composer.isEditing);

  return (
    <MessagePrimitive.Root className="group/message flex flex-col items-end gap-1">
      <MessagePrimitive.Attachments>
        {({ attachment }) => <SentAttachment attachment={attachment} />}
      </MessagePrimitive.Attachments>
      {isEditing ? (
        <EditComposer />
      ) : (
        <MessagePrimitive.If hasContent>
          <div className="flex items-center justify-end gap-1.5">
            <UserActionBar />
            <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              <MessagePrimitive.Parts />
            </div>
          </div>
        </MessagePrimitive.If>
      )}
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100">
    <ActionBarPrimitive.Edit className={actionButtonClass}>
      <LuPencil className="h-3 w-3" />
    </ActionBarPrimitive.Edit>
    <ActionBarPrimitive.Copy className={actionButtonClass}>
      <LuCopy className="h-3 w-3" />
    </ActionBarPrimitive.Copy>
  </ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
  <ComposerPrimitive.Root className="flex w-full flex-col gap-1.5 rounded-lg border border-gray-300 bg-white p-1.5 dark:border-gray-600 dark:bg-gray-800">
    <ComposerPrimitive.Input
      autoFocus
      rows={1}
      className="max-h-32 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-gray-800 outline-none dark:text-gray-100"
    />
    <div className="flex justify-end gap-1.5">
      <ComposerPrimitive.Cancel className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
        Cancel
      </ComposerPrimitive.Cancel>
      <ComposerPrimitive.Send className="rounded-md bg-gray-800 px-2 py-1 text-xs text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300">
        Save
      </ComposerPrimitive.Send>
    </div>
  </ComposerPrimitive.Root>
);

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="group/message flex flex-col gap-1">
    <div className="flex gap-2">
      <BsStars className="mt-0.5 h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />
      <div className="max-w-[90%] text-xs leading-relaxed text-gray-700 dark:text-gray-300">
        <MessagePrimitive.Parts />
      </div>
    </div>
    <AssistantActionBar />
  </MessagePrimitive.Root>
);

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root className="ml-6 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100">
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

function SentAttachment({ attachment }: { attachment: CompleteAttachment }) {
  const part = attachment.content[0];
  const name = attachment.name;

  if (attachment.type === "image" && part?.type === "image") {
    return (
      // Data-URL attachment content — next/image doesn't optimize these anyway.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.image}
        alt={name}
        className="max-h-48 max-w-55 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
      />
    );
  }

  const href = part?.type === "file" ? part.data : undefined;

  return (
    <a
      href={href}
      download={name}
      target="_blank"
      rel="noreferrer"
      className="flex max-w-[85%] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
    >
      <LuFile className="h-3 w-3 shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}

const Composer: FC = () => (
  <ComposerPrimitive.Root className="m-2 flex shrink-0 flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus-within:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-gray-600">
    <ComposerPrimitive.Attachments>
      {({ attachment }) => (
        <AttachmentPrimitive.Root
          key={attachment.id}
          className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        >
          <LuFile className="h-3 w-3 shrink-0" />
          <span className="flex-1 truncate">
            <AttachmentPrimitive.Name />
          </span>
          <AttachmentPrimitive.Remove className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-100">
            <LuX className="h-3 w-3" />
          </AttachmentPrimitive.Remove>
        </AttachmentPrimitive.Root>
      )}
    </ComposerPrimitive.Attachments>

    <div className="flex items-center gap-1">
      <ComposerPrimitive.AddAttachment className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
        <LuPaperclip className="h-3.5 w-3.5" />
      </ComposerPrimitive.AddAttachment>
      <ComposerPrimitive.Input
        rows={1}
        placeholder="Ask the harness…"
        className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-gray-800 outline-none transition-[height] duration-100 ease-out placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <LuSendHorizontal className="h-3.5 w-3.5" />
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <LuSquare className="h-3 w-3" />
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  </ComposerPrimitive.Root>
);
