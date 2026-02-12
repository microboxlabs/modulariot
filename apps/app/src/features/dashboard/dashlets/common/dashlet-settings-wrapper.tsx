"use client";

import { Button } from "flowbite-react";
import { createPortal } from "react-dom";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

type ModalWidth = "w-72" | "w-80" | "w-96";

interface DashletSettingsWrapperProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when save button is clicked */
  onSave: () => void;
  /** Modal width class */
  width?: ModalWidth;
  /** Whether content should be scrollable */
  scrollable?: boolean;
  /** Whether to show the cancel button */
  showCancelButton?: boolean;
  /** Child form content */
  children: React.ReactNode;
  /** Dictionary for internationalization */
  dictionary: I18nRecord;
}

/**
 * Wrapper component for dashlet settings modals.
 * Provides consistent modal styling, portal rendering, and Cancel/Save buttons.
 */
export function DashletSettingsWrapper({
  isOpen,
  onClose,
  onSave,
  width = "w-72",
  scrollable = false,
  showCancelButton = true,
  children,
  dictionary,
}: Readonly<DashletSettingsWrapperProps>) {
  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  if (globalThis.window === undefined) return null;

  const contentClass = scrollable
    ? "flex max-h-[70vh] flex-col gap-3 overflow-y-auto"
    : "flex flex-col gap-3";

  const cancelLabel = tr("common.cancel", dictionary);
  const saveLabel = tr("common.save", dictionary);

  return createPortal(
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => !s && onClose()}
      className={`no-drag ${width} rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800`}
    >
      <div className={contentClass}>
        {children}
        <div className="flex gap-2 pt-2">
          {showCancelButton && (
            <Button
              color="gray"
              onClick={onClose}
              onMouseDown={handleMouseDown}
              size="sm"
              className="no-drag w-full"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            color="blue"
            onClick={onSave}
            onMouseDown={handleMouseDown}
            size="sm"
            className="no-drag w-full"
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </AbsoluteModal>,
    document.body
  );
}
