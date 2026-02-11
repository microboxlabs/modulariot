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
}: DashletSettingsProps) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Orders");
  const [value, setValue] = useState(typedConfig.value || 156);
  const [unit, setUnit] = useState(typedConfig.unit || "");
  const [subtitle, setSubtitle] = useState(
    typedConfig.subtitle || "Last 24 hours"
  );

  const handleSave = () => {
    onSave({ title, value, unit, subtitle });
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
        />
        <SettingsTextField
          id="unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
        />
      </SettingsFieldGrid>
      <SettingsTextField
        id="subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
      />
    </DashletSettingsWrapper>
  );
}
