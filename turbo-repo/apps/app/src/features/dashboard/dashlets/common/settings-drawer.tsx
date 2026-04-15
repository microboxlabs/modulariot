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
  /** Optional title shown in the header */
  title?: string;
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
  title,
  className,
  children,
}: Readonly<SettingsDrawerProps>) {
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (globalThis.window === undefined || !open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (globalThis.window === undefined) return null;

  return createPortal(
    <div
      className={twMerge(
        "fixed inset-0 z-[800] transition-all duration-300",
        open ? "visible opacity-100" : "invisible opacity-0"
      )}
    >
      <div
        className={twMerge(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
        onMouseDown={(e) => {
          mouseDownOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
            onClose();
          }
          mouseDownOnBackdrop.current = false;
        }}
      />

      <dialog
        open
        aria-modal="true"
        aria-label="Settings"
        className={twMerge(
          "no-drag absolute top-0 right-0 left-auto m-0 h-full max-h-full max-w-full transform border-l border-gray-200 bg-white p-0 shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800",
          open ? "translate-x-0" : "translate-x-full",
          className ?? "w-[28rem]"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700">
          {title && (
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="no-drag cursor-pointer ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <HiXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="h-[calc(100%-3rem)] overflow-y-auto p-4">
          {open && children}
        </div>
      </dialog>
    </div>,
    document.body
  );
}
