"use client";

import { ConfirmationModal } from "../confirmation-modal";
import type { CalendarItem } from "../../types/calendar-item";
import type { CalendarI18n } from "../../contract/calendar-host";
import type { PlannedService } from "../../types/planning";

export interface DeleteConfirmationModalMessages {
  title: string;
  messagePrefix: string;
  messageSuffix: string;
  close: string;
  cancel: string;
  delete: string;
}

interface DeleteConfirmationModalProps<TItem extends { id: string } = CalendarItem> {
  isOpen: boolean;
  plannedService: PlannedService<TItem> | null;
  messages: DeleteConfirmationModalMessages;
  onConfirm: (plannedService: PlannedService<TItem>) => void;
  onCancel: () => void;
}

const DELETE_MODAL_BASE = "layout.planning.deleteModal" as const;
const DELETE_ASSIGNMENT_MODAL_BASE =
  "layout.planning.deleteAssignmentModal" as const;

/** Build the delete-plan modal copy through the host i18n seam. */
export function getDeleteModalMessages(
  i18n: CalendarI18n
): DeleteConfirmationModalMessages {
  const { tr, dict } = i18n;
  return {
    title: tr(`${DELETE_MODAL_BASE}.title`, dict),
    messagePrefix: tr(`${DELETE_MODAL_BASE}.messagePrefix`, dict),
    messageSuffix: tr(`${DELETE_MODAL_BASE}.messageSuffix`, dict),
    close: tr(`${DELETE_MODAL_BASE}.close`, dict),
    cancel: tr(`${DELETE_MODAL_BASE}.cancel`, dict),
    delete: tr(`${DELETE_MODAL_BASE}.delete`, dict),
  };
}

/** Build the delete-assignment modal copy through the host i18n seam. */
export function getDeleteAssignmentMessages(
  i18n: CalendarI18n
): DeleteConfirmationModalMessages {
  const { tr, dict } = i18n;
  return {
    title: tr(`${DELETE_ASSIGNMENT_MODAL_BASE}.title`, dict),
    messagePrefix: tr(`${DELETE_ASSIGNMENT_MODAL_BASE}.messagePrefix`, dict),
    messageSuffix: tr(`${DELETE_ASSIGNMENT_MODAL_BASE}.messageSuffix`, dict),
    close: tr(`${DELETE_ASSIGNMENT_MODAL_BASE}.close`, dict),
    cancel: tr(`${DELETE_ASSIGNMENT_MODAL_BASE}.cancel`, dict),
    delete: tr(`${DELETE_ASSIGNMENT_MODAL_BASE}.delete`, dict),
  };
}

/**
 * Confirmation modal for deleting a planned item (plan or assignment). Generic
 * over the host item type; only the item's `id` is shown. Copy is supplied by
 * the caller via {@link DeleteConfirmationModalMessages} (translated host-side).
 */
export function DeleteConfirmationModal<
  TItem extends { id: string } = CalendarItem,
>({
  isOpen,
  plannedService,
  messages,
  onConfirm,
  onCancel,
}: Readonly<DeleteConfirmationModalProps<TItem>>) {
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
