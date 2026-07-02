import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

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

export function MarkdownContent({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]} components={MARKDOWN_COMPONENTS as never}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
