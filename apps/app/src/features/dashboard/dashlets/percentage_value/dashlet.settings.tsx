"use client";

import { useRef, useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  HbTextFieldList,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

type SimpleDataMode = "static" | "pgrest";

/** Field config for the three percentage_value text fields */
const PERCENTAGE_FIELDS = [
  { id: "pv-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Progress" },
  { id: "pv-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "6" },
  { id: "pv-max", labelKey: "common.max", state: "max", hbPlaceholder: "{{row.total}}", staticPlaceholder: "10" },
] as const;

/**
 * Settings Modal for Percentage Value Dashlet
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [title, setTitle] = useState(config.title || "Progress");
  const [value, setValue] = useState(String(config.value ?? "6"));
  const [max, setMax] = useState(String(config.max ?? "10"));
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );

  // Snapshot of static field values, saved when entering pgrest mode
  const staticSnapshot = useRef({ title: title, value: value, max: max });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      // Entering pgrest: save current static values
      staticSnapshot.current = { title, value, max };
    } else if (mode === "static" && dataMode === "pgrest") {
      // Leaving pgrest: restore static values
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setMax(staticSnapshot.current.max);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(config, (detected) => {
      if (detected.length >= 1) {
        setTitle(`{{row.${detected[0].key}}}`);
      }
      if (detected.length >= 2) {
        setValue(`{{row.${detected[1].key}}}`);
      }
      if (detected.length >= 3) {
        setMax(`{{row.${detected[2].key}}}`);
      }
    }),
  });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Progress",
      value: value.trim() || "6",
      max: max.trim() || "10",
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { title, value, max };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    max: setMax,
  };

  const visualizationTab = (
    <HbTextFieldList
      fields={PERCENTAGE_FIELDS}
      fieldValues={fieldValues}
      fieldSetters={fieldSetters}
      isPgrest={isPgrest}
      dictionary={dictionary}
    />
  );

  const dataTab = (
    <PgrestDataTab
      id="pv-data-mode"
      dataMode={dataMode}
      onDataModeChange={handleDataModeChange}
      pgrest={pg}
      dictionary={dictionary}
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
