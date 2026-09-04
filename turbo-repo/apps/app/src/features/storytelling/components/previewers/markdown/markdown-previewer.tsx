"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { focusSearchMatch, searchInDom } from "../../../dom-search";
import type { SearchableHandle } from "../searchable";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH;
export const MARKDOWN_PREVIEW_URL = `${base_path ?? ""}/api/storytelling/markdown-preview`;
export const MARKDOWN_DOWNLOAD_FILENAME = "story.md";

interface MarkdownPreviewerProps {
  readonly dict: I18nRecord;
  /** Lets the header know when the search box can accept input. */
  readonly onReadyChange?: (ready: boolean) => void;
}

interface TocEntry {
  readonly level: number;
  readonly text: string;
}

/** Fetches the artifact's raw Markdown and renders it with the same
 * MarkdownContent component the rest of the app already uses (dashboard
 * dashlets, settings fields) — not a separate renderer for this one case.
 * A side rail lists the document's headings (styled like the PDF
 * previewer's "Sections" tab — previewers/pdf/pdf-previewer.tsx) for
 * quick navigation; it's built from the actual rendered heading elements
 * rather than re-parsing the Markdown, so nesting inside blockquotes/lists
 * is covered for free and there's no risk of the two disagreeing.
 * Searchable: renders in our own document (unlike HtmlPreviewer's iframe),
 * so find-in-page just scopes dom-search.ts to this component's own
 * container instead of a foreign document. */
export const MarkdownPreviewer = forwardRef<SearchableHandle, MarkdownPreviewerProps>(
  function MarkdownPreviewer({ dict, onReadyChange }, ref) {
    const [content, setContent] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const matchStateRef = useRef({ count: 0, current: -1 });

    const [toc, setToc] = useState<TocEntry[]>([]);
    const headingElsRef = useRef<HTMLElement[]>([]);
    const [activeHeading, setActiveHeading] = useState(0);

    useEffect(() => {
      let cancelled = false;
      fetch(MARKDOWN_PREVIEW_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          if (!cancelled) setContent(text);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      // Ready as soon as loading settles either way — a failed load still
      // means there's nothing left to wait on.
      if (content !== null || failed) onReadyChange?.(true);
    }, [content, failed, onReadyChange]);

    // Build the outline from the headings MarkdownContent actually rendered
    // (once, right after they land in the DOM), then track which one the
    // reader has scrolled to — same "topmost visible entry wins" idea as a
    // scrollspy, so the highlight doesn't chase whichever heading happens to
    // cover the most pixels.
    useEffect(() => {
      const container = containerRef.current;
      if (content === null || !container) return;

      const headings = Array.from(
        container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
      );
      headingElsRef.current = headings;
      setToc(
        headings.map((el) => ({
          level: Number(el.tagName[1]),
          text: el.textContent?.trim() ?? "",
        }))
      );
      if (headings.length === 0) return;

      const visible = new Map<number, boolean>();
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const idx = headings.indexOf(entry.target as HTMLElement);
            if (idx !== -1) visible.set(idx, entry.isIntersecting);
          }
          const visibleIndexes = [...visible.entries()]
            .filter(([, isVisible]) => isVisible)
            .map(([idx]) => idx);
          if (visibleIndexes.length > 0) setActiveHeading(Math.min(...visibleIndexes));
        },
        { root: container, threshold: 0 }
      );
      for (const el of headings) io.observe(el);
      return () => io.disconnect();
    }, [content]);

    useImperativeHandle(
      ref,
      () => ({
        search(query: string) {
          const el = containerRef.current;
          if (!el) return 0;
          const count = searchInDom(el, query);
          matchStateRef.current = { count, current: count > 0 ? 0 : -1 };
          if (count > 0) focusSearchMatch(el, 0);
          return count;
        },
        stepMatch(delta: number) {
          const { count, current } = matchStateRef.current;
          if (count === 0) return -1;
          const el = containerRef.current;
          if (!el) return current;
          const next = (current + delta + count) % count;
          matchStateRef.current.current = next;
          focusSearchMatch(el, next);
          return next;
        },
      }),
      []
    );

    if (failed) {
      return (
        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          {tr("detail.markdown.error", dict)}
        </div>
      );
    }

    if (content === null) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white dark:bg-gray-900">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr("detail.loading", dict)}</p>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full min-h-0 flex-1">
        {toc.length > 0 && (
          <div className="flex w-48 shrink-0 flex-col border-r border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-950">
            <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {tr("detail.markdown.outline", dict)}
            </div>
            <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              {toc.map((entry, i) => (
                <li key={`${entry.level}-${entry.text}-${i}`}>
                  <button
                    type="button"
                    onClick={() =>
                      headingElsRef.current[i]?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    style={{ paddingLeft: `${0.5 + (entry.level - 1) * 0.75}rem` }}
                    className={`block w-full truncate rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${
                      i === activeHeading
                        ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        : "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                    title={entry.text}
                  >
                    {entry.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          ref={containerRef}
          className="h-full min-h-0 flex-1 overflow-y-auto bg-white dark:bg-gray-900"
        >
          <MarkdownContent variant="document" className="mx-auto max-w-4xl px-6 py-10">
            {content}
          </MarkdownContent>
        </div>
      </div>
    );
  }
);
