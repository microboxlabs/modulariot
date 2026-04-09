"use client";

import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface InfoCardWithSummaryProps {
  /** Icon to display in the top left */
  readonly icon: IconType;
  /** Icon container className */
  readonly iconClassName?: string;
  /** Title text */
  readonly title: string;
  /** Subtitle text */
  readonly subtitle?: string;
  /** Custom React component to render in the main content area */
  readonly children: ReactNode;
  /** Summary/explanation content shown at the bottom */
  readonly summary?: ReactNode;
  /** Additional className for the container */
  readonly className?: string;
}

export default function InfoCardWithSummary({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  children,
  summary,
  className,
}: InfoCardWithSummaryProps) {
  const defaultIconClassName =
    "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";

  return (
    <div
      className={twMerge(
        "flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4",
        className
      )}
    >
      {/* Header: Icon + Title/Subtitle */}
      <div className="flex items-start gap-3">
        <div
          className={twMerge(
            "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
            iconClassName ?? defaultIconClassName
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Custom content */}
      <div className="mt-4 flex flex-col grow">{children}</div>

      {/* Separator */}
      {summary && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

          {/* Resumen */}
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {summary}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
