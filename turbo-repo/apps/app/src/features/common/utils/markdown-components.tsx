import React from "react";
import ReactMarkdown from "react-markdown";
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
    // Fenced blocks land inside <pre>, tagged language-xxx by remark — let
    // pre's background/border show through and just set the text color.
    // Inline code (no className, not inside a <pre>) gets its own pill.
    if (className?.startsWith("language-")) {
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
};

interface MarkdownContentProps {
  readonly children: string;
  readonly className?: string;
  /**
   * "compact" (default) is the original hand-mapped element styling above —
   * tuned for and used by chat bubbles (thread-messages.tsx), spotlight
   * search results, and KPI stat descriptions. "document" is Tailwind's
   * typography plugin (`prose`) with GFM (tables, strikethrough) instead —
   * full document styling for a page-length preview, which the compact
   * mapping was never meant to cover (no table support, minimal spacing).
   * Existing callers are unaffected either way — this only changes anything
   * for callers that opt into "document".
   */
  readonly variant?: "compact" | "document";
}

export function MarkdownContent({
  children,
  className,
  variant = "compact",
}: Readonly<MarkdownContentProps>) {
  if (variant === "document") {
    // twMerge, not plain concatenation — max-w-none here is only a default,
    // meant to be overridden by a max-w-* in the caller's className. Both
    // classes landing in the same attribute (via a template literal) means
    // the browser picks whichever Tailwind happened to emit later in the
    // stylesheet, not whichever the caller passed — twMerge resolves the
    // conflict in the caller's favor, like it should.
    return (
      <article className={twMerge("prose dark:prose-invert max-w-none", className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={DOCUMENT_COMPONENTS as never}>
          {children}
        </ReactMarkdown>
      </article>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]} components={MARKDOWN_COMPONENTS as never}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
