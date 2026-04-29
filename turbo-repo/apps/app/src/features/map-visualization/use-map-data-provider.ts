import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import type { MapDataProvider, MapLayer } from "./map-data-provider.types";

interface MapDataProviderResult {
  data: FeatureCollection | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolves data from a MapDataProvider configuration.
 * Currently only "static" is implemented.
 * "api" and "sse" will be added in future iterations.
 */
export function useMapDataProvider(
  provider: MapDataProvider | undefined
): MapDataProviderResult {
  const staticData = useMemo(() => {
    if (provider?.type === "static") {
      return provider.data;
    }
    return null;
  }, [provider]);

  if (provider === undefined) {
    return { data: null, isLoading: false, error: null };
  }

  if (provider.type === "static") {
    return { data: staticData, isLoading: false, error: null };
  }

  // Stub: "api" and "sse" types return null for now
  return { data: null, isLoading: false, error: null };
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
