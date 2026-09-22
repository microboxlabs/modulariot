/** Imperative handle a previewer exposes to let the header's search bar
 * (story-detail-page.tsx) drive find-in-page — implemented by HtmlPreviewer,
 * MarkdownPreviewer, PptPreviewer, and PdfPreviewer (which searches the
 * transparent pdf.js text layer rendered over each page canvas). */
export interface SearchableHandle {
  /** Highlights every match, returns the count. Async for HtmlPreviewer,
   * whose sandboxed iframe answers over postMessage; the in-document
   * previewers (Markdown, PPT) return synchronously. */
  search(query: string): number | Promise<number>;
  /** Moves to the next/previous match (delta ±1), returns the new 0-based index. */
  stepMatch(delta: number): number | Promise<number>;
}
