"use client";

import { useRef, useState } from "react";
import { Label } from "flowbite-react";
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
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { usePlannerContext } from "../../context/planner-context";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import { tr } from "@/features/i18n/tr.service";
import {
  useProgressBarColorSettings,
  ProgressBarColorRulesEditor,
} from "./progress-bar-color-rules";

type SimpleDataMode = "static" | "pgrest" | "planner";

/** Field config for the three percentage_value text fields */
const PERCENTAGE_FIELDS = [
  {
    id: "pv-title",
    labelKey: "common.title",
    state: "title",
    hbPlaceholder: "{{row.label}}",
    staticPlaceholder: "Progress",
  },
  {
    id: "pv-value",
    labelKey: "common.value",
    state: "value",
    hbPlaceholder: "{{row.current}}",
    staticPlaceholder: "6",
  },
  {
    id: "pv-max",
    labelKey: "common.max",
    state: "max",
    hbPlaceholder: "{{row.total}}",
    staticPlaceholder: "10",
  },
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
  dashletName,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();
  const refresh = useWidgetRefreshSettings(config, dictionary);

  const [title, setTitle] = useState(config.title || "Progress");
  const [value, setValue] = useState(String(config.value ?? "6"));
  const [max, setMax] = useState(String(config.max ?? "10"));
  const [barColor, setBarColor] = useState(config.barColor ?? "2563eb");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" ||
      config.dataMode === "pgrest" ||
      config.dataMode === "planner"
      ? config.dataMode
      : "static"
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const barColorRules = useProgressBarColorSettings(config);

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

  const { schemas } = usePlannerContext();
  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        if (detected.length >= 1) {
          setTitle(`{{row.${detected[0].key}}}`);
        }
        if (detected.length >= 2) {
          setValue(`{{row.${detected[1].key}}}`);
        }
        if (detected.length >= 3) {
          setMax(`{{row.${detected[2].key}}}`);
        }
      }
    ),
  });

  const isDirty = useSettingsDirty(isOpen, {
    title,
    value,
    max,
    barColor,
    dataMode,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    plannerVariableName,
    dataSourceId,
    refreshValue: refresh.value,
    barColorRulesState: barColorRules.rules,
  });

  const handleSave = () => {
    onSave({
      title: title.trim() || "Progress",
      value: value.trim() || "6",
      max: max.trim() || "10",
      barColor,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      plannerVariableName:
        dataMode === "planner" ? plannerVariableName : undefined,
      dataSourceId: dataSourceId || undefined,
      ...refresh.savePayload,
      ...barColorRules.buildSavePayload(),
    });
    onClose();
  };

  const isPgrest = dataMode !== "static";

  const fieldValues: Record<string, string> = { title, value, max };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    max: setMax,
  };

  const visualizationTab = (
    <>
      <HbTextFieldList
        fields={PERCENTAGE_FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
        schemaSuggestions={schemaSuggestions}
      />
      {/* Bar color picker */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
        <Label className="text-sm font-medium">
          {tr("dashboard.settings.barColor", dictionary)}
        </Label>
        <AdvancedColorPicker
          value={barColor}
          onChange={setBarColor}
          title={tr("dashboard.settings.selectColor", dictionary)}
        />
      </div>
      <ProgressBarColorRulesEditor
        evalMode={barColorRules.evalMode}
        onEvalModeChange={barColorRules.setEvalMode}
        rules={barColorRules.rules}
        onAdd={barColorRules.addRule}
        onRemove={barColorRules.removeRule}
        onUpdate={barColorRules.updateRule}
        dictionary={dictionary}
      />
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="pv-data-mode"
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
  );

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      tabs={[
        {
          id: "visualization",
          label: tr("dashboard.settings.visualization", dictionary),
          content: visualizationTab,
        },
        {
          id: "data",
          label: tr("dashboard.settings.dataProvider", dictionary),
          content: dataTab,
        },
      ]}
      footer={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
