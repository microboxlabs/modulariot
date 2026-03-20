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
  { id: "sd-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Monthly Revenue" },
  { id: "sd-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "84500" },
  { id: "sd-prev", labelKey: "common.previousValue", state: "previousValue", hbPlaceholder: "{{row.previous}}", staticPlaceholder: "72000" },
  { id: "sd-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "$" },
  { id: "sd-desc", labelKey: "common.description", state: "description", hbPlaceholder: "{{row.description}}", staticPlaceholder: "Total monthly revenue across all products" },
  { id: "sd-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100000" },
] as const;

const FIELD_NAMES = ["title", "value", "previousValue", "unit", "description", "target"] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Monthly Revenue");
  const [value, setValue] = useState(String(config.value ?? "84500"));
  const [previousValue, setPreviousValue] = useState(String(config.previousValue ?? "72000"));
  const [unit, setUnit] = useState(config.unit ?? "$");
  const [description, setDescription] = useState(config.description || "Total monthly revenue across all products");
  const [target, setTarget] = useState(String(config.target ?? "100000"));

  const fieldValues = { title, value, previousValue, unit, description, target };
  const fieldSetters = {
    title: setTitle,
    value: setValue,
    previousValue: setPreviousValue,
    unit: setUnit,
    description: setDescription,
    target: setTarget,
  };

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
      title: title.trim() || "Monthly Revenue",
      value: value.trim() || "84500",
      previousValue: previousValue.trim() || "72000",
      unit: unit.trim() || "$",
      description: description.trim(),
      target: target.trim() || "100000",
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
      id="sd-data-mode"
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
