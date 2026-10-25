import type { ReactNode } from "react";
import { CHANGED_CARD } from "./changed";

/** A numbered part of a rule sheet: badge, uppercase title, subtitle and controls on the right. */
export default function NumberedSection({
  number,
  title,
  subtitle,
  actions,
  changed = false,
  children,
}: Readonly<{
  number: number;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Something in the section differs from the published version. */
  changed?: boolean;
  children: ReactNode;
}>) {
  return (
    <section
      className={`rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${changed ? CHANGED_CARD : ""}`}
      data-changed={changed || undefined}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
        >
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <span className="ml-auto flex items-center gap-2">{actions}</span>
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">{children}</div>
    </section>
  );
}
