"use client";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { RowAction } from "../core/action-types";
import { isSafeActionUrl } from "../core/action-helpers";

export interface ResolvedContextItem {
  readonly action: RowAction;
  readonly href: string;
}
export interface RowContextMenuProps {
  readonly items: readonly ResolvedContextItem[];
  readonly x: number;
  readonly y: number;
  readonly ariaLabel: string;
  readonly onClose: () => void;
  readonly theme?: "light" | "dark";
  readonly portalContainer?: HTMLElement;
  readonly returnFocusTo?: HTMLElement | null;
}

/** Nonmodal navigation dialog. Hosts supply resolved links and a close callback. */
export function RowContextMenu({
  items,
  x,
  y,
  ariaLabel,
  onClose,
  theme,
  portalContainer,
  returnFocusTo,
}: RowContextMenuProps) {
  const menuRef = useRef<HTMLDialogElement>(null);
  const originFocusRef = useRef<Element | null | undefined>(undefined);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const safeItems = items.filter(
    ({ action, href }) =>
      action.method === "goto" &&
      (action.target === "_self" || action.target === "_blank") &&
      isSafeActionUrl(href),
  );
  const enabled = safeItems.length > 0;
  const container =
    portalContainer ??
    (typeof document === "undefined" ? undefined : document.body);

  useLayoutEffect(() => {
    if (!enabled) {
      originFocusRef.current = undefined;
      return;
    }
    const panel = menuRef.current;
    if (!panel) return;
    const doc = panel.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    if (originFocusRef.current === undefined)
      originFocusRef.current = doc.activeElement;
    const previousFocus = returnFocusTo ?? originFocusRef.current;
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(x, win.innerWidth - rect.width - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(y, win.innerHeight - rect.height - 8))}px`;
    const ancestor = previousFocus?.closest<HTMLElement>(
      "[data-miot-theme], .dark",
    );
    panel.dataset.miotTheme =
      theme ??
      (ancestor && ancestor.dataset.miotTheme !== "light" ? "dark" : "light");
    panel.querySelector<HTMLElement>("a")?.focus();
    let dismissed = false;
    const close = () => {
      if (dismissed) return;
      dismissed = true;
      closeRef.current();
    };
    const outside = (event: Event) => {
      if (!panel.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      if (previousFocus?.isConnected && "focus" in previousFocus) {
        (previousFocus as HTMLElement).focus();
      }
    };
    doc.addEventListener("pointerdown", outside);
    doc.addEventListener("focusin", outside);
    doc.addEventListener("keydown", escape);
    doc.addEventListener("scroll", outside, true);
    win.addEventListener("resize", close);
    return () => {
      doc.removeEventListener("pointerdown", outside);
      doc.removeEventListener("focusin", outside);
      doc.removeEventListener("keydown", escape);
      doc.removeEventListener("scroll", outside, true);
      win.removeEventListener("resize", close);
    };
  }, [enabled, x, y, theme, container, returnFocusTo]);

  if (!enabled || !container) return null;
  return createPortal(
    <dialog
      open
      ref={menuRef}
      aria-label={ariaLabel}
      className="miot-action-dropdown miot-row-context-menu"
      style={{ top: y, left: x }}
    >
      {safeItems.map(({ action, href }, index) => (
        <a
          key={`${index}-${action.name}`}
          href={href}
          target={action.target}
          rel={action.target === "_blank" ? "noopener noreferrer" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          {action.name}
          <span aria-hidden="true">
            {action.target === "_blank" ? "↗" : "→"}
          </span>
        </a>
      ))}
    </dialog>,
    container,
  );
}
