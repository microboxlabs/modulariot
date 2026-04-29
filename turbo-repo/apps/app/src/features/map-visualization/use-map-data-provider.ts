import { useMemo, useState, useEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { MapDataProvider, MapLayer } from "./map-data-provider.types";

interface MapDataProviderResult {
  data: FeatureCollection | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMapDataProvider(
  provider: MapDataProvider | undefined
): MapDataProviderResult {
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

  useEffect(() => {
    if (provider?.type !== "api" && provider?.type !== "sse") {
      return;
    }

    setIsLoading(true);
    setDynamicData(null);
    setError(null);

    if (provider.type === "api") {
      const method = provider.method ?? "GET";
      const controller = new AbortController();

      const fetchData = async () => {
        try {
          const res = await fetch(provider.url, {
            method,
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as FeatureCollection;
          setDynamicData(json);
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
      const source = new EventSource(provider.url);

      source.onmessage = (event) => {
        try {
          const json = JSON.parse(event.data as string) as FeatureCollection;
          setDynamicData(json);
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
  }, [provider]);

  if (provider === undefined) {
    return { data: null, isLoading: false, error: null };
  }

  if (provider.type === "static") {
    return { data: staticData, isLoading: false, error: null };
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

/**
 * Resolves data for every layer in the array.
 * Currently only "static" providers are resolved; "api" and "sse" return null.
 */
export function useMapLayersData(
  layers: MapLayer[],
  layersKey?: string
): MapLayerData[] {
  return useMemo(
    () =>
      layers.map((layer) => {
        const provider = layer.provider;
        if (provider?.type === "static") {
          return { layer, data: provider.data };
        }
        return { layer, data: null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layersKey ?? layers]
  );
}

// ============================================================================
// Multi-layer resolver
// ============================================================================

export interface MapLayerData {
  layer: MapLayer;
  data: FeatureCollection | null;
}

/**
 * Resolves data for every layer in the array.
 * Currently only "static" providers are resolved; "api" and "sse" return null.
 */
export function useMapLayersData(
  layers: MapLayer[],
  layersKey?: string
): MapLayerData[] {
  return useMemo(
    () =>
      layers.map((layer) => {
        const provider = layer.provider;
        if (provider?.type === "static") {
          return { layer, data: provider.data };
        }
        return { layer, data: null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layersKey ?? layers]
  );
}
