"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import MapVisualization, {
  type MapStyleName,
} from "@/features/map-visualization/map-visualization";
import MapStyleSelector from "@/features/geographic-view/components/map-style-selector";
import { CURSOR_AGREGAR } from "../places/cursors";
import PlacesMapLayers from "../places/places-map-layers";
import { PlacesEditorOverlays } from "../places/places-editor-overlays";
import { PlacesSettingsSidebar } from "../places/places-catalog";
import { itemsNombresMapa, type ItemNombre } from "../places/place-labels";
import { capasNombresGeocercas } from "../places/place-name-layer";
import { useResaltadoAnimado } from "../places/highlight-animation";
import { zoomAlClicNombre } from "../places/geofence-lod";
import {
  PLACES_INITIAL_VIEW,
  usePlacesWorkspace,
} from "../places/use-places-workspace";

export default function PlacesPageContent({ dict }: { dict: I18nRecord }) {
  const mapRef = useRef<MapRef | null>(null);
  const ws = usePlacesWorkspace(mapRef);
  const [zoom, setZoom] = useState(PLACES_INITIAL_VIEW.zoom);
  // importando: los badges son los de lo importado, no los de lo guardado
  const nombresItems = useMemo(
    () =>
      ws.nombresImport ??
      itemsNombresMapa(ws.fcPropios, ws.prevLugarFC, ws.todosLugares),
    [ws.nombresImport, ws.fcPropios, ws.prevLugarFC, ws.todosLugares]
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
    ws.importando ? ws.hoverImportUid : ws.hoveredPlaceId
  );
  // clic en un cluster: acercar lo justo para que se separe
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
        "place-names",
        ws.mapStyle,
        zoom,
        alClicNombre,
        ws.onHoverNombre,
        resaltadoAnim,
        ws.onHoverBadge,
        abrirCluster
      ),
    [
      nombresItems,
      ws.mapStyle,
      zoom,
      alClicNombre,
      ws.onHoverNombre,
      resaltadoAnim,
      ws.onHoverBadge,
      abrirCluster,
    ]
  );
  const alCambioZoom = useCallback((z: number) => {
    const next = Math.round((z || PLACES_INITIAL_VIEW.zoom) * 10) / 10;
    setZoom((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative h-full min-w-0 flex-1">
        <MapVisualization
          rounded={false}
          mapStyle={ws.mapStyle}
          layers={capasNombres}
          mapRef={mapRef}
          initialViewState={PLACES_INITIAL_VIEW}
          onZoomChange={alCambioZoom}
          onMapClick={ws.onMapClick}
          onMapContextMenu={ws.onMapContextMenu}
          idleCursor={ws.clicAgrega ? CURSOR_AGREGAR : undefined}
        >
          <PlacesMapLayers ws={ws} />
        </MapVisualization>
        <PlacesEditorOverlays ws={ws} dict={dict} />
        <div className="absolute bottom-5 left-5 z-40">
          <MapStyleSelector
            dict={dict}
            selectedStyle={ws.mapStyle}
            setSelectedStyle={(style) => ws.setMapStyle(style as MapStyleName)}
          />
        </div>
      </div>
      <PlacesSettingsSidebar ws={ws} />
    </div>
  );
}
