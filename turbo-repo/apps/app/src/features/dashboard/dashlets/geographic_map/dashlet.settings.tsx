"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ToggleSwitch,
  Label,
  Textarea,
  Dropdown,
  DropdownItem,
} from "flowbite-react";
import { HiPlus, HiChevronDown } from "react-icons/hi2";
import type { DashletSettingsProps, DataProviderEntry } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import {
  SettingsSelectField,
  SettingsTextField,
  SettingsNumberField,
  HbTextareaField,
} from "../common/settings-fields";
import { DeleteItemButton } from "../common/delete-item-button";
import { useDataProvider } from "../common/use-data-provider";
import { DataProviderEntries } from "../common/data-provider-entries";
import { tr } from "@/features/i18n/tr.service";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker/advanced-color-picker";
import type {
  MapLayer,
  MapLayerGeometryType,
  MapLayerStyle,
  MapLayerTooltip,
  MapDataProvider,
  PointRenderMode,
} from "@/features/map-visualization/map-data-provider.types";
import type { FeatureCollection } from "geojson";

// ============================================================================
// Types
// ============================================================================

type DataSourceMode = "none" | "static" | "api" | "sse";

interface LayerSettingsItem {
  id: string;
  name: string;
  geometryType: MapLayerGeometryType;
  dataMode: DataSourceMode;
  geoJsonText: string;
  geoJsonError: boolean;
  apiUrl: string;
  sseUrl: string;
  style: MapLayerStyle;
  tooltip: MapLayerTooltip;
}

// ============================================================================
// Sample GeoJSON per geometry type
// ============================================================================

const SAMPLE_GEOJSON: Record<MapLayerGeometryType, string> = {
  Point: JSON.stringify(
    {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-70.6693, -33.4489] },
          properties: { label: "Sensor A", value: 42 },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-70.6107, -33.4263] },
          properties: { label: "Sensor B", value: 87 },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-70.5757, -33.4074] },
          properties: { label: "Sensor C", value: 15 },
        },
      ],
    },
    null,
    2
  ),
  LineString: JSON.stringify(
    {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [-70.6693, -33.4489],
              [-70.64, -33.438],
              [-70.6107, -33.4263],
              [-70.5757, -33.4074],
            ],
          },
          properties: { label: "Route A" },
        },
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [-70.68, -33.46],
              [-70.66, -33.47],
              [-70.635, -33.48],
            ],
          },
          properties: { label: "Route B" },
        },
      ],
    },
    null,
    2
  ),
  Polygon: JSON.stringify(
    {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-70.69, -33.47],
                [-70.65, -33.47],
                [-70.65, -33.43],
                [-70.69, -33.43],
                [-70.69, -33.47],
              ],
            ],
          },
          properties: { label: "Zone A" },
        },
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-70.62, -33.45],
                [-70.58, -33.45],
                [-70.58, -33.41],
                [-70.62, -33.41],
                [-70.62, -33.45],
              ],
            ],
          },
          properties: { label: "Zone B" },
        },
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-72.392729, -37.537747],
                [-72.292729, -37.537747],
                [-72.292729, -37.437747],
                [-72.392729, -37.437747],
                [-72.392729, -37.537747],
              ],
            ],
          },
          properties: { label: "Zone C" },
        },
      ],
    },
    null,
    2
  ),
};

// ============================================================================
// Helpers
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

function detectGeometryType(
  collection: FeatureCollection
): MapLayerGeometryType | null {
  const counts: Record<MapLayerGeometryType, number> = {
    Point: 0,
    LineString: 0,
    Polygon: 0,
  };
  for (const f of collection.features) {
    const t = f.geometry?.type;
    if (typeof t !== "string") continue;
    if (t === "Point" || t === "MultiPoint") counts.Point++;
    else if (t === "LineString" || t === "MultiLineString") counts.LineString++;
    else if (t === "Polygon" || t === "MultiPolygon") counts.Polygon++;
  }
  const [best] = (
    Object.entries(counts) as [MapLayerGeometryType, number][]
  ).sort((a, b) => b[1] - a[1]);
  return best[1] > 0 ? best[0] : null;
}

function buildProvider(item: LayerSettingsItem): MapDataProvider | undefined {
  if (item.dataMode === "static") {
    const collection = validateGeoJson(item.geoJsonText);
    return collection ? { type: "static", data: collection } : undefined;
  }
  if (item.dataMode === "api" && item.apiUrl.trim()) {
    return { type: "api", url: item.apiUrl.trim() };
  }
  if (item.dataMode === "sse" && item.sseUrl.trim()) {
    return { type: "sse", url: item.sseUrl.trim() };
  }
  return undefined;
}

