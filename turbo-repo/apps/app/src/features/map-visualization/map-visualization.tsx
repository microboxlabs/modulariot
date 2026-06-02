"use client";

import type { LayersList, PickingInfo } from "@deck.gl/core";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Map, { useControl, MapRef } from "react-map-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { DeckProps } from "@deck.gl/core";
import { Spinner } from "flowbite-react";
import type { RefObject } from "react";
import type {
  MapDataProvider,
  MapDataProviderDefaults,
  MapLayer,
} from "./map-data-provider.types";
import { useMapDataProvider, useMapLayersData } from "./use-map-data-provider";
import {
  buildDataProviderLayers,
  buildNamedMapLayers,
} from "./layers/build-layers";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";

// ============================================================================
// Constants / helpers
// ============================================================================

const mapStyles = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
  dark: "mapbox://styles/mapbox/dark-v10",
  light: "mapbox://styles/mapbox/light-v10",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
  hybrid: "mapbox://styles/mapbox/hybrid-v10",
};

// Matches the UUID segment in named-layer IDs like "named-layer-{uuid}-points-scatterplot"
const NAMED_LAYER_RE =
  /^named-layer-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

/**
 * Walk up the layer parent chain to find a named-layer UUID.
 * Composite layers (polygon, path) have deeply nested sublayers whose
 * `info.layer` points to the leaf — this helper checks all ancestors.
 */
function findNamedLayerId(
  layer: { id: string; parent?: { id: string; parent?: unknown } | null } | null
): string | null {
  let current = layer as
    | { id: string; parent?: { id: string; parent?: unknown } | null }
    | null
    | undefined;
  while (current) {
    const match = NAMED_LAYER_RE.exec(current.id);
    if (match) return match[1];
    current = current.parent as typeof current | undefined;
  }
  return null;
}

function resolvePathValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  let current: unknown = obj;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function applyTemplate(
  template: string,
  props: Record<string, unknown>
): string {
  return template.replaceAll(/\{\{row\.([^}]+)\}\}/g, (_, key: string) => {
    const val = resolvePathValue(props, key);
    if (val === undefined || val === null) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val as string | number | boolean);
  });
}

// ============================================================================
// DeckGL overlay bridge
// ============================================================================

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(
    () =>
      new MapboxOverlay({
        ...props,
        parameters: { ...props.parameters },
      })
  );
  overlay.setProps({ ...props, parameters: { ...props.parameters } });
  return null;
}

// ============================================================================
// Main component
// ============================================================================

export interface FeatureHoverInfo {
  x: number;
  y: number;
  content: string;
  /** Geo-coordinates [lng, lat] of the clicked feature */
  coordinate?: [number, number];
  /** Whether the clicked object is a cluster */
  isCluster?: boolean;
}

