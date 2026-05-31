"use client";

import type { ReactNode } from "react";
import type { CalendarItem } from "../../types/calendar-item";
import type { SelectedSlot } from "../../types/calendar-slot";
import type { PlannedService, ReassigningService } from "../../types/planning";
import {
  DeleteConfirmationModal,
  type DeleteConfirmationModalMessages,
} from "./delete-confirmation-modal";
import { ReassignmentConnector } from "./reassignment-connector";

interface DeleteModalState<TItem extends { id: string }> {
  isOpen: boolean;
  plannedService: PlannedService<TItem> | null;
}

export interface PlanningGridOverlaysProps<
  TItem extends { id: string } = CalendarItem,
> {
  /**
   * Host-rendered context menu (e.g. permission/nav-aware ServiceContextMenu).
   * Kept host-side so the package stays free of routing/permission concerns;
   * the package only mounts it at the grid root.
   */
  readonly contextMenu: ReactNode;

  // Delete modal
  readonly deleteModal: DeleteModalState<TItem>;
  readonly deleteModalMessages: DeleteConfirmationModalMessages;
  readonly onConfirmDelete: (plannedService: PlannedService<TItem>) => void;
  readonly onCancelDelete: () => void;

  // Delete assignment modal
  readonly deleteAssignmentModal: DeleteModalState<TItem>;
  readonly deleteAssignmentMessages: DeleteConfirmationModalMessages;
  readonly onConfirmDeleteAssignment: (
    plannedService: PlannedService<TItem>
  ) => void;
  readonly onCancelDeleteAssignment: () => void;

  // Reassignment
  readonly reassigningService: ReassigningService<TItem> | null;
  readonly selectedSlot: SelectedSlot | null;
}

/**
 * Root-level grid overlays: the host context menu, the delete-confirmation
 * modals (plan + assignment), and the reassignment connector. Rendered outside
 * the scroll container's relative wrapper so they are not clipped.
 */
export function PlanningGridOverlays<
  TItem extends { id: string } = CalendarItem,
>({
  contextMenu,
  deleteModal,
  deleteModalMessages,
  onConfirmDelete,
  onCancelDelete,
  deleteAssignmentModal,
  deleteAssignmentMessages,
  onConfirmDeleteAssignment,
  onCancelDeleteAssignment,
  reassigningService,
  selectedSlot,
}: PlanningGridOverlaysProps<TItem>): ReactNode {
  return (
    <>
      {/* Context Menu (host-rendered) */}
      {contextMenu}

      {/* Delete Confirmation Modal */}
      {deleteModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          plannedService={deleteModal.plannedService}
          messages={deleteModalMessages}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}

      {/* Delete Assignment Confirmation Modal */}
      {deleteAssignmentModal.plannedService && (
        <DeleteConfirmationModal
          isOpen={deleteAssignmentModal.isOpen}
          plannedService={deleteAssignmentModal.plannedService}
          messages={deleteAssignmentMessages}
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
