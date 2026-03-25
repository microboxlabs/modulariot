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
import { SettingsModalShell } from "../common/settings-modal-shell";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();

  const [title, setTitle] = useState(config.title ?? "Status");
  const [value, setValue] = useState(config.value ?? "0");
  const [subtitle, setSubtitle] = useState(config.subtitle ?? "");
  const [color, setColor] = useState<StatusColor>(config.color ?? "gray");
  const [icon, setIcon] = useState<StatusIcon>(config.icon ?? "check");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const dp = useDataProvider(config.dataProvider ?? []);

  const staticSnapshot = useRef({ title, value, subtitle });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, subtitle };
    } else if (mode === "static" && dataMode === "pgrest") {
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
      />
      <HbTextField
        id="ss-value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder="0"
      />
      <HbTextField
        id="ss-subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
        placeholder="e.g. 204 de 230 dispositivos"
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
    />
  );
}
