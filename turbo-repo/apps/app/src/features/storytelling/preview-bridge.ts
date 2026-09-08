/**
 * Bridge between the storytelling HTML previewer and the artifact it embeds.
 *
 * The artifact runs in a `sandbox="allow-scripts"` iframe with NO
 * `allow-same-origin` (see html-previewer.tsx) — an opaque origin that can't
 * touch our cookies, our API, or the parent DOM. That isolation is the whole
 * point: whatever HTML we serve (a fixture today, AI/user artifacts later) is
 * never running with app-origin privilege.
 *
 * Because the parent can no longer reach into `contentDocument`, everything
 * that used to be done from the outside — decorating `.injected` elements
 * with an "Ask Harness" toolbar, mirroring dark mode, find-in-page — now runs
 * *inside* the iframe via this script, which the parent injects into the
 * artifact markup. Parent and bridge talk only over `postMessage`.
 *
 * This is deliberately a self-contained string (no imports): it executes in a
 * foreign document that has no module loader and no access to our bundle. The
 * search logic mirrors dom-search.ts — kept separate on purpose, since that
 * module still runs in-document for the Markdown/PPT previewers.
 */

/** Wire protocol. Every frame carries `source: "miot-preview-bridge"` so it's
 * distinguishable from unrelated traffic on the shared handshake channel. */
export const BRIDGE_SOURCE = "miot-preview-bridge";

/**
 * Parent → bridge. Only `init` travels as a window `postMessage` (carrying
 * one end of a private `MessageChannel`); everything after that goes over
 * that port, so a frame navigation can't redirect it.
 */
export type ParentToBridge =
  | { source: typeof BRIDGE_SOURCE; type: "init"; dark: boolean }
  | { source: typeof BRIDGE_SOURCE; type: "syncTheme"; dark: boolean }
  | { source: typeof BRIDGE_SOURCE; type: "search"; requestId: number; query: string }
  | { source: typeof BRIDGE_SOURCE; type: "step"; requestId: number; delta: number };

/** Bridge → parent, all over the `MessageChannel` port. */
export type BridgeToParent =
  | { source: typeof BRIDGE_SOURCE; type: "ready" }
  | { source: typeof BRIDGE_SOURCE; type: "askHarness"; label: string }
  | { source: typeof BRIDGE_SOURCE; type: "result"; requestId: number; value: number };

/**
 * The script, as a string, to inject into the artifact's `<head>` (before its
 * own body scripts run so the handshake listener is ready when the parent
 * sends `init`). `BRIDGE_SOURCE` is inlined so the IIFE stays dependency-free.
 */
