"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";

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
}

export function SettingsModalShell({
  isOpen,
  onClose,
  onSave,
  dictionary,
  visualizationTab,
  dataTab,
  className,
}: Readonly<SettingsModalShellProps>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const tabClass = (tab: SettingsTab) =>
    twMerge(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400",
    );

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className={twMerge(
        "no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800",
        className,
      )}
    >
      <div className="flex w-full max-h-[75vh] flex-col gap-3">
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
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
