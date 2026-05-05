import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { FeatureCollection } from "geojson";
import type { MapDataProvider, MapLayer } from "./map-data-provider.types";
import { parseWKBPoint } from "@/utils/map-conversion";
import { buildPgrestFetch } from "@/features/dashboard/dashlets/common/pgrest-utils";
import { resolveFilterParams } from "@/features/dashboard/dashlets/common/resolve-filter-params";
import { useOptionalPlannerContext } from "@/features/dashboard/context/planner-context";
import { useDashboardFilters } from "@/features/dashboard/context/dashboard-filters-context";

// ============================================================================
// URL template resolution
// ============================================================================

/**
 * Resolves `{{param}}` placeholders in a URL using the given search params.
 * E.g. `/app/api/map?plate={{license_plate}}` → `/app/api/map?plate=ABC123`
 */
export function resolveUrlTemplate(
  url: string,
  params: URLSearchParams
): string {
  return url.replaceAll(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
    return encodeURIComponent(params.get(key.trim()) ?? "");
  });
}

// ============================================================================
// WKB → GeoJSON transform
// ============================================================================

/**
 * Converts a MapPosition array (or single record) with WKB-encoded geometry
 * fields into a GeoJSON FeatureCollection of Point features.
 * @param raw - The raw response data (array of records or single record)
 * @param geometryField - The field name containing the WKB data. Defaults to "location".
 */
