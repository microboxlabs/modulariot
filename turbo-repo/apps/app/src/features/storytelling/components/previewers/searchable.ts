/** Imperative handle a previewer exposes to let the header's search bar
 * (story-detail-page.tsx) drive find-in-page — implemented by HtmlPreviewer,
 * MarkdownPreviewer, and PptPreviewer. PdfPreviewer renders with pdf.js
 * (pdfjs-dist) but only paints page canvases — there's no selectable text
 * layer yet, so it can't be searched; add one (pdf.js `TextLayer`) and this
 * handle to wire it in. */
export interface SearchableHandle {
  /** Highlights every match, returns the count. */
  search(query: string): number;
  /** Moves to the next/previous match (delta ±1), returns the new 0-based index. */
  stepMatch(delta: number): number;
}
