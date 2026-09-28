"use client";

import { Fragment, useMemo, useState, type FC, type ReactNode } from "react";
import { createTwoFilesPatch } from "diff";
import {
  Decoration,
  Diff,
  Hunk,
  markEdits,
  parseDiff,
  tokenize,
  type FileData,
  type HunkData,
  type HunkTokens,
  type ViewType,
} from "react-diff-view";
import {
  LuChevronsUpDown,
  LuColumns2,
  LuRows2,
  LuWrapText,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import "react-diff-view/style/index.css";
import "./diff-view.css";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";

const CONTEXT_LINES = 3;

/** A unified diff between two texts, as `git diff` would print it. */
export function unifiedPatch(
  oldText: string,
  newText: string,
  path: string,
  context: number = CONTEXT_LINES
): string {
  return withGitHeader(
    createTwoFilesPatch(
      `a/${path}`,
      `b/${path}`,
      oldText,
      newText,
      undefined,
      undefined,
      {
        context,
      }
    ),
    path
  );
}

/**
 * The parser reads git's format: a diff that starts at its `---` line (as
 * Python's difflib writes them) gets the `diff --git` line in front, and
 * anything before the `---` line is dropped.
 */
export function withGitHeader(diff: string, path: string): string {
  if (diff.startsWith("diff --git ")) return diff;
  const lines = diff.split("\n");
  let start = lines.findIndex((line) => line.startsWith("--- "));
  if (start < 0) {
    start = lines.findIndex((line) => line.startsWith("@@"));
    if (start < 0) return diff;
    lines.splice(start, 0, `--- a/${path}`, `+++ b/${path}`);
  }
  return [`diff --git a/${path} b/${path}`, ...lines.slice(start)].join("\n");
}

/** The first file of a unified diff; null when it has no hunks. */
export function parsePatch(diff: string, path = "file"): FileData | null {
  try {
    const [file] = parseDiff(withGitHeader(diff, path), {
      nearbySequences: "zip",
    });
    return file && file.hunks.length > 0 ? file : null;
  } catch {
    return null;
  }
}

function tokensOf(hunks: HunkData[]): HunkTokens | null {
  try {
    return tokenize(hunks, {
      enhancers: [markEdits(hunks, { type: "block" })],
    });
  } catch {
    return null;
  }
}

function lineCount(text: string): number {
  if (!text) return 0;
  const lines = text.split("\n");
  return text.endsWith("\n") ? lines.length - 1 : lines.length;
}

/** Old-file lines between one hunk and the next that the diff leaves out. */
export function hiddenBefore(hunks: HunkData[], index: number): number {
  const hunk = hunks[index];
  if (index === 0) return Math.max(hunk.oldStart - 1, 0);
  const previous = hunks[index - 1];
  return Math.max(hunk.oldStart - (previous.oldStart + previous.oldLines), 0);
}

export type DiffViewProps = {
  /** A unified diff. Ignored when both texts are given. */
  diff?: string | null;
  oldText?: string | null;
  newText?: string | null;
  path?: string | null;
  defaultView?: ViewType;
  /** Height cap of the scroll area, as a class; none by default. */
  maxHeightClass?: string;
  className?: string;
};

const toggleClass =
  "flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 aria-pressed:bg-gray-100 aria-pressed:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white";

/**
 * A unified diff with line numbers, unified or side-by-side, with unchanged
 * runs folded and long lines wrapped or scrolled. Given both texts, the
 * folded runs can be shown too.
 */
export const DiffView: FC<DiffViewProps> = ({
  diff,
  oldText,
  newText,
  path,
  defaultView = "unified",
  maxHeightClass,
  className,
}) => {
  const tr = useHarnessChatTr();
  const [viewType, setViewType] = useState<ViewType>(defaultView);
  const [wrap, setWrap] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const name = path ?? "file";
  const hasTexts = typeof oldText === "string" && typeof newText === "string";

  const file = useMemo(() => {
    if (hasTexts) {
      const context = collapsed
        ? CONTEXT_LINES
        : Math.max(lineCount(oldText), lineCount(newText), 1);
      return parsePatch(unifiedPatch(oldText, newText, name, context), name);
    }
    return diff ? parsePatch(diff, name) : null;
  }, [hasTexts, oldText, newText, diff, name, collapsed]);

  const tokens = useMemo(() => (file ? tokensOf(file.hunks) : null), [file]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const hunk of file?.hunks ?? []) {
      for (const change of hunk.changes) {
        if (change.type === "insert") added++;
        else if (change.type === "delete") removed++;
      }
    }
    return { added, removed };
  }, [file]);

  if (!file) {
    const identical = hasTexts ? oldText === newText : !diff?.trim();
    return (
      <p className="rounded-md bg-gray-50 px-2 py-1.5 text-[11px] text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        {identical
          ? tr("harnessChat.learning.diff.noChanges")
          : tr("harnessChat.learning.diff.invalid")}
      </p>
    );
  }

  const last = file.hunks[file.hunks.length - 1];
  const trailing = hasTexts
    ? Math.max(lineCount(oldText) - (last.oldStart + last.oldLines - 1), 0)
    : 0;

  const fold = (count: number, key: string): ReactNode => {
    const label = tr("harnessChat.learning.diff.hiddenLines", {
      count: String(count),
    });
    return (
      <Decoration key={key} className="bg-gray-50 dark:bg-gray-800/60">
        {hasTexts ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="w-full px-2 py-0.5 text-left text-[10px] text-blue-600 hover:underline dark:text-blue-400"
          >
            ⋯ {label}
          </button>
        ) : (
          <span className="block px-2 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
            ⋯ {label}
          </span>
        )}
      </Decoration>
    );
  };

  const renderHunks = (hunks: HunkData[]) =>
    hunks.map((hunk, index) => {
      const hidden = hiddenBefore(hunks, index);
      return (
        <Fragment key={hunk.content}>
          {hidden > 0 && fold(hidden, `fold-${hunk.content}`)}
          <Hunk hunk={hunk} />
          {index === hunks.length - 1 &&
            trailing > 0 &&
            fold(trailing, "fold-end")}
        </Fragment>
      );
    });

  return (
    <div
      className={twMerge(
        "miot-diff flex min-w-0 flex-col overflow-hidden rounded-md border border-gray-200 text-[11px] dark:border-gray-700",
        !wrap && "miot-diff-nowrap",
        className
      )}
    >
      <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-1.5 py-1 dark:border-gray-700 dark:bg-gray-800">
        <span className="px-1 font-mono text-[11px] tabular-nums">
          <span className="text-green-700 dark:text-green-400">
            +{stats.added}
          </span>{" "}
          <span className="text-red-600 dark:text-red-400">
            −{stats.removed}
          </span>
        </span>
        <div
          role="group"
          aria-label={tr("harnessChat.learning.diff.view")}
          className="ml-auto flex items-center gap-0.5"
        >
          <button
            type="button"
            aria-pressed={viewType === "unified"}
            title={tr("harnessChat.learning.diff.unified")}
            onClick={() => setViewType("unified")}
            className={toggleClass}
          >
            <LuRows2 aria-hidden className="h-3 w-3" />
            <span className="hidden sm:inline">
              {tr("harnessChat.learning.diff.unified")}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={viewType === "split"}
            title={tr("harnessChat.learning.diff.split")}
            onClick={() => setViewType("split")}
            className={toggleClass}
          >
            <LuColumns2 aria-hidden className="h-3 w-3" />
            <span className="hidden sm:inline">
              {tr("harnessChat.learning.diff.split")}
            </span>
          </button>
        </div>
        <button
          type="button"
          aria-pressed={wrap}
          aria-label={tr("harnessChat.learning.diff.wrap")}
          title={tr("harnessChat.learning.diff.wrap")}
          onClick={() => setWrap((on) => !on)}
          className={toggleClass}
        >
          <LuWrapText aria-hidden className="h-3 w-3" />
        </button>
        {hasTexts && (
          <button
            type="button"
            aria-pressed={collapsed}
            aria-label={tr("harnessChat.learning.diff.collapse")}
            title={tr("harnessChat.learning.diff.collapse")}
            onClick={() => setCollapsed((on) => !on)}
            className={toggleClass}
          >
            <LuChevronsUpDown aria-hidden className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className={twMerge("min-h-0 overflow-auto", maxHeightClass)}>
        <Diff
          viewType={viewType}
          diffType={file.type}
          hunks={file.hunks}
          tokens={tokens}
        >
          {renderHunks}
        </Diff>
      </div>
    </div>
  );
};
