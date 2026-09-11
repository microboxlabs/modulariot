"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiXMark } from "react-icons/hi2";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AbsoluteModal({
  children,
  selected,
  setSelected,
  maxWidth,
  maxHeight,
  height,
  className,
  dismissible = true,
  showCloseButton,
  ariaLabel,
  closeLabel = "Close",
}: {
  children: React.ReactNode;
  selected: any;
  setSelected: (selected: any) => void;
  maxWidth?: string;
  maxHeight?: string;
  height?: string;
  className?: string;
  /** Whether the modal can be dismissed via backdrop click / Escape. Defaults to true. */
  dismissible?: boolean;
  /** Whether to render the visible close (X) button. Defaults to `dismissible`. */
  showCloseButton?: boolean;
  /** Accessible name for the dialog, exposed as aria-label */
  ariaLabel?: string;
  /** Accessible name for the close button */
  closeLabel?: string;
}) {
  // Track if mousedown started on backdrop to prevent closing when selecting text
  const mouseDownOnBackdrop = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Renders in a portal to document.body so its z-800 backdrop escapes any
  // ancestor with `isolation: isolate` (e.g. the kanban board wrapper) —
  // isolate unconditionally boxes descendants into a local stacking context,
  // capping z-800 there and letting anything portaled straight to <body>
  // (like the filter bar's dropdown, z-50) render on top of it regardless.
  // Portal calls need `document`, so this only runs once mounted client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    if (dismissible) setSelected(null);
  }, [dismissible, setSelected]);

  // Move focus into the dialog when it opens, restore it to the trigger on close
  useEffect(() => {
    if (!selected) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const firstFocusable = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? node)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [selected]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [close]
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed top-0 right-0 left-0 bottom-0 flex justify-center items-center text-white transition-all duration-300 z-800 w-full h-full backdrop-blur-[10px] gap-2 px-4 ${selected ? "opacity-100 visible" : "opacity-0 invisible"}`}
      onMouseDown={(e) => {
        // Track if mousedown started on the backdrop itself
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only close if both mousedown AND click happened on the backdrop
        // This prevents closing when selecting text and dragging outside
        if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          close();
        }
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative flex flex-col items-center justify-center overflow-hidden  ${className || "bg-white dark:bg-gray-700 rounded-lg border border-gray-800"}`}
        style={{
          maxWidth: maxWidth || "100%",
          maxHeight: maxHeight || "100%",
          height: height || "",
        }}
      >
        {(showCloseButton ?? dismissible) && (
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <HiXMark className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
