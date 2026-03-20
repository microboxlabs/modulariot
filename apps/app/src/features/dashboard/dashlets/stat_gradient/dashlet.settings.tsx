"use client";

import { useRef, useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, GradientColor } from "./dashlet";
import {
  HbTextFieldList,
  SettingsPickerItem,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";

type SimpleDataMode = "static" | "pgrest";

const COLOR_OPTIONS: ColorOption<GradientColor>[] = [
  { value: "blue", label: "Blue", dotClass: "bg-blue-500" },
  { value: "green", label: "Green", dotClass: "bg-green-500" },
  { value: "red", label: "Red", dotClass: "bg-red-500" },
  { value: "yellow", label: "Yellow", dotClass: "bg-yellow-500" },
  { value: "purple", label: "Purple", dotClass: "bg-purple-500" },
];

const FIELDS = [
  { id: "sg-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Active Users" },
  { id: "sg-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "2847" },
  { id: "sg-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const [title, setTitle] = useState(config.title || "Active Users");
  const [value, setValue] = useState(String(config.value ?? "2847"));
  const [unit, setUnit] = useState(config.unit ?? "");
  const [color, setColor] = useState<GradientColor>(config.color || "blue");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const staticSnapshot = useRef({ title, value, unit });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, unit };
    } else if (mode === "static" && dataMode === "pgrest") {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setUnit(staticSnapshot.current.unit);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setUnit(`{{row.${detected[2].key}}}`);
    }),
  });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Active Users",
      value: value.trim() || "2847",
      unit: unit.trim(),
      color,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { title, value, unit };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    unit: setUnit,
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
      <SettingsPickerItem label="Color">
        <ColorPickerDropdown
          options={COLOR_OPTIONS}
          value={color}
          onChange={setColor}
          title="Select color"
        />
      </SettingsPickerItem>
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="sg-data-mode"
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
