"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ToggleSwitch,
  Label,
  Select,
  Textarea,
  TextInput,
} from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { tr } from "@/features/i18n/tr.service";
import type {
  MapDataProvider,
  MapDataProviderDefaults,
} from "@/features/map-visualization/map-data-provider.types";
import { DEFAULT_PROVIDER_STYLES } from "@/features/map-visualization/map-data-provider.types";
import type { FeatureCollection } from "geojson";

// ============================================================================
// Data Source Mode
// ============================================================================

type DataSourceMode = "none" | "static" | "api" | "sse";

function getInitialMode(provider: MapDataProvider | undefined): DataSourceMode {
  if (provider === undefined) return "none";
  return provider.type;
}

function getInitialGeoJson(provider: MapDataProvider | undefined): string {
  if (provider?.type === "static") {
    return JSON.stringify(provider.data, null, 2);
  }
  return "";
}

function getInitialApiUrl(provider: MapDataProvider | undefined): string {
  if (provider?.type === "api") {
    return provider.url;
  }
  return "";
}

function getInitialSseUrl(provider: MapDataProvider | undefined): string {
  if (provider?.type === "sse") {
    return provider.url;
  }
  return "";
}

// ============================================================================
// GeoJSON Validation
// ============================================================================

function validateGeoJson(text: string): FeatureCollection | null {
  if (!text.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as { type: string }).type === "FeatureCollection" &&
      "features" in parsed &&
      Array.isArray((parsed as { features: unknown }).features)
    ) {
      return parsed as FeatureCollection;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Build Data Provider from Settings State
// ============================================================================

function buildDataProvider(
  mode: DataSourceMode,
  geoJsonText: string,
  apiUrl: string,
  sseUrl: string
): MapDataProvider | undefined {
  if (mode === "static") {
    const collection = validateGeoJson(geoJsonText);
    if (collection) {
      return { type: "static", data: collection };
    }
    return undefined;
  }
  if (mode === "api" && apiUrl.trim()) {
    return { type: "api", url: apiUrl.trim() };
  }
  if (mode === "sse" && sseUrl.trim()) {
    return { type: "sse", url: sseUrl.trim() };
  }
  return undefined;
}

// ============================================================================
// Default Styling Section
// ============================================================================

interface DefaultsSectionProps {
  defaults: MapDataProviderDefaults;
  onChange: (defaults: MapDataProviderDefaults) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function DefaultsSection({
  defaults,
  onChange,
  dictionary,
}: Readonly<DefaultsSectionProps>) {
  const update = useCallback(
    (key: keyof MapDataProviderDefaults, value: string | number) => {
      onChange({ ...defaults, [key]: value });
    },
    [defaults, onChange]
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
        {tr("dashboard.settings.defaultStyles", dictionary)}
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            {tr("dashboard.settings.pointColor", dictionary)}
          </Label>
          <TextInput
            sizing="sm"
            value={defaults.pointColor ?? DEFAULT_PROVIDER_STYLES.pointColor}
            onChange={(e) => update("pointColor", e.target.value)}
            placeholder="3388FF"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            {tr("dashboard.settings.pointRadius", dictionary)}
          </Label>
          <TextInput
            sizing="sm"
            type="number"
            value={defaults.pointRadius ?? DEFAULT_PROVIDER_STYLES.pointRadius}
            onChange={(e) =>
              update("pointRadius", Number.parseInt(e.target.value, 10) || 8)
            }
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            {tr("dashboard.settings.lineColor", dictionary)}
          </Label>
          <TextInput
            sizing="sm"
            value={defaults.lineColor ?? DEFAULT_PROVIDER_STYLES.lineColor}
            onChange={(e) => update("lineColor", e.target.value)}
            placeholder="3388FF"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            {tr("dashboard.settings.lineWidth", dictionary)}
          </Label>
          <TextInput
            sizing="sm"
            type="number"
            value={defaults.lineWidth ?? DEFAULT_PROVIDER_STYLES.lineWidth}
            onChange={(e) =>
              update("lineWidth", Number.parseInt(e.target.value, 10) || 3)
            }
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            {tr("dashboard.settings.polygonFillColor", dictionary)}
          </Label>
          <TextInput
            sizing="sm"
            value={
              defaults.polygonFillColor ??
              DEFAULT_PROVIDER_STYLES.polygonFillColor
            }
            onChange={(e) => update("polygonFillColor", e.target.value)}
            placeholder="3388FF"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            {tr("dashboard.settings.polygonStrokeColor", dictionary)}
          </Label>
          <TextInput
            sizing="sm"
            value={
              defaults.polygonStrokeColor ??
              DEFAULT_PROVIDER_STYLES.polygonStrokeColor
            }
            onChange={(e) => update("polygonStrokeColor", e.target.value)}
            placeholder="FFFFFF"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Settings Component
// ============================================================================

/**
 * Geographic Map Dashlet Settings
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  widgetId,
  dashletName,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [showFilters, setShowFilters] = useState(config.showFilters ?? true);
  const [showStyleSelector, setShowStyleSelector] = useState(
    config.showStyleSelector ?? true
  );

  // Data source state
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>(
    getInitialMode(config.dataProvider)
  );
  const [geoJsonText, setGeoJsonText] = useState(
    getInitialGeoJson(config.dataProvider)
  );
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl(config.dataProvider));
  const [sseUrl, setSseUrl] = useState(getInitialSseUrl(config.dataProvider));
  const [providerDefaults, setProviderDefaults] =
    useState<MapDataProviderDefaults>(config.dataProviderDefaults ?? {});

  const geoJsonError =
    dataSourceMode === "static" && geoJsonText.trim() !== ""
      ? validateGeoJson(geoJsonText) === null
      : false;

  const hasDataProvider = dataSourceMode !== "none";

  // Reset state from config when drawer opens or config changes
  useEffect(() => {
    if (isOpen) {
      setShowFilters(config.showFilters ?? true);
      setShowStyleSelector(config.showStyleSelector ?? true);
      setDataSourceMode(getInitialMode(config.dataProvider));
      setGeoJsonText(getInitialGeoJson(config.dataProvider));
      setApiUrl(getInitialApiUrl(config.dataProvider));
      setSseUrl(getInitialSseUrl(config.dataProvider));
      setProviderDefaults(config.dataProviderDefaults ?? {});
    }
  }, [
    isOpen,
    config.showFilters,
    config.showStyleSelector,
    config.dataProvider,
    config.dataProviderDefaults,
  ]);

  const isDirty = useSettingsDirty(isOpen, {
    showFilters,
    showStyleSelector,
    dataSourceMode,
    geoJsonText,
    apiUrl,
    sseUrl,
    providerDefaults,
  });

  const handleSave = () => {
    const dataProvider = buildDataProvider(
      dataSourceMode,
      geoJsonText,
      apiUrl,
      sseUrl
    );
    onSave({
      showFilters,
      showStyleSelector,
      dataProvider,
      dataProviderDefaults: hasDataProvider ? providerDefaults : undefined,
    });
    onClose();
  };

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
    >
      {/* Data Source Section */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {tr("dashboard.settings.dataSource", dictionary)}
      </h3>

      <div className="flex items-center justify-between">
        <Label
          htmlFor="data-source-mode"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          {tr("dashboard.settings.dataSourceMode", dictionary)}
        </Label>
        <Select
          id="data-source-mode"
          value={dataSourceMode}
          onChange={(e) => setDataSourceMode(e.target.value as DataSourceMode)}
          className="[&>select]:cursor-pointer w-40"
        >
          <option value="none">
            {tr("dashboard.settings.dataSourceNone", dictionary)}
          </option>
          <option value="static">
            {tr("dashboard.settings.dataSourceStatic", dictionary)}
          </option>
          <option value="api">
            {tr("dashboard.settings.dataSourceApi", dictionary)}
          </option>
          <option value="sse">
            {tr("dashboard.settings.dataSourceSse", dictionary)}
          </option>
        </Select>
      </div>

      {dataSourceMode === "static" && (
        <div className="space-y-2">
          <Label
            htmlFor="geojson-input"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {tr("dashboard.settings.geoJsonData", dictionary)}
          </Label>
          <Textarea
            id="geojson-input"
            value={geoJsonText}
            onChange={(e) => setGeoJsonText(e.target.value)}
            rows={8}
            placeholder='{"type": "FeatureCollection", "features": [...]}'
            className="font-mono text-xs"
            color={geoJsonError ? "failure" : undefined}
          />
          {geoJsonError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {tr("dashboard.settings.invalidGeoJson", dictionary)}
            </p>
          )}
        </div>
      )}

      {dataSourceMode === "api" && (
        <div className="space-y-2">
          <Label
            htmlFor="api-url-input"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {tr("dashboard.settings.apiUrl", dictionary)}
          </Label>
          <TextInput
            id="api-url-input"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com/geojson"
          />
        </div>
      )}

      {dataSourceMode === "sse" && (
        <div className="space-y-2">
          <Label
            htmlFor="sse-url-input"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {tr("dashboard.settings.sseUrl", dictionary)}
          </Label>
          <TextInput
            id="sse-url-input"
            value={sseUrl}
            onChange={(e) => setSseUrl(e.target.value)}
            placeholder="https://api.example.com/events"
          />
        </div>
      )}

      {/* Default Styles (only when data provider is active) */}
      {hasDataProvider && (
        <DefaultsSection
          defaults={providerDefaults}
          onChange={setProviderDefaults}
          dictionary={dictionary}
        />
      )}

      {/* Map Settings Section */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {tr("dashboard.settings.mapSettings", dictionary)}
      </h3>

      {/* Show Filters Toggle (hidden when data provider is active) */}
      {!hasDataProvider && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor="show-filters"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            {tr("dashboard.settings.showFilters", dictionary)}
          </Label>
          <ToggleSwitch
            id="show-filters"
            checked={showFilters}
            onChange={setShowFilters}
          />
        </div>
      )}

      {/* Show Style Selector Toggle */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="show-style-selector"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          {tr("dashboard.settings.showStyleSelector", dictionary)}
        </Label>
        <ToggleSwitch
          id="show-style-selector"
          checked={showStyleSelector}
          onChange={setShowStyleSelector}
        />
      </div>
    </SettingsShell>
  );
}
