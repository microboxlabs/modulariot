"use client";

import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
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
import { useEffect, useMemo, useState, type FC, type KeyboardEvent } from "react";
import { twMerge } from "tailwind-merge";
import { HARNESS_SKILLS, type HarnessSkill } from "./harness-chat-skills";

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

function useSlashCommand() {
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [activeSkill, setActiveSkill] = useState<HarnessSkill | null>(null);

  const lastToken = text.split(/\s/).pop() ?? "";
  const query = lastToken.startsWith("/") ? lastToken.slice(1) : null;

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return HARNESS_SKILLS.filter(
      (skill) => skill.id.includes(q) || skill.label.toLowerCase().includes(q)
    );
  }, [query]);

  const isOpen = query !== null && !dismissed && matches.length > 0;

  useEffect(() => {
    setDismissed(false);
    setHighlighted(0);
  }, [query]);

  const select = (skill: HarnessSkill) => {
    setActiveSkill(skill);
    aui.composer.setText("");
    setDismissed(true);
  };

  const clearActiveSkill = () => setActiveSkill(null);

  const uncommitActiveSkill = () => {
    if (!activeSkill) return;
    const raw = `/${activeSkill.id}`;
    setActiveSkill(null);
    aui.composer.setText(raw.slice(0, -1));
  };

  const send = () => {
    const combined = activeSkill
      ? `/${activeSkill.id}${text ? ` ${text}` : ""}`
      : text;
    aui.composer.setText(combined);
    aui.composer.send();
    setActiveSkill(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => (i + 1) % matches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => (i - 1 + matches.length) % matches.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        select(matches[highlighted]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
      }
      return;
    }
    if (activeSkill && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    if (
      activeSkill &&
      e.key === "Backspace" &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.preventDefault();
      uncommitActiveSkill();
    }
  };

  return {
    isOpen,
    matches,
    highlighted,
    setHighlighted,
    select,
    onKeyDown,
    activeSkill,
    clearActiveSkill,
    send,
  };
}

const Composer: FC = () => {
  const slash = useSlashCommand();

  return (
    <ComposerPrimitive.Root className="relative m-2 flex shrink-0 flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus-within:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-gray-600">
      {slash.isOpen && (
        <SlashMenu
          skills={slash.matches}
          highlighted={slash.highlighted}
          onHover={slash.setHighlighted}
          onSelect={slash.select}
        />
      )}

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
        {slash.activeSkill && (
          <SkillBadge skill={slash.activeSkill} onRemove={slash.clearActiveSkill} />
        )}
        <ComposerPrimitive.Input
          rows={1}
          placeholder={
            slash.activeSkill
              ? slash.activeSkill.description
              : "Ask the harness…"
          }
          onKeyDown={slash.onKeyDown}
          className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-gray-800 outline-none transition-[height] duration-100 ease-out placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <ThreadPrimitive.If running={false}>
          {slash.activeSkill ? (
            <button
              type="button"
              onClick={slash.send}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            >
              <LuSendHorizontal className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ComposerPrimitive.Send className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
              <LuSendHorizontal className="h-3.5 w-3.5" />
            </ComposerPrimitive.Send>
          )}
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
            <LuSquare className="h-3 w-3" />
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
      </div>
    </ComposerPrimitive.Root>
  );
};

const SkillBadge: FC<{ skill: HarnessSkill; onRemove: () => void }> = ({
  skill,
  onRemove,
}) => {
  const Icon = skill.icon;
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      <Icon className="h-3 w-3" />
      {skill.label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove skill"
        className="flex h-3 w-3 items-center justify-center rounded-sm hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        <LuX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
};

const SlashMenu: FC<{
  skills: typeof HARNESS_SKILLS;
  highlighted: number;
  onHover: (index: number) => void;
  onSelect: (skill: HarnessSkill) => void;
}> = ({ skills, highlighted, onHover, onSelect }) => (
  <div className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
    {skills.map((skill, i) => {
      const Icon = skill.icon;
      return (
        <button
          key={skill.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(skill)}
          onMouseEnter={() => onHover(i)}
          className={twMerge(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200",
            i === highlighted && "bg-gray-100 dark:bg-gray-700"
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
          <span className="font-medium">/{skill.label}</span>
          <span className="truncate text-gray-400 dark:text-gray-500">
            {skill.description}
          </span>
        </button>
      );
    })}
  </div>
);
