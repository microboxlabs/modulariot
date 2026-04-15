"use client";

import { useState } from "react";
import { Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { defaultConfig, DEFAULT_BAR_COLOR } from "./dashlet";
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
} from "../common";
import {
  SettingsModalShell,
  useWidgetRefreshSettings,
} from "../common/settings-modal-shell";
import { usePlannerContext } from "../../context/planner-context";
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
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { schemas } = usePlannerContext();

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
