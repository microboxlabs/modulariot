"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsTitleValueUnit,
} from "../common";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Orders");
  const [value, setValue] = useState(config.value || 156);
  const [unit, setUnit] = useState(config.unit || "");
  const [subtitle, setSubtitle] = useState(config.subtitle || "Last 24 hours");

  const handleSave = () => {
    onSave({ title, value, unit, subtitle });
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
        dictionary={dictionary}
      />
      <SettingsTextField
        id="subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
      />
    </DashletSettingsWrapper>
  );
}
