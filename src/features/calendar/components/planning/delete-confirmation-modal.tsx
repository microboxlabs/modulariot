"use client";

import { ConfirmationModal } from "@/features/common/components/confirmation-modal";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { PlannedService } from "./planning-selection-context";

export interface DeleteConfirmationModalMessages {
  title: string;
  messagePrefix: string;
  messageSuffix: string;
  close: string;
  cancel: string;
  delete: string;
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  plannedService: PlannedService | null;
  messages: DeleteConfirmationModalMessages;
  onConfirm: (plannedService: PlannedService) => void;
  onCancel: () => void;
}

const DELETE_MODAL_BASE = "layout.planning.deleteModal" as const;

export function getDeleteModalMessages(
  dict: I18nDictionary,
  _serviceId: string
): DeleteConfirmationModalMessages {
  return {
    title: tr(`${DELETE_MODAL_BASE}.title`, dict),
    messagePrefix: tr(`${DELETE_MODAL_BASE}.messagePrefix`, dict),
    messageSuffix: tr(`${DELETE_MODAL_BASE}.messageSuffix`, dict),
    close: tr(`${DELETE_MODAL_BASE}.close`, dict),
    cancel: tr(`${DELETE_MODAL_BASE}.cancel`, dict),
    delete: tr(`${DELETE_MODAL_BASE}.delete`, dict),
  };
}

/**
 * Confirmation modal for deleting a planned service assignment
 */
export function DeleteConfirmationModal({
  isOpen,
  plannedService,
  messages,
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
      title={messages.title}
      description={
        <>
          {messages.messagePrefix}
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {plannedService.service.id}
          </span>
          {messages.messageSuffix}
        </>
      }
      variant="danger"
      confirmLabel={messages.delete}
      size="md"
    />
  );
}
