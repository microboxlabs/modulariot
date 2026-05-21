"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiEye, HiSwitchHorizontal, HiTrash, HiUserAdd } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  usePlanningSelection,
  type PlannedService,
} from "./planning-selection-context";
import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useCalendarViewMode } from "./use-calendar-view-mode";

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
  onDeleteAssignment: (plannedService: PlannedService) => void;
  onClose: () => void;
  dict: I18nRecord;
}

function hasRequiredAssignedResources(plannedService: PlannedService): boolean {
  const { service } = plannedService;

  return Boolean(
    service.assignedCarrier && service.assignedDriver && service.assignedTruck
  );
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
  onDeleteAssignment,
  onClose,
  dict,
}: Readonly<ServiceContextMenuProps>) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Effective view-mode — already accounts for `?as=viewer` for users with
  // GROUP_CALENDAR_VIEWER. Fail-closed: both flags are false while
  // permissions load and while the override is active.
  const { canPlan, canAssign, forceViewer, canTogglePreview } =
    useCalendarViewMode();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { inspectPlannedService } = usePlanningSelection();

  const canDeleteAssignment =
    plannedService !== null &&
    canAssign &&
    hasRequiredAssignedResources(plannedService);

  // Estimated menu dimensions for initial position calculation
  // Height varies based on number of visible buttons
  const MENU_WIDTH = 200;
  const MENU_HEADER_HEIGHT = 32;
  const MENU_BUTTON_HEIGHT = 38;
  const MENU_PADDING = 8;
  const buttonCount =
    (canAssign ? 1 : 0) +
    (canDeleteAssignment ? 1 : 0) +
    (canPlan ? 2 : 0) +
    (canTogglePreview ? 1 : 0);
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

  const handleDeleteAssignment = () => {
    onDeleteAssignment(plannedService);
    onClose();
  };

  const handleDelete = () => {
    onDelete(plannedService);
    onClose();
  };

  // Flip the `?as=viewer` URL param without losing any other params
  // (`date`, `view`, `groupCode`, etc.). Push, don't replace, so back
  // navigates out of the preview. Closes the menu so the click feels
  // discrete; the page re-renders with the new mode on the next tick.
  // When entering preview (not exiting), also populate the sidebar with
  // the right-clicked chip's data so the read-only view has content to
  // show on the same gesture — without this, the user would have to
  // right-click a second time after the URL flip to inspect the chip.
  const handleTogglePreview = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (forceViewer) {
      params.delete("as");
    } else {
      params.set("as", "viewer");
      if (plannedService) {
        inspectPlannedService(plannedService);
      }
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
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
          {tr("pages.planning.sidebar.contextMenu.service", dict)}
        </span>
        <span className="ml-1 text-xs font-mono font-bold text-gray-900 dark:text-white">
          {plannedService.service.id}
        </span>
      </div>

      {/* Menu items. For a pure GROUP_CALENDAR_VIEWER, every gate below is
          false and only the service-ID header above renders — intentional
          confirmation that the chip was selected, paired with the sidebar
          opening via inspectPlannedService in use-planning-grid. */}
      <div className="py-1">
        {canAssign && (
          <Button
            color={"alternative"}
            type="button"
            onClick={handleAssign}
            className="border-0 rounded-none w-full justify-start gap-2"
          >
            <HiUserAdd className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{tr("pages.planning.sidebar.contextMenu.assign", dict)}</span>
          </Button>
        )}

        {canDeleteAssignment && (
          <Button
            color={"alternative"}
            type="button"
            onClick={handleDeleteAssignment}
            className="border-0 rounded-none w-full justify-start gap-2"
          >
            <HiTrash className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>
              {tr("pages.planning.sidebar.contextMenu.deleteAssignment", dict)}
            </span>
          </Button>
        )}

        {canPlan && (
          <Button
            color={"alternative"}
            type="button"
            onClick={handleReassign}
            className="border-0 rounded-none w-full justify-start gap-2"
          >
            <HiSwitchHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{tr("pages.planning.sidebar.contextMenu.replan", dict)}</span>
          </Button>
        )}

        {canPlan && (
          <Button
            color={"alternative"}
            type="button"
            onClick={handleDelete}
            className="border-0 rounded-none w-full justify-start gap-2"
          >
            <HiTrash className="w-4 h-4" />
            <span>
              {tr("pages.planning.sidebar.contextMenu.deletePlanning", dict)}
            </span>
          </Button>
        )}

        {canTogglePreview && (
          <Button
            color={"alternative"}
            type="button"
            onClick={handleTogglePreview}
            className="border-0 rounded-none w-full justify-start gap-2 border-t border-gray-200 dark:border-gray-700"
          >
            <HiEye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>
              {tr(
                forceViewer
                  ? "pages.planning.sidebar.contextMenu.exitPreview"
                  : "pages.planning.sidebar.contextMenu.previewAsViewer",
                dict
              )}
            </span>
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
}
