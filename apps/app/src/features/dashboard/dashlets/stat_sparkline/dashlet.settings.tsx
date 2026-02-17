"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  DashletSettingsWrapper,
  SettingsTextField,
  SettingsTitleValueUnit,
} from "../common";
import { tr } from "@/features/i18n/tr.service";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(
    config.title || tr("dashboard.defaults.pageViews", dictionary)
  );
  const [value, setValue] = useState(config.value || 24567);
  const [unit, setUnit] = useState(config.unit || "");
  const [sparklineText, setSparklineText] = useState(
    (config.sparkline || [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90]).join(
      ", "
    )
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
        id="sparkline"
        label={tr("dashboard.settings.sparklineData", dictionary)}
        value={sparklineText}
        onChange={setSparklineText}
        placeholder="30, 45, 50, 60..."
      />
    </DashletSettingsWrapper>
  );
}
