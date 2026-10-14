"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./layers/pin_layer_clustered";
import { useSearchParams } from "next/navigation";
import {
  MapPosition,
  MapPositionProperties,
  MapPositionResume,
} from "../types/map";
import Filters from "./filters";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import MapTooltip from "./map-tooltip";
import PinTooltip from "./tooltips/pin-tooltip";
import MapStyleSelector from "./map-style-selector";
import { MapRef } from "react-map-gl";
import MapVisualizationGeneric from "@/features/map-visualization/map-visualization";
import { useGeographicProfile } from "../profiles/geographic-profile-context";
import MapNotch from "./map-notch/map-notch";
import PlacesFloatingOverlay from "./places-overlay/places-floating-overlay";
import { SlidePanel } from "./places-overlay/panel-motion";
import PlacesMapLayers from "@/features/settings-admin/places/places-map-layers";
import { CURSOR_AGREGAR } from "@/features/settings-admin/places/cursors";
import {
  itemsNombresMapa,
  type ItemNombre,
} from "@/features/settings-admin/places/place-labels";
import { capasNombresGeocercas } from "@/features/settings-admin/places/place-name-layer";
import { zoomAlClicNombre } from "@/features/settings-admin/places/geofence-lod";
import { usePlacesWorkspace } from "@/features/settings-admin/places/use-places-workspace";

type MapVisualizationProps = {
  mapPositions: MapPosition[] | null;
  dict: I18nRecord;
  mapPositionsResume: MapPositionResume;
  isLoading: boolean;
};

import {
  center_in_bounds,
  flyTo,
  zoomToVehicle,
} from "@/features/map-visualization/map-view-utils";

