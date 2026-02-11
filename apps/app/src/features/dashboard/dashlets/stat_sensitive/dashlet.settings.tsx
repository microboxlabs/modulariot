"use client";

import { useState } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsNumberField,
  SettingsFieldGrid,
} from "../common";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Account Balance");
  const [value, setValue] = useState(typedConfig.value || 125847.32);
  const [unit, setUnit] = useState(typedConfig.unit || "$");
  const [isSensitive, setIsSensitive] = useState(
    typedConfig.isSensitive ?? true
  );

  const handleSave = () => {
    onSave({ title, value, unit, isSensitive });
    onClose();
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsTextField
        id="title"
        label="Title"
        value={title}
        onChange={setTitle}
      />
      <SettingsFieldGrid cols={2}>
        <SettingsNumberField
          id="value"
          label="Value"
          value={value}
          onChange={setValue}
          step="0.01"
        />
        <SettingsTextField
          id="unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
        />
      </SettingsFieldGrid>
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
