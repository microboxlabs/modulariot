"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  BRIDGE_SOURCE,
  PREVIEW_BRIDGE_SCRIPT,
  type BridgeToParent,
} from "../../../preview-bridge";
import type { SearchableHandle } from "../searchable";

// How long to wait for the sandboxed bridge to answer a search/step request
// before giving up — a dropped message shouldn't hang the search box forever.
const BRIDGE_CALL_TIMEOUT_MS = 3_000;

interface HtmlPreviewerProps {
  readonly html: string;
  readonly title: string;
  readonly dict: I18nRecord;
  /** Lets the header know whether search/loading UI should be enabled. */
  readonly onReadyChange?: (ready: boolean) => void;
  /** An "Ask Harness" click on one of the artifact's `.injected` elements. */
  readonly onAskHarness?: (label: string) => void;
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Splices the bridge script into the artifact's `<head>`, before its own
 * body scripts run, so the handshake listener is ready for `init`. */
export function buildSandboxedDoc(html: string): string {
  const inject = `<script>${PREVIEW_BRIDGE_SCRIPT}</script>`;
  return html.includes("</head>") ? html.replace("</head>", `${inject}</head>`) : inject + html;
}

/**
 * Renders an HTML artifact in a **sandboxed** iframe — `allow-scripts` only,
 * no `allow-same-origin`, so the artifact gets an opaque origin with no reach
 * into our cookies, our API, or this page's DOM. The markup, bridge script
 * injected, goes in through `srcDoc` (not a blob URL — recent browsers block
 * sandboxed, opaque-origin frames from reading a blob owned by another origin).
 *
 * The per-card "Ask Harness" toolbar, dark-mode mirroring and find-in-page run
 * inside the iframe (see preview-bridge.ts), driven over a private
 * `MessageChannel` the parent hands over during the load handshake.
 */
export const HtmlPreviewer = forwardRef<SearchableHandle, HtmlPreviewerProps>(
  function HtmlPreviewer({ html, title, dict, onReadyChange, onAskHarness }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const srcDoc = useMemo(() => buildSandboxedDoc(html), [html]);
    const [iframeReady, setIframeReady] = useState(false);
    const askRef = useRef(onAskHarness);
    askRef.current = onAskHarness;

    // Our end of the private MessageChannel to the sandboxed bridge — set on
    // the iframe's `load`. All parent↔bridge traffic after the handshake runs
    // over this, so it needs no target-origin and can't be redirected by a
    // frame navigation.
    const portRef = useRef<MessagePort | null>(null);
    // requestId → resolver for in-flight search/step calls awaiting a
    // `result` message back from the bridge.
    const pendingRef = useRef(new Map<number, (value: number) => void>());
    const requestIdRef = useRef(0);

    useEffect(() => {
      onReadyChange?.(iframeReady);
    }, [iframeReady, onReadyChange]);

    // Handshake once the document has loaded: hand the bridge one end of a
    // fresh MessageChannel, plus the current theme.
    const handleIframeLoad = useCallback(() => {
      const contentWindow = iframeRef.current?.contentWindow;
      if (!contentWindow || portRef.current) return;

      const channel = new MessageChannel();
      portRef.current = channel.port1;
      channel.port1.onmessage = (e: MessageEvent) => {
        const data = e.data as BridgeToParent | undefined;
        if (data?.source !== BRIDGE_SOURCE) return;
        if (data.type === "ready") {
          setIframeReady(true);
        } else if (data.type === "askHarness") {
          askRef.current?.(data.label);
        } else if (data.type === "result") {
          const resolve = pendingRef.current.get(data.requestId);
          if (resolve) {
            pendingRef.current.delete(data.requestId);
            resolve(data.value);
          }
        }
      };
      channel.port1.start();

      // The one unavoidable "*": the sandboxed frame's opaque origin matches
      // no specific target value. This message carries only a theme flag and
      // the transferred port; every later exchange rides the port, which a
      // navigation can't intercept, and the bridge only accepts a port from
      // its direct parent.
      contentWindow.postMessage( // NOSONAR: opaque sandbox origin leaves "*" as the only option here
        { source: BRIDGE_SOURCE, type: "init", dark: isDark() },
        "*",
        [channel.port2],
      );

      // The bridge normally answers with `ready`; if the artifact's markup is
      // odd enough that it never runs, still drop the loading overlay so the
      // frame (and a degraded search box) aren't hidden forever.
      window.setTimeout(() => setIframeReady(true), 2_000);
    }, []);

    // Tear the channel down with the component.
    useEffect(() => {
      const ports = pendingRef.current;
      return () => {
        portRef.current?.close();
        ports.clear();
      };
    }, []);

    // Theme is a class toggled on the parent <html> at any time (device
    // preference change, manual toggle) — forward it so the bridge keeps the
    // iframe in sync mid-visit, not just at load.
    useEffect(() => {
      const target = document.documentElement;
      const observer = new MutationObserver(() => {
        portRef.current?.postMessage({
          source: BRIDGE_SOURCE,
          type: "syncTheme",
          dark: target.classList.contains("dark"),
        });
      });
      observer.observe(target, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }, []);

    const callBridge = useCallback(
      (type: "search" | "step", payload: Record<string, unknown>, fallback: number) => {
        const port = portRef.current;
        if (!port) return Promise.resolve(fallback);
        const requestId = ++requestIdRef.current;
        const pending = pendingRef.current;
        return new Promise<number>((resolve) => {
          pending.set(requestId, resolve);
          port.postMessage({ source: BRIDGE_SOURCE, type, requestId, ...payload });
          setTimeout(() => {
            if (pending.delete(requestId)) resolve(fallback);
          }, BRIDGE_CALL_TIMEOUT_MS);
        });
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        search: (query: string) => callBridge("search", { query }, 0),
        stepMatch: (delta: number) => callBridge("step", { delta }, -1),
      }),
      [callBridge],
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
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          srcDoc={srcDoc}
          title={title}
          sandbox="allow-scripts"
          className="h-full w-full border-0"
        />
      </div>
    );
  },
);
