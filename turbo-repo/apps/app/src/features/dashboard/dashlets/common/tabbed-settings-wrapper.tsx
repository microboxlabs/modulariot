"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SettingsDrawer } from "./settings-drawer";
import type { UseDataProviderReturn } from "./use-data-provider";
import { DataProviderEntries } from "./data-provider-entries";
import { SettingsTabButton } from "./settings-tab-button";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

interface TabbedSettingsWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  dataProvider: UseDataProviderReturn;
  dictionary: I18nRecord;
  children: ReactNode;
  /** Content rendered when planner mode is selected */
  plannerContent?: ReactNode;
  /** Optional title shown in the header */
  title?: string;
  /** Widget ID for anchor navigation */
  widgetId?: string;
}

// ============================================================================
// TabbedSettingsWrapper
// ============================================================================

export function TabbedSettingsWrapper({
  isOpen,
  onClose,
  onSave,
  dataProvider,
  dictionary,
  children,
  plannerContent,
  title,
  widgetId,
}: Readonly<TabbedSettingsWrapperProps>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <SettingsDrawer
      open={isOpen}
      onClose={onClose}
      title={title}
      widgetId={widgetId}
      dictionary={dictionary}
    >
      <div className="flex h-full flex-col gap-3">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <SettingsTabButton
            active={activeTab === "visualization"}
            onClick={() => setActiveTab("visualization")}
          >
            {tr("dashboard.settings.visualization", dictionary)}
          </SettingsTabButton>
          <SettingsTabButton
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </SettingsTabButton>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeTab === "visualization" ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("dashboard.settings.dynamicValuesHint", dictionary, {
                  code: "{{data_provider.key}}",
                })}
              </p>
              {children}
            </>
          ) : (
            <>
              <DataProviderEntries
                dataProvider={dataProvider}
                dictionary={dictionary}
              />
              {plannerContent}
            </>
          )}
        </div>

        {/* Save */}
        <Button
          onClick={onSave}
          onMouseDown={handleMouseDown}
          size="sm"
          className="w-full"
        >
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </SettingsDrawer>
  );
}
