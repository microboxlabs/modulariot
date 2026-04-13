"use client";

import { createPortal } from "react-dom";
import { HiEllipsisVertical, HiArrowTopRightOnSquare, HiLink } from "react-icons/hi2";
import type { ActionItem } from "./action-types";
import { usePortalDropdown } from "./use-portal-dropdown";

interface ResolvedAction {
  action: ActionItem;
  href: string;
}

interface ActionDropdownProps {
  items: ResolvedAction[];
  ariaLabel: string;
}

export function ActionDropdown({ items, ariaLabel }: Readonly<ActionDropdownProps>) {
  const { open, pos, buttonRef, menuRef, close, toggle } =
    usePortalDropdown();

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
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
