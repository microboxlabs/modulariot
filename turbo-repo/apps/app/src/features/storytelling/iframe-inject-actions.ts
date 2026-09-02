import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BsStars } from "react-icons/bs";
import { MARK_CLASS, MARK_CURRENT_CLASS } from "./dom-search";

export { searchInDom as searchInIframe, clearSearchHighlights, focusSearchMatch } from "./dom-search";

const STYLE_ID = "miot-injected-style";
const TOOLBAR_CLASS = "miot-inject-toolbar";
const ASK_BTN_CLASS = "miot-inject-ask";
const TARGET_CLASS = "injected";

// react-icons renders straight to SVG markup, so it works even though this
// button lives in a foreign iframe document with no access to our React
// tree — same icon the rest of the app uses for the Harness assistant
// everywhere from the navbar toggle to spotlight search, just serialized
// once.
const ASK_HARNESS_ICON_SVG = renderToStaticMarkup(createElement(BsStars, { size: 12 }));

export interface InjectActionHandlers {
  /** Share/Download used to live in this toolbar too — pulled for now, not
   * gone for good; re-add here (and their buttons below) if they come back. */
  readonly onAskHarness: (element: HTMLElement) => void;
}

/**
 * The app's dark mode lives as a `dark` class on the PARENT document's
 * <html> (see ThemeDetector.tsx) — the iframe's own document has no idea
 * it exists. Mirror it onto the iframe's <html> so the `html.dark` rules
 * above can pick it up.
 */
export function syncInjectedTheme(doc: Document, isDark: boolean): void {
  doc.documentElement.classList.toggle("dark", isDark);
}

/**
 * Best-effort label for an `injected` element, so "Ask Harness" can say what
 * it's asking about. `.ttl`/`.chip` are this dashboard's own conventions for
 * a card's title/kind — not part of the `injected` contract — so this falls
 * back to trimmed text content, then a generic label, for markup that
 * doesn't follow them.
 */
export function describeInjectedElement(el: HTMLElement): string {
  const title = el.querySelector(".ttl")?.textContent?.trim();
  if (title) return title;
  const chip = el.querySelector(".chip")?.textContent?.trim();
  if (chip) return chip;
  const text = el.textContent?.trim();
  return text ? text.slice(0, 80) : "this component";
}

/**
 * Decorates every element carrying the `injected` class inside a same-origin
 * iframe document with a yellow hover ring and an Ask Harness toolbar that
 * fades in on hover. `injected` is the contract: any HTML dropped into the
 * storytelling iframe opts individual elements in by adding that class,
 * without the embedded document needing to know this app exists.
 */
export function injectActionPills(doc: Document, handlers: InjectActionHandlers): void {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${TARGET_CLASS} {
        position: relative;
        box-shadow: 0 0 0 2px transparent inset;
        transition: box-shadow 0.15s ease;
      }
      .${TARGET_CLASS}:hover {
        box-shadow: 0 0 0 2px #eab308 inset !important;
      }
      .${TOOLBAR_CLASS} {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        display: flex;
        gap: 2px;
        padding: 2px;
        border-radius: 6px;
        background: #fff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
      }
      .${TARGET_CLASS}:hover > .${TOOLBAR_CLASS} {
        opacity: 1;
        pointer-events: auto;
      }
      .${TOOLBAR_CLASS} button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        border: none;
        background: transparent;
        color: #374151;
        cursor: pointer;
        padding: 0;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .${TOOLBAR_CLASS} button:hover {
        background: #f3f4f6;
        color: #111827;
      }
      .${TOOLBAR_CLASS} button svg {
        display: block;
        width: 12px;
        height: 12px;
      }
      html.dark .${TOOLBAR_CLASS} {
        background: #1f2937;
        border-color: #374151;
      }
      html.dark .${TOOLBAR_CLASS} button {
        color: #d1d5db;
      }
      html.dark .${TOOLBAR_CLASS} button:hover {
        background: #374151;
        color: #f9fafb;
      }
      .${TOOLBAR_CLASS} button.${ASK_BTN_CLASS} {
        color: rgb(209, 137, 0);
      }
      .${TOOLBAR_CLASS} button.${ASK_BTN_CLASS}:hover {
        background: linear-gradient(to bottom right, rgb(241, 179, 0), rgb(209, 137, 0));
        color: #fff;
      }
      html.dark .${TOOLBAR_CLASS} button.${ASK_BTN_CLASS} {
        color: rgb(251, 191, 36);
      }
      html.dark .${TOOLBAR_CLASS} button.${ASK_BTN_CLASS}:hover {
        background: linear-gradient(to bottom right, rgb(241, 179, 0), rgb(209, 137, 0));
        color: #fff;
      }
      mark.${MARK_CLASS} {
        background: #fef08a;
        color: #111827;
        border-radius: 2px;
        padding: 0 1px;
      }
      mark.${MARK_CLASS}.${MARK_CURRENT_CLASS} {
        /* Kept in sync with globals.css's .miot-search-mark-current — see
         * its comment for why this is orange-700, not -500. */
        background: #c2410c;
        color: #fff;
      }
    `;
    doc.head.appendChild(style);
  }

  for (const el of doc.querySelectorAll<HTMLElement>(`.${TARGET_CLASS}`)) {
    if (el.querySelector(`:scope > .${TOOLBAR_CLASS}`)) continue;

    const toolbar = doc.createElement("div");
    toolbar.className = TOOLBAR_CLASS;

    const askBtn = doc.createElement("button");
    askBtn.type = "button";
    askBtn.className = ASK_BTN_CLASS;
    askBtn.title = "Ask Harness";
    askBtn.setAttribute("aria-label", "Ask Harness about this component");
    askBtn.innerHTML = ASK_HARNESS_ICON_SVG;
    askBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.onAskHarness(el);
    });

    toolbar.appendChild(askBtn);
    el.appendChild(toolbar);
  }
}

