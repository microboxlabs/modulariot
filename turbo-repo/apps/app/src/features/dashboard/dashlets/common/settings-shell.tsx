"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { SettingsPanel } from "@microboxlabs/miot-dashboard-ui/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsDrawer } from "./settings-drawer";
import { useDirtySettings } from "./dirty-settings-context";

// ============================================================================
// Bridge — propagates the externally-computed isDirty flag into the context
// that lives inside SettingsDrawer's DirtySettingsProvider.
// ============================================================================

function DirtyStateBridge({ isDirty }: Readonly<{ isDirty: boolean }>) {
  const { registerDirty } = useDirtySettings();
  useEffect(() => {
    registerDirty(isDirty);
    return () => registerDirty(false);
  }, [isDirty, registerDirty]);
  return null;
}

// ============================================================================
// Types
// ============================================================================

export interface SettingsTab {
  /** Unique identifier for the tab */
  id: string;
  /** Display label (already translated) */
  label: string;
  /** Tab panel content */
  content: ReactNode;
}

export interface SettingsShellProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Callback when save button is clicked */
  onSave: () => void;
  /** Dictionary for internationalization */
  dictionary: I18nRecord;
  /**
   * Tabbed layout: pass an array of tabs.
   * When provided, `children` is ignored.
   */
  tabs?: SettingsTab[];
  /**
   * Single-pane layout: pass content directly.
   * Only used when `tabs` is not provided.
   */
  children?: ReactNode;
  /** Content rendered above the save button (e.g. refresh interval select) */
  footer?: ReactNode;
  /** Drawer width override */
  className?: string;
  /** Title in the drawer header */
  title?: string;
  /** Widget ID for anchor link */
  widgetId?: string;
  /** Whether the settings form has unsaved changes */
  isDirty?: boolean;
  /** className applied to the scrollable content area (default: "p-4") */
  contentClassName?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Builds the standard visualization + data provider tabs used by most dashlet settings.
 * Eliminates the duplicated tabs array construction across dashlet files.
 */
export function buildStandardTabs(
  dictionary: I18nRecord,
  visualizationTab: ReactNode,
  dataTab: ReactNode
): SettingsTab[] {
  return [
    {
      id: "visualization",
      label: tr("dashboard.settings.visualization", dictionary),
      content: visualizationTab,
    },
    {
      id: "data",
      label: tr("dashboard.settings.dataProvider", dictionary),
      content: dataTab,
    },
  ];
}

/**
 * Unified settings shell for all dashlet settings.
 *
 * Supports two layout modes:
 * - **Tabbed**: pass `tabs` array → renders tab bar + active panel
 * - **Single-pane**: pass `children` → renders content directly
 *
 * Automatically integrates with DirtySettingsContext (provided by SettingsDrawer):
 * - Disables Save button when no changes have been made
 * - Registers onSave as save-and-close for the unsaved-changes modal
 */
export function SettingsShell({
  isOpen,
  onClose,
  onSave,
  dictionary,
  tabs,
  children,
  footer,
  className,
  title,
  widgetId,
  isDirty = false,
  contentClassName,
}: Readonly<SettingsShellProps>) {
  return (
    <SettingsDrawer
      open={isOpen}
      onClose={onClose}
      className={className}
      title={title}
      widgetId={widgetId}
      dictionary={dictionary}
    >
      <DirtyStateBridge isDirty={isDirty} />
      <SettingsShellContent
        onSave={onSave}
        dictionary={dictionary}
        tabs={tabs}
        footer={footer}
        contentClassName={contentClassName}
      >
        {children}
      </SettingsShellContent>
    </SettingsDrawer>
  );
}

// ============================================================================
// Inner content — reads context for dirty state + registers save callback
// ============================================================================

interface SettingsShellContentProps {
  onSave: () => void;
  dictionary: I18nRecord;
  tabs?: SettingsTab[];
  children?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
}

function SettingsShellContent({
  onSave,
  dictionary,
  tabs,
  children,
  footer,
  contentClassName = "p-4",
}: Readonly<SettingsShellContentProps>) {
  const { isDirty, registerSaveAndClose } = useDirtySettings();
  useEffect(() => {
    registerSaveAndClose(onSave);
    return () => registerSaveAndClose(undefined);
  }, [onSave, registerSaveAndClose]);
  return (
    <SettingsPanel
      tabs={tabs}
      tabsLabel={tr("dashboard.settings.visualization", dictionary)}
      saveLabel={tr("common.save", dictionary)}
      onSave={onSave}
      isDirty={isDirty}
      footer={footer}
      contentClassName={contentClassName}
    >
      {children}
    </SettingsPanel>
  );
}
