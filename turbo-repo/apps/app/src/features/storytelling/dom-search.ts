export const MARK_CLASS = "miot-search-mark";
export const MARK_CURRENT_CLASS = "miot-search-mark-current";

function scopeAndDoc(root: Document | Element): { scope: Element; doc: Document } {
  if (root instanceof Document) return { scope: root.body, doc: root };
  const doc = root.ownerDocument;
  return { scope: root, doc };
}

/** Undoes searchInDom — restores the original text nodes so a fresh search
 * always starts from clean markup instead of nesting <mark>s. Works on
 * either a whole foreign document (the HTML previewer's iframe) or a
 * specific container in our own document (Markdown/PPT previewers), since
 * `root` can be either. */
export function clearSearchHighlights(root: Document | Element): void {
  const { scope, doc } = scopeAndDoc(root);
  for (const mark of scope.querySelectorAll(`mark.${MARK_CLASS}`)) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(doc.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

/**
 * Wraps every case-insensitive occurrence of `query` inside `root`'s text in
 * a highlighted <mark> — same idea as a browser's native find-in-page but
 * under our own control (styleable, and we can report the count and jump
 * between matches from the search bar in the parent page). Returns the
 * number of matches found. `root` is either a whole foreign document (same-
 * origin iframe) or a container element in our own document.
 */
export function searchInDom(root: Document | Element, query: string): number {
  clearSearchHighlights(root);
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;

  const { scope, doc } = scopeAndDoc(root);
  const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") return NodeFilter.FILTER_REJECT;
      const text = node.textContent;
      if (!text?.toLowerCase().includes(needle)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n as Text);

  let matchCount = 0;
  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const lowerText = text.toLowerCase();
    const frag = doc.createDocumentFragment();
    let cursor = 0;
    let idx = lowerText.indexOf(needle);
    while (idx !== -1) {
      if (idx > cursor) frag.appendChild(doc.createTextNode(text.slice(cursor, idx)));
      const mark = doc.createElement("mark");
      mark.className = MARK_CLASS;
      mark.textContent = text.slice(idx, idx + needle.length);
      frag.appendChild(mark);
      matchCount++;
      cursor = idx + needle.length;
      idx = lowerText.indexOf(needle, cursor);
    }
    if (cursor < text.length) frag.appendChild(doc.createTextNode(text.slice(cursor)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
  return matchCount;
}

/**
 * Marks the match at `index` as current (distinct highlight) and, unless
 * told not to, scrolls it into view — the search bar's next/prev
 * navigation. Skip the scroll (`scroll: false`) for content that's scaled
 * to fit rather than naturally scrollable — e.g. PptPreviewer's slide
 * canvas is a fixed-size layout CSS-transformed to fit its frame, so
 * scrollIntoView would act on the pre-scale geometry and shift the frame
 * for no reason (the whole slide is always fully shown already).
 */
export function focusSearchMatch(
  root: Document | Element,
  index: number,
  options: { scroll?: boolean } = {}
): void {
  const { scroll = true } = options;
  const { scope } = scopeAndDoc(root);
  const marks = scope.querySelectorAll<HTMLElement>(`mark.${MARK_CLASS}`);
  for (const mark of marks) mark.classList.remove(MARK_CURRENT_CLASS);
  const target = marks[index];
  if (!target) return;
  target.classList.add(MARK_CURRENT_CLASS);
  if (scroll) target.scrollIntoView({ block: "center", behavior: "smooth" });
}
