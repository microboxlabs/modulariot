"use client";

import { useRef, useState } from "react";
import { TextCardFields } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, TextAlign } from "./dashlet";
import { getHandlebarsStatus } from "../common/handlebars-helpers";
import { useDataProvider } from "../common/use-data-provider";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildSimplePgrestConfig } from "../common/pgrest-settings-helpers";
import { PgrestDataTab } from "../common/pgrest-data-tab";
import { useActiveProviders } from "../common/use-active-providers";
import { DataProviderEntries } from "../common/data-provider-entries";
import { type SimpleDataMode } from "../common/use-simple-pgrest-settings";
import { isRemoteDataMode } from "../common/use-simple-pgrest-settings";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  widgetId,
  dashletName,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);

  const [text, setText] = useState(
    config.text ?? "Add your text or quote here..."
  );
  const [italic, setItalic] = useState(config.italic ?? true);
  const [align, setAlign] = useState<TextAlign>(config.align ?? "left");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" ||
      config.dataMode === "pgrest" ||
      config.dataMode === "planner"
      ? config.dataMode
      : "static"
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );

  const dp = useDataProvider(config.dataProvider ?? []);

  const staticSnapshot = useRef({ text });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (isRemoteDataMode(mode) && dataMode === "static") {
      staticSnapshot.current = { text };
    } else if (mode === "static" && isRemoteDataMode(dataMode)) {
      setText(staticSnapshot.current.text);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        if (detected.length >= 1) setText(`{{row.${detected[0].key}}}`);
      }
    ),
  });

  const isDirty = useSettingsDirty(isOpen, {
    text,
    italic,
    align,
    dpEntries: dp.dataProvider,
    dataMode,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    dataSourceId,
    plannerVariableName,
    refreshValue: refresh.value,
  });

  const handleSave = () => {
    onSave({
      text,
      italic,
      align,
      dataProvider: dp.getCleanEntries(),
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName:
        dataMode === "planner" ? plannerVariableName : undefined,
      ...refresh.savePayload,
    } as DashletConfig);
    onClose();
  };

  const textStatus = getHandlebarsStatus(text);

  const visualizationTab = (
    <TextCardFields
      value={{ text, italic, align }}
      onChange={(next) => {
        setText(next.text);
        setItalic(next.italic);
        setAlign(next.align);
      }}
      textStatus={textStatus}
      labels={{
        legend: tr("dashboard.textCard.appearance", dictionary),
        text: tr("dashboard.textCard.text", dictionary),
        placeholder: tr("dashboard.textCard.placeholder", dictionary),
        alignment: tr("dashboard.textCard.alignment", dictionary),
        left: tr("dashboard.textCard.left", dictionary),
        center: tr("dashboard.textCard.center", dictionary),
        right: tr("dashboard.textCard.right", dictionary),
        italic: tr("dashboard.textCard.italic", dictionary),
      }}
    />
  );

  const dataTab = (
    <>
      <PgrestDataTab
        id="tc-data-mode"
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
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      title={dashletName}
      tabs={buildStandardTabs(dictionary, visualizationTab, dataTab)}
      footer={refresh.selectNode}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
