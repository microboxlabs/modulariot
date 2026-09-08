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

/** Fetches the artifact's raw Markdown and renders it with the same
 * MarkdownContent component the rest of the app already uses (dashboard
 * dashlets, settings fields) — not a separate renderer for this one case.
 * Searchable: renders in our own document (unlike HtmlPreviewer's iframe),
 * so find-in-page just scopes dom-search.ts to this component's own
 * container instead of a foreign document. */
export const MarkdownPreviewer = forwardRef<SearchableHandle, MarkdownPreviewerProps>(
  function MarkdownPreviewer({ dict, onReadyChange }, ref) {
    const [content, setContent] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const matchStateRef = useRef({ count: 0, current: -1 });

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
      <div ref={containerRef} className="h-full w-full overflow-y-auto bg-white dark:bg-gray-900">
        <MarkdownContent variant="document" className="mx-auto max-w-4xl px-6 py-10">
          {content}
        </MarkdownContent>
      </div>
    );
  }
);
