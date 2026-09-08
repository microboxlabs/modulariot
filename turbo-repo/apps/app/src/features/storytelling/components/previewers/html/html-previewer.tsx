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
  BRIDGE_SOURCE,
  PREVIEW_BRIDGE_SCRIPT,
  jsonForInlineScript,
  type BridgeToParent,
} from "../../../preview-bridge";
import type { SearchableHandle } from "../searchable";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const HTML_PREVIEW_URL = `${base_path}/api/storytelling/dashboard-preview`;
const HTML_PREVIEW_DATA_URL = `${base_path}/api/storytelling/dashboard-preview-data`;
export const HTML_DOWNLOAD_FILENAME = "dashboard.html";

// How long to wait for the sandboxed bridge to answer a search/step request
// before giving up — a dropped message shouldn't hang the search box forever.
const BRIDGE_CALL_TIMEOUT_MS = 3_000;

interface HtmlPreviewerProps {
  readonly title: string;
  readonly dict: I18nRecord;
  /** Lets the header know whether search/loading UI should be enabled. */
  readonly onReadyChange?: (ready: boolean) => void;
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * Splices the preloaded dataset and the bridge script into the artifact's
 * `<head>`, before its own body scripts run. The data goes in as a
 * `JSON.parse("…")` of the raw JSON text (not a JS object literal) — same
 * fast path dashboard-preview-data/route.ts documents, and the parse the
 * fixture would otherwise have done itself after a second fetch it can no
 * longer make from inside the sandbox.
 */
function buildSandboxedDoc(html: string, dataJson: string): string {
  const inject =
    `<script>window.__MIOT_DASHBOARD_DATA__=JSON.parse(${jsonForInlineScript(dataJson)});</script>` +
    `<script>${PREVIEW_BRIDGE_SCRIPT}</script>`;
  return html.includes("</head>")
    ? html.replace("</head>", `${inject}</head>`)
    : inject + html;
}

/**
 * Renders an HTML artifact in a **sandboxed** iframe — `allow-scripts` only,
 * no `allow-same-origin`, so the artifact gets an opaque origin with no reach
 * into our cookies, our API, or this page's DOM. The parent fetches the
 * markup + dataset (it's authenticated; the sandbox is not) and assembles a
 * self-contained document, bridge script injected, that it hands to the
 * iframe via `srcDoc` (not a blob URL — recent browsers block sandboxed,
 * opaque-origin frames from reading a blob owned by another origin).
 *
 * Everything that used to poke at `contentDocument` from here — the injected
 * per-card "Ask Harness" toolbar, dark-mode mirroring, find-in-page — now
 * runs inside the iframe (see preview-bridge.ts) and is driven over
 * `postMessage`.
 */
export const HtmlPreviewer = forwardRef<SearchableHandle, HtmlPreviewerProps>(
  function HtmlPreviewer({ title, dict, onReadyChange }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { attachReference } = useHarnessChatContext();
    const [srcDoc, setSrcDoc] = useState<string | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [iframeReady, setIframeReady] = useState(false);

    // requestId → resolver for in-flight search/step calls awaiting a
    // `result` message back from the bridge.
    const pendingRef = useRef(new Map<number, (value: number) => void>());
    const requestIdRef = useRef(0);

    useEffect(() => {
      onReadyChange?.(iframeReady);
    }, [iframeReady, onReadyChange]);

    // Fetch the artifact + its dataset (authenticated, same-origin — the
    // sandbox can do neither) and build the isolated document. Runs post-paint
    // so the page shell is interactive before the artifact's heavy inline
    // script starts parsing.
    useEffect(() => {
      let cancelled = false;

      (async () => {
        try {
          const [htmlRes, dataRes] = await Promise.all([
            fetch(HTML_PREVIEW_URL, { credentials: "same-origin" }),
            fetch(HTML_PREVIEW_DATA_URL, { credentials: "same-origin" }),
          ]);
          if (!htmlRes.ok || !dataRes.ok) throw new Error("preview fetch failed");
          const [html, data] = await Promise.all([htmlRes.text(), dataRes.text()]);
          if (cancelled) return;
          setSrcDoc(buildSandboxedDoc(html, data));
        } catch {
          if (!cancelled) setLoadFailed(true);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []);

    // Handshake once the document has loaded: tell the bridge our origin (so
    // it can target its replies) and the current theme. targetOrigin is "*"
    // because the sandboxed frame has an opaque origin that no specific value
    // would match; nothing sensitive travels parent→bridge.
    const handleIframeLoad = useCallback(() => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: "init",
          dark: isDark(),
          parentOrigin: window.location.origin,
        },
        "*",
      );
      // The bridge normally answers with `ready`; if the artifact's markup is
      // odd enough that it never runs, still drop the loading overlay so the
      // frame (and a degraded search box) aren't hidden forever.
      window.setTimeout(() => setIframeReady(true), 2_000);
    }, []);

    useEffect(() => {
      const pending = pendingRef.current;
      function onMessage(e: MessageEvent) {
        if (e.source !== iframeRef.current?.contentWindow) return;
        const data = e.data as BridgeToParent | undefined;
        if (!data || data.source !== BRIDGE_SOURCE) return;
        if (data.type === "ready") {
          setIframeReady(true);
        } else if (data.type === "askHarness") {
          attachReference(data.label);
        } else if (data.type === "result") {
          const resolve = pending.get(data.requestId);
          if (resolve) {
            pending.delete(data.requestId);
            resolve(data.value);
          }
        }
      }
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [attachReference]);

    // Theme is a class toggled on the parent <html> at any time (device
    // preference change, manual toggle) — forward it so the bridge keeps the
    // iframe in sync mid-visit, not just at load.
    useEffect(() => {
      const target = document.documentElement;
      const observer = new MutationObserver(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { source: BRIDGE_SOURCE, type: "syncTheme", dark: target.classList.contains("dark") },
          "*",
        );
      });
      observer.observe(target, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }, []);

    const callBridge = useCallback(
      (type: "search" | "step", payload: Record<string, unknown>, fallback: number) => {
        const contentWindow = iframeRef.current?.contentWindow;
        if (!contentWindow) return Promise.resolve(fallback);
        const requestId = ++requestIdRef.current;
        const pending = pendingRef.current;
        return new Promise<number>((resolve) => {
          pending.set(requestId, resolve);
          contentWindow.postMessage({ source: BRIDGE_SOURCE, type, requestId, ...payload }, "*");
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
        {!iframeReady && !loadFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-900">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("detail.loading", dict)}
            </p>
          </div>
        )}
        {loadFailed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-6 text-center dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("detail.loadError", dict)}
            </p>
          </div>
        )}
        {srcDoc && (
          <iframe
            ref={iframeRef}
            onLoad={handleIframeLoad}
            srcDoc={srcDoc}
            title={title}
            sandbox="allow-scripts"
            className="h-full w-full border-0"
          />
        )}
      </div>
    );
  },
);
