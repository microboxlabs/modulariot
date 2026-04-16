"use client";

import { Button } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsDrawer } from "./settings-drawer";

interface DashletSettingsWrapperProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Callback when save button is clicked */
  onSave: () => void;
  /** Whether to show the cancel button */
  showCancelButton?: boolean;
  /** Child form content */
  children: React.ReactNode;
  /** Dictionary for internationalization */
  dictionary: I18nRecord;
  /** Optional title shown in the header */
  title?: string;
  /** Widget ID for anchor navigation */
  widgetId?: string;
}

/**
 * Wrapper component for dashlet settings drawers.
 * Provides consistent drawer styling, portal rendering, and Cancel/Save buttons.
 */
export function DashletSettingsWrapper({
  isOpen,
  onClose,
  onSave,
  showCancelButton = true,
  children,
  dictionary,
  title,
  widgetId,
}: Readonly<DashletSettingsWrapperProps>) {
  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const cancelLabel = tr("common.cancel", dictionary);
  const saveLabel = tr("common.save", dictionary);

  return (
    <SettingsDrawer
      open={isOpen}
      onClose={onClose}
      title={title}
      widgetId={widgetId}
    >
      <div className="flex h-full flex-col gap-3">
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
    </SettingsDrawer>
  );
}
