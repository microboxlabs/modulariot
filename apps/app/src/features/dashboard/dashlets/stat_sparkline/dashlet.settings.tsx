"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  HbTextFieldList,
  SettingsTextField,
  PgrestDataTab,
  useSimplePgrestSettings,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";
import { tr } from "@/features/i18n/tr.service";

const FIELDS = [
  { id: "sk-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Page Views" },
  { id: "sk-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "24567" },
  { id: "sk-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
] as const;

const FIELD_NAMES = ["title", "value", "unit"] as const;

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
  const [value, setValue] = useState(String(config.value ?? "24567"));
  const [unit, setUnit] = useState(config.unit ?? "");
  const [sparklineText, setSparklineText] = useState(
    (config.sparkline || [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90]).join(
      ", "
    )
  );

  const fieldValues = { title, value, unit };
  const fieldSetters = { title: setTitle, value: setValue, unit: setUnit };

  const {
    isPgrest,
    activeProviders,
    dataMode,
    dataSourceId,
    setDataSourceId,
    pg,
    handleDataModeChange,
    pgrestSaveFields,
  } = useSimplePgrestSettings({
    config,
    fieldNames: FIELD_NAMES,
    fieldValues,
    fieldSetters,
  });

  const handleSave = () => {
    const sparkline = sparklineText
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    onSave({
      title: title.trim() || "Page Views",
      value: value.trim() || "24567",
      unit: unit.trim(),
      sparkline: sparkline.length > 0 ? sparkline : [50, 50],
      ...pgrestSaveFields,
    });
    onClose();
  };

  const visualizationTab = (
    <>
      <HbTextFieldList
        fields={FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
      />
      <SettingsTextField
        id="sparkline"
        label={tr("dashboard.settings.sparklineData", dictionary)}
        value={sparklineText}
        onChange={setSparklineText}
        placeholder="30, 45, 50, 60..."
      />
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="sk-data-mode"
      dataMode={dataMode}
      onDataModeChange={handleDataModeChange}
      pgrest={pg}
      dictionary={dictionary}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={setDataSourceId}
      activeProviders={activeProviders}
    />
  );

  return (
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
    />
  );
}
