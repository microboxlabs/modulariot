"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiExclamation, HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { PlannedService } from "./planning-selection-context";

export interface DeleteConfirmationModalMessages {
  title: string;
  message: string;
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
  serviceId: string
): DeleteConfirmationModalMessages {
  return {
    title: tr(`${DELETE_MODAL_BASE}.title`, dict),
    message: tr(`${DELETE_MODAL_BASE}.message`, dict, { serviceId }),
    close: tr(`${DELETE_MODAL_BASE}.close`, dict),
    cancel: tr(`${DELETE_MODAL_BASE}.cancel`, dict),
    delete: tr(`${DELETE_MODAL_BASE}.delete`, dict),
  };
}

/**
 * Confirmation modal for deleting a planned service assignment
 * Uses portal to render above all other content
 */
export function DeleteConfirmationModal({
  isOpen,
  plannedService,
  messages,
  onConfirm,
  onCancel,
}: Readonly<DeleteConfirmationModalProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync dialog open state with isOpen
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // When dialog is closed by Escape or backdrop click, sync parent state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onCancel();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onCancel]);

  if (!isOpen || !plannedService) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-modal-title"
      className={twMerge(
        "relative z-[9999] mx-auto max-w-[calc(100vw-2rem)]",
        "border-0 rounded-xl shadow-2xl p-0",
        "bg-white dark:bg-gray-800",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        "[&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-sm [&::backdrop]:animate-in [&::backdrop]:fade-in-0 [&::backdrop]:duration-200"
      )}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onCancel}
        className={twMerge(
          "absolute top-2 right-2",
          "p-1 rounded-lg",
          "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
          "hover:bg-gray-100 dark:hover:bg-gray-700",
          "transition-colors duration-150"
        )}
        aria-label={messages.close}
      >
        <HiX className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="px-5 py-4">
        {/* Header with icon and title inline */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 shrink-0">
            <HiExclamation className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h3
            id="delete-modal-title"
            className="text-base font-semibold text-gray-900 dark:text-white"
          >
            {messages.title}
          </h3>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 whitespace-nowrap">
          {messages.message}
        </p>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className={twMerge(
              "px-3 py-1.5",
              "text-sm font-medium",
              "text-gray-700 dark:text-gray-300",
              "bg-gray-100 dark:bg-gray-700",
              "hover:bg-gray-200 dark:hover:bg-gray-600",
              "rounded-lg",
              "transition-colors duration-150"
            )}
          >
            {messages.cancel}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (plannedService) {
                onConfirm(plannedService);
              }
            }}
            className={twMerge(
              "px-3 py-1.5",
              "text-sm font-medium",
              "text-white",
              "bg-red-600 hover:bg-red-700",
              "dark:bg-red-600 dark:hover:bg-red-700",
              "rounded-lg",
              "transition-colors duration-150"
            )}
          >
            {messages.delete}
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