function wkbResponseToGeoJson(raw: unknown, geometryField = "location"): FeatureCollection {
  const records = Array.isArray(raw) ? raw : [raw];
  return {
    type: "FeatureCollection",
    features: records
      .map((record) => {
        const r = record as Record<string, unknown>;
        const location = r[geometryField];
        if (!location || typeof location !== "string") return null;
        try {
          const [lng, lat] = parseWKBPoint(location);
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [lng, lat] },
            properties: r,
          };
        } catch {
          return null;
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

/**
 * Converts rows with separate lat/lng columns into a GeoJSON FeatureCollection.
 */
function latLngToGeoJson(raw: unknown, latField: string, lngField: string): FeatureCollection {
  const records = Array.isArray(raw) ? raw : [raw];
  return {
    type: "FeatureCollection",
    features: records
      .map((record) => {
        const r = record as Record<string, unknown>;
        const rawLat = r[latField];
        const rawLng = r[lngField];
        const lat = Number.parseFloat(typeof rawLat === "string" || typeof rawLat === "number" ? String(rawLat) : "");
        const lng = Number.parseFloat(typeof rawLng === "string" || typeof rawLng === "number" ? String(rawLng) : "");
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lng, lat] },
          properties: r,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

/**
 * Converts raw data to GeoJSON using provider geometry config.
 * Priority: transformWkb (uses geometryField), then latField/lngField, then passthrough.
 */
function rowsToGeoJson(
  raw: unknown,
  opts: { transformWkb?: boolean; geometryField?: string; latField?: string; lngField?: string; responsePath?: string }
): FeatureCollection {
  const data = opts.responsePath ? extractByPath(raw, opts.responsePath) : raw;
  if (data === null || data === undefined) {
    return { type: "FeatureCollection", features: [] };
  }
  if (opts.transformWkb) {
    return wkbResponseToGeoJson(data, opts.geometryField || "location");
  }
  if (opts.latField && opts.lngField) {
    return latLngToGeoJson(data, opts.latField, opts.lngField);
  }
  // If data looks like a valid FeatureCollection, return it
  if (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type: unknown }).type === "FeatureCollection" &&
    "features" in data &&
    Array.isArray((data as { features: unknown }).features)
  ) {
    return data as FeatureCollection;
  }
  // Fallback: empty collection
  return { type: "FeatureCollection", features: [] };
}

/**
 * Fetches a URL and converts the response to a GeoJSON FeatureCollection.
 * Throws on HTTP errors or AbortError (caller should check for AbortError).
 */
async function fetchGeoJson(
  url: string,
  init: RequestInit,
  provider: { transformWkb?: boolean; geometryField?: string; latField?: string; lngField?: string; responsePath?: string },
  unwrapResponse = false,
): Promise<FeatureCollection> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  let raw: unknown = json;
  if (unwrapResponse && !provider.responsePath) {
    raw = unwrapPgrestResponse(json);
  }
  return (provider.transformWkb || provider.latField || provider.responsePath)
    ? rowsToGeoJson(raw, provider)
    : (raw as FeatureCollection);
}

/**
 * Extracts a nested value from an object using dot-notation path.
 * E.g. extractByPath({ data: [1,2] }, "data") → [1,2]
 * E.g. extractByPath({ results: { items: [...] } }, "results.items") → [...]
 */
function extractByPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") {
      return current;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Unwraps a pgrest response that may be nested in a `data` property.
 * Handles `{ data: [...] }` or `{ data: { ... } }` wrappers common in RPC responses.
 */
function unwrapPgrestResponse(json: unknown): unknown {
  if (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    "data" in json
  ) {
    return (json as Record<string, unknown>).data;
  }
  return json;
}

/**
 * Fires fetchData immediately and, if refreshInterval > 0, serializes refreshes
 * using an async loop that awaits each fetch before scheduling the next timeout.
 * Pushes cleanup into the provided cleanups array.
 */
function scheduleRefetch(
  fetchData: () => Promise<void>,
  refreshInterval: number | undefined,
  cleanups: (() => void)[],
): void {
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const loop = async () => {
    while (!cancelled) {
      await fetchData();
      if (cancelled || !refreshInterval || refreshInterval <= 0) break;
      await new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, refreshInterval);
      });
    }
  };

  void loop();

  cleanups.push(() => {
    cancelled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

// ============================================================================
// Single-provider hook
// ============================================================================

interface MapDataProviderResult {
  data: FeatureCollection | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMapDataProvider(
  provider: MapDataProvider | undefined
): MapDataProviderResult {
  const searchParams = useSearchParams();
  const { results: plannerResults } = useOptionalPlannerContext();
  const { activeFilters } = useDashboardFilters();
  const [dynamicData, setDynamicData] = useState<FeatureCollection | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const staticData = useMemo(() => {
    if (provider?.type === "static") {
      return provider.data;
    }
    return null;
  }, [provider]);

  // Handle planner data from context (not a fetch)
  const plannerData = useMemo(() => {
    if (provider?.type !== "planner") return null;
    const result = plannerResults.get(provider.variableName);
    if (!result || result.loading || result.error) return null;
    return rowsToGeoJson(result.rows, provider);
  }, [provider, plannerResults]);

  useEffect(() => {
    if (provider?.type !== "api" && provider?.type !== "sse" && provider?.type !== "pgrest" && provider?.type !== "planner") {
      return;
    }

    setIsLoading(true);
    setDynamicData(null);
    setError(null);

    if (provider.type === "api") {
      const resolvedUrl = resolveUrlTemplate(provider.url, searchParams);
      const method = provider.method ?? "GET";
      const controller = new AbortController();

      const fetchData = async () => {
        try {
          const data = await fetchGeoJson(resolvedUrl, { method, signal: controller.signal }, provider);
          setDynamicData(data);
          setIsLoading(false);
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      };

      const cleanups: (() => void)[] = [() => controller.abort()];
      scheduleRefetch(fetchData, provider.refreshInterval, cleanups);
      return () => cleanups.forEach((fn) => fn());
    }

    if (provider.type === "sse") {
      const resolvedUrl = resolveUrlTemplate(provider.url, searchParams);
      const source = new EventSource(resolvedUrl);

      source.onmessage = (event) => {
        try {
          const json = JSON.parse(event.data as string) as unknown;
          const data = (provider.transformWkb || provider.latField || provider.responsePath)
            ? rowsToGeoJson(json, provider)
            : (json as FeatureCollection);
          setDynamicData(data);
          setError(null);
          setIsLoading(false);
        } catch {
          setError(new Error("Failed to parse SSE data"));
          setIsLoading(false);
        }
      };

      source.onerror = () => {
        // Only report a permanent failure when the browser has given up.
        // Otherwise let EventSource reconnect automatically.
        if (source.readyState === EventSource.CLOSED) {
          setError(new Error("SSE connection closed"));
          setIsLoading(false);
        }
      };

      return () => source.close();
    }

    if (provider.type === "pgrest") {
      const controller = new AbortController();
      const resolvedParams = resolveFilterParams(provider.params, activeFilters);
      const { url, init } = buildPgrestFetch(
        provider.functionName,
        provider.method,
        resolvedParams,
        provider.dataSourceId,
      );

      const fetchData = async () => {
        try {
          const data = await fetchGeoJson(url, { ...init, signal: controller.signal }, provider, true);
          setDynamicData(data);
          setIsLoading(false);
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      };

      const cleanups: (() => void)[] = [() => controller.abort()];
      scheduleRefetch(fetchData, provider.refreshInterval, cleanups);
      return () => cleanups.forEach((fn) => fn());
    }
  }, [provider, searchParams, activeFilters]);

  if (provider === undefined) {
    return { data: null, isLoading: false, error: null };
  }

  if (provider.type === "static") {
    return { data: staticData, isLoading: false, error: null };
  }

  if (provider.type === "planner") {
    const result = plannerResults.get(provider.variableName);
    return {
      data: plannerData,
      isLoading: result?.loading ?? false,
      error: result?.error ? new Error(result.error) : null,
    };
  }

  return { data: dynamicData, isLoading, error };
}

// ============================================================================
// Multi-layer resolver
// ============================================================================

export interface MapLayerData {
  layer: MapLayer;
  data: FeatureCollection | null;
}

type SetDynamicData = (updater: (prev: Record<string, FeatureCollection | null>) => Record<string, FeatureCollection | null>) => void;

/**
 * Sets up fetching/streaming for a single dynamic layer and returns cleanup functions.
 */
function setupLayerProvider(
  layer: MapLayer,
  searchParams: URLSearchParams,
  activeFilters: Record<string, string>,
  setDynamicData: SetDynamicData,
): (() => void)[] {
  const provider = layer.provider!;
  const cleanups: (() => void)[] = [];

  if (provider.type === "api") {
    const resolvedUrl = resolveUrlTemplate(provider.url, searchParams);
    const controller = new AbortController();
    cleanups.push(() => controller.abort());

    const fetchData = async () => {
      try {
        const data = await fetchGeoJson(resolvedUrl, { method: provider.method ?? "GET", signal: controller.signal }, provider);
        setDynamicData((prev) => ({ ...prev, [layer.id]: data }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setDynamicData((prev) => ({ ...prev, [layer.id]: null }));
      }
    };

    scheduleRefetch(fetchData, provider.refreshInterval, cleanups);
  }

  if (provider.type === "sse") {
    const resolvedUrl = resolveUrlTemplate(provider.url, searchParams);
    const source = new EventSource(resolvedUrl);

    source.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data as string) as unknown;
        const data = (provider.transformWkb || provider.latField || provider.responsePath)
          ? rowsToGeoJson(json, provider)
          : (json as FeatureCollection);
        setDynamicData((prev) => ({ ...prev, [layer.id]: data }));
      } catch {
        // ignore parse errors, keep last good data
      }
    };

    cleanups.push(() => source.close());
  }

  if (provider.type === "pgrest") {
    const controller = new AbortController();
    cleanups.push(() => controller.abort());

    const resolvedParams = resolveFilterParams(provider.params, activeFilters);
    const { url, init } = buildPgrestFetch(
      provider.functionName,
      provider.method,
      resolvedParams,
      provider.dataSourceId,
    );

    const fetchData = async () => {
      try {
        const data = await fetchGeoJson(url, { ...init, signal: controller.signal }, provider, true);
        setDynamicData((prev) => ({ ...prev, [layer.id]: data }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setDynamicData((prev) => ({ ...prev, [layer.id]: null }));
      }
    };

    scheduleRefetch(fetchData, provider.refreshInterval, cleanups);
  }

  return cleanups;
}

export function useMapLayersData(
  layers: MapLayer[],
  layersKey?: string
): MapLayerData[] {
  const searchParams = useSearchParams();
  const { results: plannerResults } = useOptionalPlannerContext();
  const { activeFilters } = useDashboardFilters();
  const [dynamicData, setDynamicData] = useState<
    Record<string, FeatureCollection | null>
  >({});

  useEffect(() => {
    const dynamicLayers = layers.filter(
      (l) => l.provider?.type === "api" || l.provider?.type === "sse" || l.provider?.type === "pgrest"
    );
    if (dynamicLayers.length === 0) return;

    const cleanups: (() => void)[] = [];

    for (const layer of dynamicLayers) {
      cleanups.push(...setupLayerProvider(layer, searchParams, activeFilters, setDynamicData));
    }

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersKey ?? layers, searchParams, activeFilters]);

  return useMemo(
    () =>
      layers.map((layer) => {
        const provider = layer.provider;
        if (provider?.type === "static") {
          return { layer, data: provider.data };
        }
        if (provider?.type === "api" || provider?.type === "sse" || provider?.type === "pgrest") {
          return { layer, data: dynamicData[layer.id] ?? null };
        }
        if (provider?.type === "planner") {
          const result = plannerResults.get(provider.variableName);
          if (!result || result.loading || result.error) {
            return { layer, data: null };
          }
          const data = rowsToGeoJson(result.rows, provider);
          return { layer, data };
        }
        return { layer, data: null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layers, dynamicData, layersKey, plannerResults]
  );
}
