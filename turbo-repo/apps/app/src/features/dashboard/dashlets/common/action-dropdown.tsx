"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { HiEllipsisVertical, HiArrowTopRightOnSquare, HiLink } from "react-icons/hi2";
import type { ActionItem } from "./action-types";

interface ResolvedAction {
  action: ActionItem;
  href: string;
}

interface ActionDropdownProps {
  items: ResolvedAction[];
  ariaLabel: string;
}

export function ActionDropdown({ items, ariaLabel }: Readonly<ActionDropdownProps>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const close = useCallback(() => setOpen(false), []);

  // Compute position when opening
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.right,
    });
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  // Close on scroll of any ancestor (the table container scrolls)
  useEffect(() => {
    if (!open) return;
    const handler = () => close();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open, close]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <HiEllipsisVertical className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)" }}
          >
            {items.map(({ action, href }, idx) => (
              <a
                key={`${idx}-${action.name}`}
                href={href}
                target={action.target}
                rel={action.target === "_blank" ? "noopener noreferrer" : undefined}
                onClick={close}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {action.target === "_blank" ? (
                  <HiArrowTopRightOnSquare className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                ) : (
                  <HiLink className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                )}
                <span className="truncate">{action.name}</span>
              </a>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