export default function MapVisualization({
  mapPositions,
  dict,
  isLoading,
}: MapVisualizationProps) {
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<MapPositionProperties>>();
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [originalPositions, setOriginalPositions] = useState<MapPosition[]>([]);
  const [mapStyle, setMapStyle] = useState("satellite");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("licensePlate") || "");

  const [zoom, setZoom] = useState(2);

  const mapRef = useRef<MapRef | null>(null);
  const { activeView } = useGeographicProfile();
  const placesMode = activeView === "places";
  const testMode = activeView === "test";
  const places = usePlacesWorkspace(mapRef, { enabled: placesMode });
  const namesGen = useRef(0);
  const prevPlaces = useRef(placesMode);
  if (placesMode && !prevPlaces.current) namesGen.current += 1;
  prevPlaces.current = placesMode;

  useEffect(() => {
    if (placesMode) {
      setPositions([]);
      setOriginalPositions([]);
      setHoverInfo(undefined);
      return;
    }
    if (mapPositions) {
      setPositions(mapPositions);
      setOriginalPositions(mapPositions);
    }
  }, [placesMode, mapPositions]);

  useEffect(() => {
    setSearch(searchParams.get("licensePlate") || "");
  }, [searchParams.get("licensePlate")]);

  useEffect(() => {
    if (placesMode) return;
    if (
      !isLoading &&
      mapRef.current &&
      mapPositions &&
      mapPositions.length > 0
    ) {
      center_in_bounds(positions || [], mapRef.current, isLoading);
    }
  }, [isLoading, placesMode, mapRef.current]);

  useEffect(() => {
    if (search && search != "") {
      const filteredPositions = originalPositions.filter((position: any) =>
        position.asset_id.toLowerCase().includes(search.toLowerCase())
      );
      setPositions(filteredPositions || []);
      if (filteredPositions && filteredPositions.length > 0 && mapRef.current) {
        center_in_bounds(filteredPositions, mapRef.current, false);
      }
    } else if (originalPositions.length != positions.length) {
      setPositions(originalPositions);
    }
  }, [search, originalPositions]);

  const onPinClick = useCallback(
    ({ object, viewport }: { object: any; viewport: any }) => {
      // Only show tooltip for non-clustered pins
      if (!object.properties.cluster && mapRef.current) {
        const coordinates: [number, number] = [
          object.geometry.coordinates[0],
          object.geometry.coordinates[1],
        ];
        // Zoom in only when the filters leave this vehicle on its own
        if (positions.length === 1) {
          zoomToVehicle(mapRef.current, coordinates);
        } else {
          flyTo(mapRef.current, coordinates);
        }
        setHoverInfo({
          object,
          x: viewport.width / 2, // Center horizontally
          y: viewport.height / 2, // Center vertically + offset down by 100px
        } as PickingInfo<MapPositionProperties>);
      } else {
        if (mapRef.current) {
          flyTo(
            mapRef.current,
            [object.geometry.coordinates[0], object.geometry.coordinates[1]],
            zoom + 2
          );
        }
        setHoverInfo(undefined);
      }
    },
    [setHoverInfo, zoom, positions.length]
  );

  const nombresItems = useMemo(
    () =>
      itemsNombresMapa(
        places.fcPropios,
        places.prevLugarFC,
        places.todosLugares
      ),
    [places.fcPropios, places.prevLugarFC, places.todosLugares]
  );

  const alClicNombre = useCallback(
    (item: ItemNombre) => {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({
        center: [item.ancla[1], item.ancla[0]],
        zoom: zoomAlClicNombre(item, zoom, nombresItems),
        duration: 800,
      });
    },
    [zoom, nombresItems]
  );

  const capasNombres = useMemo(
    () =>
      capasNombresGeocercas(
        nombresItems,
        `place-names-${namesGen.current}`,
        mapStyle,
        zoom,
        alClicNombre
      ),
    [nombresItems, namesGen.current, mapStyle, zoom, alClicNombre]
  );

  const alCambioZoom = useCallback((z: number) => {
    const next = Math.round((z || 2) * 10) / 10;
    setZoom((prev) => (prev === next ? prev : next));
  }, []);

  const layers = placesMode
    ? capasNombres
    : !positions.length
      ? []
      : [
          new PinLayer({
            data: positions,
            zoom: zoom,
            onClick: ({ object, viewport }: { object: any; viewport: any }) => {
              onPinClick({ object, viewport });
            },
            updateTriggers: {
              data: positions,
            },
            pickable: true,
          }),
        ];

  return (
    <div className="h-full w-full relative overflow-hidden">
      <MapVisualizationGeneric
        rounded={false}
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
        onZoomChange={alCambioZoom}
        onMapClick={placesMode ? places.onMapClick : undefined}
        onMapContextMenu={placesMode ? places.onMapContextMenu : undefined}
        idleCursor={
          placesMode && places.clicAgrega ? CURSOR_AGREGAR : undefined
        }
      >
        {placesMode ? <PlacesMapLayers ws={places} /> : null}
      </MapVisualizationGeneric>
      <div className="absolute bottom-5 left-5 z-40 flex flex-col gap-2">
        <MapStyleSelector
          dict={dict}
          selectedStyle={mapStyle}
          setSelectedStyle={setMapStyle}
        />
      </div>
      <SlidePanel
        show={!placesMode}
        from="left"
        className="absolute left-0 top-0 bottom-0 z-40 pointer-events-none"
      >
        <div className="pointer-events-auto">
          <Filters
            dict={dict}
            originalPositions={originalPositions}
            setPositions={setPositions}
          />
        </div>
      </SlidePanel>
      <div className="absolute right-5 top-5 z-50">
        <MapNotch dict={dict} />
      </div>
      <PlacesFloatingOverlay dict={dict} ws={places} show={placesMode} />
      <SlidePanel
        show={testMode}
        className="absolute top-4 right-20 z-40 w-[280px] rounded-xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
      >
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("geographic_view.notch.test", dict)}
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("geographic_view.notch.testHint", dict)}
        </p>
      </SlidePanel>
      {hoverInfo && !placesMode && (
        <MapTooltip
          left={hoverInfo.x}
          top={hoverInfo.y}
          setHoverInfo={setHoverInfo}
        >
          <PinTooltip object={hoverInfo.object} dict={dict} />
        </MapTooltip>
      )}
    </div>
  );
}
