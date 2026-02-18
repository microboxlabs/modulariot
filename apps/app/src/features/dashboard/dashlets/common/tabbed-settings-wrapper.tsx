"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button, TextInput } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { UseDataProviderReturn } from "./use-data-provider";

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
}

// ============================================================================
// Private sub-components
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
      )}
    >
      {children}
    </button>
  );
}

function DataProviderTab({
  dataProvider,
  dictionary,
}: {
  dataProvider: UseDataProviderReturn;
  dictionary: I18nRecord;
}) {
  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.defineVariablesHint", dictionary, {
          code: "{{data_provider.key}}",
        })}
      </p>
      <div className="space-y-2">
        {dataProvider.dataProvider.map((entry, i) => (
          <div
            key={entry._id}
            className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
          >
            <TextInput
              value={entry.key}
              onChange={(e) =>
                dataProvider.updateEntry(i, "key", e.target.value)
              }
              placeholder={tr("dashboard.settings.key", dictionary)}
              sizing="sm"
              className="flex-1"
            />
            <TextInput
              value={entry.value}
              onChange={(e) =>
                dataProvider.updateEntry(i, "value", e.target.value)
              }
              placeholder={tr("common.value", dictionary)}
              sizing="sm"
              className="flex-1"
            />
            <Button
              size="xs"
              color="failure"
              onClick={() => dataProvider.removeEntry(i)}
              onMouseDown={handleMouseDown}
              className="no-drag shrink-0"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button
        size="xs"
        color="light"
        onClick={dataProvider.addEntry}
        onMouseDown={handleMouseDown}
        className="no-drag w-full"
      >
        {tr("dashboard.settings.addEntry", dictionary)}
      </Button>
    </>
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
}: Readonly<TabbedSettingsWrapperProps>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(s) => {
        if (!s) onClose();
      }}
      className="no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full flex-col gap-3 max-h-[70vh]">
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
            <DataProviderTab
              dataProvider={dataProvider}
              dictionary={dictionary}
            />
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
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
