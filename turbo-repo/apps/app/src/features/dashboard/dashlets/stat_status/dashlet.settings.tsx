"use client";

import { useRef, useState } from "react";
import type { DashletSettingsProps } from "../types";
import type {
  DashletConfig,
  StatusColor,
  StatusIcon,
} from "./dashlet";
import { ICON_OPTIONS, COLOR_OPTIONS } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import {
  SettingsSelectField,
  HbTextField,
  useDataProvider,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
  DataProviderEntries,
  type SimpleDataMode,
} from "../common";
import { SettingsModalShell, useWidgetRefreshSettings } from "../common/settings-modal-shell";
import { usePlannerContext } from "../../context/planner-context";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();

  const [title, setTitle] = useState(config.title ?? "Status");
  const [value, setValue] = useState(config.value ?? "0");
  const [subtitle, setSubtitle] = useState(config.subtitle ?? "");
  const [color, setColor] = useState<StatusColor>(config.color ?? "gray");
  const [icon, setIcon] = useState<StatusIcon>(config.icon ?? "check");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest" || config.dataMode === "planner"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );

  const dp = useDataProvider(config.dataProvider ?? []);

  const staticSnapshot = useRef({ title, value, subtitle });

  const isRemoteMode = (m: SimpleDataMode) => m === "pgrest" || m === "planner";
  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (isRemoteMode(mode) && dataMode === "static") {
      staticSnapshot.current = { title, value, subtitle };
    } else if (mode === "static" && isRemoteMode(dataMode)) {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setSubtitle(staticSnapshot.current.subtitle);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setSubtitle(`{{row.${detected[2].key}}}`);
    }),
  });

  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const handleSave = () => {
    onSave({
      title,
      value,
      subtitle,
      color,
      icon,
      dataProvider: dp.getCleanEntries(),
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName: dataMode === "planner" ? plannerVariableName : undefined,
      ...refresh.savePayload,
    } as DashletConfig);
    onClose();
  };

  const visualizationTab = (
    <>
      <HbTextField
        id="ss-title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder="Status"
        schemaSuggestions={schemaSuggestions}
      />
      <HbTextField
        id="ss-value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder="0"
        schemaSuggestions={schemaSuggestions}
      />
      <HbTextField
        id="ss-subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
        placeholder="e.g. 204 de 230 dispositivos"
        schemaSuggestions={schemaSuggestions}
      />
      <SettingsSelectField
        id="ss-color"
        label="Color"
        value={color}
        onChange={(v) => setColor(v as StatusColor)}
        options={COLOR_OPTIONS.map((c) => ({ value: c.id, label: c.label }))}
      />
      <SettingsSelectField
        id="ss-icon"
        label="Icon"
        value={icon}
        onChange={(v) => setIcon(v as StatusIcon)}
        options={ICON_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
      />
    </>
  );

  const dataTab = (
    <>
      <PgrestDataTab
        id="ss-data-mode"
        dataMode={dataMode}
        onDataModeChange={handleDataModeChange}
        pgrest={pg}
        dictionary={dictionary}
        plannerVariableName={plannerVariableName}
        onPlannerVariableNameChange={setPlannerVariableName}
        dataSourceId={dataSourceId}
        onDataSourceIdChange={setDataSourceId}
        activeProviders={activeProviders}
      />
      <DataProviderEntries dataProvider={dp} dictionary={dictionary} />
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
