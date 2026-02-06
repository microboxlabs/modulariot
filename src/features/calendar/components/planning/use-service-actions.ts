"use client";

import { useState, useCallback } from "react";
import type { PlannedService } from "./planning-selection-context";
import type { ContextMenuPosition } from "./service-context-menu";
import { ShowNotification } from "@/features/notifications/notification";

export interface ContextMenuState {
  isOpen: boolean;
  position: ContextMenuPosition;
  plannedService: PlannedService | null;
}

export interface DeleteModalState {
  isOpen: boolean;
  plannedService: PlannedService | null;
}

interface UseServiceActionsProps {
  removeService: (serviceId: string) => Promise<void>;
  startReassignment: (plannedService: PlannedService) => void;
}

interface UseServiceActionsResult {
  contextMenu: ContextMenuState;
  deleteModal: DeleteModalState;
  handleContextMenu: (e: React.MouseEvent, plannedService: PlannedService) => void;
  handleCloseContextMenu: () => void;
  handleReassign: (plannedService: PlannedService) => void;
  handleDeleteRequest: (plannedService: PlannedService) => void;
  handleConfirmDelete: (plannedService: PlannedService) => Promise<void>;
  handleCancelDelete: () => void;
}

/**
 * Shared hook for service context menu and delete modal actions
 * Used by both DayGrid and WeekView components
 */
export function useServiceActions({
  removeService,
  startReassignment,
}: UseServiceActionsProps): UseServiceActionsResult {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    plannedService: null,
  });

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    plannedService: null,
  });

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, plannedService: PlannedService) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        plannedService,
      });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleReassign = useCallback(
    (plannedService: PlannedService) => {
      startReassignment(plannedService);
      ShowNotification({
        type: "info",
        message: "Seleccione una nueva fecha y hora para reasignar el servicio",
      });
    },
    [startReassignment]
  );

  const handleDeleteRequest = useCallback((plannedService: PlannedService) => {
    setDeleteModal({
      isOpen: true,
      plannedService,
    });
  }, []);

  const handleConfirmDelete = useCallback(
    async (plannedService: PlannedService) => {
      if (plannedService) {
        try {
          await removeService(plannedService.service.id);
          ShowNotification({
            type: "success",
            message: "Asignación eliminada",
          });
        } catch (error) {
          console.error("Error deleting planned service:", error);
          ShowNotification({
            type: "error",
            message:
              "Error al eliminar la asignación. Por favor, intente nuevamente.",
          });
        }
      }
      setDeleteModal({ isOpen: false, plannedService: null });
    },
    [removeService]
  );

  const handleCancelDelete = useCallback(() => {
    setDeleteModal({ isOpen: false, plannedService: null });
  }, []);

  return {
    contextMenu,
    deleteModal,
    handleContextMenu,
    handleCloseContextMenu,
    handleReassign,
    handleDeleteRequest,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
