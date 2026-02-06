"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HiExclamation, HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { PlannedService } from "./planning-selection-context";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  plannedService: PlannedService | null;
  onConfirm: (plannedService: PlannedService) => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for deleting a planned service assignment
 * Uses portal to render above all other content
 */
export function DeleteConfirmationModal({
  isOpen,
  plannedService,
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
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
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
          aria-label="Cerrar"
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
              Confirmar eliminación
            </h3>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 whitespace-nowrap">
            ¿Eliminar la asignación del servicio{" "}
            <span className="font-mono font-bold text-gray-900 dark:text-white">
              {plannedService.service.id}
            </span>
            ?
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
              Cancelar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Delete button clicked, calling onConfirm with", plannedService);
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
              Eliminar
            </button>
          </div>
        </div>
    </dialog>,
    document.body
  );
}
