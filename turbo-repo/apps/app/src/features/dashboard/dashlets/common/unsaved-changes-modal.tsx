"use client";

import { Button, Modal, ModalBody } from "flowbite-react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  /** Close the modal (return to settings) */
  onKeepEditing: () => void;
  /** Discard changes and close the settings drawer */
  onDiscard: () => void;
  /** Save changes and close — only shown when provided */
  onSaveAndClose?: () => void;
  dictionary: I18nRecord;
}

const stopEvent = (e: React.MouseEvent) => {
  e.stopPropagation();
};

/** Theme override to render the modal above the settings drawer (z-[800]) */
const modalTheme = {
  root: {
    base: "fixed inset-x-0 top-0 z-[900] h-screen overflow-y-auto overflow-x-hidden md:inset-0 md:h-full",
    show: { on: "flex bg-gray-900/50 dark:bg-gray-900/80", off: "hidden" },
  },
  content: {
    inner:
      "relative flex max-h-[90vh] flex-col rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg",
  },
};

/**
 * Confirmation modal shown when closing dashlet settings with unsaved changes.
 * Three actions: "Keep editing", "Discard changes", and optionally "Save & close".
 * Uses portal to escape draggable containers, same pattern as ConfirmModal.
 */
export function UnsavedChangesModal({
  isOpen,
  onKeepEditing,
  onDiscard,
  onSaveAndClose,
  dictionary,
}: Readonly<UnsavedChangesModalProps>) {
  if (!isOpen) return null;

  return (
    <Modal
      show={isOpen}
      size="lg"
      onClose={onKeepEditing}
      popup
      dismissible={false}
      theme={modalTheme}
    >
      <ModalBody
        className="no-drag p-5"
        onClick={stopEvent}
        onMouseDown={stopEvent}
      >
        <div className="flex items-center gap-2 mb-2">
          <HiOutlineExclamationCircle className="h-6 w-6 shrink-0 text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("dashboard.settings.unsavedChanges.title", dictionary)}
          </h3>
        </div>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {tr("dashboard.settings.unsavedChanges.description", dictionary)}
        </p>
        <div className="flex items-center justify-between gap-6 whitespace-nowrap">
          <Button
            size="xs"
            color="alternative"
            onClick={(e: React.MouseEvent) => {
              stopEvent(e);
              onKeepEditing();
            }}
            onMouseDown={stopEvent}
            className="no-drag"
          >
            {tr("dashboard.settings.unsavedChanges.keepEditing", dictionary)}
          </Button>
          <div className="flex gap-2">
            <Button
              size="xs"
              color="red"
              onClick={(e: React.MouseEvent) => {
                stopEvent(e);
                onDiscard();
              }}
              onMouseDown={stopEvent}
              className="no-drag"
            >
              {tr("dashboard.settings.unsavedChanges.discard", dictionary)}
            </Button>
            {onSaveAndClose && (
              <Button
                size="xs"
                color="blue"
                onClick={(e: React.MouseEvent) => {
                  stopEvent(e);
                  onSaveAndClose();
                }}
                onMouseDown={stopEvent}
                className="no-drag"
              >
                {tr(
                  "dashboard.settings.unsavedChanges.saveAndClose",
                  dictionary
                )}
              </Button>
            )}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
