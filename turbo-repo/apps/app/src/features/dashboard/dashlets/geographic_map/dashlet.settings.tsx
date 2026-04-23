"use client";

import { useState, useEffect } from "react";
import { ToggleSwitch, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
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
  widgetId,
  dashletName,
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

  const isDirty = useSettingsDirty(isOpen, { showFilters, showStyleSelector });

  const handleSave = () => {
    onSave({
      showFilters,
      showStyleSelector,
    });
    onClose();
  };

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {tr("dashboard.settings.mapSettings", dictionary)}
      </h3>

      {/* Show Filters Toggle */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="show-filters"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          {tr("dashboard.settings.showFilters", dictionary)}
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
          {tr("dashboard.settings.showStyleSelector", dictionary)}
        </Label>
        <ToggleSwitch
          id="show-style-selector"
          checked={showStyleSelector}
          onChange={setShowStyleSelector}
        />
      </div>
    </SettingsShell>
  );
}
