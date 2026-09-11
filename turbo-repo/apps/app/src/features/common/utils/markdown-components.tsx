import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { twMerge } from "tailwind-merge";

const MARKDOWN_COMPONENTS = {
  p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-1.5 last:mb-0 block dark:text-gray-200">{children}</p>
  ),
  strong: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold dark:text-gray-50">{children}</strong>
  ),
  em: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic">{children}</em>
  ),
  ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-6 flex flex-col gap-1 mb-2 last:mb-0 text-sm">{children}</ul>
  ),
  ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-6 flex flex-col gap-1 mb-2 last:mb-0 text-sm">{children}</ol>
  ),
  li: ({ children }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-snug ">{children}</li>
  ),
  h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-md font-bold mb-1 leading-tight">{children}</h1>
  ),
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-sm font-semibold mb-1 leading-tight">{children}</h2>
  ),  
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-xs font-bold">{children}</h3>
  ),
  hr: () => (
    <hr className="border-0 h-px bg-black/10 dark:bg-white/10 mb-3 mt-2" />
  ),
  code: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <code className="rounded bg-black/10 px-0.5 font-mono dark:bg-white/10">{children}</code>
  ),
  a: ({ children, href }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className="underline opacity-80 hover:opacity-100" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  // GFM tables, styled to the same tight/small scale as everything else in
  // this map (not Tailwind Typography's prose scale — see the "document"
  // variant below for that — which sizes for a standalone page, not a chat
  // bubble or a dropdown row: ~2x the text size and multiple line-heights
  // of margin around every block). The card chrome (border/rounded/bg) is
  // the same gray-50/gray-800 + border pairing the code-block `pre` below
  // uses, so a table reads as the same kind of "embedded block" as code.
  // overflow-x-auto is scoped to the card itself so a too-wide table scrolls
  // on its own instead of dragging its host (spotlight's results list, the
  // chat thread) into a sideways scroll.
  // whitespace-nowrap on every cell: a wrapped cell grows the table's row
  // height instead of its width, which defeats the point of scoping the
  // scroll to overflow-x-auto above — cells stay one line and the table
  // grows sideways (scrollable) instead of vertically. overscroll-x-none:
  // without it, panning this card to its horizontal edge lets the browser's
  // own elastic bounce/rubber-band kick in on the card itself (macOS
  // trackpads especially) — jarring for a table-sized scroller nested
  // inside a much bigger vertically-scrolling one.
  table: ({ children }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="mb-1.5 last:mb-0 overflow-x-auto overscroll-x-none rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full border-collapse whitespace-nowrap text-left text-xs">
        {children}
      </table>
    </div>
  ),
  // Same "highlighted table header" treatment used elsewhere in the app
  // (schema-panel.tsx) — a solid wash, not just the border below, so the
  // header row reads as a distinct band rather than blending into the
  // first data row. One step past the column divider's own shade in both
  // themes (gray-200/gray-600 vs. the divider's gray-100/gray-700) so that
  // divider still shows up as a contrasting line across the header too,
  // instead of vanishing into a background painted the same color.
  thead: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="border-b border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-600">
      {children}
    </thead>
  ),
  // dark:divide-gray-700, not -800: the card behind this table is
  // dark:bg-gray-800 (see `table` above) — a divider in that same shade is
  // invisible against its own background. gray-700 is the step up from it
  // (matching the card's own dark:border-gray-700), same as Typography's
  // prose-invert theme uses for its table borders (--tw-prose-invert-td-
  // borders: gray-700 over a gray-900 body) for the same reason.
  tbody: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{children}</tbody>
  ),
  // divide-x on every row (header row included, since GFM maps both to the
  // same `tr`) draws a faint rule between columns — the same stepped token
  // tbody uses between rows, so it reads as a grid line, not a strong border.
  tr: ({ children }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="divide-x divide-gray-100 dark:divide-gray-700">{children}</tr>
  ),
  th: ({ children }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-gray-700 dark:text-gray-200">
      {children}
    </th>
  ),
  td: ({ children }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="whitespace-nowrap px-2 py-1.5 align-top text-gray-600 dark:text-gray-300">
      {children}
    </td>
  ),
  del: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <del className="opacity-70">{children}</del>
  ),
};

