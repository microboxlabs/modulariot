import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { FeatureCollection } from "geojson";
import type { MapDataProvider, MapLayer } from "./map-data-provider.types";
import { parseWKBPoint } from "@/utils/map-conversion";
import { buildPgrestFetch } from "@/features/dashboard/dashlets/common/pgrest-utils";
import { usePlannerContext } from "@/features/dashboard/context/planner-context";

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
  return url.replaceAll(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    return params.get(key.trim()) ?? "";
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
    features: records.map((record) => {
      const r = record as Record<string, unknown>;
      const location = r[geometryField] as string | undefined;
      const [lng, lat] = location ? parseWKBPoint(location) : [0, 0];
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [lng, lat] },
        properties: r,
      };
    }),
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
        const lat = parseFloat(String(r[latField] ?? ""));
        const lng = parseFloat(String(r[lngField] ?? ""));
        if (isNaN(lat) || isNaN(lng)) return null;
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
    "type" in (data as object) &&
    (data as { type: unknown }).type === "FeatureCollection" &&
    "features" in (data as object) &&
    Array.isArray((data as { features: unknown }).features)
  ) {
    return data as FeatureCollection;
  }
  // Fallback: empty collection
  return { type: "FeatureCollection", features: [] };
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
  const { results: plannerResults } = usePlannerContext();
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
          const res = await fetch(resolvedUrl, {
            method,
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as unknown;
          const data = (provider.transformWkb || provider.latField || provider.responsePath)
            ? rowsToGeoJson(json, provider)
            : (json as FeatureCollection);
          setDynamicData(data);
          setIsLoading(false);
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      };

      void fetchData();

      if (provider.refreshInterval && provider.refreshInterval > 0) {
        const interval = setInterval(
          () => void fetchData(),
          provider.refreshInterval
        );
        return () => {
          controller.abort();
          clearInterval(interval);
        };
      }

      return () => controller.abort();
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
          setIsLoading(false);
        } catch {
          setError(new Error("Failed to parse SSE data"));
          setIsLoading(false);
        }
      };

      source.onerror = () => {
        setError(new Error("SSE connection error"));
        setIsLoading(false);
        source.close();
      };

      return () => source.close();
    }

    if (provider.type === "pgrest") {
      const controller = new AbortController();
      const { url, init } = buildPgrestFetch(
        provider.functionName,
        provider.method,
        provider.params,
        provider.dataSourceId,
      );

      const fetchData = async () => {
        try {
          const res = await fetch(url, {
            ...init,
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const raw = provider.responsePath ? json : unwrapPgrestResponse(json);
          const data = (provider.transformWkb || provider.latField || provider.responsePath)
            ? rowsToGeoJson(raw, provider)
            : (raw as FeatureCollection);
          setDynamicData(data);
          setIsLoading(false);
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      };

      void fetchData();

      if (provider.refreshInterval && provider.refreshInterval > 0) {
        const interval = setInterval(
          () => void fetchData(),
          provider.refreshInterval
        );
        return () => {
          controller.abort();
          clearInterval(interval);
        };
      }

      return () => controller.abort();
    }
  }, [provider, searchParams]);

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

export function useMapLayersData(
  layers: MapLayer[],
  layersKey?: string
): MapLayerData[] {
  const searchParams = useSearchParams();
  const { results: plannerResults } = usePlannerContext();
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
      const provider = layer.provider!;

      if (provider.type === "api") {
        const resolvedUrl = resolveUrlTemplate(provider.url, searchParams);
        const controller = new AbortController();
        cleanups.push(() => controller.abort());

        const fetchData = async () => {
          try {
            const res = await fetch(resolvedUrl, {
              method: provider.method ?? "GET",
              signal: controller.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as unknown;
            const data = (provider.transformWkb || provider.latField || provider.responsePath)
              ? rowsToGeoJson(json, provider)
              : (json as FeatureCollection);
            setDynamicData((prev) => ({ ...prev, [layer.id]: data }));
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            setDynamicData((prev) => ({ ...prev, [layer.id]: null }));
          }
        };

        void fetchData();

        if (provider.refreshInterval && provider.refreshInterval > 0) {
          const interval = setInterval(
            () => void fetchData(),
            provider.refreshInterval
          );
          cleanups.push(() => clearInterval(interval));
        }
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

        source.onerror = () => source.close();
        cleanups.push(() => source.close());
      }

      if (provider.type === "pgrest") {
        const controller = new AbortController();
        cleanups.push(() => controller.abort());

        const { url, init } = buildPgrestFetch(
          provider.functionName,
          provider.method,
          provider.params,
          provider.dataSourceId,
        );

        const fetchData = async () => {
          try {
            const res = await fetch(url, {
              ...init,
              signal: controller.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const raw = provider.responsePath ? json : unwrapPgrestResponse(json);
            const data = (provider.transformWkb || provider.latField || provider.responsePath)
              ? rowsToGeoJson(raw, provider)
              : (raw as FeatureCollection);
            setDynamicData((prev) => ({ ...prev, [layer.id]: data }));
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            setDynamicData((prev) => ({ ...prev, [layer.id]: null }));
          }
        };

        void fetchData();

        if (provider.refreshInterval && provider.refreshInterval > 0) {
          const interval = setInterval(
            () => void fetchData(),
            provider.refreshInterval
          );
          cleanups.push(() => clearInterval(interval));
        }
      }
    }

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersKey ?? layers, searchParams]);

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
