"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { defaultConfig } from "./dashlet";
import {
  HbTextField,
  SettingsFieldGrid,
  useDataProvider,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
  DataProviderEntries,
  useThresholdSettings,
  ThresholdEditor,
} from "../common";
import { SettingsModalShell, useWidgetRefreshSettings } from "../common/settings-modal-shell";
import { usePlannerContext } from "../../context/planner-context";
import { tr } from "@/features/i18n/tr.service";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  dashletName,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();

  const [title, setTitle] = useState(String(config.title ?? defaultConfig.title));
  const [value, setValue] = useState(String(config.value ?? defaultConfig.value));
  const [maxValue, setMaxValue] = useState(String(config.maxValue ?? defaultConfig.maxValue));
  const [unit, setUnit] = useState(String(config.unit ?? defaultConfig.unit));
  const [dataMode, setDataMode] = useState<"static" | "pgrest" | "planner">(
    config.dataMode === "static" || config.dataMode === "pgrest" || config.dataMode === "planner"
      ? config.dataMode
      : "static"
  );
  const [dataSourceId, setDataSourceId] = useState<string>(config.dataSourceId ?? "");
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );

  const dp = useDataProvider(config.dataProvider ?? []);
  const threshold = useThresholdSettings(config);

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setValue(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setMaxValue(`{{row.${detected[1].key}}}`);
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
      maxValue,
      unit,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName: dataMode === "planner" ? plannerVariableName : undefined,
      dataProvider: dp.getCleanEntries(),
      ...refresh.savePayload,
      ...threshold.buildThresholdSavePayload(),
    });
    onClose();
  };

  const visualizationTab = (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.dynamicValuesHint", dictionary, {
          code: "{{data_provider.key}}",
        })}
      </p>
      <HbTextField
        id="sc-title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder="Storage Used"
        schemaSuggestions={schemaSuggestions}
      />
      <SettingsFieldGrid cols={3}>
        <HbTextField
          id="sc-value"
          label={tr("common.value", dictionary)}
          value={value}
          onChange={setValue}
          placeholder="67"
          schemaSuggestions={schemaSuggestions}
        />
        <HbTextField
          id="sc-max"
          label="Max"
          value={maxValue}
          onChange={setMaxValue}
          placeholder="100"
          schemaSuggestions={schemaSuggestions}
        />
        <HbTextField
          id="sc-unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
          placeholder="GB"
          schemaSuggestions={schemaSuggestions}
        />
      </SettingsFieldGrid>
      <ThresholdEditor
        enabled={threshold.thresholdEnabled}
        onToggle={threshold.setThresholdEnabled}
        field={threshold.thresholdField}
        onFieldChange={threshold.setThresholdField}
        applyTo={threshold.thresholdApplyTo}
        onApplyToChange={threshold.setThresholdApplyTo}
        rules={threshold.thresholdRules}
        onAdd={threshold.addThresholdRule}
        onRemove={threshold.removeThresholdRule}
        onUpdate={threshold.updateThresholdRule}
        schemaSuggestions={schemaSuggestions}
      />
    </>
  );

  const dataTab = (
    <>
      <PgrestDataTab
        id="sc-data-mode"
        dataMode={dataMode}
        onDataModeChange={(v) => setDataMode(v as "static" | "pgrest" | "planner")}
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
      title={dashletName}
    />
  );
}
