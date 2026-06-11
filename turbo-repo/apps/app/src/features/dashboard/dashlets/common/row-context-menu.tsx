"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiArrowTopRightOnSquare, HiLink } from "react-icons/hi2";
import type { RowAction } from "./action-types";

export interface ResolvedContextItem {
  action: RowAction;
  href: string;
}

interface RowContextMenuProps {
  items: ResolvedContextItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export function RowContextMenu({ items, x, y, onClose }: Readonly<RowContextMenuProps>) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // clamp to viewport after render or when position changes
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    if (rect.right > window.innerWidth - pad) {
      el.style.left = `${window.innerWidth - rect.width - pad}px`;
    }
    if (rect.bottom > window.innerHeight - pad) {
      el.style.top = `${window.innerHeight - rect.height - pad}px`;
    }
  }, [x, y]);

  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{ top: y, left: x }}
    >
      {items.map(({ action, href }, idx) => (
        <a
          key={`${idx}-${action.name}`}
          href={href}
          target={action.target}
          rel={action.target === "_blank" ? "noopener noreferrer" : undefined}
          onClick={onClose}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
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
    document.body
  );
}
