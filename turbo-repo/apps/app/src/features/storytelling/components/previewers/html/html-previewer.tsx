"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useHarnessChatContext } from "@/features/harness-chat/context/harness-chat-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  describeInjectedElement,
  focusSearchMatch,
  injectActionPills,
  searchInIframe,
  syncInjectedTheme,
} from "../../../iframe-inject-actions";
import type { SearchableHandle } from "../searchable";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH;
export const HTML_PREVIEW_URL = `${base_path ?? ""}/api/storytelling/dashboard-preview`;
export const HTML_DOWNLOAD_FILENAME = "dashboard.html";

interface HtmlPreviewerProps {
  readonly title: string;
  readonly dict: I18nRecord;
  /** Lets the header know whether search/loading UI should be enabled. */
  readonly onReadyChange?: (ready: boolean) => void;
}

/**
 * Renders an HTML artifact in a same-origin iframe (served through our own
 * API route so it's same-origin, not a cross-origin embed) and decorates it
 * with the injected per-card toolbar (share/download/ask-harness) and
 * find-in-page search — see iframe-inject-actions.ts for how both reach into
 * the iframe's own DOM.
 */
export const HtmlPreviewer = forwardRef<SearchableHandle, HtmlPreviewerProps>(
  function HtmlPreviewer({ title, dict, onReadyChange }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { attachReference } = useHarnessChatContext();
    // The embedded dashboard is ~6MB of mostly one giant inline <script> — an
    // unavoidably synchronous parse/execute that blocks the shared main
    // thread (same-origin iframe). Don't even start it until after this
    // page's own shell has painted, so that much is interactive first; show
    // a loading state for the beat after.
    const [mountIframe, setMountIframe] = useState(false);
    const [iframeReady, setIframeReady] = useState(false);
    const matchStateRef = useRef({ count: 0, current: -1 });

    useEffect(() => {
      setMountIframe(true);
    }, []);

    useEffect(() => {
      onReadyChange?.(iframeReady);
    }, [iframeReady, onReadyChange]);

    // Same-origin iframe (served through our own API route), so we can reach
    // into its document once it's loaded and decorate whatever it marks as
    // `injected` — the embedded HTML doesn't need to know this app exists.
    // Share/Download used to live in this per-card toolbar too — pulled for
    // now (see injectActionPills), just Ask Harness left.
    const handleIframeLoad = useCallback(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      injectActionPills(doc, {
        onAskHarness: (el) => {
          const label = describeInjectedElement(el);
          attachReference(label);
        },
      });
      syncInjectedTheme(doc, document.documentElement.classList.contains("dark"));
      setIframeReady(true);
    }, [attachReference]);

    // Theme is a class toggled on the parent <html> at any time (device
    // preference change, manual toggle) — mirror it into the iframe live
    // instead of only at load, so the toolbar doesn't go stale mid-visit.
    useEffect(() => {
      const target = document.documentElement;
      const observer = new MutationObserver(() => {
        const doc = iframeRef.current?.contentDocument;
        if (doc) syncInjectedTheme(doc, target.classList.contains("dark"));
      });
      observer.observe(target, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        search(query: string) {
          const doc = iframeRef.current?.contentDocument;
          if (!doc) return 0;
          const count = searchInIframe(doc, query);
          matchStateRef.current = { count, current: count > 0 ? 0 : -1 };
          if (count > 0) focusSearchMatch(doc, 0);
          return count;
        },
        stepMatch(delta: number) {
          const { count, current } = matchStateRef.current;
          if (count === 0) return -1;
          const doc = iframeRef.current?.contentDocument;
          if (!doc) return current;
          const next = (current + delta + count) % count;
          matchStateRef.current.current = next;
          focusSearchMatch(doc, next);
          return next;
        },
      }),
      []
    );

    return (
      <div className="relative min-h-0 flex-1">
        {!iframeReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-900">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("detail.loading", dict)}
            </p>
          </div>
        )}
        {mountIframe && (
          <iframe
            ref={iframeRef}
            onLoad={handleIframeLoad}
            src={HTML_PREVIEW_URL}
            // allow-scripts: the fixture's own inline <script> has to run.
            // allow-same-origin: contentDocument access above (theming,
            // injectActionPills, find-in-page) needs it. Together they don't
            // fully sandbox script content — the missing permissions
            // (top-navigation, popups, forms, modals, downloads, pointer
            // lock) are what's actually being withheld here.
            sandbox="allow-scripts allow-same-origin"
            title={title}
            className="h-full w-full border-0"
          />
        )}
      </div>
    );
  }
);
