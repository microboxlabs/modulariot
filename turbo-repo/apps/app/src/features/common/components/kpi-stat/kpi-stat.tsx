"use client";

import type { IconType } from "react-icons";
import type { CSSProperties, ReactNode } from "react";
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
  readonly style?: CSSProperties;
}

export interface ValueConfig {
  readonly text: string | number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface DescriptionConfig {
  readonly text: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface IconConfig {
  readonly icon?: IconType;
  readonly custom?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
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
  /** Whether to scale text and icons based on container size */
  readonly scalable?: boolean;
}

/** Get container classes based on style and variant */
function getContainerClasses(
  style: KpiStatStyle,
  variant: KpiStatVariant
): string {
  // Both variants use flex row for the main container
  const base = "flex items-center gap-3 h-fit rounded-lg p-4 shrink-0 h-full";

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

  return twMerge(base, styleClasses[style], variantClasses);
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

/** Get scalable styles for different elements */
function getScalableStyles(scalable: boolean) {
  if (!scalable) {
    return {
      icon: undefined,
      iconInner: undefined,
      title: undefined,
      value: undefined,
      unit: undefined,
      description: undefined,
    };
  }
  return {
    icon: {
      width: "clamp(2rem, 30cqh, 8rem)",
      height: "clamp(2rem, 30cqh, 8rem)",
    },
    iconInner: {
      width: "clamp(1rem, 18cqh, 5rem)",
      height: "clamp(1rem, 18cqh, 5rem)",
    },
    title: { fontSize: "clamp(0.75rem, 15cqh, 2.5rem)" },
    value: { fontSize: "clamp(1.25rem, 40cqh, 6rem)" },
    unit: { fontSize: "clamp(0.75rem, 20cqh, 3rem)" },
    description: { fontSize: "clamp(0.625rem, 12cqh, 2rem)" },
  };
}

/** Icon section sub-component */
function IconSection({
  icon,
  iconClassName,
  scalable,
  variant,
  scalableStyles,
}: Readonly<{
  icon: IconConfig | undefined;
  iconClassName: string;
  scalable: boolean;
  variant: KpiStatVariant;
  scalableStyles: ReturnType<typeof getScalableStyles>;
}>) {
  const Icon = icon?.icon;
  const customIcon = icon?.custom;
  const hasIcon = Icon !== undefined || customIcon !== undefined;

  if (!hasIcon) return null;

  const getIconSizeClass = (): string => {
    if (scalable) return "";
    return variant === "vertical" ? "w-12 h-12" : "w-10 h-10";
  };
  const sizeClass = getIconSizeClass();

  return (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-lg shrink-0",
        sizeClass,
        iconClassName
      )}
      style={{ ...icon?.style, ...scalableStyles.icon }}
    >
      {customIcon ??
        (Icon && (
          <Icon
            className={scalable ? "" : "w-6 h-6"}
            style={scalableStyles.iconInner}
          />
        ))}
    </div>
  );
}

/** Title element */
function TitleElement({
  title,
  textClasses,
  scalable,
  scalableStyles,
}: Readonly<{
  title: TitleConfig | undefined;
  textClasses: ReturnType<typeof getTextClasses>;
  scalable: boolean;
  scalableStyles: ReturnType<typeof getScalableStyles>;
}>) {
  if (!title) return null;

  return (
    <span
      className={twMerge(
        scalable ? "" : "text-sm",
        "truncate",
        textClasses.title,
        title.className
      )}
      style={{ ...title.style, ...scalableStyles.title }}
    >
      {title.text}
    </span>
  );
}

/** Description element */
function DescriptionElement({
  description,
  textClasses,
  scalable,
  scalableStyles,
}: Readonly<{
  description: DescriptionConfig | undefined;
  textClasses: ReturnType<typeof getTextClasses>;
  scalable: boolean;
  scalableStyles: ReturnType<typeof getScalableStyles>;
}>) {
  if (!description) return null;

  return (
    <span
      className={twMerge(
        scalable ? "" : "text-xs",
        "truncate",
        textClasses.description,
        description.className
      )}
      style={{ ...description.style, ...scalableStyles.description }}
    >
      {description.text}
    </span>
  );
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
  scalable = false,
}: Readonly<KpiStatProps>) {
  const iconClassName = getIconClasses(style, icon?.className);
  const textClasses = getTextClasses(style);
  const scalableStyles = getScalableStyles(scalable);
  const containerClasses = getContainerClasses(style, variant);

  const displayValue =
    typeof value.text === "number" ? value.text.toLocaleString() : value.text;

  const iconSection = (
    <IconSection
      icon={icon}
      iconClassName={iconClassName}
      scalable={scalable}
      variant={variant}
      scalableStyles={scalableStyles}
    />
  );

  const unitElement = unit && (
    <span
      className={twMerge(
        scalable ? "" : "text-base",
        "ml-1 font-normal",
        textClasses.unit
      )}
      style={scalableStyles.unit}
    >
      {unit}
    </span>
  );

  if (variant === "vertical") {
    return (
      <div
        className={twMerge(containerClasses, className)}
        style={containerStyle}
      >
        {iconSection}
        <div className="flex flex-col min-w-0 flex-1">
          <TitleElement
            title={title}
            textClasses={textClasses}
            scalable={scalable}
            scalableStyles={scalableStyles}
          />
          <span
            className={twMerge(
              "font-bold truncate",
              textClasses.value,
              value.className
            )}
            style={{ ...value.style, ...scalableStyles.value }}
          >
            {displayValue}
            {unitElement}
          </span>
          <DescriptionElement
            description={description}
            textClasses={textClasses}
            scalable={scalable}
            scalableStyles={scalableStyles}
          />
          {children}
        </div>
      </div>
    );
  }

  // Horizontal layout
  return (
    <div
      className={twMerge(containerClasses, className)}
      style={containerStyle}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {iconSection}
        <div className="flex flex-col min-w-0">
          <TitleElement
            title={title}
            textClasses={textClasses}
            scalable={scalable}
            scalableStyles={scalableStyles}
          />
          <DescriptionElement
            description={description}
            textClasses={textClasses}
            scalable={scalable}
            scalableStyles={scalableStyles}
          />
        </div>
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span
          className={twMerge(
            "font-bold",
            scalable ? "" : "text-2xl",
            textClasses.value,
            value.className
          )}
          style={{ ...value.style, ...scalableStyles.value }}
        >
          {displayValue}
        </span>
        {unit && (
          <span
            className={twMerge(
              scalable ? "" : "text-base",
              "font-normal",
              textClasses.unit
            )}
            style={scalableStyles.unit}
          >
            {unit}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
