"use client";

import { useRef, useState } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, InfoCardIcon } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown";
import { HbTextField, HbTextareaField } from "../common/settings-fields";
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

const DEFAULT_DATA_ENTRIES = [
  { key: "title", value: "Example Title" },
  { key: "value", value: "100" },
];

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

  const [title, setTitle] = useState(config.title || "Metric");
  const [icon, setIcon] = useState<InfoCardIcon>(config.icon || "chart");
  const [iconColor, setIconColor] = useState(config.iconColor || "");
  const [value, setValue] = useState(config.value || "100%");
  const [valueColor, setValueColor] = useState(config.valueColor || "");
  const [descriptor, setDescriptor] = useState(
    config.descriptor || "Percentage of tasks completed"
  );
  const [descriptorColor, setDescriptorColor] = useState(
    config.descriptorColor || ""
  );
  const [aiPlaceholder, setAiPlaceholder] = useState(
    config.aiPlaceholder || "AI summary will appear here"
  );
  const [viewMoreUrl, setViewMoreUrl] = useState(config.viewMoreUrl || "");
  const [viewMoreLabel, setViewMoreLabel] = useState(
    config.viewMoreLabel || "View more"
  );
  const [openInSameTab, setOpenInSameTab] = useState(
    config.openInSameTab ?? false
  );
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

  const dp = useDataProvider(
    (
      config as DashletConfig & {
        dataProvider?: import("../types").DataProviderEntry[];
      }
    ).dataProvider || DEFAULT_DATA_ENTRIES
  );

  const colorRules = useValueColorSettings({
    valueColorRules: config.valueColorRules,
  });

  const staticSnapshot = useRef({
    title,
    value,
    valueColor,
    iconColor,
    descriptor,
    descriptorColor,
    aiPlaceholder,
    viewMoreUrl,
    viewMoreLabel,
    openInSameTab,
  });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (isRemoteDataMode(mode) && dataMode === "static") {
      staticSnapshot.current = {
        title,
        value,
        valueColor,
        iconColor,
        descriptor,
        descriptorColor,
        aiPlaceholder,
        viewMoreUrl,
        viewMoreLabel,
        openInSameTab,
      };
    } else if (mode === "static" && isRemoteDataMode(dataMode)) {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setValueColor(staticSnapshot.current.valueColor);
      setIconColor(staticSnapshot.current.iconColor);
      setDescriptor(staticSnapshot.current.descriptor);
      setDescriptorColor(staticSnapshot.current.descriptorColor);
      setAiPlaceholder(staticSnapshot.current.aiPlaceholder);
      setViewMoreUrl(staticSnapshot.current.viewMoreUrl);
      setViewMoreLabel(staticSnapshot.current.viewMoreLabel);
      setOpenInSameTab(staticSnapshot.current.openInSameTab);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig(
      { ...config, dataSourceId: dataSourceId || undefined },
      (detected) => {
        if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
        if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
        if (detected.length >= 3) setDescriptor(`{{row.${detected[2].key}}}`);
      }
    ),
  });

  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const isDirty = useSettingsDirty(isOpen, {
    title,
    icon,
    iconColor,
    value,
    valueColor,
    descriptor,
    descriptorColor,
    aiPlaceholder,
    viewMoreUrl,
    viewMoreLabel,
    openInSameTab,
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
      icon,
      iconColor,
      value,
      valueColor,
      descriptor,
      descriptorColor,
      aiPlaceholder,
      viewMoreUrl,
      viewMoreLabel,
      openInSameTab,
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
        id="title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder={tr("dashboard.settings.titlePlaceholder", dictionary)}
        schemaSuggestions={schemaSuggestions}
        filterSuggestions={filterSuggestions}
      />

      <HbTextField
        id="value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder={tr("dashboard.settings.valuePlaceholder", dictionary)}
        schemaSuggestions={schemaSuggestions}
        filterSuggestions={filterSuggestions}
      />

      <HbTextareaField
        id="descriptor"
        label={tr("dashboard.settings.descriptor", dictionary)}
        value={descriptor}
        onChange={setDescriptor}
        placeholder={tr("dashboard.settings.descriptorPlaceholder", dictionary)}
        rows={2}
        filterSuggestions={filterSuggestions}
      />

      <HbTextareaField
        id="aiPlaceholder"
        label={tr("dashboard.settings.aiPlaceholder", dictionary)}
        value={aiPlaceholder}
        onChange={setAiPlaceholder}
        placeholder={tr(
          "dashboard.settings.aiPlaceholderPlaceholder",
          dictionary
        )}
        rows={2}
        filterSuggestions={filterSuggestions}
      />

      <HbTextField
        id="viewMoreUrl"
        label={tr("dashboard.settings.viewMoreUrl", dictionary)}
        schemaSuggestions={schemaSuggestions}
        filterSuggestions={filterSuggestions}
        value={viewMoreUrl}
        onChange={setViewMoreUrl}
        placeholder="https://example.com/details"
      />

      {viewMoreUrl.trim() && (
        <HbTextField
          id="viewMoreLabel"
          label={tr("dashboard.settings.viewMoreLabel", dictionary)}
          schemaSuggestions={schemaSuggestions}
          filterSuggestions={filterSuggestions}
          value={viewMoreLabel}
          onChange={setViewMoreLabel}
          placeholder={tr(
            "dashboard.settings.viewMoreLabelPlaceholder",
            dictionary
          )}
        />
      )}
      {viewMoreUrl.trim() && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">
            {tr("dashboard.settings.openInSameTab", dictionary)}
          </Label>
          <ToggleSwitch checked={openInSameTab} onChange={setOpenInSameTab} />
        </div>
      )}

      {/* Icon & Colors section */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <Label className="text-sm font-medium">
            {tr("dashboard.settings.icon", dictionary)}
          </Label>
          <div className="flex items-center gap-2">
            <IconPickerDropdown
              value={icon}
              onChange={(v) => setIcon(v as InfoCardIcon)}
              title={tr("dashboard.settings.selectIcon", dictionary)}
              searchPlaceholder={tr("dashboard.settings.searchIcons", dictionary)}
              emptyMessage={tr("dashboard.settings.noIconsFound", dictionary)}
            />
            <AdvancedColorPicker
              value={iconColor}
              onChange={setIconColor}
              title={tr("dashboard.settings.selectColor", dictionary)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <Label className="text-sm font-medium">
            {tr("dashboard.settings.valueColor", dictionary)}
          </Label>
          <AdvancedColorPicker
            value={valueColor}
            onChange={setValueColor}
            title={tr("dashboard.settings.selectColor", dictionary)}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <Label className="text-sm font-medium">
            {tr("dashboard.settings.descriptorColor", dictionary)}
          </Label>
          <AdvancedColorPicker
            value={descriptorColor}
            onChange={setDescriptorColor}
            title={tr("dashboard.settings.selectColor", dictionary)}
          />
        </div>
      </div>
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
        id="ic-data-mode"
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
