"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type {
  DashletConfig,
  StatusColor,
  StatusIcon,
} from "./dashlet";
import { ICON_OPTIONS, COLOR_OPTIONS } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import {
  SettingsSelectField,
  HbTextField,
  useDataProvider,
  TabbedSettingsWrapper,
} from "../common";

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

  const dp = useDataProvider(config.dataProvider ?? []);

  const handleSave = () => {
    onSave({
      title,
      value,
      subtitle,
      color,
      icon,
      dataProvider: dp.getCleanEntries(),
    } as DashletConfig);
    onClose();
  };

  return (
    <TabbedSettingsWrapper
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dataProvider={dp}
      dictionary={dictionary}
    >
      <HbTextField
        id="ss-title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder="Status"
      />
      <HbTextField
        id="ss-value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder="0"
      />
      <HbTextField
        id="ss-subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
        placeholder="e.g. 204 de 230 dispositivos"
      />
      <SettingsSelectField
        id="ss-color"
        label="Color"
        value={color}
        onChange={(v) => setColor(v as StatusColor)}
        options={COLOR_OPTIONS.map((c) => ({ value: c.id, label: c.label }))}
      />
      <SettingsSelectField
        id="ss-icon"
        label="Icon"
        value={icon}
        onChange={(v) => setIcon(v as StatusIcon)}
        options={ICON_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
      />
    </TabbedSettingsWrapper>
  );
}
