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
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";

type SimpleDataMode = "static" | "pgrest";

const FIELDS = [
  { id: "sd-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Monthly Revenue" },
  { id: "sd-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "84500" },
  { id: "sd-prev", labelKey: "common.previousValue", state: "previousValue", hbPlaceholder: "{{row.previous}}", staticPlaceholder: "72000" },
  { id: "sd-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "$" },
  { id: "sd-desc", labelKey: "common.description", state: "description", hbPlaceholder: "{{row.description}}", staticPlaceholder: "Total monthly revenue across all products" },
  { id: "sd-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100000" },
] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);
  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true
  );

  const [title, setTitle] = useState(config.title || "Monthly Revenue");
  const [value, setValue] = useState(String(config.value ?? "84500"));
  const [previousValue, setPreviousValue] = useState(String(config.previousValue ?? "72000"));
  const [unit, setUnit] = useState(config.unit ?? "$");
  const [description, setDescription] = useState(config.description || "Total monthly revenue across all products");
  const [target, setTarget] = useState(String(config.target ?? "100000"));
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const staticSnapshot = useRef({ title, value, previousValue, unit, description, target });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, previousValue, unit, description, target };
    } else if (mode === "static" && dataMode === "pgrest") {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setPreviousValue(staticSnapshot.current.previousValue);
      setUnit(staticSnapshot.current.unit);
      setDescription(staticSnapshot.current.description);
      setTarget(staticSnapshot.current.target);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setPreviousValue(`{{row.${detected[2].key}}}`);
      if (detected.length >= 4) setUnit(`{{row.${detected[3].key}}}`);
      if (detected.length >= 5) setDescription(`{{row.${detected[4].key}}}`);
      if (detected.length >= 6) setTarget(`{{row.${detected[5].key}}}`);
    }),
  });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Monthly Revenue",
      value: value.trim() || "84500",
      previousValue: previousValue.trim() || "72000",
      unit: unit.trim() || "$",
      description: description.trim(),
      target: target.trim() || "100000",
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { title, value, previousValue, unit, description, target };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    previousValue: setPreviousValue,
    unit: setUnit,
    description: setDescription,
    target: setTarget,
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
