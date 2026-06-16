"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, StatusIcon } from "./dashlet";
import { ICON_OPTIONS } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import { SettingsSelectField, HbTextField } from "../common/settings-fields";
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
import { usePlannerContext } from "../../context/planner-context";
import { useDashboardFilterSuggestions } from "../common/use-filter-suggestions";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import {
  useValueColorSettings,
  ValueColorRulesEditor,
} from "./value-color-rules";

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
  const { schemas } = usePlannerContext();
  const filterSuggestions = useDashboardFilterSuggestions();

  const [title, setTitle] = useState(config.title ?? "Status");
  const [value, setValue] = useState(config.value ?? "0");
  const [subtitle, setSubtitle] = useState(config.subtitle ?? "");
  const [showColor, setShowColor] = useState(config.showColor === true);
  const [color, setColor] = useState(config.color ?? "3b82f6");
  const [icon, setIcon] = useState<StatusIcon>(config.icon ?? "check");
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

  // Reset form state when drawer opens so useSettingsDirty sees fresh baselines
  useEffect(() => {
    if (!isOpen) return;
    setTitle(config.title ?? "Status");
    setValue(config.value ?? "0");
    setSubtitle(config.subtitle ?? "");
    setShowColor(config.showColor === true);
    setColor(config.color ?? "3b82f6");
    setIcon(config.icon ?? "check");
    setDataSourceId(config.dataSourceId ?? "");
    setPlannerVariableName(config.plannerVariableName ?? "");
  }, [isOpen, config]);

  const dp = useDataProvider(config.dataProvider ?? []);
  const colorRules = useValueColorSettings({
    valueColorRules: config.valueColorRules,
  });

  const staticSnapshot = useRef({ title, value, subtitle });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (isRemoteDataMode(mode) && dataMode === "static") {
      staticSnapshot.current = { title, value, subtitle };
    } else if (mode === "static" && isRemoteDataMode(dataMode)) {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setSubtitle(staticSnapshot.current.subtitle);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
        if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
        if (detected.length >= 3) setSubtitle(`{{row.${detected[2].key}}}`);
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
    subtitle,
    showColor,
    color,
    icon,
    dpEntries: dp.dataProvider,
    dataMode,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    dataSourceId,
    plannerVariableName,
    refreshValue: refresh.value,
    colorRulesState: colorRules.rules,
  });

  const handleSave = () => {
    onSave({
      title,
      value,
      subtitle,
      showColor,
      color,
      icon,
      dataProvider: dp.getCleanEntries(),
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName:
        dataMode === "planner" ? plannerVariableName : undefined,
      ...refresh.savePayload,
      ...colorRules.buildSavePayload(),
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
        filterSuggestions={filterSuggestions}
      />
      <HbTextField
        id="ss-value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder="0"
        schemaSuggestions={schemaSuggestions}
        filterSuggestions={filterSuggestions}
      />
      <HbTextField
        id="ss-subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
        placeholder="e.g. 204 de 230 dispositivos"
        schemaSuggestions={schemaSuggestions}
        filterSuggestions={filterSuggestions}
      />
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
        <div className="flex items-center gap-2">
          <Checkbox
            id="ss-show-color"
            checked={showColor}
            onChange={(e) => setShowColor(e.target.checked)}
          />
          <Label
            htmlFor="ss-show-color"
            className="text-sm font-medium cursor-pointer"
          >
            {tr("dashboard.settings.color", dictionary)}
          </Label>
        </div>
        {showColor && (
          <div className="flex items-center gap-2">
            <AdvancedColorPicker
              value={color}
              onChange={setColor}
              title={tr("dashboard.settings.selectColor", dictionary)}
            />
          </div>
        )}
      </div>
      <SettingsSelectField
        id="ss-icon"
        label="Icon"
        value={icon}
        onChange={(v) => setIcon(v as StatusIcon)}
        options={ICON_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
      />
      <ValueColorRulesEditor
        rules={colorRules.rules}
        dictionary={dictionary}
        onAdd={colorRules.addRule}
        onRemove={colorRules.removeRule}
        onUpdate={colorRules.updateRule}
        onToggleTarget={colorRules.toggleTarget}
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
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      tabs={buildStandardTabs(dictionary, visualizationTab, dataTab)}
      footer={refresh.selectNode}
      widgetId={widgetId}
      title={dashletName}
      isDirty={isDirty}
    />
  );
}
