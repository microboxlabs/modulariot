"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { HiXMark, HiClipboardDocument, HiCheck } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import {
  DirtySettingsProvider,
  useDirtySettings,
} from "./dirty-settings-context";
import { UnsavedChangesModal } from "./unsaved-changes-modal";

interface SettingsDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Optional title shown in the header */
  title?: string;
  /** Optional class override for the panel (e.g. width) */
  className?: string;
  /** Drawer content */
  children: ReactNode;
  /** Widget ID for anchor navigation (displayed automatically at top) */
  widgetId?: string;
  /** i18n dictionary for translations */
  dictionary?: I18nRecord;
}

/**
 * Right-side sliding drawer for dashlet settings.
 * Renders via portal to document.body to escape grid layout z-index.
 * Wraps children in DirtySettingsProvider to enable unsaved-changes tracking.
 */
export function SettingsDrawer({
  open,
  onClose,
  title,
  className,
  children,
  widgetId,
  dictionary,
}: Readonly<SettingsDrawerProps>) {
  if (globalThis.window === undefined) return null;

  return (
    <DirtySettingsProvider>
      <SettingsDrawerInner
        open={open}
        onClose={onClose}
        title={title}
        className={className}
        widgetId={widgetId}
        dictionary={dictionary}
      >
        {children}
      </SettingsDrawerInner>
    </DirtySettingsProvider>
  );
}

// ============================================================================
// Inner component — reads dirty context to intercept close
// ============================================================================

function SettingsDrawerInner({
  open,
  onClose,
  title,
  className,
  children,
  widgetId,
  dictionary,
}: Readonly<SettingsDrawerProps>) {
  const mouseDownOnBackdrop = useRef(false);
  const [copied, setCopied] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const { isDirty, onSaveAndClose } = useDirtySettings();

  /** If dirty, show confirmation modal instead of closing immediately */
  const handleAttemptClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleDiscard = useCallback(() => {
    setShowUnsavedModal(false);
    onClose();
  }, [onClose]);

  const handleSaveAndClose = useCallback(() => {
    setShowUnsavedModal(false);
    onSaveAndClose?.();
  }, [onSaveAndClose]);

  const handleKeepEditing = useCallback(() => {
    setShowUnsavedModal(false);
  }, []);

  const handleCopyAnchor = useCallback(() => {
    if (!widgetId) return;
    const anchor = `#widget-${widgetId}`;
    navigator.clipboard.writeText(anchor).then(() => {
      setCopied(true);
      ShowNotification({
        type: "success",
        message: tr("common.copiedToClipboard", dictionary ?? {}),
      });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [widgetId, dictionary]);

  useEffect(() => {
    if (globalThis.window === undefined || !open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleAttemptClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleAttemptClose]);

  if (globalThis.window === undefined) return null;

  return createPortal(
    <div
      className={twMerge(
        "fixed inset-0 z-[800] transition-all duration-300",
        open ? "visible opacity-100" : "invisible opacity-0"
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={twMerge(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
        onMouseDown={(e) => {
          mouseDownOnBackdrop.current = e.target === e.currentTarget;
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
            handleAttemptClose();
          }
          mouseDownOnBackdrop.current = false;
          e.stopPropagation();
        }}
      />

      <dialog
        open
        aria-modal="true"
        aria-label="Settings"
        className={twMerge(
          "no-drag absolute top-0 right-0 left-auto m-0 flex h-full max-h-full max-w-full flex-col transform border-l border-gray-200 bg-white p-0 shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800",
          open ? "translate-x-0" : "translate-x-full",
          className ?? "w-[28rem]"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700">
          {title && (
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={handleAttemptClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="no-drag cursor-pointer ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <HiXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Widget anchor ID - shown automatically at the top */}
          {widgetId && (
            <div className="p-3 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCopyAnchor}
                title={tr("common.copy", dictionary ?? {})}
                className="flex h-8 w-full cursor-pointer items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <span className="relative h-3.5 w-3.5 shrink-0">
                  <HiClipboardDocument
                    className={twMerge(
                      "absolute inset-0 h-3.5 w-3.5 text-gray-400 transition-all duration-200",
                      copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
                    )}
                  />
                  <HiCheck
                    className={twMerge(
                      "absolute inset-0 h-3.5 w-3.5 text-green-500 transition-all duration-200",
                      copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
                    )}
                  />
                </span>
                <code className="truncate font-mono text-gray-500 dark:text-gray-400">
                  #widget-{widgetId}
                </code>
              </button>
            </div>
          )}
          {open && children}
        </div>
      </dialog>

      {/* Unsaved changes confirmation */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscard}
        onSaveAndClose={onSaveAndClose ? handleSaveAndClose : undefined}
        dictionary={dictionary ?? {}}
      />
    </div>,
    document.body
  );
}
