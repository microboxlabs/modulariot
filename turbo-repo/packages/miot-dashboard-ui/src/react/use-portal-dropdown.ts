"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Shared state and event-handling logic for portal-based dropdown menus.
 * Used by ActionDropdown, ExportDropdown, and any future dropdown that
 * renders its menu via createPortal.
 */
export function usePortalDropdown(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const close = useCallback(() => setOpen(false), []);
  const restoreFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (!enabled) close();
  }, [enabled, close]);

  // Compute position when opening
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const win = buttonRef.current.ownerDocument.defaultView;
    if (!win) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panel = menuRef.current;
    const width = panel?.offsetWidth ?? 180;
    const height = panel?.offsetHeight ?? 0;
    setPos({
      top: Math.max(
        8,
        rect.bottom + 4 + height > win.innerHeight - 8
          ? rect.top - height - 4
          : rect.bottom + 4,
      ),
      left: Math.max(width + 8, Math.min(rect.right, win.innerWidth - 8)),
    });
    panel?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      close();
    };
    const doc = buttonRef.current?.ownerDocument;
    if (!doc) return;
    doc.addEventListener("pointerdown", handler);
    doc.addEventListener("focusin", handler);
    return () => {
      doc.removeEventListener("pointerdown", handler);
      doc.removeEventListener("focusin", handler);
    };
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const doc = buttonRef.current?.ownerDocument;
    if (!doc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        restoreFocus();
      }
    };
    doc.addEventListener("keydown", handler);
    return () => doc.removeEventListener("keydown", handler);
  }, [open, restoreFocus]);

  // Close on scroll of any ancestor (the table/dashboard container scrolls)
  useEffect(() => {
    if (!open) return;
    const win = buttonRef.current?.ownerDocument.defaultView;
    if (!win) return;
    const handler = () => close();
    win.addEventListener("scroll", handler, true);
    win.addEventListener("resize", handler);
    return () => {
      win.removeEventListener("scroll", handler, true);
      win.removeEventListener("resize", handler);
    };
  }, [open, close]);

  return { open, pos, buttonRef, menuRef, close, toggle };
}
