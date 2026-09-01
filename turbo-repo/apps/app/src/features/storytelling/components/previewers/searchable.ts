/** Imperative handle a previewer exposes to let the header's search bar
 * (story-detail-page.tsx) drive find-in-page — implemented by HtmlPreviewer,
 * MarkdownPreviewer, and PptPreviewer. Not implemented by PdfPreviewer: it's
 * a native browser <iframe src="file.pdf">, and browsers don't expose any
 * way to script their built-in PDF viewer's search from outside — that
 * would need swapping the renderer for a JS-based one (pdfjs-dist). */
export interface SearchableHandle {
  /** Highlights every match, returns the count. */
  search(query: string): number;
  /** Moves to the next/previous match (delta ±1), returns the new 0-based index. */
  stepMatch(delta: number): number;
}
