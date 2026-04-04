"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { HiXMark } from "react-icons/hi2";

interface SettingsDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Optional class override for the panel (e.g. width) */
  className?: string;
  /** Drawer content */
  children: ReactNode;
}

/**
 * Right-side sliding drawer for dashlet settings.
 * Renders via portal to document.body to escape grid layout z-index.
 */
export function SettingsDrawer({
  open,
  onClose,
  className,
  children,
}: Readonly<SettingsDrawerProps>) {
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (typeof globalThis.window === "undefined") return null;

  return createPortal(
    <div
      className={twMerge(
        "fixed inset-0 z-[800] transition-all duration-300",
        open ? "visible opacity-100" : "invisible opacity-0",
      )}
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          onClose();
        }
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        className={twMerge(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={twMerge(
          "no-drag absolute top-0 right-0 h-full max-w-full transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800",
          open ? "translate-x-0" : "translate-x-full",
          className ?? "w-[28rem]",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag absolute top-3 right-3 z-10 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <HiXMark className="h-5 w-5" />
        </button>

        <div className="h-full overflow-y-auto p-4 pt-10">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
