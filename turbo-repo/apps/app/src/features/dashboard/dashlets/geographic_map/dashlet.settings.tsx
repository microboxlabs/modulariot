"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ToggleSwitch,
  Label,
  Textarea,
  TextInput,
  Select,
  Dropdown,
  DropdownItem,
  Tooltip,
} from "flowbite-react";
import { HiPlus, HiChevronDown, HiCheck, HiXMark, HiQuestionMarkCircle } from "react-icons/hi2";
import type { DashletSettingsProps, DataProviderEntry } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell, buildStandardTabs } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import {
  SettingsSelectField,
  SettingsTextField,
  SettingsNumberField,
  HbInlineInput,
  HbTextareaField,
  HbTextField,
} from "../common/settings-fields";
import { DeleteItemButton } from "../common/delete-item-button";
import { useActiveProviders } from "../common/use-active-providers";
import { PgrestFunctionAutocomplete } from "../common/pgrest-function-autocomplete";
import { PlannerVariableSelector } from "../common/planner-variable-selector";
import { useOptionalPlannerContext } from "../../context/planner-context";
import { useDashboardFilters } from "../../context/dashboard-filters-context";
import { useDataProvider } from "../common/use-data-provider";
import { DataProviderEntries } from "../common/data-provider-entries";
import { tr } from "@/features/i18n/tr.service";
import { resolveUrlTemplate } from "@/features/map-visualization/use-map-data-provider";
import { buildPgrestFetch } from "../common/pgrest-utils";
import { resolveFilterParams } from "../common/resolve-filter-params";
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

type DataSourceMode = "none" | "static" | "api" | "sse" | "pgrest" | "planner";

interface LayerSettingsItem {
  id: string;
  name: string;
  geometryType: MapLayerGeometryType;
  dataMode: DataSourceMode;
  geoJsonText: string;
  geoJsonError: boolean;
  apiUrl: string;
  refreshIntervalSec: number;
  sseUrl: string;
  pgrestFunctionName: string;
  pgrestParams: { key: string; value: string; _id: string }[];
  pgrestHttpMethod: "POST" | "GET";
  dataSourceId: string;
  plannerVariableName: string;
  transformWkb: boolean;
  geometryField: string;
  latField: string;
  lngField: string;
  responsePath: string;
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
  const geoFields = {
    geometryField: (item.geometryField ?? "").trim() || undefined,
    latField: (item.latField ?? "").trim() || undefined,
    lngField: (item.lngField ?? "").trim() || undefined,
    responsePath: (item.responsePath ?? "").trim() || undefined,
  };
  if (item.dataMode === "static") {
    const collection = validateGeoJson(item.geoJsonText);
    return collection ? { type: "static", data: collection } : undefined;
  }
  if (item.dataMode === "api" && item.apiUrl.trim()) {
    return {
      type: "api",
      url: item.apiUrl.trim(),
      refreshInterval: item.refreshIntervalSec > 0 ? item.refreshIntervalSec * 1000 : undefined,
      transformWkb: item.transformWkb || undefined,
      ...geoFields,
    };
  }
  if (item.dataMode === "sse" && item.sseUrl.trim()) {
    return {
      type: "sse",
      url: item.sseUrl.trim(),
      transformWkb: item.transformWkb || undefined,
      ...geoFields,
    };
  }
  if (item.dataMode === "pgrest" && item.pgrestFunctionName.trim()) {
    return {
      type: "pgrest",
      functionName: item.pgrestFunctionName.trim(),
      method: item.pgrestHttpMethod,
      params: item.pgrestParams
        .filter((p) => p.key.trim())
        .map((p) => ({ key: p.key, value: p.value })),
      dataSourceId: item.dataSourceId || undefined,
      refreshInterval: item.refreshIntervalSec > 0 ? item.refreshIntervalSec * 1000 : undefined,
      transformWkb: item.transformWkb || undefined,
      ...geoFields,
    };
  }
  if (item.dataMode === "planner" && (item.plannerVariableName ?? "").trim()) {
    return {
      type: "planner",
      variableName: (item.plannerVariableName ?? "").trim(),
      transformWkb: item.transformWkb || undefined,
      ...geoFields,
    };
  }
  return undefined;
}

