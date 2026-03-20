"use client";

import { useState } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  HbTextFieldList,
  PgrestDataTab,
  useSimplePgrestSettings,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

const FIELDS = [
  { id: "ss-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Account Balance" },
  { id: "ss-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.balance}}", staticPlaceholder: "125847.32" },
  { id: "ss-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.currency}}", staticPlaceholder: "$" },
] as const;

const FIELD_NAMES = ["title", "value", "unit"] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Account Balance");
  const [value, setValue] = useState(String(config.value ?? "125847.32"));
  const [unit, setUnit] = useState(config.unit ?? "$");
  const [isSensitive, setIsSensitive] = useState(config.isSensitive ?? true);

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
    onSave({
      title: title.trim() || "Account Balance",
      value: value.trim() || "125847.32",
      unit: unit.trim() || "$",
      isSensitive,
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
      <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
        <div>
          <Label className="text-sm font-medium">Hidden by default</Label>
          <p className="text-xs text-gray-500">User must click to reveal</p>
        </div>
        <ToggleSwitch
          checked={isSensitive}
          onChange={setIsSensitive}
          label=""
        />
      </div>
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="ss-data-mode"
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
