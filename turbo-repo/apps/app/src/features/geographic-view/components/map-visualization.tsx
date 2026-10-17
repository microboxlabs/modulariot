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
import MapLayersCard, { capasDeVista, useCapasMapa } from "./map-layers-card";
import PlaceBadgeTooltip from "@/features/settings-admin/places/place-badge-tooltip";
import { MapRef } from "react-map-gl";
import MapVisualizationGeneric from "@/features/map-visualization/map-visualization";
import { useGeographicProfile } from "../profiles/geographic-profile-context";
import MapNotch from "./map-notch/map-notch";
import PlacesFloatingOverlay from "./places-overlay/places-floating-overlay";
import { twMerge } from "tailwind-merge";
import {
  EXPAND_TRANSITION,
  SlidePanel,
  usePanelOpen,
} from "./places-overlay/panel-motion";
import PlacesMapLayers from "@/features/settings-admin/places/places-map-layers";
import { CURSOR_AGREGAR } from "@/features/settings-admin/places/cursors";
import {
  itemsNombresMapa,
  type ItemNombre,
} from "@/features/settings-admin/places/place-labels";
import { capasNombresGeocercas } from "@/features/settings-admin/places/place-name-layer";
import { useResaltadoAnimado } from "@/features/settings-admin/places/highlight-animation";
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
  // mismo frame, duración y curva que la barra de Lugares: el notch se mueve
  // pegado a su borde al abrir y al cerrar
  const lugaresAbierto = usePanelOpen(placesMode);
  const testMode = activeView === "test";
  // barra "Capas": qué se dibuja; en la vista general las geocercas (forma y
  // nombre) se ven, solo lectura, bajo los camiones mientras estén activas
  const [capas, setCapa] = useCapasMapa();
  const geocercasEnGeneral = !placesMode && !testMode && capas.geocercas;
  const places = usePlacesWorkspace(mapRef, {
    enabled: placesMode || geocercasEnGeneral,
  });
  // al salir de Lugares, lo que quedó abierto (formulario, import) se cierra:
  // la vista general muestra las geocercas solo de lectura
  useEffect(() => {
    if (!placesMode && places.modo !== "ver") places.cerrarForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesMode]);
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

  // importando: los badges son los de lo importado, no los de lo guardado
  const nombresItems = useMemo(
    () =>
      places.nombresImport ??
      itemsNombresMapa(
        places.fcPropios,
        places.prevLugarFC,
        places.todosLugares
      ),
    [
      places.nombresImport,
      places.fcPropios,
      places.prevLugarFC,
      places.todosLugares,
    ]
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

  const resaltadoAnim = useResaltadoAnimado(
    places.importando ? places.hoverImportUid : places.hoveredPlaceId
  );
  // clic en un cluster de geocercas: acercar lo justo para que se separe
  const abrirCluster = useCallback(
    (centro: [number, number], z: number) =>
      mapRef.current?.flyTo({
        center: [centro[1], centro[0]],
        zoom: z,
        duration: 600,
      }),
    []
  );
  const capasNombres = useMemo(
    () =>
      capasNombresGeocercas(
        nombresItems,
        `place-names-${namesGen.current}`,
        mapStyle,
        zoom,
        alClicNombre,
        places.onHoverNombre,
        resaltadoAnim,
        places.onHoverBadge,
        abrirCluster
      ),
    [
      nombresItems,
      namesGen.current,
      mapStyle,
      zoom,
      alClicNombre,
      places.onHoverNombre,
      resaltadoAnim,
      places.onHoverBadge,
      abrirCluster,
    ]
  );

  const alCambioZoom = useCallback((z: number) => {
    const next = Math.round((z || 2) * 10) / 10;
    setZoom((prev) => (prev === next ? prev : next));
  }, []);

  // los badges van primero: los camiones, encima
  const capasGeocercas =
    (placesMode || geocercasEnGeneral) && capas.geocercas ? capasNombres : [];
  const verVehiculos = !placesMode && capas.vehiculos && positions.length > 0;
  const layers = [
    ...capasGeocercas,
    ...(verVehiculos
      ? [
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
        ]
      : []),
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
        {placesMode || geocercasEnGeneral ? (
          <PlacesMapLayers
            ws={places}
            vistaGeneral={geocercasEnGeneral}
            ocultar={{
              geocercas: !capas.geocercas,
              trayectos: !capas.trayectos,
            }}
          />
        ) : null}
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
      {/* con la barra de Lugares abierta, notch y capas quedan a su lado */}
      <div
        className={twMerge(
          "absolute top-5 z-50 flex flex-col items-end gap-2 transition-[right]",
          EXPAND_TRANSITION,
          lugaresAbierto ? "right-115" : "right-5"
        )}
      >
        <MapNotch dict={dict} />
        {/* capas, justo bajo los botones de vistas */}
        <MapLayersCard
          dict={dict}
          capas={capas}
          disponibles={capasDeVista(activeView)}
          onCambiar={setCapa}
        />
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
      {/* vista general: nombre y categorías de la geocerca bajo el mouse */}
      {geocercasEnGeneral && places.tooltipBadge && (
        <PlaceBadgeTooltip
          badge={places.tooltipBadge.badge}
          x={places.tooltipBadge.x}
          y={places.tooltipBadge.y}
        />
      )}
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
