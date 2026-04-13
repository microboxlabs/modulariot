"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PickingInfo } from "@deck.gl/core";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import {
  useMapPositions,
} from "@/features/common/providers/client-api.provider";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer_clustered";
import Filters from "@/features/geographic-view/components/filters";
import MapTooltip from "@/features/geographic-view/components/map-tooltip";
import PinTooltip from "@/features/geographic-view/components/tooltips/pin-tooltip";
import MapStyleSelector from "@/features/geographic-view/components/map-style-selector";
import {
  MapPosition,
  MapPositionProperties,
} from "@/features/geographic-view/types/map";
import MapVisualizationGeneric from "@/features/map-visualization/map-visualization";
import {
  center_in_bounds,
  flyTo,
} from "@/features/map-visualization/map-view-utils";
import type { MapRef } from "react-map-gl";
import { Spinner } from "flowbite-react";

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for this dashlet */
export interface DashletConfig {
  showFilters: boolean;
  showStyleSelector: boolean;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  showFilters: true,
  showStyleSelector: true,
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

function EditModeOverlay() {
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
      <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-none">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          Edit Mode
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Drag to move this widget
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
// Map Content Component
// ============================================================================

interface MapContentProps {
  mapPositions: MapPosition[] | null;
  isLoading: boolean;
  showFilters: boolean;
  showStyleSelector: boolean;
}

function MapContent({
  mapPositions,
  isLoading,
  showFilters,
  showStyleSelector,
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

  const layers = [
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
      updateTriggers: {
        data: positions,
      },
      pickable: true,
    }),
  ];

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
  const config = widget.config as unknown as DashletConfig;
  const showFilters = config.showFilters ?? true;
  const showStyleSelector = config.showStyleSelector ?? true;

  const { positions: mapPositions, isLoading, error } = useMapPositions();

  if (error) {
    console.error("Map dashlet error:", error);
    // Continue rendering with empty data instead of showing error
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
        />
      )}
      {editMode && <EditModeOverlay />}
    </div>
  );
}
