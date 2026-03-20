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
  useActiveProviders,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

type SimpleDataMode = "static" | "pgrest";

const FIELDS = [
  { id: "si-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Orders" },
  { id: "si-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.count}}", staticPlaceholder: "156" },
  { id: "si-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "" },
  { id: "si-subtitle", labelKey: "common.subtitle", state: "subtitle", hbPlaceholder: "{{row.subtitle}}", staticPlaceholder: "Last 24 hours" },
] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const [title, setTitle] = useState(config.title || "Orders");
  const [value, setValue] = useState(String(config.value ?? "156"));
  const [unit, setUnit] = useState(config.unit ?? "");
  const [subtitle, setSubtitle] = useState(config.subtitle || "Last 24 hours");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const staticSnapshot = useRef({ title, value, unit, subtitle });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, unit, subtitle };
    } else if (mode === "static" && dataMode === "pgrest") {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setUnit(staticSnapshot.current.unit);
      setSubtitle(staticSnapshot.current.subtitle);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setUnit(`{{row.${detected[2].key}}}`);
      if (detected.length >= 4) setSubtitle(`{{row.${detected[3].key}}}`);
    }),
  });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Orders",
      value: value.trim() || "156",
      unit: unit.trim(),
      subtitle: subtitle.trim(),
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { title, value, unit, subtitle };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    unit: setUnit,
    subtitle: setSubtitle,
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
