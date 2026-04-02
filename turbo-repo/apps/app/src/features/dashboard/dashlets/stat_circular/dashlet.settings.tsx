"use client";

import { useState, useRef, useCallback } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { defaultConfig } from "./dashlet";
import {
  HbTextField,
  SettingsSelectField,
  SettingsFieldGrid,
  useDataProvider,
} from "../common";
import type { ColumnItem } from "../common/column-helpers";
import { SettingsModalShell, useWidgetRefreshSettings } from "../common/settings-modal-shell";
import { PgrestSettingsSection } from "../common/pgrest-settings-section";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildPgrestContentLabels } from "../common/pgrest-settings-helpers";
import { tr } from "@/features/i18n/tr.service";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);

  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true
  );

  const [title, setTitle] = useState(String(config.title ?? defaultConfig.title));
  const [value, setValue] = useState(String(config.value ?? defaultConfig.value));
  const [maxValue, setMaxValue] = useState(String(config.maxValue ?? defaultConfig.maxValue));
  const [unit, setUnit] = useState(String(config.unit ?? defaultConfig.unit));
  const [dataMode, setDataMode] = useState<"static" | "pgrest">(config.dataMode ?? "static");
  const [dataSourceId, setDataSourceId] = useState<string>(config.dataSourceId ?? "");

  const dp = useDataProvider(config.dataProvider ?? []);

  // Keep refs to setters so the pgrest callbacks always use the latest
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;
  const setMaxValueRef = useRef(setMaxValue);
  setMaxValueRef.current = setMaxValue;
  const setTitleRef = useRef(setTitle);
  setTitleRef.current = setTitle;
  const setUnitRef = useRef(setUnit);
  setUnitRef.current = setUnit;

  const onColumnsDetected = useCallback(
    (keys: string[]) =>
      keys.map((key, i) => ({
        _id: `col-${Date.now()}-${i}`,
        key: `{{row.${key}}}`,
        label: key,
        type: "text" as const,
      })),
    [],
  );

  const noop = useCallback(() => {}, []);

  const onDetectionComplete = useCallback((detected: ColumnItem[]) => {
    // Auto-fill visualization fields with first detected row keys
    if (detected.length >= 1) {
      setValueRef.current(detected[0].key);
    }
    if (detected.length >= 2) {
      setMaxValueRef.current(detected[1].key);
    }
  }, []);

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    dataSourceId: dataSourceId || undefined,
    onColumnsDetected,
    setColumns: noop,
    onDetectionComplete,
  });

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
      pgrestPathMode: pg.pgrestPathMode,
      dataSourceId: dataSourceId || undefined,
      dataProvider: dp.getCleanEntries(),
      ...refresh.savePayload,
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

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
      />
      <SettingsFieldGrid cols={3}>
        <HbTextField
          id="sc-value"
          label={tr("common.value", dictionary)}
          value={value}
          onChange={setValue}
          placeholder="67"
        />
        <HbTextField
          id="sc-max"
          label="Max"
          value={maxValue}
          onChange={setMaxValue}
          placeholder="100"
        />
        <HbTextField
          id="sc-unit"
          label="Unit"
          value={unit}
          onChange={setUnit}
          placeholder="GB"
        />
      </SettingsFieldGrid>
    </>
  );

  const dataTab = (
    <>
      <SettingsSelectField
        id="sc-data-mode"
        label={tr("dashboard.settings.dataSource", dictionary)}
        value={dataMode}
        onChange={(v) => setDataMode(v as "static" | "pgrest")}
        options={[
          { value: "static", label: tr("dashboard.settings.staticJson", dictionary) },
          { value: "pgrest", label: "PGREST" },
        ]}
      />

      {dataMode === "pgrest" && (
        <PgrestSettingsSection
          pgrest={pg}
          dictionary={dictionary}
          labels={buildPgrestContentLabels(dictionary)}
          dataSourceId={dataSourceId}
          onDataSourceIdChange={setDataSourceId}
          activeProviders={activeProviders}
        />
      )}

      {/* Data provider key/value entries */}
      <Label className="block text-sm font-medium">
        {tr("dashboard.settings.dataProvider", dictionary)}
      </Label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.defineVariablesHint", dictionary, {
          code: "{{data_provider.key}}",
        })}
      </p>
      <div className="space-y-2">
        {dp.dataProvider.map((entry, i) => (
          <div
            key={entry._id}
            className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700"
          >
            <TextInput
              value={entry.key}
              onChange={(e) => dp.updateEntry(i, "key", e.target.value)}
              placeholder={tr("dashboard.settings.key", dictionary)}
              sizing="sm"
              className="flex-1"
            />
            <TextInput
              value={entry.value}
              onChange={(e) => dp.updateEntry(i, "value", e.target.value)}
              placeholder={tr("common.value", dictionary)}
              sizing="sm"
              className="flex-1"
            />
            <Button
              size="xs"
              color="failure"
              onClick={() => dp.removeEntry(i)}
              onMouseDown={handleMouseDown}
              className="no-drag shrink-0"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button
        size="xs"
        color="light"
        onClick={dp.addEntry}
        onMouseDown={handleMouseDown}
        className="no-drag w-full"
      >
        {tr("dashboard.settings.addEntry", dictionary)}
      </Button>
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
