"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, CardBackgroundColor, CardIcon } from "./dashlet";
import type { ColorOption } from "@/features/common/components/color-picker-dropdown";
import { tr } from "@/features/i18n/tr.service";
import {
  HbTextFieldList,
  SettingsSelectField,
  usePgrestSettingsState,
  PgrestSettingsSection,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  buildPgrestContentLabels,
  IconColorPickerRow,
  useActiveProviders,
} from "../common";
import { PlannerVariableSelector } from "../common/planner-variable-selector";
import { SettingsModalShell, useWidgetRefreshSettings } from "../common/settings-modal-shell";
import { usePlannerContext } from "../../context/planner-context";

type CardDataMode = "static" | "pgrest" | "planner";

/** Background color options for ColorPickerDropdown */
const BG_COLOR_OPTIONS: ColorOption<CardBackgroundColor>[] = [
  {
    value: "white",
    label: "White",
    dotClass: "bg-white border border-gray-300",
  },
  { value: "gray", label: "Gray", dotClass: "bg-gray-500" },
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-500" },
];

/** Field config for the three card text fields */
const CARD_FIELDS = [
  { id: "card-name", labelKey: "common.label", state: "name", hbPlaceholder: "{{row.metric_name}}", staticPlaceholder: "Enter label..." },
  { id: "card-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.total}}", staticPlaceholder: "Enter value..." },
  { id: "card-descriptor", labelKey: "dashboard.settings.descriptor", state: "descriptor", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "Enter descriptor..." },
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
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);

  const [name, setName] = useState(config.name || "Metric");
  const [value, setValue] = useState(config.value || "0");
  const [descriptor, setDescriptor] = useState(config.descriptor || "");
  const [backgroundColor, setBackgroundColor] = useState<CardBackgroundColor>(
    config.backgroundColor || "white"
  );
  const [icon, setIcon] = useState<CardIcon>(config.icon || "chart");
  const [dataMode, setDataMode] = useState<CardDataMode>(
    config.dataMode || "static"
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const { schemas } = usePlannerContext();
  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) {
        setName(`{{row.${detected[0].key}}}`);
      }
      if (detected.length >= 2) {
        setValue(`{{row.${detected[1].key}}}`);
      }
      if (detected.length >= 3) {
        setDescriptor(`{{row.${detected[2].key}}}`);
      }
    }),
  });

  const handleSave = () => {
    onSave({
      name: name.trim() || "Metric",
      value: value.trim() || "0",
      descriptor: descriptor.trim(),
      backgroundColor,
      icon,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      pgrestPathMode: pg.pgrestPathMode,
      plannerVariableName: dataMode === "planner" ? plannerVariableName : undefined,
      dataSourceId: dataSourceId || undefined,
      ...refresh.savePayload,
    });
    onClose();
  };

  const isPgrest = dataMode !== "static";

  const fieldValues: Record<string, string> = { name, value, descriptor };
  const fieldSetters: Record<string, (v: string) => void> = {
    name: setName,
    value: setValue,
    descriptor: setDescriptor,
  };

  const visualizationTab = (
    <>
      <HbTextFieldList
        fields={CARD_FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
        schemaSuggestions={schemaSuggestions}
      />
      <IconColorPickerRow
        icon={icon}
        onIconChange={setIcon}
        colorOptions={BG_COLOR_OPTIONS}
        color={backgroundColor}
        onColorChange={setBackgroundColor}
        dictionary={dictionary}
      />
    </>

  );

  const dataTab = (
    <>
      <SettingsSelectField
        id="card-data-mode"
        label={tr("dashboard.settings.dataSource", dictionary)}
        value={dataMode}
        onChange={(v) => setDataMode(v as CardDataMode)}
        options={[
          { value: "static", label: tr("dashboard.settings.staticJson", dictionary) },
          { value: "pgrest", label: "PGREST" },
          { value: "planner", label: "Planner" },
        ]}
      />
      {dataMode === "pgrest" && (
        <PgrestSettingsSection
          pgrest={pg}
          dictionary={dictionary}
          labels={buildPgrestContentLabels(dictionary)}
          dataSourceId={dataSourceId}
          onDataSourceIdChange={setDataSourceId}
          activeProviders={activeProviders}
        />
      )}
      {dataMode === "planner" && (
        <PlannerVariableSelector
          label="Variable"
          value={plannerVariableName}
          onChange={setPlannerVariableName}
        />
      )}
    </>
  );

  return (
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
      refreshSelect={refresh.selectNode}
    />
  );
}
