"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { focusSearchMatch, searchInDom } from "../../../dom-search";
import type { StorySection } from "../../../storytelling.types";
import type { SearchableHandle } from "../searchable";

interface SectionsPreviewerProps {
  readonly sections: readonly StorySection[];
  readonly onReadyChange?: (ready: boolean) => void;
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-3xl font-bold",
  2: "text-2xl font-semibold",
  3: "text-xl font-semibold",
};

function Heading({
  text,
  level,
}: {
  readonly text: string;
  readonly level: number;
}) {
  const className = `${HEADING_CLASS[level] ?? "text-lg font-semibold"} text-gray-900 dark:text-white`;
  if (level <= 1) return <h1 className={className}>{text}</h1>;
  if (level === 2) return <h2 className={className}>{text}</h2>;
  if (level === 3) return <h3 className={className}>{text}</h3>;
  return <h4 className={className}>{text}</h4>;
}

function Table({
  title,
  headers,
  rows,
}: {
  readonly title?: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
}) {
  return (
    <figure className="overflow-x-auto">
      {title && (
        <figcaption className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </figcaption>
      )}
      <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            {headers.map((header, i) => (
              <th key={`${header}-${i}`} className="px-3 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr
              key={r}
              className="border-b border-gray-100 dark:border-gray-700"
            >
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Section({ section }: { readonly section: StorySection }) {
  switch (section.type) {
    case "heading":
      return <Heading text={section.text} level={section.level ?? 2} />;
    case "text":
      return (
        <MarkdownContent variant="document">{section.text}</MarkdownContent>
      );
    case "metric":
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {section.label}
          </p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {section.value}
            {section.unit && (
              <span className="ml-1 text-base font-normal">{section.unit}</span>
            )}
          </p>
          {section.delta && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {section.delta}
            </p>
          )}
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-gray-300 pl-4 text-lg italic text-gray-700 dark:border-gray-600 dark:text-gray-300">
          <p>{section.text}</p>
          {section.author && (
            <footer className="mt-1 text-sm not-italic text-gray-500">
              — {section.author}
            </footer>
          )}
        </blockquote>
      );
    case "chart":
      return (
        <figure>
          {section.title && (
            <figcaption className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {section.title}
            </figcaption>
          )}
          {section.option && (
            <div className="h-80 w-full">
              <ReactECharts
                option={section.option}
                notMerge
                style={{ width: "100%", height: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            </div>
          )}
        </figure>
      );
    case "table":
      return (
        <Table
          title={section.title}
          headers={section.headers}
          rows={section.rows}
        />
      );
    default:
      return null;
  }
}

/** A story built from blocks: headings, Markdown text, metrics, quotes,
 * ECharts charts and tables, in the order the story lists them. */
export const SectionsPreviewer = forwardRef<
  SearchableHandle,
  SectionsPreviewerProps
>(function SectionsPreviewer({ sections, onReadyChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const matchStateRef = useRef({ count: 0, current: -1 });

  useEffect(() => {
    onReadyChange?.(true);
  }, [onReadyChange]);

  useImperativeHandle(
    ref,
    () => ({
      search(query: string) {
        const el = containerRef.current;
        if (!el) return 0;
        const count = searchInDom(el, query);
        matchStateRef.current = { count, current: count > 0 ? 0 : -1 };
        if (count > 0) focusSearchMatch(el, 0);
        return count;
      },
      stepMatch(delta: number) {
        const { count, current } = matchStateRef.current;
        const el = containerRef.current;
        if (count === 0 || !el) return count === 0 ? -1 : current;
        const next = (current + delta + count) % count;
        matchStateRef.current.current = next;
        focusSearchMatch(el, next);
        return next;
      },
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-gray-900"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        {sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}
      </div>
    </div>
  );
});