function buildGeoFields(provider: NonNullable<MapLayer["provider"]>) {
  return {
    transformWkb: "transformWkb" in provider ? (provider.transformWkb ?? false) : false,
    geometryField: "geometryField" in provider ? (provider.geometryField ?? "") : "",
    latField: "latField" in provider ? (provider.latField ?? "") : "",
    lngField: "lngField" in provider ? (provider.lngField ?? "") : "",
    responsePath: "responsePath" in provider
      ? ((provider as { responsePath?: string }).responsePath ?? "")
      : "",
  };
}

function buildProviderFields(provider: MapLayer["provider"]) {
  let apiUrl = "";
  let sseUrl = "";
  let pgrestFunctionName = "";
  let pgrestParams: { key: string; value: string; _id: string }[] = [];
  let pgrestHttpMethod: "POST" | "GET" = "POST";
  let dataSourceId = "";
  let plannerVariableName = "";
  let refreshIntervalSec = 0;
  let transformWkb = false;
  let geometryField = "";
  let latField = "";
  let lngField = "";
  let responsePath = "";

  if (!provider || provider.type === "static") {
    return { apiUrl, sseUrl, pgrestFunctionName, pgrestParams, pgrestHttpMethod, dataSourceId, plannerVariableName, refreshIntervalSec, transformWkb, geometryField, latField, lngField, responsePath };
  }

  const geo = buildGeoFields(provider);
  transformWkb = geo.transformWkb;
  geometryField = geo.geometryField;
  latField = geo.latField;
  lngField = geo.lngField;
  responsePath = geo.responsePath;

  if (provider.type === "api") {
    apiUrl = provider.url;
    refreshIntervalSec = (provider.refreshInterval ?? 0) / 1000;
  } else if (provider.type === "sse") {
    sseUrl = provider.url;
  } else if (provider.type === "pgrest") {
    pgrestFunctionName = provider.functionName;
    pgrestParams = provider.params.map((p) => ({ ...p, _id: crypto.randomUUID() }));
    pgrestHttpMethod = provider.method;
    dataSourceId = provider.dataSourceId ?? "";
    refreshIntervalSec = (provider.refreshInterval ?? 0) / 1000;
  } else if (provider.type === "planner") {
    plannerVariableName = provider.variableName;
  }

  return { apiUrl, sseUrl, pgrestFunctionName, pgrestParams, pgrestHttpMethod, dataSourceId, plannerVariableName, refreshIntervalSec, transformWkb, geometryField, latField, lngField, responsePath };
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
    ...buildProviderFields(layer.provider),
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
    refreshIntervalSec: 0,
    sseUrl: "",
    pgrestFunctionName: "",
    pgrestParams: [],
    pgrestHttpMethod: "POST",
    dataSourceId: "",
    plannerVariableName: "",
    transformWkb: false,
    geometryField: "",
    latField: "",
    lngField: "",
    responsePath: "",
    style: { pointMode: "pin" },
    tooltip: { template: "" },
  };
}

// ============================================================================
// API Status Indicator
// ============================================================================

function ApiStatusIndicator({ url }: { readonly url: string }) {
  const searchParams = useSearchParams();
  const resolvedUrl = useMemo(
    () => resolveUrlTemplate(url, searchParams),
    [url, searchParams]
  );
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (!resolvedUrl.trim()) {
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const controller = new AbortController();

    fetch(resolvedUrl.trim(), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          setStatus("error");
          return;
        }
        await res.json();
        setStatus("success");
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [resolvedUrl]);

  if (status === "idle") return null;

  return (
    <div className="mb-1 flex h-8.5 w-8.5 shrink-0 items-center justify-center">
      {status === "loading" && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      )}
      {status === "success" && (
        <HiCheck className="h-5 w-5 text-green-500" />
      )}
      {status === "error" && (
        <HiXMark className="h-5 w-5 text-red-500" />
      )}
    </div>
  );
}

// ============================================================================
// Pgrest Layer Section
// ============================================================================

