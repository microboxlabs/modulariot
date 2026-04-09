"use client";

import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type KpiStatVariant = "horizontal" | "vertical";

/** Visual style options for the KPI card appearance */
export type KpiStatStyle =
  | "default"
  | "gradient-blue"
  | "gradient-green"
  | "gradient-purple"
  | "gradient-orange"
  | "minimal"
  | "bordered";

export interface TitleConfig {
  readonly text: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export interface ValueConfig {
  readonly text: string | number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export interface DescriptionConfig {
  readonly text: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export interface IconConfig {
  readonly icon?: IconType;
  readonly custom?: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
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
  /** Visual style: default, gradient-*, minimal, bordered */
  readonly style?: KpiStatStyle;
  /** Additional className for the container */
  readonly className?: string;
  /** Inline style for the container */
  readonly containerStyle?: React.CSSProperties;
  /** Custom content to render below the value */
  readonly children?: ReactNode;
}

/** Get container classes based on style and variant */
function getContainerClasses(
  style: KpiStatStyle,
  variant: KpiStatVariant
): string {
  // Both variants use flex row for the main container
  const base = "flex items-center gap-3 h-fit rounded-lg p-4 shrink-0";

  const styleClasses: Record<KpiStatStyle, string> = {
    default:
      "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
    "gradient-blue":
      "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0",
    "gradient-green":
      "bg-gradient-to-br from-green-500 to-green-600 text-white border-0",
    "gradient-purple":
      "bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0",
    "gradient-orange":
      "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0",
    minimal: "bg-transparent border-0 p-0",
    bordered: "bg-transparent border border-gray-200 dark:border-gray-700",
  };

  // Horizontal variant uses justify-between to push value to the right
  const variantClasses = variant === "horizontal" ? "justify-between" : "";

  return `${base} ${styleClasses[style]} ${variantClasses}`;
}

/** Get text classes based on style for proper contrast */
function getTextClasses(style: KpiStatStyle) {
  const isGradient = style.startsWith("gradient-");
  return {
    title: isGradient ? "text-white/80" : "text-gray-700 dark:text-gray-300",
    value: isGradient ? "text-white" : "text-gray-900 dark:text-gray-200",
    unit: isGradient ? "text-white/70" : "text-gray-600 dark:text-gray-400",
    description: isGradient
      ? "text-white/70"
      : "text-gray-600 dark:text-gray-300/60",
  };
}

/** Get icon classes based on style */
function getIconClasses(style: KpiStatStyle, customClassName?: string): string {
  if (customClassName) return customClassName;

  const isGradient = style.startsWith("gradient-");
  if (isGradient) {
    return "text-white bg-white/20";
  }
  return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
}

export default function KpiStat({
  title,
  value,
  unit,
  description,
  icon,
  variant = "horizontal",
  style = "default",
  className = "",
  containerStyle,
  children,
}: Readonly<KpiStatProps>) {
  const Icon = icon?.icon;
  const customIcon = icon?.custom;
  const iconClassName = getIconClasses(style, icon?.className);
  const textClasses = getTextClasses(style);

  const hasIcon = Icon !== undefined || customIcon !== undefined;
  const displayValue =
    typeof value.text === "number" ? value.text.toLocaleString() : value.text;

  // Render icon section
  const iconSection = hasIcon && (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-lg shrink-0",
        variant === "vertical" ? "w-12 h-12" : "w-10 h-10",
        iconClassName
      )}
      style={icon?.style}
    >
      {customIcon ?? (Icon && <Icon className="w-6 h-6" />)}
    </div>
  );

  // Render content section
  const contentSection = (
    <div
      className={`flex flex-col min-w-0 ${variant === "vertical" ? "flex-1" : ""}`}
    >
      {title && (
        <span
          className={twMerge(
            "text-sm truncate",
            textClasses.title,
            title.className
          )}
          style={title.style}
        >
          {title.text}
        </span>
      )}
      <span
        className={twMerge(
          "font-bold truncate",
          textClasses.value,
          value.className
        )}
        style={value.style}
      >
        {displayValue}
        {unit && (
          <span
            className={twMerge("ml-1 text-base font-normal", textClasses.unit)}
          >
            {unit}
          </span>
        )}
      </span>
      {description && (
        <span
          className={twMerge(
            "text-xs truncate",
            textClasses.description,
            description.className
          )}
          style={description.style}
        >
          {description.text}
        </span>
      )}
      {children}
    </div>
  );

  const containerClasses = getContainerClasses(style, variant);

  if (variant === "vertical") {
    // Vertical: icon | title+value+description stacked in one column
    return (
      <div
        className={twMerge(containerClasses, className)}
        style={containerStyle}
      >
        {iconSection}
        {contentSection}
      </div>
    );
  }

  // Horizontal: icon+title+description on left, value on right
  return (
    <div
      className={twMerge(containerClasses, className)}
      style={containerStyle}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {iconSection}
        <div className="flex flex-col min-w-0">
          {title && (
            <span
              className={twMerge(
                "text-sm truncate",
                textClasses.title,
                title.className
              )}
              style={title.style}
            >
              {title.text}
            </span>
          )}
          {description && (
            <span
              className={twMerge(
                "text-xs truncate",
                textClasses.description,
                description.className
              )}
              style={description.style}
            >
              {description.text}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span
          className={twMerge(
            "font-bold text-2xl",
            textClasses.value,
            value.className
          )}
          style={value.style}
        >
          {displayValue}
        </span>
        {unit && (
          <span className={twMerge("text-base font-normal", textClasses.unit)}>
            {unit}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