function mapLayerToSettingsItem(layer: MapLayer): LayerSettingsItem {
  const mode = (layer.provider?.type ?? "none") as DataSourceMode;
  const geoJsonText =
    layer.provider?.type === "static"
      ? JSON.stringify(layer.provider.data, null, 2)
      : "";
  return {
    id: layer.id,
    name: layer.name,
    geometryType: layer.geometryType,
    dataMode: mode,
    geoJsonText,
    geoJsonError: false,
    apiUrl: layer.provider?.type === "api" ? layer.provider.url : "",
    sseUrl: layer.provider?.type === "sse" ? layer.provider.url : "",
    style: layer.style ?? {},
    tooltip: layer.tooltip ?? { template: "" },
  };
}

function settingsItemToMapLayer(item: LayerSettingsItem): MapLayer {
  return {
    id: item.id,
    name: item.name,
    geometryType: item.geometryType,
    provider: buildProvider(item),
    style: item.style,
    tooltip: item.tooltip,
  };
}

function newLayerItem(): LayerSettingsItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    geometryType: "Point",
    dataMode: "none",
    geoJsonText: "",
    geoJsonError: false,
    apiUrl: "",
    sseUrl: "",
    style: { pointMode: "pin" },
    tooltip: { template: "" },
  };
}

// ============================================================================
// Layer Card
// ============================================================================

