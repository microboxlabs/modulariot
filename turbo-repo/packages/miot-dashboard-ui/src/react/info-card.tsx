"use client";
import { Children, type CSSProperties, type ReactNode } from "react";
import { isSafeActionUrl } from "../core/action-helpers";
export interface InfoCardProps {
  readonly title: string;
  readonly value: string;
  readonly descriptor: string;
  readonly footer: string;
  readonly icon?: ReactNode;
  readonly iconStyle?: CSSProperties;
  readonly valueStyle?: CSSProperties;
  readonly descriptorStyle?: CSSProperties;
  readonly children?: ReactNode;
  readonly editMode?: boolean;
  readonly onAddDetail?: () => void;
  readonly addDetailLabel: string;
  readonly viewMoreUrl?: string;
  readonly viewMoreLabel: string;
  readonly openInSameTab?: boolean;
}
function safeWebLink(href: string | undefined) {
  if (!href || !isSafeActionUrl(href)) return false;
  try {
    const protocol = new URL(href, "https://dashboard.invalid").protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
/** Resolved literal content with optional host-owned icons and nested widgets. */
export function InfoCard({
  title,
  value,
  descriptor,
  footer,
  icon,
  iconStyle,
  valueStyle,
  descriptorStyle,
  children,
  editMode = false,
  onAddDetail,
  addDetailLabel,
  viewMoreUrl,
  viewMoreLabel,
  openInSameTab = false,
}: InfoCardProps) {
  const hasChildren = Children.count(children) > 0;
  return (
    <article className="miot-info-card" aria-label={title || undefined}>
      <header>
        <h3>{title}</h3>
        {icon && (
          <span aria-hidden="true" style={iconStyle}>
            {icon}
          </span>
        )}
      </header>
      <div className="miot-info-card__body">
        <strong style={valueStyle}>{value}</strong>
        <p style={descriptorStyle}>{descriptor}</p>
        {hasChildren && (
          <div className="miot-info-card__details">{children}</div>
        )}
        {editMode && !hasChildren && onAddDetail && (
          <button
            className="miot-info-card__add no-drag"
            type="button"
            onClick={onAddDetail}
          >
            {addDetailLabel}
          </button>
        )}
      </div>
      <footer>
        <p>{footer}</p>
        {safeWebLink(viewMoreUrl) && (
          <a
            className="no-drag"
            href={viewMoreUrl}
            target={openInSameTab ? "_self" : "_blank"}
            rel={openInSameTab ? undefined : "noopener noreferrer"}
          >
            {viewMoreLabel}
          </a>
        )}
      </footer>
    </article>
  );
}
