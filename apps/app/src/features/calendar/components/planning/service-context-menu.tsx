"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiSwitchHorizontal, HiTrash, HiUserAdd } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { PlannedService } from "./planning-selection-context";
import { Button } from "flowbite-react";

const ASIGNATION_FLAG = process.env.NEXT_PUBLIC_ASIGNATION_FLAG === "true";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ServiceContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  plannedService: PlannedService | null;
  onReassign: (plannedService: PlannedService) => void;
  onAssign: (plannedService: PlannedService) => void;
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
  onReassign,
  onAssign,
  onDelete,
  onClose,
}: Readonly<ServiceContextMenuProps>) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Estimated menu dimensions for initial position calculation
  // Height varies based on number of buttons (2 without ASIGNATION_FLAG, 3 with it)
  const MENU_WIDTH = 180;
  const MENU_HEADER_HEIGHT = 32;
  const MENU_BUTTON_HEIGHT = 38;
  const MENU_PADDING = 8;
  const buttonCount = ASIGNATION_FLAG ? 3 : 2;
  const MENU_HEIGHT =
    MENU_HEADER_HEIGHT + MENU_PADDING + buttonCount * MENU_BUTTON_HEIGHT;

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

  const handleAssign = () => {
    onAssign(plannedService);
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
          <span>Volver a planificar</span>
        </Button>
        {ASIGNATION_FLAG && (
          <Button
            color={"alternative"}
            type="button"
            onClick={handleAssign}
            className="border-0 rounded-none w-full justify-start gap-2"
          >
            <HiUserAdd className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>Asignar</span>
          </Button>
        )}
        <Button
          color={"alternative"}
          type="button"
          onClick={handleDelete}
          className="border-0 rounded-none w-full justify-start gap-2"
        >
          <HiTrash className="w-4 h-4" />
          <span>Eliminar planificación</span>
        </Button>
      </div>
    </div>,
    document.body
  );
}
