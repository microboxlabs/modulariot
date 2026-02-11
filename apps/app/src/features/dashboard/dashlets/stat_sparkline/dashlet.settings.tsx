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
  const [title, setTitle] = useState(typedConfig.title || "Page Views");
  const [value, setValue] = useState(typedConfig.value || 24567);
  const [unit, setUnit] = useState(typedConfig.unit || "");
  const [sparklineText, setSparklineText] = useState(
    (
      typedConfig.sparkline || [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90]
    ).join(", ")
  );

  const handleSave = () => {
    const sparkline = sparklineText
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    onSave({
      title,
      value,
      unit,
      sparkline: sparkline.length > 0 ? sparkline : [50, 50],
    });
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
        id="sparkline"
        label="Sparkline Data (comma-separated)"
        value={sparklineText}
        onChange={setSparklineText}
        placeholder="30, 45, 50, 60..."
      />
    </DashletSettingsWrapper>
  );
}
