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
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Monthly Revenue");
  const [value, setValue] = useState(config.value || 84500);
  const [previousValue, setPreviousValue] = useState(
    config.previousValue || 72000
  );
  const [unit, setUnit] = useState(config.unit || "$");
  const [description, setDescription] = useState(config.description || "");
  const [target, setTarget] = useState(config.target || 100000);

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
      dictionary={dictionary}
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
