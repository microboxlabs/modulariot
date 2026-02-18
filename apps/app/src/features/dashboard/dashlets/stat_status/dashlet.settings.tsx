"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, StatusColor, StatusIcon } from "./dashlet";
import { ICON_OPTIONS, COLOR_OPTIONS } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsSelectField,
} from "../common";

// ============================================================================
// Settings Component
// ============================================================================

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title ?? "Status");
  const [value, setValue] = useState(config.value ?? "0");
  const [subtitle, setSubtitle] = useState(config.subtitle ?? "");
  const [color, setColor] = useState<StatusColor>(config.color ?? "gray");
  const [icon, setIcon] = useState<StatusIcon>(config.icon ?? "check");

  const handleSave = () => {
    onSave({ title, value, subtitle, color, icon } as DashletConfig);
    onClose();
  };

  return (
    <DashletSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
    >
      <SettingsTextField
        id="stat-status-title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder="Status"
      />
      <SettingsTextField
        id="stat-status-value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder="0"
      />
      <SettingsTextField
        id="stat-status-subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
        placeholder="e.g. 204 de 230 dispositivos"
      />
      <SettingsSelectField
        id="stat-status-color"
        label="Color"
        value={color}
        onChange={(v) => setColor(v as StatusColor)}
        options={COLOR_OPTIONS.map((c) => ({ value: c.id, label: c.label }))}
      />
      <SettingsSelectField
        id="stat-status-icon"
        label="Icon"
        value={icon}
        onChange={(v) => setIcon(v as StatusIcon)}
        options={ICON_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
      />
    </DashletSettingsWrapper>
  );
}
