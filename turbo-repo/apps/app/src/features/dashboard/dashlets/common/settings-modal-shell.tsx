"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsDrawer } from "./settings-drawer";
import { RefreshIntervalSelect } from "./refresh-interval-select";

type SettingsTab = "visualization" | "data";

interface SettingsModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  dictionary: I18nRecord;
  /** Content for the visualization tab */
  visualizationTab: ReactNode;
  /** Content for the data provider tab */
  dataTab: ReactNode;
  /** Optional class override for the modal width */
  className?: string;
  /** Optional refresh interval select rendered above the save button (overrides built-in) */
  refreshSelect?: ReactNode;
  /** Optional title shown in the header */
  title?: string;
}

export function SettingsModalShell({
  isOpen,
  onClose,
  onSave,
  dictionary,
  visualizationTab,
  dataTab,
  className,
  refreshSelect,
  title,
}: Readonly<SettingsModalShellProps>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const tabClass = (tab: SettingsTab) =>
    twMerge(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
    );

  return (
    <SettingsDrawer
      open={isOpen}
      onClose={onClose}
      className={className}
      title={title}
    >
      <div className="flex h-full flex-col gap-3">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("visualization")}
            className={tabClass("visualization")}
          >
            {tr("dashboard.settings.visualization", dictionary)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={tabClass("data")}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-3 overflow-y-auto">
          {activeTab === "visualization" ? visualizationTab : dataTab}
        </div>

        {/* Optional refresh interval */}
        {refreshSelect}

        {/* Save button */}
        <Button
          onClick={onSave}
          onMouseDown={handleMouseDown}
          size="sm"
          className="no-drag w-full shrink-0"
        >
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </SettingsDrawer>
  );
}

// ============================================================================
// Hook: per-widget refresh interval state for settings modals
// ============================================================================

/**
 * Manages widget-level refresh interval state and provides props for the
 * RefreshIntervalSelect + the save payload. Use this in any custom settings
 * modal that uses SettingsModalShell directly.
 *
 * Usage:
 * ```ts
 * const refresh = useWidgetRefreshSettings(config);
 * // In save: onSave({ ...myFields, ...refresh.savePayload });
 * // In shell: <SettingsModalShell refreshSelect={refresh.selectNode} ... />
 * ```
 */
export function useWidgetRefreshSettings(
  config: object,
  dictionary: I18nRecord
) {
  const [value, setValue] = useState<number | "inherit">(() => {
    const v = "refreshInterval" in config ? config.refreshInterval : undefined;
    return typeof v === "number" ? v : "inherit";
  });

  const savePayload =
    value === "inherit"
      ? { refreshInterval: undefined }
      : { refreshInterval: value };

  const selectNode = (
    <RefreshIntervalSelect
      value={value}
      onChange={setValue}
      dictionary={dictionary}
    />
  );

  return { value, setValue, savePayload, selectNode };
}