// Prose's default `pre`/`code` colors are fixed (a dark gray background
// regardless of light/dark mode — code blocks conventionally stay dark even
// on a light page) — swapped for the app's own light/dark surface tokens
// (the same gray-50/gray-800 + border pairing used throughout the app) so
// code blocks actually follow the system theme instead of always looking
// like a dark terminal.
const DOCUMENT_COMPONENTS = {
  pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      {children}
    </pre>
  ),
  code: ({ className, children }: React.HTMLAttributes<HTMLElement>) => {
    // Fenced blocks land inside <pre>, tagged language-xxx by remark and
    // then `hljs …` by rehype-highlight — let pre's background/border show
    // through and set only the base text color (the .hljs-* token spans
    // rehype-highlight injects colour themselves, see globals.css).
    // Inline code (no className, not inside a <pre>) gets its own pill.
    if (className?.includes("language-")) {
      return (
        <code className={twMerge(className, "text-gray-800 dark:text-gray-200")}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        {children}
      </code>
    );
  },
  // GFM tables render at their natural width, which can easily exceed a
  // narrow host (a spotlight dropdown, a chat bubble column). Scoping the
  // scrollbar to the table itself — rather than leaving the host container
  // to pick up an implicit overflow-x from its own overflow-y-auto — means
  // only the table pans, not the whole results list/thread around it. Same
  // card chrome as `pre` above, so a table reads as the same kind of
  // "embedded block" as a code fence within the document. whitespace-nowrap
  // on every cell keeps a wide cell growing the table sideways (scrollable)
  // instead of wrapping and growing it vertically instead. overscroll-x-none
  // stops the browser's own elastic bounce/rubber-band from firing on this
  // card when panning hits its horizontal edge (macOS trackpads especially).
  table: ({ children }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto overscroll-x-none rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <table className="whitespace-nowrap">{children}</table>
    </div>
  ),
  // Same highlighted-header treatment as the compact variant's `thead`
  // below — prose doesn't give thead a background of its own, so this adds
  // one rather than fighting prose's specificity to change one.
  thead: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-gray-200 dark:bg-gray-600">{children}</thead>
  ),
  // divide-x draws a faint rule between columns (header row included, since
  // GFM maps both header and body rows to the same `tr`) — a border, not a
  // padding/margin, so it layers over prose's own cell spacing without
  // fighting its specificity the way a plain padding override would.
  // dark:divide-gray-700, not -800: this table's card is dark:bg-gray-800
  // (see `table` above) — a divider in that same shade doesn't show up
  // against its own background. gray-700 is the step up from it, same as
  // Typography's own prose-invert row borders use for the same reason. It
  // also stays visibly distinct from the header's own gray-200/gray-600
  // wash above, so the column line doesn't vanish inside the header band.
  tr: ({ children }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="divide-x divide-gray-100 dark:divide-gray-700">{children}</tr>
  ),
  th: ({ children }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="whitespace-nowrap">{children}</th>
  ),
  td: ({ children }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="whitespace-nowrap">{children}</td>
  ),
};

interface MarkdownContentProps {
  readonly children: string;
  readonly className?: string;
  /**
   * "compact" (default) is the hand-mapped element styling above, GFM
   * included (tables, strikethrough) — tuned for and used by chat bubbles
   * (thread-messages.tsx), spotlight search results, and KPI stat
   * descriptions: small text, tight margins, sized to sit inside a bubble
   * or a dropdown row. "document" is Tailwind's typography plugin (`prose`)
   * instead — full document styling (bigger type scale, ~1 line of margin
   * around every block) for a page-length preview, used by the storytelling
   * markdown artifact. Deliberately NOT what the compact callers use: prose
   * is sized for a standalone page, not a few lines of chat.
   */
  readonly variant?: "compact" | "document";
  /**
   * Extra element renderers merged over the variant's built-in map (they
   * win on collision). Only consulted for "document" — the place a
   * page-length preview may need to special-case a block, e.g. turning a
   * ```mermaid fence into a rendered diagram (markdown-previewer.tsx).
   */
  readonly components?: Components;
}

export function MarkdownContent({
  children,
  className,
  variant = "compact",
  components,
}: Readonly<MarkdownContentProps>) {
  if (variant === "document") {
    // twMerge, not plain concatenation — max-w-none here is only a default,
    // meant to be overridden by a max-w-* in the caller's className. Both
    // classes landing in the same attribute (via a template literal) means
    // the browser picks whichever Tailwind happened to emit later in the
    // stylesheet, not whichever the caller passed — twMerge resolves the
    // conflict in the caller's favor, like it should.
    return (
      // prose-th:/prose-td: (Typography's own override variants, not plain
      // padding utilities — those lose to prose's descendant selectors) give
      // table rows a bit more breathing room than the plugin's default.
      <article
        className={twMerge(
          "prose dark:prose-invert max-w-none prose-th:py-2 prose-td:py-2",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={{ ...DOCUMENT_COMPONENTS, ...components } as never}
        >
          {children}
        </ReactMarkdown>
      </article>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MARKDOWN_COMPONENTS as never}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
