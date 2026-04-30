"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { z } from "zod";
import type { PickingInfo } from "@deck.gl/core";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import { useMapPositions } from "@/features/common/providers/client-api.provider";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer_clustered";
import Filters from "@/features/geographic-view/components/filters";
import MapTooltip from "@/features/geographic-view/components/map-tooltip";
import PinTooltip from "@/features/geographic-view/components/tooltips/pin-tooltip";
import MapStyleSelector from "@/features/geographic-view/components/map-style-selector";
import {
  MapPosition,
  MapPositionProperties,
} from "@/features/geographic-view/types/map";
import MapVisualizationGeneric, {
  type FeatureHoverInfo,
} from "@/features/map-visualization/map-visualization";
import {
  center_in_bounds,
  flyTo,
} from "@/features/map-visualization/map-view-utils";
import type {
  MapLayer,
  PointRenderMode,
} from "@/features/map-visualization/map-data-provider.types";
import type { MapRef } from "react-map-gl";
import { ScatterplotLayer, IconLayer } from "deck.gl";
import { Spinner } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { createLocationPinSvg } from "@/features/map-visualization/layers/location-pin-layer";

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for this dashlet */
export interface DashletConfig {
  showFilters: boolean;
  showStyleSelector: boolean;
  /** How to render live-position points: "pin" for vehicle markers, "circle" for simple dots */
  pointMode: PointRenderMode;
  layers?: MapLayer[];
  dataProvider?: { key: string; value: string }[];
}

/** Zod schema for runtime validation */
const dashletConfigSchema = z.object({
  showFilters: z.boolean(),
  showStyleSelector: z.boolean(),
  pointMode: z.enum(["circle", "pin", "location-pin"]).optional(),
  layers: z.array(z.any()).optional(),
  dataProvider: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional(),
});

/** Default configuration */
export const defaultConfig: DashletConfig = {
  showFilters: true,
  showStyleSelector: true,
  pointMode: "pin",
};

// ============================================================================
// Layout Defaults
// ============================================================================

/** Grid layout constraints - map needs more space */
export const layoutDefaults: DashletLayoutDefaults = {
  minW: 10,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Edit Mode Overlay Component
// ============================================================================

interface EditModeOverlayProps {
  dictionary: I18nRecord;
}

function EditModeOverlay({ dictionary }: Readonly<EditModeOverlayProps>) {
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
      <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-none">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("dashboard.editMode", dictionary)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("dashboard.dragToMoveWidget", dictionary)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

function MapLoadingSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg">
      <div className="absolute top-5 left-5 flex flex-col gap-1 items-center justify-center">
        <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
        <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
        <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
        <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
      </div>
      <div className="absolute top-5 right-5 flex flex-col gap-1 items-center justify-center">
        <div className="bg-gray-200 dark:bg-gray-700 h-10 w-10 flex flex-col gap-2 rounded-full animate-pulse" />
      </div>
      <Spinner size="xl" />
    </div>
  );
}

// ============================================================================
// Data Provider Map Content Component
// ============================================================================

interface LayersMapContentProps {
  mapLayers: MapLayer[];
  showStyleSelector: boolean;
}

function LayersMapContent({
  mapLayers,
  showStyleSelector,
}: Readonly<LayersMapContentProps>) {
  const { dictionary } = useDashboard();
  const [mapStyle, setMapStyle] = useState("satellite");
  const mapRef = useRef<MapRef>(null);
  const [zoom, setZoom] = useState(2);
  const [clickTooltip, setClickTooltip] = useState<FeatureHoverInfo | null>(
    null
  );

  const handleFeatureClick = useCallback(
    (info: FeatureHoverInfo | null) => {
      if (!info) {
        setClickTooltip(null);
        return;
      }

      // Cluster → just zoom in, no tooltip
      if (info.isCluster) {
        if (mapRef.current && info.coordinate) {
          flyTo(mapRef.current, info.coordinate, zoom + 2);
        }
        setClickTooltip(null);
        return;
      }

      // Single item → fly to center it, then open tooltip at viewport center
      if (mapRef.current && info.coordinate) {
        flyTo(mapRef.current, info.coordinate);
      }
      const container = mapRef.current?.getContainer();
      const cx = container ? container.clientWidth / 2 : info.x;
      const cy = container ? container.clientHeight / 2 : info.y;
      setClickTooltip({ ...info, x: cx, y: cy });
    },
    [zoom]
  );

  return (
    <>
      <MapVisualizationGeneric
        mapStyle={
          mapStyle as
            | "satellite"
            | "streets"
            | "dark"
            | "light"
            | "outdoors"
            | "hybrid"
        }
        layers={[]}
        mapRef={mapRef}
        mapLayers={mapLayers}
        onFeatureClick={handleFeatureClick}
        onZoomChange={setZoom}
      />
      {showStyleSelector && (
        <div className="absolute bottom-5 left-5 z-40 flex flex-col gap-2">
          <MapStyleSelector
            dict={dictionary}
            selectedStyle={mapStyle}
            setSelectedStyle={setMapStyle}
          />
        </div>
      )}
      {clickTooltip && (
        <MapTooltip
          left={clickTooltip.x}
          top={clickTooltip.y}
          setHoverInfo={setClickTooltip}
        >
          <div className="px-3 py-2 max-w-72">
            <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
              {clickTooltip.content}
            </p>
          </div>
        </MapTooltip>
      )}
    </>
  );
}

