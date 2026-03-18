"use client";

import type { ReactNode } from "react";
import { ServiceContextMenu } from "./service-context-menu";
import {
  DeleteConfirmationModal,
  getDeleteModalMessages,
  getDeleteAssignmentMessages,
} from "./delete-confirmation-modal";
import { ReassignmentConnector } from "./reassignment-connector";
import type { PlannedService } from "./planning-selection-context";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

// ============================================================================
// Types
// ============================================================================

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  plannedService: PlannedService | null;
}

interface DeleteModalState {
  isOpen: boolean;
  plannedService: PlannedService | null;
}

interface PlanningGridOverlaysProps {
  readonly dict: I18nDictionary;

  // Context menu
  readonly contextMenu: ContextMenuState;
  readonly onReassign: (plannedService: PlannedService) => void;
  readonly onAssign: (plannedService: PlannedService) => void;
  readonly onDeleteRequest: (plannedService: PlannedService) => void;
  readonly onDeleteAssignmentRequest: (plannedService: PlannedService) => void;
  readonly onCloseContextMenu: () => void;

  // Delete modal
  readonly deleteModal: DeleteModalState;
  readonly onConfirmDelete: (plannedService: PlannedService) => void;
  readonly onCancelDelete: () => void;

  // Delete assignment modal
  readonly deleteAssignmentModal: DeleteModalState;
  readonly onConfirmDeleteAssignment: (plannedService: PlannedService) => void;
  readonly onCancelDeleteAssignment: () => void;

  // Reassignment
  readonly reassigningService: {
    service: PlannedService;
    originalSlot: { date: Date; hour: number; minutes: number };
  } | null;
  readonly selectedSlot: {
    date: Date;
    hour: number;
    minutes: number;
  } | null;
}

// ============================================================================
// Component
// ============================================================================

export function PlanningGridOverlays({
  dict,
  contextMenu,
  onReassign,
  onAssign,
  onDeleteRequest,
  onDeleteAssignmentRequest,
  onCloseContextMenu,
  deleteModal,
  onConfirmDelete,
  onCancelDelete,
  deleteAssignmentModal,
  onConfirmDeleteAssignment,
  onCancelDeleteAssignment,
  reassigningService,
  selectedSlot,
}: PlanningGridOverlaysProps): ReactNode {
  return (
    <>
      {/* Context Menu */}
      <ServiceContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        plannedService={contextMenu.plannedService}
        onReassign={onReassign}
        onAssign={onAssign}
        onDelete={onDeleteRequest}
        onDeleteAssignment={onDeleteAssignmentRequest}
        onClose={onCloseContextMenu}
        dict={dict}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          plannedService={deleteModal.plannedService}
          messages={getDeleteModalMessages(
            dict,
            deleteModal.plannedService.service.id
          )}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}

      {/* Delete Assignment Confirmation Modal */}
      {deleteAssignmentModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteAssignmentModal.isOpen}
          plannedService={deleteAssignmentModal.plannedService}
          messages={getDeleteAssignmentMessages(
            dict,
            deleteAssignmentModal.plannedService.service.id
          )}
          onConfirm={onConfirmDeleteAssignment}
          onCancel={onCancelDeleteAssignment}
        />
      )}

      {/* Reassignment Connector - shows line between original and target slot */}
      {reassigningService && (
        <ReassignmentConnector
          originSlot={reassigningService.originalSlot}
          targetSlot={selectedSlot}
          serviceId={reassigningService.service.service.id}
        />
      )}
    </>
  );
}
