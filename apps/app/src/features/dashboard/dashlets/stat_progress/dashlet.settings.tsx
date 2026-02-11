"use client";

import { useState } from "react";
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
}: Readonly<DashletSettingsProps>) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Quarterly Goal");
  const [value, setValue] = useState(typedConfig.value || 78);
  const [target, setTarget] = useState(typedConfig.target || 100);
  const [unit, setUnit] = useState(typedConfig.unit || "%");

  const handleSave = () => {
    onSave({ title, value, target, unit });
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
      <SettingsFieldGrid cols={3}>
        <SettingsNumberField
          id="value"
          label="Value"
          value={value}
          onChange={setValue}
        />
        <SettingsNumberField
          id="target"
          label="Target"
          value={target}
          onChange={setTarget}
        />
        <SettingsTextField
          id="unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
        />
      </SettingsFieldGrid>
    </DashletSettingsWrapper>
  );
}
