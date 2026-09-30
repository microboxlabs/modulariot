"use client";
import type { CSSProperties, ReactNode } from "react";
export interface IconStatProps {
  readonly title?: string;
  readonly value: string;
  readonly unit?: string;
  /** Hosts may supply their sanitized Markdown renderer here. */
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly variant?: "horizontal" | "vertical";
  /** The parent must establish a size query container. */
  readonly scalable?: boolean;
  readonly className?: string;
  readonly containerStyle?: CSSProperties;
  readonly titleStyle?: CSSProperties;
  readonly valueStyle?: CSSProperties;
  readonly descriptionStyle?: CSSProperties;
  readonly iconStyle?: CSSProperties;
}
/** Resolved presentation shared by icon dashboards and external hosts. */
export function IconStat({
  title,
  value,
  unit,
  description,
  icon,
  variant = "horizontal",
  scalable = false,
  className = "",
  containerStyle,
  titleStyle,
  valueStyle,
  descriptionStyle,
  iconStyle,
}: IconStatProps) {
  return (
    <article
      className={`miot-icon-stat ${className}`}
      aria-label={title || undefined}
      data-variant={variant}
      data-scalable={scalable || undefined}
      style={containerStyle}
    >
      {icon && (
        <span
          className="miot-icon-stat__icon"
          aria-hidden="true"
          style={iconStyle}
        >
          {icon}
        </span>
      )}
      <div className="miot-icon-stat__content">
        {title && (
          <span className="miot-icon-stat__title" style={titleStyle}>
            {title}
          </span>
        )}
        <strong className="miot-icon-stat__value" style={valueStyle}>
          {value}
          {unit && <span className="miot-icon-stat__unit">{unit}</span>}
        </strong>
        {description && (
          <div className="miot-icon-stat__description" style={descriptionStyle}>
            {description}
          </div>
        )}
      </div>
    </article>
  );
}
