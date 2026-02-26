"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiSwitchHorizontal, HiTrash } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { PlannedService } from "./planning-selection-context";
import { Button } from "flowbite-react";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ServiceContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  plannedService: PlannedService | null;
  dict: I18nDictionary;
  onReassign: (plannedService: PlannedService) => void;
  onDelete: (plannedService: PlannedService) => void;
  onClose: () => void;
}

/**
 * Calculate adjusted position to keep menu within viewport
 */
function getAdjustedPosition(
  position: ContextMenuPosition,
  menuWidth: number,
  menuHeight: number
): ContextMenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let newX = position.x;
  let newY = position.y;

  // Adjust if menu goes beyond right edge
  if (position.x + menuWidth > viewportWidth) {
    newX = viewportWidth - menuWidth - 8;
  }

  // Adjust if menu goes beyond bottom edge
  if (position.y + menuHeight > viewportHeight) {
    newY = viewportHeight - menuHeight - 8;
  }

  return { x: newX, y: newY };
}

/**
 * Portal-based context menu for service chips in calendar views
 * Provides options to reassign or delete a planned service
 */
export function ServiceContextMenu({
  isOpen,
  position,
  plannedService,
  dict,
  onReassign,
  onDelete,
  onClose,
}: Readonly<ServiceContextMenuProps>) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Estimated menu dimensions for initial position calculation
  const MENU_WIDTH = 180;
  const MENU_HEIGHT = 120;

  // Calculate position immediately (no animation delay)
  const adjustedPosition = getAdjustedPosition(
    position,
    MENU_WIDTH,
    MENU_HEIGHT
  );

  // Handle click outside - use capture phase to catch all clicks including on disabled elements
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && !menuRef.current.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Use capture phase to intercept clicks before they reach disabled elements
    // Small timeout to prevent the same right-click from closing the menu
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("keydown", handleEscape);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !plannedService) return null;

  const handleReassign = () => {
    onReassign(plannedService);
    onClose();
  };

  const handleDelete = () => {
    onDelete(plannedService);
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      data-context-menu
      className={twMerge(
        "fixed z-[9999] min-w-[160px]",
        "bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "rounded-lg shadow-lg",
        "py-1"
      )}
      style={{
        top: adjustedPosition.y,
        left: adjustedPosition.x,
      }}
    >
      {/* Service ID header */}
      <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Servicio
        </span>
        <span className="ml-1 text-xs font-mono font-bold text-gray-900 dark:text-white">
          {plannedService.service.id}
        </span>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <Button
          color={"alternative"}
          type="button"
          onClick={handleReassign}
          className="border-0 rounded-none w-full justify-start gap-2"
        >
          <HiSwitchHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{dict.pages.planning.sidebar.contextMenu.reassign}</span>
        </Button>
        <Button
          color={"alternative"}
          type="button"
          onClick={handleDelete}
          className="border-0 rounded-none w-full justify-start gap-2"
        >
          <HiTrash className="w-4 h-4" />
          <span>{dict.pages.planning.sidebar.contextMenu.delete}</span>
        </Button>
      </div>
    </div>,
    document.body
  );
}