interface PgrestLayerSectionProps {
  item: LayerSettingsItem;
  set: <K extends keyof LayerSettingsItem>(key: K, value: LayerSettingsItem[K]) => void;
  onChange: (updated: LayerSettingsItem) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function PgrestLayerSection({
  item,
  set,
  onChange,
  dictionary,
}: Readonly<PgrestLayerSectionProps>) {
  const activeProviders = useActiveProviders();

  return (
    <>
      <div>
        <Label
          htmlFor={`pgrest-ds-${item.id}`}
          className="mb-1 block text-sm font-medium"
        >
          {tr("dashboard.settings.dataSourceProvider", dictionary)}
        </Label>
        <Select
          id={`pgrest-ds-${item.id}`}
          sizing="sm"
          value={item.dataSourceId}
          onChange={(e) => {
            onChange({ ...item, dataSourceId: e.target.value, pgrestFunctionName: "" });
          }}
          className="[&>select]:cursor-pointer"
        >
          <option value="">
            {activeProviders.length === 0
              ? tr("dashboard.settings.noActiveProviders", dictionary)
              : tr("dashboard.settings.selectProvider", dictionary)}
          </option>
          {activeProviders.map((ds) => (
            <option key={ds.id} value={ds.id}>
              {ds.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label
          htmlFor={`pgrest-fn-${item.id}`}
          className="mb-1 block text-sm font-medium"
        >
          {tr("dashboard.settings.functionName", dictionary)}
        </Label>
        <PgrestFunctionAutocomplete
          id={`pgrest-fn-${item.id}`}
          value={item.pgrestFunctionName}
          onChange={(v) => set("pgrestFunctionName", v)}
          onSelect={(v) => set("pgrestFunctionName", v)}
          dictionary={dictionary}
          dataSourceId={item.dataSourceId || undefined}
        />
      </div>
      <SettingsSelectField
        id={`pgrest-method-${item.id}`}
        label={tr("dashboard.settings.httpMethod", dictionary)}
        value={item.pgrestHttpMethod}
        onChange={(v) => set("pgrestHttpMethod", v as "POST" | "GET")}
        options={[
          { value: "POST", label: "POST" },
          { value: "GET", label: "GET" },
        ]}
      />
      <div>
        <div className="mb-1.5 flex items-center gap-1">
          <Label className="text-sm font-medium">
            {tr("dashboard.settings.parameters", dictionary)}
          </Label>
          <Tooltip
            content={
              <div className="space-y-1 text-xs">
                <p>
                  {tr("dashboard.settings.parametersHintIntro", dictionary)}{" "}
                  <code className="rounded bg-gray-600 px-1 py-0.5 font-mono text-white">
                    {"{{filter.<key>}}"}
                  </code>
                </p>
                <p className="font-semibold">{tr("dashboard.settings.parametersHintExamples", dictionary)}</p>
                <ul className="list-inside list-disc space-y-0.5">
                  <li>
                    <code className="font-mono">eq.{"{{filter.status}}"}</code>
                  </li>
                  <li>
                    <code className="font-mono">gte.{"{{filter.date_range_from}}"}</code>
                  </li>
                  <li>
                    <code className="font-mono">{"{{filter.organization_id}}"}</code>
                  </li>
                </ul>
              </div>
            }
            placement="top"
            className="max-w-72"
          >
            <HiQuestionMarkCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
          </Tooltip>
        </div>
        <div className="space-y-1.5">
          {item.pgrestParams.map((p) => (
            <div key={p._id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <TextInput
                  sizing="sm"
                  placeholder={tr("dashboard.settings.key", dictionary)}
                  value={p.key}
                  onChange={(e) => {
                    const updated = item.pgrestParams.map((pp) =>
                      pp._id === p._id ? { ...pp, key: e.target.value } : pp
                    );
                    set("pgrestParams", updated);
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <HbInlineInput
                  placeholder={tr("common.value", dictionary)}
                  value={p.value}
                  onChange={(v) => {
                    const updated = item.pgrestParams.map((pp) =>
                      pp._id === p._id ? { ...pp, value: v } : pp
                    );
                    set("pgrestParams", updated);
                  }}
                />
              </div>
              <DeleteItemButton
                onClick={() => {
                  set("pgrestParams", item.pgrestParams.filter((pp) => pp._id !== p._id));
                }}
                ariaLabel={tr("dashboard.settings.deleteParameter", dictionary)}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            set("pgrestParams", [
              ...item.pgrestParams,
              { key: "", value: "", _id: crypto.randomUUID() },
            ]);
          }}
          className="mt-2 flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <HiPlus className="h-3 w-3" />
          {tr("dashboard.settings.addParameter", dictionary)}
        </button>
      </div>
      <SettingsNumberField
        id={`geo-refresh-pgrest-${item.id}`}
        label={tr("dashboard.settings.refreshInterval", dictionary)}
        value={item.refreshIntervalSec}
        onChange={(v) => set("refreshIntervalSec", v)}
      />
    </>
  );
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
  const searchParams = useSearchParams();
  const resolvedApiUrl = useMemo(
    () => resolveUrlTemplate(item.apiUrl, searchParams),
    [item.apiUrl, searchParams]
  );
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
        <DeleteItemButton onClick={onDelete} ariaLabel={tr("dashboard.settings.deleteOrigin", dictionary)} />
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
            {
              value: "pgrest",
              label: tr("dashboard.settings.pgrest", dictionary),
            },
            {
              value: "planner",
              label: tr("dashboard.settings.planner", dictionary),
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
          <>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Label
                  htmlFor={`geo-apiurl-${item.id}`}
                  className="text-sm font-medium"
                >
                  {tr("dashboard.settings.apiUrl", dictionary)}
                </Label>
                {item.apiUrl !== resolvedApiUrl && (
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                    - {resolvedApiUrl}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <HbInlineInput
                    id={`geo-apiurl-${item.id}`}
                    value={item.apiUrl}
                    onChange={(v) => set("apiUrl", v)}
                    placeholder="https://api.example.com/geojson"
                  />
                </div>
                <ApiStatusIndicator url={item.apiUrl} />
              </div>
            </div>
            <SettingsNumberField
              id={`geo-refresh-${item.id}`}
              label={tr("dashboard.settings.refreshInterval", dictionary)}
              value={item.refreshIntervalSec}
              onChange={(v) => set("refreshIntervalSec", v)}
            />
          </>
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

        {item.dataMode === "pgrest" && (
          <PgrestLayerSection
            item={item}
            set={set}
            onChange={onChange}
            dictionary={dictionary}
          />
        )}

        {item.dataMode === "planner" && (
          <PlannerVariableSelector
            id={`geo-planner-${item.id}`}
            label={tr("dashboard.settings.plannerVariable", dictionary)}
            value={item.plannerVariableName}
            onChange={(v) => set("plannerVariableName", v)}
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

// ============================================================================
// Data Preview Section
// ============================================================================

interface DataPreviewSectionProps {
  item: LayerSettingsItem;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

/**
 * Determines whether a layer settings item has configured data.
 */
function layerHasData(item: LayerSettingsItem): boolean {
  switch (item.dataMode) {
    case "static":
      return item.geoJsonText.trim() !== "";
    case "api":
      return item.apiUrl.trim() !== "";
    case "pgrest":
      return item.pgrestFunctionName.trim() !== "";
    case "planner":
      return (item.plannerVariableName ?? "").trim() !== "";
    default:
      return false;
  }
}

/**
 * Applies a dot-notation responsePath to a JSON string, returning the extracted subset.
 */
function applyResponsePath(text: string, responsePath: string): string {
  const path = responsePath.trim();
  if (!path) return text;
  try {
    let extracted: unknown = JSON.parse(text);
    for (const key of path.split(".")) {
      if (extracted === null || extracted === undefined || typeof extracted !== "object") {
        return text;
      }
      extracted = (extracted as Record<string, unknown>)[key];
    }
    const result = JSON.stringify(extracted, null, 2);
    return result ?? "";
  } catch {
    return text;
  }
}

/**
 * Resolves preview text for planner-type layers from context results.
 */
function getPlannerPreview(
  item: LayerSettingsItem,
  plannerResults: Map<string, { rows: Record<string, string>[]; loading: boolean; error: string | null }>,
): string | null {
  if (item.dataMode !== "planner") return null;
  if (!(item.plannerVariableName ?? "").trim()) return null;
  const result = plannerResults.get(item.plannerVariableName);
  if (!result) return null;
  if (result.loading) return "__loading__";
  if (result.error) return `Error: ${result.error}`;
  return JSON.stringify(result.rows, null, 2);
}

/**
 * Picks the raw preview text based on the layer's data mode.
 */
function getRawPreviewText(
  item: LayerSettingsItem,
  plannerPreview: string | null,
  fetchedData: string | null,
): string | null {
  switch (item.dataMode) {
    case "static":
      return item.geoJsonText;
    case "planner":
      return plannerPreview;
    default:
      return fetchedData;
  }
}

function DataPreviewSection({
  item,
  dictionary,
}: Readonly<DataPreviewSectionProps>) {
  const searchParams = useSearchParams();
  const { results: plannerResults } = useOptionalPlannerContext();
  const { activeFilters } = useDashboardFilters();
  const resolvedApiUrl = useMemo(
    () => resolveUrlTemplate(item.apiUrl, searchParams),
    [item.apiUrl, searchParams]
  );
  const [open, setOpen] = useState(false);
  const [fetchedData, setFetchedData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasData = layerHasData(item);

  useEffect(() => {
    if (!open) return;

    let fetchUrl: string | null = null;
    let fetchInit: RequestInit = {};

    if (item.dataMode === "api" && resolvedApiUrl.trim()) {
      fetchUrl = resolvedApiUrl.trim();
    } else if (item.dataMode === "pgrest" && item.pgrestFunctionName.trim()) {
      const resolvedParams = resolveFilterParams(
        item.pgrestParams.filter((p) => p.key.trim()).map((p) => ({ key: p.key, value: p.value })),
        activeFilters,
      );
      const built = buildPgrestFetch(
        item.pgrestFunctionName.trim(),
        item.pgrestHttpMethod,
        resolvedParams,
        item.dataSourceId || undefined,
      );
      fetchUrl = built.url;
      fetchInit = built.init ?? {};
    }

    if (!fetchUrl) return;

    setLoading(true);
    setError(null);
    setFetchedData(null);

    const controller = new AbortController();
    fetch(fetchUrl, { ...fetchInit, signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setFetchedData(JSON.stringify(json, null, 2));
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [open, item.dataMode, resolvedApiUrl, item.pgrestFunctionName, item.pgrestHttpMethod, item.pgrestParams, item.dataSourceId, activeFilters]);

  const plannerPreview = useMemo(
    () => getPlannerPreview(item, plannerResults),
    [item, plannerResults]
  );

  const rawPreviewText = getRawPreviewText(item, plannerPreview, fetchedData);

  // Apply responsePath extraction to the preview
  const previewText = useMemo(() => {
    if (!rawPreviewText || rawPreviewText === "__loading__") return rawPreviewText;
    return applyResponsePath(rawPreviewText, item.responsePath ?? "");
  }, [rawPreviewText, item.responsePath]);

  if (!hasData && item.dataMode !== "sse") return null;

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
        <span>{tr("dashboard.settings.dataPreview", dictionary)}</span>
        {hasData && (
          <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
        )}
      </button>

      {open && (
        <div className="mt-2">
          {(loading || previewText === "__loading__") && (
            <p className="text-xs text-gray-400">{tr("dashboard.settings.previewLoading", dictionary)}</p>
          )}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          {item.dataMode === "sse" && (
            <p className="text-xs text-gray-400 italic">
              {tr("dashboard.settings.ssePreviewUnavailable", dictionary)}
            </p>
          )}
          {previewText && previewText !== "__loading__" && (
            <Textarea
              readOnly
              value={previewText}
              rows={8}
              className="font-mono text-xs"
            />
          )}
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

  const set = useCallback(
    <K extends keyof LayerSettingsItem>(key: K, value: LayerSettingsItem[K]) =>
      onChange({ ...item, [key]: value }),
    [item, onChange]
  );

  const hasDataProvider =
    item.dataMode === "api" ||
    item.dataMode === "sse" ||
    item.dataMode === "pgrest" ||
    item.dataMode === "planner";

  const isPinMode = (item.style.pointMode ?? "pin") === "pin";

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
              value={item.style.pointMode ?? "pin"}
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

        {hasDataProvider && (
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`geo-wkb-${item.id}`}
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              {tr("dashboard.settings.transformWkb", dictionary)}
            </Label>
            <ToggleSwitch
              id={`geo-wkb-${item.id}`}
              checked={item.transformWkb}
              onChange={(v) => set("transformWkb", v)}
            />
          </div>
        )}

        {hasDataProvider && item.transformWkb && (
          <HbTextField
            id={`geo-geomfield-${item.id}`}
            label={tr("dashboard.settings.geometryField", dictionary)}
            value={item.geometryField}
            onChange={(v) => set("geometryField", v)}
            placeholder="location"
            tooltip={tr("dashboard.settings.geometryFieldTooltip", dictionary)}
          />
        )}

        {hasDataProvider && !item.transformWkb && (
          <div className="grid grid-cols-2 gap-2">
            <HbTextField
              id={`geo-latfield-${item.id}`}
              label={tr("dashboard.settings.latField", dictionary)}
              value={item.latField}
              onChange={(v) => set("latField", v)}
              placeholder="lat"
              tooltip={tr("dashboard.settings.latFieldTooltip", dictionary)}
            />
            <HbTextField
              id={`geo-lngfield-${item.id}`}
              label={tr("dashboard.settings.lngField", dictionary)}
              value={item.lngField}
              onChange={(v) => set("lngField", v)}
              placeholder="lng"
              tooltip={tr("dashboard.settings.lngFieldTooltip", dictionary)}
            />
          </div>
        )}

        {hasDataProvider && (
          <HbTextField
            id={`geo-responsepath-${item.id}`}
            label={tr("dashboard.settings.responsePath", dictionary)}
            value={item.responsePath}
            onChange={(v) => set("responsePath", v)}
            placeholder="data.results"
            tooltip={tr("dashboard.settings.responsePathTooltip", dictionary)}
          />
        )}
      </div>
      <TooltipLayerSection item={item} onChange={onChange} dictionary={dictionary} />
      <DataPreviewSection item={item} dictionary={dictionary} />
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
  pointMode: PointRenderMode;
  onPointModeChange: (v: PointRenderMode) => void;
  layers: LayerSettingsItem[];
  onLayersChange: (layers: LayerSettingsItem[]) => void;
  dictionary: DashletSettingsProps<DashletConfig>["dictionary"];
}

function VisualizationTab({
  showFilters,
  onShowFiltersChange,
  showStyleSelector,
  onShowStyleSelectorChange,
  pointMode,
  onPointModeChange,
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

      {layers.length === 0 && (
        <SettingsSelectField
          id="vis-pointmode-global"
          label={tr("dashboard.settings.pointStyle", dictionary)}
          value={pointMode}
          onChange={(v) => onPointModeChange(v as PointRenderMode)}
          options={POINT_MODE_KEYS.map((opt) => ({
            value: opt.value,
            label: tr(opt.labelKey, dictionary),
          }))}
        />
      )}

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const dp = useDataProvider(
    (config.dataProvider ?? []) as DataProviderEntry[]
  );

  useEffect(() => {
    if (isOpen) {
      setShowFilters(config.showFilters ?? true);
      setShowStyleSelector(config.showStyleSelector ?? true);
      setPointMode(config.pointMode ?? "pin");
      setLayers((config.layers ?? []).map(mapLayerToSettingsItem));
      setSaveError(null);
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
    const invalidLayers = layers.filter(
      (item) => item.dataMode !== "none" && buildProvider(item) === undefined
    );
    if (invalidLayers.length > 0) {
      const names = invalidLayers
        .map((item) => item.name.trim() || tr("dashboard.settings.unnamedOrigin", dictionary))
        .join(", ");
      setSaveError(
        `${tr("dashboard.settings.layerSaveError", dictionary)}: ${names}`
      );
      return;
    }
    setSaveError(null);
    onSave({
      showFilters,
      showStyleSelector,
      pointMode,
      layers: layers
        .filter((item) => item.dataMode !== "none")
        .map(settingsItemToMapLayer),
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
          pointMode={pointMode}
          onPointModeChange={setPointMode}
          layers={layers}
          onLayersChange={setLayers}
          dictionary={dictionary}
        />,
        <>
          {saveError && (
            <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {saveError}
            </p>
          )}
          <DataProviderTab
            layers={layers}
            onLayersChange={(next) => { setSaveError(null); setLayers(next); }}
            dictionary={dictionary}
          />
          <hr className="my-3 border-gray-200 dark:border-gray-700" />
          <DataProviderEntries dataProvider={dp} dictionary={dictionary} />
        </>
      )}
    />
  );
}
