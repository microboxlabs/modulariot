"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, ColorTheme, IconType } from "./dashlet";
import type { ColorOption } from "@/features/common/components/color-picker-dropdown";
import {
  HbTextFieldList,
  usePgrestSettingsState,
  PgrestDataTab,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  IconColorPickerRow,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

type LabeledDataMode = "static" | "pgrest" | "planner";

/** Color options for ColorPickerDropdown */
const COLOR_OPTIONS: ColorOption<ColorTheme>[] = [
  { value: "gray", label: "Gray", dotClass: "bg-gray-500" },
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-500" },
  { value: "teal", label: "Teal", dotClass: "bg-teal-500" },
  { value: "orange", label: "Orange", dotClass: "bg-orange-500" },
];

/** Field config for the two labeled data text fields */
const LABELED_DATA_FIELDS = [
  { id: "dashlet-name", labelKey: "common.label", state: "name", hbPlaceholder: "{{row.metric_name}}", staticPlaceholder: "Enter label..." },
  { id: "dashlet-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.total}}", staticPlaceholder: "Enter value..." },
] as const;

/**
 * Settings Modal
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [name, setName] = useState(config.name || "Metric");
  const [value, setValue] = useState(config.value || "0");
  const [color, setColor] = useState<ColorTheme>(config.color || "gray");
  const [icon, setIcon] = useState<IconType>(config.icon || "chart");
  const [dataMode, setDataMode] = useState<LabeledDataMode>(
    config.dataMode || "static"
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(config, (detected) => {
      if (detected.length >= 1) {
        setName(`{{row.${detected[0].key}}}`);
      }
      if (detected.length >= 2) {
        setValue(`{{row.${detected[1].key}}}`);
      }
    }),
  });

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      color,
      icon,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      plannerVariableName: dataMode === "planner" ? plannerVariableName : undefined,
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { name, value };
  const fieldSetters: Record<string, (v: string) => void> = {
    name: setName,
    value: setValue,
  };

  const visualizationTab = (
    <>
      <HbTextFieldList
        fields={LABELED_DATA_FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
      />
      <IconColorPickerRow
        icon={icon}
        onIconChange={setIcon}
        colorOptions={COLOR_OPTIONS}
        color={color}
        onColorChange={setColor}
        dictionary={dictionary}
      />
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="labeled-data-mode"
      dataMode={dataMode}
      onDataModeChange={(v) => setDataMode(v as LabeledDataMode)}
      pgrest={pg}
      dictionary={dictionary}
      plannerVariableName={plannerVariableName}
      onPlannerVariableNameChange={setPlannerVariableName}
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
