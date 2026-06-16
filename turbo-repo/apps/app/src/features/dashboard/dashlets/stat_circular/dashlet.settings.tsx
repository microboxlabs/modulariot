"use client";

import { useState } from "react";
import { Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { defaultConfig, DEFAULT_BAR_COLOR } from "./dashlet";
import { HbTextField, SettingsFieldGrid } from "../common/settings-fields";
import { useDataProvider } from "../common/use-data-provider";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildSimplePgrestConfig } from "../common/pgrest-settings-helpers";
import { PgrestDataTab } from "../common/pgrest-data-tab";
import { useActiveProviders } from "../common/use-active-providers";
import { DataProviderEntries } from "../common/data-provider-entries";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { usePlannerContext } from "../../context/planner-context";
import { useDashboardFilterSuggestions } from "../common/use-filter-suggestions";
import { tr } from "@/features/i18n/tr.service";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import {
  useRingColorSettings,
  RingColorRulesEditor,
} from "./value-color-rules";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  dashletName,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();
  const filterSuggestions = useDashboardFilterSuggestions();

  const [title, setTitle] = useState(
    String(config.title ?? defaultConfig.title)
  );
  const [value, setValue] = useState(
    String(config.value ?? defaultConfig.value)
  );
  const [maxValue, setMaxValue] = useState(
    String(config.maxValue ?? defaultConfig.maxValue)
  );
  const [unit, setUnit] = useState(String(config.unit ?? defaultConfig.unit));
  const [dataMode, setDataMode] = useState<"static" | "pgrest" | "planner">(
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
  const ringColorRules = useRingColorSettings(config);
  const [ringColor, setRingColor] = useState(config.ringColor ?? "3b82f6");

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        if (detected.length >= 1) setValue(`{{row.${detected[0].key}}}`);
        if (detected.length >= 2) setMaxValue(`{{row.${detected[1].key}}}`);
      }
    ),
  });

  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const isDirty = useSettingsDirty(isOpen, {
    title,
    value,
    maxValue,
    unit,
    ringColor,
    dataMode,
    dpEntries: dp.dataProvider,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    dataSourceId,
    plannerVariableName,
    refreshValue: refresh.value,
    ringColorRulesState: ringColorRules.rules,
  });

  const handleSave = () => {
    onSave({
      title,
      value,
      maxValue,
      unit,
      barColor: config.barColor ?? DEFAULT_BAR_COLOR,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName:
        dataMode === "planner" ? plannerVariableName : undefined,
      dataProvider: dp.getCleanEntries(),
      ringColor,
      ...refresh.savePayload,
      ...ringColorRules.buildSavePayload(),
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
        filterSuggestions={filterSuggestions}
      />
      <SettingsFieldGrid cols={3}>
        <HbTextField
          id="sc-value"
          label={tr("common.value", dictionary)}
          value={value}
          onChange={setValue}
          placeholder="67"
          schemaSuggestions={schemaSuggestions}
          filterSuggestions={filterSuggestions}
        />
        <HbTextField
          id="sc-max"
          label="Max"
          value={maxValue}
          onChange={setMaxValue}
          placeholder="100"
          schemaSuggestions={schemaSuggestions}
          filterSuggestions={filterSuggestions}
        />
        <HbTextField
          id="sc-unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
          placeholder="GB"
          schemaSuggestions={schemaSuggestions}
          filterSuggestions={filterSuggestions}
        />
      </SettingsFieldGrid>
      {/* Ring color picker */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
        <Label className="text-sm font-medium">
          {tr("dashboard.settings.ringColor", dictionary)}
        </Label>
        <AdvancedColorPicker
          value={ringColor}
          onChange={setRingColor}
          title={tr("dashboard.settings.selectColor", dictionary)}
        />
      </div>
      <RingColorRulesEditor
        rules={ringColorRules.rules}
        dictionary={dictionary}
        onAdd={ringColorRules.addRule}
        onRemove={ringColorRules.removeRule}
        onUpdate={ringColorRules.updateRule}
      />
    </>
  );

  const dataTab = (
    <>
      <PgrestDataTab
        id="sc-data-mode"
        dataMode={dataMode}
        onDataModeChange={(v) =>
          setDataMode(v as "static" | "pgrest" | "planner")
        }
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
      tabs={buildStandardTabs(dictionary, visualizationTab, dataTab)}
      footer={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