interface LayerCardProps {
  item: LayerSettingsItem;
  onChange: (updated: LayerSettingsItem) => void;
  onDelete: () => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function LayerCard({
  item,
  onChange,
  onDelete,
  dictionary,
}: Readonly<LayerCardProps>) {
  const set = useCallback(
    <K extends keyof LayerSettingsItem>(
      key: K,
      value: LayerSettingsItem[K]
    ) => {
      const updated = { ...item, [key]: value };

      // Auto-fill sample GeoJSON when switching to static with no existing data
      if (
        key === "dataMode" &&
        value === "static" &&
        !item.geoJsonText.trim()
      ) {
        updated.geoJsonText = SAMPLE_GEOJSON[item.geometryType];
      }

      // Reset to sample GeoJSON when geometry type changes while on static
      if (key === "geometryType" && item.dataMode === "static") {
        updated.geoJsonText = SAMPLE_GEOJSON[value as MapLayerGeometryType];
        updated.geoJsonError = false;
      }

      onChange(updated);
    },
    [item, onChange]
  );

  const handleGeoJson = (text: string) => {
    const collection = text.trim() ? validateGeoJson(text) : null;
    const error = text.trim() !== "" && collection === null;
    const detected = collection ? detectGeometryType(collection) : null;
    onChange({
      ...item,
      geoJsonText: text,
      geoJsonError: error,
      ...(detected ? { geometryType: detected } : {}),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-600">
        <input
          type="text"
          value={item.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={tr(
            "dashboard.settings.originNamePlaceholder",
            dictionary
          )}
          className="min-w-0 flex-1 rounded border-0 bg-transparent text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 dark:text-white dark:placeholder-gray-500"
        />
        <GeometryBadgeSelector
          type={item.geometryType}
          onChange={(t) => set("geometryType", t)}
          dictionary={dictionary}
        />
        <DeleteItemButton onClick={onDelete} ariaLabel="Delete origin" />
      </div>

      {/* Body */}
      <div className="space-y-3 p-3">
        {/* Data source */}
        <SettingsSelectField
          id={`geo-dsmode-${item.id}`}
          label={tr("dashboard.settings.dataSource", dictionary)}
          value={item.dataMode}
          onChange={(v) => set("dataMode", v as DataSourceMode)}
          options={[
            {
              value: "none",
              label: tr("dashboard.settings.dataSourceNone", dictionary),
            },
            {
              value: "static",
              label: tr("dashboard.settings.dataSourceStatic", dictionary),
            },
            {
              value: "api",
              label: tr("dashboard.settings.dataSourceApi", dictionary),
            },
            {
              value: "sse",
              label: tr("dashboard.settings.dataSourceSse", dictionary),
            },
          ]}
        />

        {item.dataMode === "static" && (
          <div>
            <Label
              htmlFor={`geo-geojson-${item.id}`}
              className="mb-1 block text-sm font-medium"
            >
              {tr("dashboard.settings.geoJsonData", dictionary)}
            </Label>
            <Textarea
              id={`geo-geojson-${item.id}`}
              value={item.geoJsonText}
              onChange={(e) => handleGeoJson(e.target.value)}
              rows={6}
              placeholder='{"type": "FeatureCollection", "features": [...]}'
              className="font-mono text-xs"
              color={item.geoJsonError ? "failure" : "gray"}
            />
            {item.geoJsonError && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {tr("dashboard.settings.invalidGeoJson", dictionary)}
              </p>
            )}
          </div>
        )}

        {item.dataMode === "api" && (
          <SettingsTextField
            id={`geo-apiurl-${item.id}`}
            label={tr("dashboard.settings.apiUrl", dictionary)}
            value={item.apiUrl}
            onChange={(v) => set("apiUrl", v)}
            placeholder="https://api.example.com/geojson"
          />
        )}

        {item.dataMode === "sse" && (
          <SettingsTextField
            id={`geo-sseurl-${item.id}`}
            label={tr("dashboard.settings.sseUrl", dictionary)}
            value={item.sseUrl}
            onChange={(v) => set("sseUrl", v)}
            placeholder="https://api.example.com/events"
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Geometry type badge / selector
// ============================================================================

const GEOMETRY_ORDER: MapLayerGeometryType[] = [
  "Point",
  "LineString",
  "Polygon",
];

const GEOMETRY_CONFIG: Record<
  MapLayerGeometryType,
  { labelKey: string; cls: string }
> = {
  Point: {
    labelKey: "dashboard.settings.geometryPoint",
    cls: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/70",
  },
  LineString: {
    labelKey: "dashboard.settings.geometryPath",
    cls: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/70",
  },
  Polygon: {
    labelKey: "dashboard.settings.geometryPolygon",
    cls: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/70",
  },
};

/** Read-only badge — used in LayerStyleCard where type cannot be changed */
function GeometryBadge({
  type,
  dictionary,
}: Readonly<{
  type: MapLayerGeometryType;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}>) {
  const { labelKey, cls } = GEOMETRY_CONFIG[type];
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {tr(labelKey, dictionary)}
    </span>
  );
}

/** Badge-styled Flowbite dropdown for selecting geometry type */
function GeometryBadgeSelector({
  type,
  onChange,
  dictionary,
}: Readonly<{
  type: MapLayerGeometryType;
  onChange: (t: MapLayerGeometryType) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}>) {
  const { labelKey } = GEOMETRY_CONFIG[type];
  return (
    <Dropdown
      label=""
      dismissOnClick
      renderTrigger={() => (
        <button
          type="button"
          className="no-drag flex h-7 shrink-0 cursor-pointer items-center justify-between gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
        >
          {tr(labelKey, dictionary)}
          <HiChevronDown className="h-3 w-3 shrink-0" />
        </button>
      )}
    >
      {GEOMETRY_ORDER.map((t) => (
        <DropdownItem key={t} onClick={() => onChange(t)} className="text-xs">
          {tr(GEOMETRY_CONFIG[t].labelKey, dictionary)}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

// ============================================================================
// ============================================================================
// Layer Style Card (lives in Visualization tab)
// ============================================================================

interface LayerStyleCardProps {
  item: LayerSettingsItem;
  onChange: (updated: LayerSettingsItem) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

const POINT_MODE_KEYS: { value: PointRenderMode; labelKey: string }[] = [
  { value: "pin", labelKey: "dashboard.settings.pointStylePin" },
  {
    value: "location-pin",
    labelKey: "dashboard.settings.pointStyleLocationPin",
  },
  { value: "circle", labelKey: "dashboard.settings.pointStyleCircle" },
];

// ============================================================================
// Tooltip Layer Section
// ============================================================================

interface TooltipLayerSectionProps {
  item: LayerSettingsItem;
  onChange: (updated: LayerSettingsItem) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function TooltipLayerSection({
  item,
  onChange,
  dictionary,
}: Readonly<TooltipLayerSectionProps>) {
  const [open, setOpen] = useState(false);

  const template = item.tooltip?.template ?? "";

  const handleTemplate = (value: string) => {
    onChange({ ...item, tooltip: { template: value } });
  };

  return (
    <div className="border-t border-gray-200 px-3 py-1.5 dark:border-gray-600">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <HiChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span>{tr("dashboard.settings.tooltipSection", dictionary)}</span>
        {template.trim() && (
          <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
        )}
      </button>

      {open && (
        <div className="mt-2">
          <HbTextareaField
            id={`tooltip-tpl-${item.id}`}
            label={tr("dashboard.settings.tooltipTemplate", dictionary)}
            value={template}
            onChange={handleTemplate}
            placeholder="{{row.label}}: {{row.value}}"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

function LayerStyleCard({
  item,
  onChange,
  dictionary,
}: Readonly<LayerStyleCardProps>) {
  const setStyle = useCallback(
    <K extends keyof MapLayerStyle>(key: K, value: MapLayerStyle[K]) =>
      onChange({ ...item, style: { ...item.style, [key]: value } }),
    [item, onChange]
  );

  const isPinMode = item.style.pointMode === "pin";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-600">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
          {item.name || tr("dashboard.settings.unnamedOrigin", dictionary)}
        </span>
        <GeometryBadge type={item.geometryType} dictionary={dictionary} />
      </div>

      <div className="p-3 space-y-3">
        {/* Point */}
        {item.geometryType === "Point" && (
          <div className="flex items-end gap-2">
            <SettingsSelectField
              id={`vis-pointmode-${item.id}`}
              label={tr("dashboard.settings.pointStyle", dictionary)}
              value={item.style.pointMode ?? "location-pin"}
              onChange={(v) => setStyle("pointMode", v as PointRenderMode)}
              options={POINT_MODE_KEYS.map((opt) => ({
                value: opt.value,
                label: tr(opt.labelKey, dictionary),
              }))}
            />
            {!isPinMode && (
              <AdvancedColorPicker
                value={item.style.color ?? "3388FF"}
                onChange={(v) => setStyle("color", v || undefined)}
                title={tr("dashboard.settings.pointColor", dictionary)}
                className="h-8.5 w-8.5 min-h-8.5 min-w-8.5"
              />
            )}
          </div>
        )}

        {/* LineString — width + color inline */}
        {item.geometryType === "LineString" && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SettingsNumberField
                id={`vis-lw-${item.id}`}
                label={tr("dashboard.settings.lineWidth", dictionary)}
                value={item.style.lineWidth ?? 3}
                onChange={(v) => setStyle("lineWidth", v)}
              />
            </div>
            <AdvancedColorPicker
              value={item.style.color ?? "3388FF"}
              onChange={(v) => setStyle("color", v || undefined)}
              title={tr("dashboard.settings.lineColor", dictionary)}
              className="shrink-0 h-8.5 w-8.5 min-h-8.5 min-w-8.5"
            />
          </div>
        )}

        {/* Polygon */}
        {item.geometryType === "Polygon" && (
          <div className="space-y-3">
            {/* Fill: opacity input + fill color picker */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SettingsNumberField
                  id={`vis-opacity-${item.id}`}
                  label={tr("dashboard.settings.polygonFillOpacity", dictionary)}
                  value={item.style.opacity ?? 0.35}
                  onChange={(v) => setStyle("opacity", v)}
                  step="0.05"
                  min={0}
                  max={1}
                />
              </div>
              <AdvancedColorPicker
                value={item.style.color ?? "3388FF"}
                onChange={(v) => setStyle("color", v || undefined)}
                title={tr("dashboard.settings.polygonFillColor", dictionary)}
                className="shrink-0 h-8.5 w-8.5 min-h-8.5 min-w-8.5"
              />
            </div>
            {/* Border: stroke width input + stroke color picker */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SettingsNumberField
                  id={`vis-lw-${item.id}`}
                  label={tr("dashboard.settings.polygonStrokeWidth", dictionary)}
                  value={item.style.lineWidth ?? 3}
                  onChange={(v) => setStyle("lineWidth", v)}
                />
              </div>
              <AdvancedColorPicker
                value={item.style.strokeColor ?? "FFFFFF"}
                onChange={(v) => setStyle("strokeColor", v || undefined)}
                title={tr("dashboard.settings.polygonStrokeColor", dictionary)}
                className="shrink-0 h-8.5 w-8.5 min-h-8.5 min-w-8.5"
              />
            </div>
          </div>
        )}

      </div>
      <TooltipLayerSection item={item} onChange={onChange} dictionary={dictionary} />
    </div>
  );
}

// ============================================================================
// Visualization Tab
// ============================================================================

interface VisualizationTabProps {
  showFilters: boolean;
  onShowFiltersChange: (v: boolean) => void;
  showStyleSelector: boolean;
  onShowStyleSelectorChange: (v: boolean) => void;
  layers: LayerSettingsItem[];
  onLayersChange: (layers: LayerSettingsItem[]) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function VisualizationTab({
  showFilters,
  onShowFiltersChange,
  showStyleSelector,
  onShowStyleSelectorChange,
  layers,
  onLayersChange,
  dictionary,
}: Readonly<VisualizationTabProps>) {
  const handleStyleChange = useCallback(
    (index: number, updated: LayerSettingsItem) => {
      const next = [...layers];
      next[index] = updated;
      onLayersChange(next);
    },
    [layers, onLayersChange]
  );

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {tr("dashboard.settings.mapSettings", dictionary)}
      </h3>

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
          onChange={onShowFiltersChange}
        />
      </div>

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
          onChange={onShowStyleSelectorChange}
        />
      </div>

      {layers.length > 0 && (
        <>
          <hr className="border-gray-200 dark:border-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr("dashboard.settings.layerStyles", dictionary)}
          </h3>
          {layers.map((item, index) => (
            <LayerStyleCard
              key={item.id}
              item={item}
              onChange={(updated) => handleStyleChange(index, updated)}
              dictionary={dictionary}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Data Provider Tab
// ============================================================================

interface DataProviderTabProps {
  layers: LayerSettingsItem[];
  onLayersChange: (layers: LayerSettingsItem[]) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function DataProviderTab({
  layers,
  onLayersChange,
  dictionary,
}: Readonly<DataProviderTabProps>) {
  const handleChange = useCallback(
    (index: number, updated: LayerSettingsItem) => {
      const next = [...layers];
      next[index] = updated;
      onLayersChange(next);
    },
    [layers, onLayersChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      onLayersChange(layers.filter((_, i) => i !== index));
    },
    [layers, onLayersChange]
  );

  const handleAdd = () => {
    onLayersChange([...layers, newLayerItem()]);
  };

  return (
    <div className="space-y-3">
      {layers.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {tr("dashboard.settings.noDataOrigins", dictionary)}
        </p>
      )}

      {layers.map((item, index) => (
        <LayerCard
          key={item.id}
          item={item}
          onChange={(updated) => handleChange(index, updated)}
          onDelete={() => handleDelete(index)}
          dictionary={dictionary}
        />
      ))}

      <button
        type="button"
        onClick={handleAdd}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
      >
        <HiPlus className="h-4 w-4" />
        {tr("dashboard.settings.addOrigin", dictionary)}
      </button>
    </div>
  );
}

// ============================================================================
// Main Settings Component
// ============================================================================

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
  const [pointMode, setPointMode] = useState<PointRenderMode>(
    config.pointMode ?? "pin"
  );
  const [layers, setLayers] = useState<LayerSettingsItem[]>(() =>
    (config.layers ?? []).map(mapLayerToSettingsItem)
  );
  const dp = useDataProvider(
    (config.dataProvider ?? []) as DataProviderEntry[]
  );

  useEffect(() => {
    if (isOpen) {
      setShowFilters(config.showFilters ?? true);
      setShowStyleSelector(config.showStyleSelector ?? true);
      setPointMode(config.pointMode ?? "pin");
      setLayers((config.layers ?? []).map(mapLayerToSettingsItem));
    }
  }, [
    isOpen,
    config.showFilters,
    config.showStyleSelector,
    config.pointMode,
    config.layers,
  ]);

  const isDirty = useSettingsDirty(isOpen, {
    showFilters,
    showStyleSelector,
    pointMode,
    layers,
    dpEntries: dp.dataProvider,
  });

  const handleSave = () => {
    onSave({
      showFilters,
      showStyleSelector,
      pointMode,
      layers: layers
        .map(settingsItemToMapLayer)
        .filter((l) => l.provider !== undefined),
      dataProvider: dp.getCleanEntries(),
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
      tabs={buildStandardTabs(
        dictionary,
        <VisualizationTab
          showFilters={showFilters}
          onShowFiltersChange={setShowFilters}
          showStyleSelector={showStyleSelector}
          onShowStyleSelectorChange={setShowStyleSelector}
          layers={layers}
          onLayersChange={setLayers}
          dictionary={dictionary}
        />,
        <>
          <DataProviderTab
            layers={layers}
            onLayersChange={setLayers}
            dictionary={dictionary}
          />
          <hr className="my-3 border-gray-200 dark:border-gray-700" />
          <DataProviderEntries dataProvider={dp} dictionary={dictionary} />
        </>
      )}
    />
  );
}