export const PREVIEW_BRIDGE_SCRIPT = `
(function () {
  "use strict";
  var SOURCE = ${JSON.stringify(BRIDGE_SOURCE)};
  var STYLE_ID = "miot-injected-style";
  var TARGET_CLASS = "injected";
  var TOOLBAR_CLASS = "miot-inject-toolbar";
  var ASK_BTN_CLASS = "miot-inject-ask";
  var MARK_CLASS = "miot-search-mark";
  var MARK_CURRENT_CLASS = "miot-search-mark-current";
  var ASK_ICON =
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">' +
    '<path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"></path></svg>';

  var port = null;
  var matchState = { count: 0, current: -1 };

  function post(msg) {
    if (port === null) return;
    msg.source = SOURCE;
    port.postMessage(msg);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "." + TARGET_CLASS + "{position:relative;box-shadow:0 0 0 2px transparent inset;transition:box-shadow .15s ease}" +
      "." + TARGET_CLASS + ":hover{box-shadow:0 0 0 2px #eab308 inset!important}" +
      "." + TOOLBAR_CLASS + "{position:absolute;top:8px;right:8px;z-index:10;display:flex;gap:2px;padding:2px;border-radius:6px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 2px 6px rgba(0,0,0,.12);opacity:0;pointer-events:none;transition:opacity .15s ease}" +
      "." + TARGET_CLASS + ":hover>." + TOOLBAR_CLASS + ",." + TARGET_CLASS + ":focus-within>." + TOOLBAR_CLASS + "{opacity:1;pointer-events:auto}" +
      "." + TOOLBAR_CLASS + " button{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;border:none;background:transparent;color:rgb(209,137,0);cursor:pointer;padding:0;transition:background-color .15s ease,color .15s ease}" +
      "." + TOOLBAR_CLASS + " button:hover{background:linear-gradient(to bottom right,rgb(241,179,0),rgb(209,137,0));color:#fff}" +
      "." + TOOLBAR_CLASS + " button svg{display:block}" +
      "html.dark ." + TOOLBAR_CLASS + "{background:#1f2937;border-color:#374151}" +
      "html.dark ." + TOOLBAR_CLASS + " button{color:rgb(251,191,36)}" +
      "mark." + MARK_CLASS + "{background:#fef08a;color:#111827;border-radius:2px;padding:0 1px}" +
      "mark." + MARK_CLASS + "." + MARK_CURRENT_CLASS + "{background:#c2410c;color:#fff}";
    (document.head || document.documentElement).appendChild(style);
  }

  function describe(el) {
    var t = el.querySelector(".ttl");
    if (t && t.textContent && t.textContent.trim()) return t.textContent.trim();
    var c = el.querySelector(".chip");
    if (c && c.textContent && c.textContent.trim()) return c.textContent.trim();
    var text = (el.textContent || "").trim();
    return text ? text.slice(0, 80) : "this component";
  }

  function injectPills() {
    injectStyles();
    var els = document.querySelectorAll("." + TARGET_CLASS);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.querySelector(":scope > ." + TOOLBAR_CLASS)) continue;
      var toolbar = document.createElement("div");
      toolbar.className = TOOLBAR_CLASS;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = ASK_BTN_CLASS;
      btn.title = "Ask Harness";
      btn.setAttribute("aria-label", "Ask Harness about this component");
      btn.innerHTML = ASK_ICON;
      (function (target) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          post({ type: "askHarness", label: describe(target) });
        });
      })(el);
      toolbar.appendChild(btn);
      el.appendChild(toolbar);
    }
  }

  function syncTheme(dark) {
    document.documentElement.classList.toggle("dark", !!dark);
  }

  function clearHighlights() {
    var marks = document.body.querySelectorAll("mark." + MARK_CLASS);
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      var parentNode = m.parentNode;
      if (!parentNode) continue;
      parentNode.replaceChild(document.createTextNode(m.textContent || ""), m);
      parentNode.normalize();
    }
  }

  function search(query) {
    clearHighlights();
    var needle = (query || "").trim().toLowerCase();
    if (!needle) { matchState = { count: 0, current: -1 }; return 0; }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var tag = node.parentElement && node.parentElement.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") return NodeFilter.FILTER_REJECT;
        var text = node.textContent;
        if (!text || text.toLowerCase().indexOf(needle) === -1) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [];
    for (var n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    var count = 0;
    for (var i = 0; i < nodes.length; i++) {
      var textNode = nodes[i];
      var text = textNode.textContent || "";
      var lower = text.toLowerCase();
      var frag = document.createDocumentFragment();
      var cursor = 0;
      var idx = lower.indexOf(needle);
      while (idx !== -1) {
        if (idx > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, idx)));
        var mark = document.createElement("mark");
        mark.className = MARK_CLASS;
        mark.textContent = text.slice(idx, idx + needle.length);
        frag.appendChild(mark);
        count++;
        cursor = idx + needle.length;
        idx = lower.indexOf(needle, cursor);
      }
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    }
    matchState = { count: count, current: count > 0 ? 0 : -1 };
    if (count > 0) focusMatch(0);
    return count;
  }

  function focusMatch(index) {
    var marks = document.body.querySelectorAll("mark." + MARK_CLASS);
    for (var i = 0; i < marks.length; i++) marks[i].classList.remove(MARK_CURRENT_CLASS);
    var target = marks[index];
    if (!target) return;
    target.classList.add(MARK_CURRENT_CLASS);
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function step(delta) {
    if (matchState.count === 0) return -1;
    var next = (matchState.current + delta + matchState.count) % matchState.count;
    matchState.current = next;
    focusMatch(next);
    return next;
  }

  function onReady() {
    injectPills();
    // Late-rendered .injected elements (the embedded dashboard builds its
    // cards from data that arrives after first paint) — re-run once the DOM
    // settles so their toolbars still get added.
    var observer = new MutationObserver(function () { injectPills(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function onPortMessage(e) {
    var d = e.data;
    if (!d || d.source !== SOURCE) return;
    if (d.type === "syncTheme") syncTheme(d.dark);
    else if (d.type === "search") post({ type: "result", requestId: d.requestId, value: search(d.query) });
    else if (d.type === "step") post({ type: "result", requestId: d.requestId, value: step(d.delta) });
  }

  // The parent hands us one end of a private MessageChannel in its first (and
  // only) window-level message — verified to be from our direct parent frame.
  // Everything after that is point-to-point over the port, which no frame
  // navigation can redirect.
  window.addEventListener("message", function (e) {
    if (e.source !== parent || port !== null) return;
    var d = e.data;
    if (!d || d.source !== SOURCE || d.type !== "init" || !e.ports || !e.ports[0]) return;
    port = e.ports[0];
    port.onmessage = onPortMessage;
    port.start();
    syncTheme(d.dark);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady);
    } else {
      onReady();
    }
    post({ type: "ready" });
  });
})();
`;

/**
 * Escapes a raw JSON string for safe embedding inside an inline `<script>` as
 * `JSON.parse(<result>)`. `JSON.stringify` on a string yields a valid JS
 * string literal; the extra replacements neutralise `</script>`, HTML comment
 * openers, and the two line terminators JS (pre-ES2019) rejects inside string
 * literals — all as `\uXXXX` escapes that leave the parsed value untouched.
 */
export function jsonForInlineScript(jsonText: string): string {
  return JSON.stringify(jsonText).replace(/[<>&\u2028\u2029]/g, (ch) => {
    const hex = (ch.codePointAt(0) ?? 0).toString(16).padStart(4, "0");
    return String.raw`\u${hex}`;
  });
}
