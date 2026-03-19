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
  removeAssignment: (serviceId: string) => Promise<void>;
  startReassignment: (plannedService: PlannedService) => void;
  startAssignment: (plannedService: PlannedService) => void;
}

interface UseServiceActionsResult {
  contextMenu: ContextMenuState;
  deleteModal: DeleteModalState;
  deleteAssignmentModal: DeleteModalState;
  handleContextMenu: (
    e: React.MouseEvent,
    plannedService: PlannedService
  ) => void;
  handleCloseContextMenu: () => void;
  handleReassign: (plannedService: PlannedService) => void;
  handleAssign: (plannedService: PlannedService) => void;
  handleDeleteRequest: (plannedService: PlannedService) => void;
  handleConfirmDelete: (plannedService: PlannedService) => Promise<void>;
  handleCancelDelete: () => void;
  handleDeleteAssignmentRequest: (plannedService: PlannedService) => void;
  handleConfirmDeleteAssignment: (
    plannedService: PlannedService
  ) => Promise<void>;
  handleCancelDeleteAssignment: () => void;
}

/**
 * Shared hook for service context menu and delete modal actions
 * Used by both DayGrid and WeekView components
 */
export function useServiceActions({
  removeService,
  removeAssignment,
  startReassignment,
  startAssignment,
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

  // Delete assignment confirmation modal state
  const [deleteAssignmentModal, setDeleteAssignmentModal] =
    useState<DeleteModalState>({
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
        message: "Seleccione una nueva fecha y hora para volver a planificar",
      });
    },
    [startReassignment]
  );

  const handleAssign = useCallback(
    (plannedService: PlannedService) => {
      startAssignment(plannedService);
    },
    [startAssignment]
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

  // Delete assignment handlers
  const handleDeleteAssignmentRequest = useCallback(
    (plannedService: PlannedService) => {
      setDeleteAssignmentModal({
        isOpen: true,
        plannedService,
      });
    },
    []
  );

  const handleConfirmDeleteAssignment = useCallback(
    async (plannedService: PlannedService) => {
      if (plannedService) {
        try {
          await removeAssignment(plannedService.service.id);
          ShowNotification({
            type: "success",
            message: "Asignación eliminada",
          });
        } catch (error) {
          console.error("Error deleting assignment:", error);
          ShowNotification({
            type: "error",
            message:
              "Error al eliminar la asignación. Por favor, intente nuevamente.",
          });
        }
      }
      setDeleteAssignmentModal({ isOpen: false, plannedService: null });
    },
    [removeAssignment]
  );

  const handleCancelDeleteAssignment = useCallback(() => {
    setDeleteAssignmentModal({ isOpen: false, plannedService: null });
  }, []);

  return {
    contextMenu,
    deleteModal,
    deleteAssignmentModal,
    handleContextMenu,
    handleCloseContextMenu,
    handleReassign,
    handleAssign,
    handleDeleteRequest,
    handleConfirmDelete,
    handleCancelDelete,
    handleDeleteAssignmentRequest,
    handleConfirmDeleteAssignment,
    handleCancelDeleteAssignment,
  };
}
