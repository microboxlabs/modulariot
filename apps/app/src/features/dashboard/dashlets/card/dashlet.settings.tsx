"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, CardBackgroundColor, CardIcon } from "./dashlet";
import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown";
import { tr } from "@/features/i18n/tr.service";
import {
  SettingsPickerRow,
  SettingsPickerItem,
  SettingsSelectField,
  HbTextField,
  usePgrestSettingsState,
  PgrestSettingsSection,
  fromPgrestParamItems,
  humanizeKey,
  buildPgrestContentLabels,
} from "../common";
import { DASHLET_ICON_OPTIONS } from "../common/icon-options";
import { SettingsModalShell } from "../common/settings-modal-shell";

type CardDataMode = "static" | "pgrest";

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

const ICON_OPTIONS = DASHLET_ICON_OPTIONS;

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

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestParams: config.pgrestParams || [],
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    onColumnsDetected: (keys) =>
      keys.map((key, i) => ({
        _id: `col-${Date.now()}-${i}`,
        key,
        label: humanizeKey(key),
        type: "text" as const,
      })),
    setColumns: () => {},
    onDetectionComplete: (detected) => {
      // Auto-fill name/value/descriptor with first detected keys
      if (detected.length >= 1) {
        setName(`{{row.${detected[0].key}}}`);
      }
      if (detected.length >= 2) {
        setValue(`{{row.${detected[1].key}}}`);
      }
      if (detected.length >= 3) {
        setDescriptor(`{{row.${detected[2].key}}}`);
      }
    },
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
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { name, value, descriptor };
  const fieldSetters: Record<string, (v: string) => void> = {
    name: setName,
    value: setValue,
    descriptor: setDescriptor,
  };

  const visualizationTab = (
    <>
      {CARD_FIELDS.map((f) => (
        <HbTextField
          key={f.id}
          id={f.id}
          label={tr(f.labelKey, dictionary)}
          value={fieldValues[f.state]}
          onChange={fieldSetters[f.state]}
          placeholder={isPgrest ? f.hbPlaceholder : f.staticPlaceholder}
        />
      ))}
      <SettingsPickerRow>
        <SettingsPickerItem label={tr("dashboard.settings.icon", dictionary)}>
          <IconPickerDropdown
            options={ICON_OPTIONS}
            value={icon}
            onChange={setIcon}
            title={tr("dashboard.settings.icon", dictionary)}
          />
        </SettingsPickerItem>
        <SettingsPickerItem label={tr("dashboard.settings.color", dictionary)}>
          <ColorPickerDropdown
            options={BG_COLOR_OPTIONS}
            value={backgroundColor}
            onChange={setBackgroundColor}
            title={tr("dashboard.settings.color", dictionary)}
          />
        </SettingsPickerItem>
      </SettingsPickerRow>
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
        ]}
      />
      {isPgrest && (
        <PgrestSettingsSection
          pgrest={pg}
          dictionary={dictionary}
          labels={buildPgrestContentLabels(dictionary)}
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
    />
  );
}
