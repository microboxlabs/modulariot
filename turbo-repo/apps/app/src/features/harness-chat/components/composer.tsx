"use client";

import { AuiIf, ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { LuPaperclip, LuSendHorizontal, LuSquare } from "react-icons/lu";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type RefObject,
  type UIEvent,
} from "react";
import { twMerge } from "tailwind-merge";
import type { HarnessSkill } from "../harness-chat-types";
import { useRunCancel } from "../context/run-cancel-context";
import { ComposerAttachmentPreview } from "./attachments";

const WHITESPACE_CHARS = new Set([" ", "\t", "\n", "\r", "\f", "\v"]);

// Index of the start of the trailing run of non-whitespace characters —
// a plain scan instead of the unanchored `/\S*$/` regex (flagged for
// super-linear backtracking risk on pathological input).
function trailingNonWhitespaceStart(text: string): number {
  let i = text.length;
  while (i > 0 && !WHITESPACE_CHARS.has(text[i - 1])) i--;
  return i;
}

function useSlashCommand(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  skills: HarnessSkill[]
) {
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  // Caret position, not just end-of-text — a "/" typed in the middle of
  // already-written text (between two words) should open the menu too.
  const [cursorPos, setCursorPos] = useState(text.length);
  const pendingCursorRef = useRef<number | null>(null);

  const skillIds = useMemo(() => new Set(skills.map((skill) => skill.id)), [skills]);

  const beforeCursor = text.slice(0, cursorPos);
  const tokenStart = trailingNonWhitespaceStart(beforeCursor);
  const currentToken = beforeCursor.slice(tokenStart);
  const query = currentToken.startsWith("/") ? currentToken.slice(1) : null;

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return skills.filter(
      (skill) => skill.id.includes(q) || skill.label.toLowerCase().includes(q)
    );
  }, [query, skills]);

  const isOpen = query !== null && !dismissed && matches.length > 0;

  // Any exact "/skillid" token anywhere in the text is highlighted live,
  // whether it was typed by hand or inserted via the dropdown — the text
  // itself stays a single string, no separate committed-skill state.
  const highlightedParts = useMemo(() => {
    // Segments are fragments of freely-typed text with no natural id, so a
    // key is derived from the segment's own value plus its occurrence
    // count among duplicates — not its position — since the array index
    // shifts as the user types and can associate the wrong DOM node with
    // the wrong segment.
    const seen = new Map<string, number>();
    return text.split(/(\s+)/).map((segment) => {
      if (segment.startsWith("/") && skillIds.has(segment.slice(1))) {
        const occurrence = seen.get(segment) ?? 0;
        seen.set(segment, occurrence + 1);
        return (
          <span key={`${segment}#${occurrence}`} className="text-amber-600 dark:text-amber-400">
            {segment}
          </span>
        );
      }
      return segment;
    });
  }, [text, skillIds]);

  useEffect(() => {
    setDismissed(false);
    setHighlighted(0);
  }, [query]);

  // Restore the caret once the composer text (and thus the DOM value) has
  // actually updated to include the inserted "/skillid " — setting it any
  // earlier would just get clamped/overwritten by the pending value swap.
  useEffect(() => {
    if (pendingCursorRef.current === null) return;
    const pos = pendingCursorRef.current;
    pendingCursorRef.current = null;
    textareaRef.current?.setSelectionRange(pos, pos);
  }, [text, textareaRef]);

  const trackCursor = (e: { currentTarget: HTMLTextAreaElement }) => {
    setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
  };

  const select = (skill: HarnessSkill) => {
    const tokenStartAbs = cursorPos - currentToken.length;
    const insertion = `/${skill.id} `;
    const newText = text.slice(0, tokenStartAbs) + insertion + text.slice(cursorPos);
    const newCursorPos = tokenStartAbs + insertion.length;
    pendingCursorRef.current = newCursorPos;
    setCursorPos(newCursorPos);
    aui.composer.setText(newText);
    setDismissed(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return;
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
  };

  return {
    isOpen,
    matches,
    highlighted,
    setHighlighted,
    select,
    onKeyDown,
    highlightedParts,
    trackCursor,
  };
}

export const Composer: FC<{ skills: HarnessSkill[] }> = ({ skills }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slash = useSlashCommand(textareaRef, skills);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { markCanceled } = useRunCancel();
  const text = useAuiState((s) => s.composer.text);

  const syncBackdropScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
  };

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

      <div className="flex flex-wrap gap-1.5 empty:hidden">
        <ComposerPrimitive.Attachments>
          {({ attachment }) => (
            <ComposerAttachmentPreview key={attachment.id} attachment={attachment} />
          )}
        </ComposerPrimitive.Attachments>
      </div>

      <div className="flex items-center gap-1">
        <ComposerPrimitive.AddAttachment className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <LuPaperclip className="h-3.5 w-3.5" />
        </ComposerPrimitive.AddAttachment>
        {/*
          ComposerPrimitive.Input renders react-textarea-autosize under the
          hood. When the value is empty, it measures height from
          `node.placeholder` (falling back to a single "x" only once no
          placeholder is set either) — so a native `placeholder` attribute
          here would get wrapped across however many lines the *current*
          container width forces, and that width is briefly whatever the
          chat panel's own open/close CSS transition happens to be at that
          instant, not its final settled value. That's the actual "big empty
          input on open" bug: the placeholder text momentarily wraps to
          several lines in a near-zero-width container. No placeholder
          attribute means the library measures its own single-character
          fallback instead, which can never wrap — so the empty state's
          height is always minimal and width-independent, and it only ever
          grows once there's real text to grow for. The placeholder text
          itself is rendered separately below, as a plain absolutely
          positioned overlay that has no bearing on height.
        */}
        <div className="relative flex-1">
          <div
            ref={backdropRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-1 py-1 text-xs leading-snug text-gray-800 dark:text-gray-100"
          >
            {slash.highlightedParts}
          </div>
          {text === "" && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 truncate px-1 py-1 text-xs leading-snug text-gray-400 dark:text-gray-500"
            >
              Ask the harness…
            </span>
          )}
          <ComposerPrimitive.Input
            ref={textareaRef}
            rows={1}
            aria-label="Ask the harness…"
            onKeyDown={slash.onKeyDown}
            onChange={slash.trackCursor}
            onSelect={slash.trackCursor}
            onScroll={syncBackdropScroll}
            className="relative max-h-90 w-full resize-none bg-transparent px-1 py-1 text-xs leading-snug text-transparent outline-none transition-[height] duration-100 ease-out caret-gray-800 dark:caret-gray-100"
          />
        </div>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100">
            <LuSendHorizontal className="h-3.5 w-3.5" />
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel
            aria-label="Cancel"
            onClick={markCanceled}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            <LuSquare className="h-3 w-3" />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
};

const SlashMenu: FC<{
  skills: HarnessSkill[];
  highlighted: number;
  onHover: (index: number) => void;
  onSelect: (skill: HarnessSkill) => void;
}> = ({ skills, highlighted, onHover, onSelect }) => (
  <div className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
    {skills.map((skill, i) => (
      <button
        key={skill.id}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(skill)}
        onMouseEnter={() => onHover(i)}
        className={twMerge(
          "flex w-full flex-col gap-0.5 px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200",
          i === highlighted && "bg-gray-100 dark:bg-gray-700"
        )}
      >
        <span className="font-medium">/{skill.label}</span>
        <span className="truncate text-gray-400 dark:text-gray-500">{skill.description}</span>
      </button>
    ))}
  </div>
);
