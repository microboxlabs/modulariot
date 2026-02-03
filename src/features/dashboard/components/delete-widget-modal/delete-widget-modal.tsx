"use client";

import { ConfirmModal } from "../confirm-modal";

interface DeleteWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  widgetName: string;
}

/**
 * Confirmation modal for deleting a widget
 */
export function DeleteWidgetModal({
  isOpen,
  onClose,
  onConfirm,
  widgetName,
}: DeleteWidgetModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Widget"
      description={
        <>
          Delete <strong>&quot;{widgetName}&quot;</strong>? This cannot be
          undone.
        </>
      }
      confirmText="Delete"
      confirmColor="red"
    />
  );
}
