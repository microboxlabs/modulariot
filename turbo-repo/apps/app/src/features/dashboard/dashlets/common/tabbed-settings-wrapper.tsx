"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SettingsDrawer } from "./settings-drawer";
import type { UseDataProviderReturn } from "./use-data-provider";
import { DataProviderEntries } from "./data-provider-entries";

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
}

// ============================================================================
// Private sub-components
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
        active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
      )}
    >
      {children}
    </button>
  );
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
}: Readonly<TabbedSettingsWrapperProps>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <SettingsDrawer open={isOpen} onClose={onClose} title={title}>
      <div className="flex h-full flex-col gap-3">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <TabButton
            active={activeTab === "visualization"}
            onClick={() => setActiveTab("visualization")}
          >
            {tr("dashboard.settings.visualization", dictionary)}
          </TabButton>
          <TabButton
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </TabButton>
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