// ============================================================================
// Map Content Component
// ============================================================================

interface MapContentProps {
  mapPositions: MapPosition[] | null;
  isLoading: boolean;
  showFilters: boolean;
  showStyleSelector: boolean;
  pointMode: PointRenderMode;
}

function MapContent({
  mapPositions,
  isLoading,
  showFilters,
  showStyleSelector,
  pointMode,
}: Readonly<MapContentProps>) {
  const { dictionary } = useDashboard();
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<MapPositionProperties>>();
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [originalPositions, setOriginalPositions] = useState<MapPosition[]>([]);
  const [mapStyle, setMapStyle] = useState("satellite");
  const [zoom, setZoom] = useState(2);

  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (mapPositions) {
      setPositions(mapPositions);
      setOriginalPositions(mapPositions);
    }
  }, [mapPositions]);

  useEffect(() => {
    if (
      !isLoading &&
      mapRef.current &&
      mapPositions &&
      mapPositions.length > 0
    ) {
      center_in_bounds(positions || [], mapRef.current, isLoading);
    }
  }, [isLoading, mapPositions, positions]);

  const onPinClick = useCallback(
    ({
      object,
      viewport,
    }: {
      object: MapPositionProperties;
      viewport: { width: number; height: number };
    }) => {
      if (!("cluster" in object) && mapRef.current) {
        flyTo(mapRef.current, [
          (object as unknown as { geometry: { coordinates: [number, number] } })
            .geometry.coordinates[0],
          (object as unknown as { geometry: { coordinates: [number, number] } })
            .geometry.coordinates[1],
        ]);
        setHoverInfo({
          object,
          x: viewport.width / 2,
          y: viewport.height / 2,
        } as PickingInfo<MapPositionProperties>);
      } else {
        if (mapRef.current) {
          flyTo(
            mapRef.current,
            [
              (
                object as unknown as {
                  geometry: { coordinates: [number, number] };
                }
              ).geometry.coordinates[0],
              (
                object as unknown as {
                  geometry: { coordinates: [number, number] };
                }
              ).geometry.coordinates[1],
            ],
            zoom + 2
          );
        }
        setHoverInfo(undefined);
      }
    },
    [zoom]
  );

  // Wrap flat MapPosition[] into the same GeoJSON structure that
  // PinLayer/supercluster produces so onPinClick + PinTooltip work for all modes.
  const wrappedPositions = useMemo(
    () =>
      (positions || []).map((p) => ({
        ...p,
        // Explicit fields override the spread so PinTooltip reads them directly
        // when the picked object is cast to MapPositionProperties
        type: "Feature" as const,
        asset_id: p.assetid,
        speed_limit: p.speed_limit_condition,
        gps_provider: p.telcom_gps_provider,
        cluster: false,
        properties: {
          ...p,
          asset_id: p.assetid,
          speed_limit: p.speed_limit_condition,
          gps_provider: p.telcom_gps_provider,
          cluster: false,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [p.longitude || 0, p.latitude || 0] as [
            number,
            number,
          ],
        },
      })),
    [positions]
  );

  const locationPinIcon = useMemo(
    () => ({
      url: createLocationPinSvg("3388FF"),
      width: 48,
      height: 48,
      anchorX: 24,
      anchorY: 48,
      mask: false,
    }),
    []
  );

  const layers = useMemo(() => {
    if (pointMode === "pin") {
      return [
        new PinLayer({
          data: positions || [],
          zoom: zoom,
          onClick: ({
            object,
            viewport,
          }: {
            object: MapPositionProperties;
            viewport: { width: number; height: number };
          }) => {
            onPinClick({ object, viewport });
          },
          updateTriggers: { data: positions },
          pickable: true,
        }),
      ];
    }

    if (pointMode === "location-pin") {
      return [
        new IconLayer({
          id: "live-positions-location-pins",
          data: wrappedPositions,
          getPosition: (d: (typeof wrappedPositions)[number]) =>
            d.geometry.coordinates,
          getIcon: () => locationPinIcon,
          getSize: 36,
          sizeUnits: "pixels" as const,
          pickable: true,
          onClick: (info: PickingInfo) =>
            onPinClick({
              object: info.object as MapPositionProperties,
              viewport: info.viewport as unknown as {
                width: number;
                height: number;
              },
            }),
          updateTriggers: { data: positions },
          parameters: { depthTest: false },
        }),
      ];
    }

    return [
      new ScatterplotLayer({
        id: "live-positions-circles",
        data: wrappedPositions,
        getPosition: (d: (typeof wrappedPositions)[number]) =>
          d.geometry.coordinates,
        getFillColor: [51, 136, 255, 200],
        getRadius: 8,
        radiusUnits: "pixels" as const,
        pickable: true,
        onClick: (info: PickingInfo) =>
          onPinClick({
            object: info.object as MapPositionProperties,
            viewport: info.viewport as unknown as {
              width: number;
              height: number;
            },
          }),
        updateTriggers: { data: positions },
      }),
    ];
  }, [pointMode, positions, wrappedPositions, zoom, onPinClick, locationPinIcon]);

  return (
    <>
      <MapVisualizationGeneric
        mapStyle={
          mapStyle as
            | "satellite"
            | "streets"
            | "dark"
            | "light"
            | "outdoors"
            | "hybrid"
        }
        layers={layers}
        isLoading={false}
        mapRef={mapRef}
        onZoomChange={(newZoom) => {
          setZoom(newZoom || 2);
        }}
      />
      {showStyleSelector && (
        <div className="absolute bottom-5 left-5 z-40 flex flex-col gap-2">
          <MapStyleSelector
            dict={dictionary}
            selectedStyle={mapStyle}
            setSelectedStyle={setMapStyle}
          />
        </div>
      )}
      {showFilters && (
        <div className="absolute left-0 top-0 bottom-0 z-40 pointer-events-none">
          <div className="pointer-events-auto">
            <Filters
              dict={dictionary}
              originalPositions={originalPositions}
              setPositions={setPositions}
            />
          </div>
        </div>
      )}
      {hoverInfo && (
        <MapTooltip
          left={hoverInfo.x}
          top={hoverInfo.y}
          setHoverInfo={setHoverInfo}
        >
          <PinTooltip object={hoverInfo.object} dict={dictionary} />
        </MapTooltip>
      )}
    </>
  );
}

