"use client";

import { ReactNode } from "react";
import {
  Modal,
  ModalBody,
  ModalFooter,
  Button,
  Alert,
} from "flowbite-react";
import { ErrorWithAlfrescoError } from "@/features/task-forms/components/task-confirm-modal/task-confirm-modal.types";
import { ErrorAlert } from "@/features/task-forms/components/error-alert";

export type FormModalProps = Readonly<{
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal subtitle (optional) */
  subtitle?: string;
  /** Modal content */
  children: ReactNode;
  /** Submit button label */
  submitLabel: string;
  /** Cancel button label (optional, defaults to "Cancel") */
  cancelLabel?: string;
  /** Whether form is processing */
  isProcessing?: boolean;
  /** Error to display (supports both generic Error and Alfresco-specific errors) */
  error?: Error | ErrorWithAlfrescoError | null;
  /** Form submit handler */
  onSubmit: () => void;
  /** Modal size */
  size?:
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl";
  /** Whether to show cancel button */
  showCancelButton?: boolean;
  /** Whether to show the close (X) button in the header */
  showHeaderClose?: boolean;
}>;

/**
 * Check if error is an Alfresco-specific error
 */
function isAlfrescoError(
  error: Error | ErrorWithAlfrescoError
): error is ErrorWithAlfrescoError {
  return (
    "info" in error && typeof error.info === "object" && error.info !== null
  );
}

/**
 * FormModal - A standardized modal shell for forms.
 *
 * This component provides a consistent look and feel matching the task transition modal.
 * Use this as the base for any form modal in the application.
 */
export default function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  submitLabel,
  cancelLabel = "Cancelar",
  isProcessing = false,
  error = null,
  onSubmit,
  size = "4xl",
  showCancelButton = false,
  showHeaderClose = false,
}: FormModalProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Modal dismissible show={isOpen} onClose={onClose} size={size}>
      <form onSubmit={handleSubmit}>
        {/* Plain div instead of flowbite's <ModalHeader> — ModalHeader renders
            a built-in close (X) button that the app's modal convention doesn't
            use by default. Exit is via the Cancel/Close button in the footer
            unless `showHeaderClose` is set. The dark: classes restore the
            contrast that ModalHeader provided implicitly. */}
        <div className="flex items-start justify-between p-4 md:p-5">
          <div className="flex flex-col items-start">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {showHeaderClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
            >
              <svg
                aria-hidden="true"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 14 14"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                />
              </svg>
            </button>
          )}
        </div>
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col my-4">{children}</div>
          {error && (
            <div className="mt-4 mb-4 space-y-2">
              {isAlfrescoError(error) ? (
                <ErrorAlert error={error} />
              ) : (
                <Alert color="red">{error.message}</Alert>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter className="border-none">
          <div className="flex w-full justify-end gap-2">
            {showCancelButton && (
              <Button color="gray" onClick={onClose} disabled={isProcessing}>
                {cancelLabel}
              </Button>
            )}
            <Button
              color="blue"
              type="submit"
              disabled={isProcessing}
            >
              {submitLabel}
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
