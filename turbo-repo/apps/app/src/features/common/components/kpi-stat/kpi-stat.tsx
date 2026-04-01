"use client";

import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type KpiStatVariant = "horizontal" | "vertical";

export interface TitleConfig {
  readonly text: string;
  readonly className?: string;
}

export interface ValueConfig {
  readonly text: string | number;
  readonly className?: string;
}

export interface DescriptionConfig {
  readonly text: string;
  readonly className?: string;
}

export interface IconConfig {
  readonly icon?: IconType;
  readonly custom?: ReactNode;
  readonly className?: string;
}

interface KpiStatProps {
  /** Title/label displayed at the top */
  readonly title?: TitleConfig;
  /** Main value displayed prominently */
  readonly value: ValueConfig;
  /** Unit to display after the value */
  readonly unit?: string;
  /** Description/subtitle displayed at the bottom */
  readonly description?: DescriptionConfig;
  /** Icon configuration */
  readonly icon?: IconConfig;
  /** Layout variant: horizontal (icon left) or vertical (stacked) */
  readonly variant?: KpiStatVariant;
  /** Additional className for the container */
  readonly className?: string;
  /** Custom content to render below the value */
  readonly children?: ReactNode;
}

export default function KpiStat({
  title,
  value,
  unit,
  description,
  icon,
  variant = "horizontal",
  className = "",
  children,
}: Readonly<KpiStatProps>) {
  const Icon = icon?.icon;
  const customIcon = icon?.custom;
  const iconClassName =
    icon?.className ??
    "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";

  const hasIcon = Icon !== undefined || customIcon !== undefined;
  const displayValue =
    typeof value.text === "number" ? value.text.toLocaleString() : value.text;

  // Render icon section
  const iconSection = hasIcon && (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-lg shrink-0",
        variant === "horizontal" ? "w-12 h-12" : "w-10 h-10",
        iconClassName
      )}
    >
      {customIcon ?? (Icon && <Icon className="w-6 h-6" />)}
    </div>
  );

  // Render content section
  const contentSection = (
    <div
      className={`flex flex-col min-w-0 ${variant === "horizontal" ? "flex-1" : ""}`}
    >
      {title && (
        <span
          className={twMerge(
            "text-sm text-gray-500 dark:text-gray-300 truncate",
            title.className
          )}
        >
          {title.text}
        </span>
      )}
      <span
        className={twMerge(
          `font-bold text-gray-900 dark:text-gray-200 truncate`,
          value.className
        )}
      >
        {displayValue}
        {unit && (
          <span className="ml-1 text-base font-normal text-gray-500 dark:text-gray-400">
            {unit}
          </span>
        )}
      </span>
      {description && (
        <span
          className={twMerge(
            "text-xs text-gray-500 dark:text-gray-300/60 truncate",
            description.className
          )}
        >
          {description.text}
        </span>
      )}
      {children}
    </div>
  );

  if (variant === "horizontal") {
    return (
      <div
        className={twMerge(
          "flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4",
          className
        )}
      >
        {iconSection}
        {contentSection}
      </div>
    );
  }

  // Vertical variant (StatBox style)
  return (
    <div
      className={twMerge(
        "flex flex-col justify-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3 min-w-0",
        className
      )}
    >
      {iconSection && <div className="mb-2">{iconSection}</div>}
      {contentSection}
    </div>
  );
}
