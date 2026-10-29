"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import MapTooltip from "./map-tooltip";
import PinTooltip from "./tooltips/pin-tooltip";
import MapStyleSelector from "./map-style-selector";
import MapLayersCard, { capasDeVista, useCapasMapa } from "./map-layers-card";
import {
  PlaceBadgeTooltip,
  PlacesEditorOverlays,
  PlacesMapLayers,
  hayBorrador,
  usePlacesEnMapa,
} from "@/features/places";
import { MapRef } from "react-map-gl";
import MapVisualizationGeneric from "@/features/map-visualization/map-visualization";
import { useGeographicProfile } from "../profiles/geographic-profile-context";
import MapNotch from "./map-notch/map-notch";
import MapControlsFrame from "./map-controls-frame";
import { usePermisoEditorLugares } from "../profiles/places-permission";
import PlacesFloatingOverlay from "./places-overlay/places-floating-overlay";
import { SlidePanel } from "./places-overlay/panel-motion";

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
}: Readonly<MapVisualizationProps>) {
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<MapPositionProperties>>();
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [originalPositions, setOriginalPositions] = useState<MapPosition[]>([]);
  const [mapStyle, setMapStyle] = useState("satellite");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("licensePlate") || "");

  const [zoom, setZoom] = useState(2);

  const mapRef = useRef<MapRef | null>(null);
  const { activeView, setActiveView } = useGeographicProfile();
  const placesMode = activeView === "places";
  // barra "Capas": qué se dibuja; en la vista general las geocercas (forma y
  // nombre) se ven, solo lectura, bajo los camiones mientras estén activas
  const [capas, setCapa] = useCapasMapa();
  const geocercasEnGeneral = !placesMode && capas.geocercas;
  const puedeEditarLugares = usePermisoEditorLugares();
  const lugares = usePlacesEnMapa(mapRef, {
    editando: placesMode,
    verGeocercas: placesMode || geocercasEnGeneral,
    puedeEditar: puedeEditarLugares,
    // los badges siguen la barra "Capas"; los trayectos, solo en Lugares
    nombres: {
      geocercas: capas.geocercas,
      trayectos: placesMode && capas.trayectos,
    },
    mapStyle,
    zoom,
  });
  const places = lugares.ws;

  // tras recargar con un lugar o trayecto a medio editar: volver a Lugares
  // (el editor retoma el borrador al abrirse)
  const borradorRevisado = useRef(false);
  useEffect(() => {
    if (!puedeEditarLugares || borradorRevisado.current) return;
    borradorRevisado.current = true;
    if (!placesMode && hayBorrador("geografico")) setActiveView("places");
  }, [puedeEditarLugares, placesMode, setActiveView]);

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

  // cerrar Lugares no mueve la cámara: el encuadre de los camiones es para
  // cuando cargan, no para la vuelta desde Lugares
  const veniaDeLugares = useRef(placesMode);
  useEffect(() => {
    const salioDeLugares = veniaDeLugares.current && !placesMode;
    veniaDeLugares.current = placesMode;
    if (placesMode || salioDeLugares) return;
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

  const capasNombres = lugares.capasNombres;

  const alCambioZoom = useCallback((z: number) => {
    const next = Math.round((z || 2) * 10) / 10;
    setZoom((prev) => (prev === next ? prev : next));
  }, []);

  // los badges van primero: los camiones, encima
  const capasGeocercas = placesMode || geocercasEnGeneral ? capasNombres : [];
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
    // el mapa y, a su lado, la barra de Lugares: al abrirla el mapa se
    // angosta (su centro sigue siendo el de lo que se ve) y sus controles se
    // mueven con su borde
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
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
          {...lugares.propsMapa}
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
        {/* todos los controles a 20 px del borde; con Lugares abierto, a su lado */}
        <MapControlsFrame
          topLeft={
            // filtros de camiones: se van al abrir Lugares (no hay camiones)
            <SlidePanel show={!placesMode} from="left">
              <Filters
                dict={dict}
                originalPositions={originalPositions}
                setPositions={setPositions}
                className="p-0"
              />
            </SlidePanel>
          }
          topRight={
            <>
              {/* dejar Lugares con cambios sin guardar: igual que su ✕ */}
              <MapNotch dict={dict} alSalirDeLugares={places.pedirSalir} />
              {/* capas, justo bajo los botones de vistas */}
              <MapLayersCard
                dict={dict}
                capas={capas}
                disponibles={capasDeVista(activeView)}
                onCambiar={setCapa}
              />
            </>
          }
          bottomLeft={
            <MapStyleSelector
              dict={dict}
              selectedStyle={mapStyle}
              setSelectedStyle={setMapStyle}
            />
          }
        />
        {/* menús y barras de dibujo: sobre el mapa, en sus coordenadas */}
        {placesMode && <PlacesEditorOverlays ws={places} dict={dict} />}
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
      <PlacesFloatingOverlay dict={dict} ws={places} show={placesMode} />
    </div>
  );
}
