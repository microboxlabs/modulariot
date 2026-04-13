"use client";

import { useState, useEffect } from "react";
import { Button, ToggleSwitch, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsDrawer } from "../common/settings-drawer";
import { tr } from "@/features/i18n/tr.service";

/**
 * Geographic Map Dashlet Settings
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [showFilters, setShowFilters] = useState(config.showFilters ?? true);
  const [showStyleSelector, setShowStyleSelector] = useState(
    config.showStyleSelector ?? true
  );

  // Reset state from config when drawer opens or config changes
  useEffect(() => {
    if (isOpen) {
      setShowFilters(config.showFilters ?? true);
      setShowStyleSelector(config.showStyleSelector ?? true);
    }
  }, [isOpen, config.showFilters, config.showStyleSelector]);

  const handleSave = () => {
    onSave({
      showFilters,
      showStyleSelector,
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <SettingsDrawer open={isOpen} onClose={onClose}>
      <div className="flex h-full flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("dashboard.settings.mapSettings", dictionary) || "Map Settings"}
        </h3>

        {/* Show Filters Toggle */}
        <div className="flex items-center justify-between">
          <Label
            htmlFor="show-filters"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {tr("dashboard.settings.showFilters", dictionary) || "Show Filters"}
          </Label>
          <ToggleSwitch
            id="show-filters"
            checked={showFilters}
            onChange={setShowFilters}
          />
        </div>

        {/* Show Style Selector Toggle */}
        <div className="flex items-center justify-between">
          <Label
            htmlFor="show-style-selector"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {tr("dashboard.settings.showStyleSelector", dictionary) ||
              "Show Style Selector"}
          </Label>
          <ToggleSwitch
            id="show-style-selector"
            checked={showStyleSelector}
            onChange={setShowStyleSelector}
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-auto flex w-full justify-end gap-2">
          <Button
            color="gray"
            onClick={onClose}
            className="no-drag w-full"
            onMouseDown={handleMouseDown}
          >
            {tr("common.cancel", dictionary) || "Cancel"}
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            className="no-drag w-full"
            onMouseDown={handleMouseDown}
          >
            {tr("common.save", dictionary) || "Save"}
          </Button>
        </div>
      </div>
    </SettingsDrawer>
  );
}
