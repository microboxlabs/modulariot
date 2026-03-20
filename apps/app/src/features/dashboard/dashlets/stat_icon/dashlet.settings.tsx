"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  HbTextFieldList,
  PgrestDataTab,
  useSimplePgrestSettings,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

const FIELDS = [
  { id: "si-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Orders" },
  { id: "si-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "156" },
  { id: "si-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
  { id: "si-subtitle", labelKey: "common.subtitle", state: "subtitle", hbPlaceholder: "{{row.subtitle}}", staticPlaceholder: "Last 24 hours" },
] as const;

const FIELD_NAMES = ["title", "value", "unit", "subtitle"] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Orders");
  const [value, setValue] = useState(String(config.value ?? "156"));
  const [unit, setUnit] = useState(config.unit ?? "");
  const [subtitle, setSubtitle] = useState(config.subtitle || "Last 24 hours");

  const fieldValues = { title, value, unit, subtitle };
  const fieldSetters = { title: setTitle, value: setValue, unit: setUnit, subtitle: setSubtitle };

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
    onSave({
      title: title.trim() || "Orders",
      value: value.trim() || "156",
      unit: unit.trim(),
      subtitle: subtitle.trim(),
      ...pgrestSaveFields,
    });
    onClose();
  };

  const visualizationTab = (
    <HbTextFieldList
      fields={FIELDS}
      fieldValues={fieldValues}
      fieldSetters={fieldSetters}
      isPgrest={isPgrest}
      dictionary={dictionary}
    />
  );

  const dataTab = (
    <PgrestDataTab
      id="si-data-mode"
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