// ============================================================================
// Main Dashlet Component
// ============================================================================

/**
 * Geographic Map Dashlet
 *
 * Displays an interactive map with position markers and filters.
 * In edit mode, an overlay is shown to allow moving the widget.
 */
export function Dashlet({ editMode, widget }: Readonly<DashletComponentProps>) {
  // Validate and merge widget.config with defaultConfig
  const parsed = dashletConfigSchema.partial().safeParse(widget.config);
  const config: DashletConfig = parsed.success
    ? { ...defaultConfig, ...parsed.data }
    : defaultConfig;
  const showFilters = config.showFilters;
  const showStyleSelector = config.showStyleSelector;
  const pointMode = config.pointMode;

  const { dictionary } = useDashboard();
  const hasLayers = config.layers && config.layers.length > 0;

  const {
    positions: mapPositions,
    isLoading,
    error,
    mutate,
  } = useMapPositions();

  if (!hasLayers && error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          {tr("dashboard.dashlets.geographic_map.load_failed", dictionary)}
        </span>
        <button
          type="button"
          onClick={() => mutate()}
          className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
        >
          {tr("common.retry", dictionary)}
        </button>
      </div>
    );
  }

  if (hasLayers) {
    return (
      <div className="h-full w-full relative overflow-hidden rounded-lg">
        <LayersMapContent
          mapLayers={config.layers!}
          showStyleSelector={showStyleSelector}
        />
        {editMode && <EditModeOverlay dictionary={dictionary} />}
      </div>
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden rounded-lg">
      {isLoading ? (
        <MapLoadingSkeleton />
      ) : (
        <MapContent
          mapPositions={mapPositions}
          isLoading={isLoading}
          showFilters={showFilters}
          showStyleSelector={showStyleSelector}
          pointMode={pointMode}
        />
      )}
      {editMode && <EditModeOverlay dictionary={dictionary} />}
    </div>
  );
}
