"use client";

import { ConfirmationModal } from "@/features/common/components/confirmation-modal";
import type { PlannedService } from "./planning-selection-context";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  plannedService: PlannedService | null;
  onConfirm: (plannedService: PlannedService) => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for deleting a planned service assignment
 */
export function DeleteConfirmationModal({
  isOpen,
  plannedService,
  onConfirm,
  onCancel,
}: Readonly<DeleteConfirmationModalProps>) {
  if (!plannedService) return null;

  const handleConfirm = () => {
    onConfirm(plannedService);
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onCancel}
      onConfirm={handleConfirm}
      title="Confirmar eliminación"
      description={
        <>
          ¿Eliminar la asignación del servicio{" "}
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {plannedService.service.id}
          </span>
          ?
        </>
      }
      variant="danger"
      confirmLabel="Eliminar"
      size="md"
    />
  );
}
