"use client";

import { useState } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { DashletSettingsWrapper, SettingsTitleValueUnit } from "../common";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Account Balance");
  const [value, setValue] = useState(config.value || 125847.32);
  const [unit, setUnit] = useState(config.unit || "$");
  const [isSensitive, setIsSensitive] = useState(config.isSensitive ?? true);

  const handleSave = () => {
    onSave({ title, value, unit, isSensitive });
    onClose();
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
    >
      <SettingsTitleValueUnit
        title={title}
        onTitleChange={setTitle}
        value={value}
        onValueChange={setValue}
        unit={unit}
        onUnitChange={setUnit}
        valueStep="0.01"
        dictionary={dictionary}
      />
      <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
        <div>
          <Label className="text-sm font-medium">Hidden by default</Label>
          <p className="text-xs text-gray-500">User must click to reveal</p>
        </div>
        <ToggleSwitch
          checked={isSensitive}
          onChange={setIsSensitive}
          label=""
        />
      </div>
    </DashletSettingsWrapper>
  );
}
