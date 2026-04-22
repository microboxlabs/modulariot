"use client";

import { useState, useEffect } from "react";
import { Label, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import {
  type DashletConfig,
  type ContainerVariant,
  defaultConfig,
} from "./dashlet";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import {
  SettingsTextField,
  SettingsTextareaField,
  SettingsPickerItem,
  usePgrestSettingsState,
  PgrestDataTab,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  useActiveProviders,
} from "../common";
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { usePlannerContext } from "../../context/planner-context";
import { tr } from "@/features/i18n/tr.service";

type ContainerDataMode = "static" | "pgrest" | "planner";

/**
 * Settings modal for Container dashlet
 * Uses SettingsModalShell with visualization + data provider tabs
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

  // Visual settings state
  const [variant, setVariant] = useState<ContainerVariant>(
    config.variant ?? defaultConfig.variant
  );
  const [name, setName] = useState(config.name ?? defaultConfig.name);
  const [description, setDescription] = useState(
    config.description ?? defaultConfig.description
  );
  const [verMasUrl, setVerMasUrl] = useState(
    config.verMasUrl ?? defaultConfig.verMasUrl
  );
  const [openInSameTab, setOpenInSameTab] = useState(
    config.openInSameTab ?? false
  );
  const [label, setLabel] = useState(config.label ?? defaultConfig.label);
  const [borderColor, setBorderColor] = useState<string>(
    config.borderColor ?? defaultConfig.borderColor ?? "6b7280"
  );

  // Data settings state
  const [dataMode, setDataMode] = useState<ContainerDataMode>(
    config.dataMode || "static"
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const { schemas } = usePlannerContext();
  const schemaSuggestions =
    dataMode === "planner" && plannerVariableName
      ? schemas.get(plannerVariableName)
      : undefined;

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({
      ...config,
      dataSourceId: dataSourceId || undefined,
    }),
  });

  // Sync state when config changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    setVariant(config.variant ?? defaultConfig.variant);
    setName(config.name ?? defaultConfig.name);
    setDescription(config.description ?? defaultConfig.description);
    setVerMasUrl(config.verMasUrl ?? defaultConfig.verMasUrl);
    setOpenInSameTab(config.openInSameTab ?? false);
    setLabel(config.label ?? defaultConfig.label);
    setBorderColor(config.borderColor ?? defaultConfig.borderColor ?? "6b7280");
    setDataMode(config.dataMode || "static");
    setPlannerVariableName(config.plannerVariableName ?? "");
    setDataSourceId(config.dataSourceId ?? "");
  }, [config, isOpen]);

  const isDirty = useSettingsDirty(isOpen, {
    variant,
    name,
    description,
    verMasUrl,
    openInSameTab,
    label,
    borderColor,
    dataMode,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    plannerVariableName,
    dataSourceId,
    refreshValue: refresh.value,
  });

  const handleSave = () => {
    const newConfig: Record<string, unknown> = {
      // Visual fields (preserve all regardless of variant)
      variant,
      name: name?.trim() || tr("dashboard.defaults.untitled", dictionary),
      description: description?.trim() || "",
      verMasUrl: verMasUrl?.trim() || "",
      openInSameTab,
      label: label?.trim() || tr("dashboard.defaults.group", dictionary),
      borderColor,
      // Data fields
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      plannerVariableName:
        dataMode === "planner" ? plannerVariableName : undefined,
      dataSourceId: dataSourceId || undefined,
      ...refresh.savePayload,
    };
    onSave(newConfig);
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isPgrest = dataMode !== "static";

  // Visualization tab: variant toggle + conditional visual fields
  const visualizationTab = (
    <div className="flex w-full flex-col gap-3">
      {/* Variant Toggle */}
      <div>
        <Label className="mb-1 block text-sm">
          {tr("dashboard.settings.containerType", dictionary)}
        </Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVariant("bento-box")}
            onMouseDown={handleMouseDown}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-1.5 text-center text-xs transition-all ${
              variant === "bento-box"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            <div className="font-medium">
              {tr("dashboard.settings.bentoBox", dictionary)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVariant("labeled-group")}
            onMouseDown={handleMouseDown}
            className={`flex-1 cursor-pointer rounded-lg border px-3 py-1.5 text-center text-xs transition-all ${
              variant === "labeled-group"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            <div className="font-medium">
              {tr("dashboard.settings.labeledGroup", dictionary)}
            </div>
          </button>
        </div>
      </div>

      {/* Conditional Fields based on variant */}
      {variant === "bento-box" ? (
        <>
          <SettingsTextField
            id="name"
            label={tr("dashboard.settings.name", dictionary)}
            value={name ?? ""}
            onChange={setName}
            placeholder={
              isPgrest
                ? "{{row.title}}"
                : tr("dashboard.settings.enterName", dictionary)
            }
          />
          <SettingsTextareaField
            id="description"
            label={tr("dashboard.settings.description", dictionary)}
            value={description ?? ""}
            onChange={setDescription}
            placeholder={
              isPgrest
                ? "{{row.description}}"
                : tr("dashboard.settings.enterDescription", dictionary)
            }
            rows={2}
          />
          <SettingsTextField
            id="verMasUrl"
            label={tr("dashboard.settings.seeMoreUrl", dictionary)}
            value={verMasUrl ?? ""}
            onChange={setVerMasUrl}
            placeholder="https://example.com"
          />
          {verMasUrl && (
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {tr("dashboard.settings.openInSameTab", dictionary)}
              </Label>
              <ToggleSwitch
                checked={openInSameTab}
                onChange={setOpenInSameTab}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <SettingsTextField
            id="label"
            label={tr("dashboard.settings.label", dictionary)}
            value={label ?? ""}
            onChange={setLabel}
            placeholder={
              isPgrest
                ? "{{row.label}}"
                : tr("dashboard.settings.enterLabel", dictionary)
            }
          />
          <SettingsPickerItem
            label={tr("dashboard.settings.borderColor", dictionary)}
          >
            <AdvancedColorPicker
              value={borderColor}
              onChange={setBorderColor}
              title={tr("dashboard.settings.selectBorderColor", dictionary)}
            />
          </SettingsPickerItem>
        </>
      )}

      {/* Schema hints when using planner/pgrest */}
      {isPgrest && schemaSuggestions && schemaSuggestions.length > 0 && (
        <div className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {tr("dashboard.settings.availableColumns", dictionary)}
          </p>
          <div className="flex flex-wrap gap-1">
            {schemaSuggestions.map((key) => (
              <span
                key={key}
                className="inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {key}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            {tr("dashboard.settings.useRowColumnInFields", dictionary, {
              code: "{{row.<column>}}",
            })}
          </p>
        </div>
      )}
    </div>
  );

  // Data provider tab
  const dataTab = (
    <PgrestDataTab
      id="container-data-mode"
      dataMode={dataMode}
      onDataModeChange={(v) => setDataMode(v as ContainerDataMode)}
      pgrest={pg}
      dictionary={dictionary}
      plannerVariableName={plannerVariableName}
      onPlannerVariableNameChange={setPlannerVariableName}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={(v) => {
        setDataSourceId(v);
      }}
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
