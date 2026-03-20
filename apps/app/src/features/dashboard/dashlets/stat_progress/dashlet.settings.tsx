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
  { id: "sp-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Quarterly Goal" },
  { id: "sp-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.current}}", staticPlaceholder: "78" },
  { id: "sp-target", labelKey: "common.target", state: "target", hbPlaceholder: "{{row.target}}", staticPlaceholder: "100" },
  { id: "sp-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "%" },
] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const [title, setTitle] = useState(config.title || "Quarterly Goal");
  const [value, setValue] = useState(String(config.value ?? "78"));
  const [target, setTarget] = useState(String(config.target ?? "100"));
  const [unit, setUnit] = useState(config.unit ?? "%");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const staticSnapshot = useRef({ title, value, target, unit });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, target, unit };
    } else if (mode === "static" && dataMode === "pgrest") {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setTarget(staticSnapshot.current.target);
      setUnit(staticSnapshot.current.unit);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setTarget(`{{row.${detected[2].key}}}`);
      if (detected.length >= 4) setUnit(`{{row.${detected[3].key}}}`);
    }),
  });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Quarterly Goal",
      value: value.trim() || "78",
      target: target.trim() || "100",
      unit: unit.trim() || "%",
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    });
    onClose();
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { title, value, target, unit };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    target: setTarget,
    unit: setUnit,
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
      id="sp-data-mode"
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