export default function MapVisualization({
  mapStyle,
  layers,
  isLoading = false,
  mapRef,
  onZoomChange,
  dataProvider,
  dataProviderDefaults,
  mapLayers,
  onFeatureHover,
  onFeatureClick,
  onLayerClick,
}: {
  mapStyle: keyof typeof mapStyles;
  layers: LayersList;
  isLoading?: boolean;
  mapRef: RefObject<MapRef | null>;
  onZoomChange?: (zoom: number) => void;
  dataProvider?: MapDataProvider;
  dataProviderDefaults?: MapDataProviderDefaults;
  mapLayers?: MapLayer[];
  onFeatureHover?: (info: FeatureHoverInfo | null) => void;
  onFeatureClick?: (info: FeatureHoverInfo | null) => void;
  /** Raw pick callback for any layer click (used by custom layers passed via `layers`) */
  onLayerClick?: (info: PickingInfo) => void;
}) {
  const runtimeConfig = useRuntimeConfig();
  const mapboxAccessToken = runtimeConfig?.MAPBOX_API_KEY ?? "";
  const isRuntimeConfigLoading = runtimeConfig === null;
  const hasMapboxAccessToken = mapboxAccessToken.trim().length > 0;
  const shouldRenderMap = !isRuntimeConfigLoading && hasMapboxAccessToken;
  const [cursor, setCursor] = useState<string>("grab");
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [internalZoom, setInternalZoom] = useState(2.5);
  const [selectedPath, setSelectedPath] = useState<{
    layerId: string;
    featureIndex: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable key that changes whenever any mapLayer config changes (style, tooltip, etc.)
  const mapLayersKey = useMemo(
    () => JSON.stringify(mapLayers ?? []),
    [mapLayers]
  );

  const handleHover = useCallback(
    (info: PickingInfo) => {
      if (!info.object || !info.layer) {
        onFeatureHover?.(null);
        return;
      }
      const layerId = findNamedLayerId(info.layer);
      if (!layerId) {
        onFeatureHover?.(null);
        return;
      }
      const mapLayer = (mapLayers ?? []).find((l) => l.id === layerId);
      const template = mapLayer?.tooltip?.template?.trim();
      const obj = info.object as Record<string, unknown>;
      const objProps =
        (obj?.properties as Record<string, unknown> | undefined) ?? {};
      const props = { ...obj, ...objProps };
      if (!template) {
        onFeatureHover?.(null);
        return;
      }
      const content = applyTemplate(template, props);
      onFeatureHover?.({ x: info.x, y: info.y, content });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapLayersKey, onFeatureHover]
  );

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (!info.object || !info.layer) {
        setSelectedPath(null);
        onFeatureClick?.(null);
        return;
      }
      const layerId = findNamedLayerId(info.layer);
      if (!layerId) {
        setSelectedPath(null);
        onLayerClick?.(info);
        return;
      }
      const mapLayer = (mapLayers ?? []).find((l) => l.id === layerId);
      const template = mapLayer?.tooltip?.template?.trim();
      const obj = info.object as Record<string, unknown>;
      const objProps =
        (obj?.properties as Record<string, unknown> | undefined) ?? {};
      const isCluster =
        Boolean(obj.cluster) || Boolean(objProps.cluster);
      const props = { ...obj, ...objProps };

      // Track path selection for highlight
      const featureIndex =
        typeof obj.featureIndex === "number" ? obj.featureIndex : -1;
      if (featureIndex >= 0) {
        const pathLayerId = `named-layer-${layerId}-lines`;
        setSelectedPath((prev) =>
          prev?.layerId === pathLayerId &&
          prev?.featureIndex === featureIndex
            ? null
            : { layerId: pathLayerId, featureIndex }
        );
      } else {
        setSelectedPath(null);
      }

      // No tooltip template configured → skip
      if (!template) {
        onFeatureClick?.(null);
        return;
      }

      const content = applyTemplate(template, props);

      // Resolved content is empty → skip
      if (!content.trim()) {
        onFeatureClick?.(null);
        return;
      }

      // Extract coordinates: prefer info.coordinate (click position on map),
      // fall back to Point geometry coordinates
      let coord: [number, number] | undefined;
      if (info.coordinate) {
        coord = [info.coordinate[0], info.coordinate[1]];
      } else {
        const geom = obj?.geometry as
          | { type?: string; coordinates?: unknown }
          | undefined;
        if (geom?.type === "Point" && Array.isArray(geom.coordinates)) {
          coord = [
            geom.coordinates[0] as number,
            geom.coordinates[1] as number,
          ];
        }
      }

      onFeatureClick?.({
        x: info.x,
        y: info.y,
        content,
        coordinate: coord,
        isCluster,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapLayersKey, onFeatureClick, onLayerClick]
  );

  const { data: providerData } = useMapDataProvider(dataProvider);
  const namedLayerData = useMapLayersData(mapLayers ?? [], mapLayersKey);

  const mergedLayers = useMemo(() => {
    if (mapLayers && mapLayers.length > 0) {
      return [
        ...buildNamedMapLayers(namedLayerData, internalZoom, selectedPath),
        ...layers,
      ];
    }
    if (!providerData) return layers;
    return [
      ...buildDataProviderLayers(
        providerData,
        dataProviderDefaults,
        selectedPath
      ),
      ...layers,
    ];
  }, [
    mapLayersKey,
    namedLayerData,
    internalZoom,
    providerData,
    dataProviderDefaults,
    layers,
    selectedPath,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        mapRef.current?.resize();
      });
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [mapRef]);

  const mapboxStyles = useMemo(
    () => (
      <style>
        {`
          .mapboxgl-ctrl-logo { display: none !important; }
          .mapboxgl-ctrl-attrib-inner { display: block !important; }
          .mapboxgl-ctrl-attrib a { color: #333 !important; text-decoration: none !important; }
          .mapboxgl-ctrl-attrib a:hover { text-decoration: underline !important; }
        `}
      </style>
    ),
    []
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative rounded-lg overflow-hidden"
    >
      {shouldRenderMap ? (
        <Map
          ref={mapRef}
          mapboxAccessToken={mapboxAccessToken}
          mapStyle={mapStyles[mapStyle]}
          onLoad={(e) => {
            const z = e.target.getZoom();
            setInternalZoom(z);
            onZoomChange?.(z);
          }}
          onZoom={(e) => {
            setInternalZoom(e.viewState.zoom);
            onZoomChange?.(e.viewState.zoom);
          }}
          onDragStart={() => setIsMapDragging(true)}
          onDragEnd={() => setIsMapDragging(false)}
          cursor={cursor}
          initialViewState={{
            longitude: -62.136105,
            latitude: -21.756514,
            zoom: 2.5,
          }}
          preserveDrawingBuffer={true}
          antialias={true}
        >
          {isLoading && (
            <div className="absolute top-4 left-0 bg-gray-200 dark:bg-gray-800 p-2 rounded-r-full z-10">
              <Spinner />
            </div>
          )}
          <DeckGLOverlay
            layers={mergedLayers}
            onHover={handleHover}
            onClick={handleClick}
            getCursor={({ isHovering }) => {
              let newCursor: string;
              if (isMapDragging) {
                newCursor = "grabbing";
              } else if (isHovering) {
                newCursor = "pointer";
              } else {
                newCursor = "grab";
              }
              setCursor(newCursor);
              return newCursor;
            }}
          />
        </Map>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <Spinner />
        </div>
      )}
      {mapboxStyles}
    </div>
  );
}
