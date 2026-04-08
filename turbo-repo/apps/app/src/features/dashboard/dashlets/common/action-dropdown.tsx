"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HiEllipsisVertical, HiArrowTopRightOnSquare, HiLink } from "react-icons/hi2";
import type { ActionItem } from "./action-types";

interface ResolvedAction {
  action: ActionItem;
  href: string;
}

interface ActionDropdownProps {
  items: ResolvedAction[];
}

export function ActionDropdown({ items }: Readonly<ActionDropdownProps>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
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

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <HiEllipsisVertical className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
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
        </div>
      )}
    </div>
  );
}
