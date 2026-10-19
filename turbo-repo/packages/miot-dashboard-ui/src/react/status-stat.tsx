"use client";
import type { ReactNode } from "react";
export interface StatusStatProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle?: string;
  readonly icon?: ReactNode;
  /** Six-digit RGB hex without #. Invalid values use theme defaults. */
  readonly borderColor?: string;
  readonly iconColor?: string;
  readonly valueColor?: string;
}
function color(value: string | undefined) {
  return value && /^[\da-f]{6}$/i.test(value) ? `#${value}` : undefined;
}
/** Presentation only; hosts resolve values, color rules and decorative icons. */
export function StatusStat({
  title,
  value,
  subtitle,
  icon,
  borderColor,
  iconColor,
  valueColor,
}: StatusStatProps) {
  const border = color(borderColor),
    foreground = color(iconColor),
    text = color(valueColor);
  return (
    <article
      className="miot-status-stat"
      aria-label={title || undefined}
      style={{ borderLeftColor: border }}
    >
      <header>
        <p>{title}</p>
        {icon && (
          <span
            className="miot-status-stat__icon"
            aria-hidden="true"
            style={{
              color: foreground,
              backgroundColor: foreground ? `${foreground}20` : undefined,
            }}
          >
            {icon}
          </span>
        )}
      </header>
      <div>
        <strong style={{ color: text }}>{value}</strong>
        {subtitle && <p className="miot-status-stat__subtitle">{subtitle}</p>}
      </div>
    </article>
  );
}
