"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsNumberField,
  SettingsTextareaField,
  SettingsFieldGrid,
} from "../common";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
}: Readonly<DashletSettingsProps>) {
  const typedConfig = config as unknown as DashletConfig;
  const [title, setTitle] = useState(typedConfig.title || "Monthly Revenue");
  const [value, setValue] = useState(typedConfig.value || 84500);
  const [previousValue, setPreviousValue] = useState(
    typedConfig.previousValue || 72000
  );
  const [unit, setUnit] = useState(typedConfig.unit || "$");
  const [description, setDescription] = useState(typedConfig.description || "");
  const [target, setTarget] = useState(typedConfig.target || 100000);

  const handleSave = () => {
    onSave({ title, value, previousValue, unit, description, target });
    onClose();
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      scrollable
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
          label="Current Value"
          value={value}
          onChange={setValue}
        />
        <SettingsNumberField
          id="prev"
          label="Previous"
          value={previousValue}
          onChange={setPreviousValue}
        />
      </SettingsFieldGrid>
      <SettingsFieldGrid cols={2}>
        <SettingsTextField
          id="unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
        />
        <SettingsNumberField
          id="target"
          label="Target"
          value={target}
          onChange={setTarget}
        />
      </SettingsFieldGrid>
      <SettingsTextareaField
        id="description"
        label="Description"
        value={description}
        onChange={setDescription}
        rows={2}
      />
    </DashletSettingsWrapper>
  );
}
