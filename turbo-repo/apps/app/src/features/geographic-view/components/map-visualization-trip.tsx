"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import {
  FlyToInterpolator,
  LinearInterpolator,
  ScatterplotLayer,
} from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./layers/pin_layer";
import { PulsePinLayer } from "./layers/pulse";
import { MapPosition, PulseProps } from "../types/map";
import { useGeofences } from "@/features/common/providers/client-api.provider";
import type { Geometry } from "geojson";
import {
  geofenceGeometry,
  geofencePinPosition,
} from "../utils/geofence-geometry";
import { GeofenceLayer } from "./geofence";
import { Spinner } from "flowbite-react";
import { GeofencePinLayer } from "./geofence_pin";
import { TreatmentsLocationResponseItem } from "@/app/api/treatments/location/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import MapTooltip from "./map-tooltip";
import PulseTooltip, {
  PulseListType,
  PulseType,
} from "./tooltips/pulse-tooltip";
import ToolBar from "./tool-bar/tool-bar";
// import MapStyleSelector from "./map-style-selector";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
// import MapButton from "./map-button";
// import { BsSignStop } from "react-icons/bs";
import { ConditionsAgg } from "@/features/symptoms/types/timeline";
import ImageSelector from "./image-viewer/image-selector";
import { useTimelapse } from "../hooks/use-timelapse";
import { logger } from "@/lib/logger";
import { tr } from "@/features/i18n/tr.service";
import PulseRange from "./tool-bar/pulse-range";
import MapVisualization from "@/features/map-visualization/map-visualization";
import { MapRef } from "react-map-gl";
import {
  PlaceBadgeTooltip,
  PlacesEditorOverlays,
  type GeocercaExterna,
  PlacesMapLayers,
  usePlacesEnMapa,
} from "@/features/places";
import PlacesFloatingOverlay from "./places-overlay/places-floating-overlay";
import PlacesToggle from "./places-overlay/places-toggle";
import MapControlsFrame from "./map-controls-frame";
import { usePermisoEditorLugares } from "../profiles/places-permission";
import {
  flyTo,
  panTo,
  toLngLat,
  zoomToVehicle,
} from "@/features/map-visualization/map-view-utils";
import { haversineKm, type LngLat } from "@/features/calendar/utils/distance";
import {
  estimateEtaHours,
  formatEtaHours,
  ringCentroid,
} from "../utils/vehicle-origin";
import { BOUNDS_PADDING, showsNoData, tripCamera } from "../utils/trip-camera";

// This is defined so i can then try to add a "visualization selector" if the user wants the satelital view or not
const mapboxStyles = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
  dark: "mapbox://styles/mapbox/dark-v10",
  light: "mapbox://styles/mapbox/light-v10",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
  hybrid: "mapbox://styles/mapbox/hybrid-v10",
};

type Zone = {
  location_type: any;
  id: string;
  name: string;
  location: string | GeoJSON.Geometry;
};

type GeofenceData = {
  zone: Zone;
  asset_id: string;
  trip_id: string;
};

export type ViewStateType = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  padding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  width: number;
  height: number;
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator | LinearInterpolator;
  transitionEasing?: (t: number) => number;
};

const INITIAL_VIEW_STATE: ViewStateType = {
  longitude: -70.668505,
  latitude: -33.439764,
  zoom: 4.0,
  // base rotation
  pitch: 45,
  bearing: 45,
  // base rotation
  transitionDuration: 500,
  transitionInterpolator: new FlyToInterpolator(),
  transitionEasing: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  padding: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  width: 100,
  height: 100,
};

// The map is tilted, so below this zoom the scroll wheel can pull the camera
// to the map's edge or to latitude 0, far from the trip.
const TRIP_MAP_MIN_ZOOM = 2;

/* INDIVIDUAL POSITION TEST */
type MapVisualizationProps = {
  tripId: string;
  positions: MapPosition[] | null;
  isLoading: boolean;
  error: Error | null;
  filteredLocationData: TreatmentsLocationResponseItem | null;
  dict: I18nRecord;
  selectedTreatmentIndex: ConditionsAgg | null;
  setSelectedTreatment?: (
    treatment: TreatmentsGeneralResponseItem | null
  ) => void;
  setSelectedTreatmentIndex?: (treatmentIndex: ConditionsAgg | null) => void;
  minimized?: boolean;
  licensePlate?: string | null;
  /**
   * Avisa al abrir o cerrar Lugares: la página puede ocultar lo que tiene al
   * lado (la línea de tiempo, el visor multimedia) para darle todo el ancho.
   */
  onLugaresChange?: (abierto: boolean) => void;
  /** Where a case without a trip opened, marked on the map. */
  casePoint?: CasePoint | null;
};

export type CasePoint = { longitude: number; latitude: number };

type GeometryFeature = {
  type: string;
  geometry: Geometry;
  properties: GeometryFeatureProperties;
};

type GeometryFeatureProperties = {
  id: string;
  name: string;
};

/** Píldora de arriba al centro del mapa de viaje (aviso o distancia). */
const PILDORA_VIAJE =
  "flex items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs text-gray-900 shadow dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-100";

/** "Cargando" o "sin datos" del viaje, en el lugar de la distancia. */
function EstadoDelViaje({
  dict,
  cargando,
}: Readonly<{ dict: I18nRecord; cargando: boolean }>) {
  return (
    <div data-estado-viaje className={PILDORA_VIAJE}>
      {cargando ? (
        <Spinner size="sm" />
      ) : (
        <span className="text-gray-500 dark:text-gray-400">
          {tr("geographic_view.no_data_found", dict)}
        </span>
      )}
    </div>
  );
}

/** Distancia del vehículo al origen y cuánto le falta (ETA). */
function DistanciaAlOrigen({
  dict,
  km,
  etaHoras,
}: Readonly<{ dict: I18nRecord; km: number; etaHoras: number | null }>) {
  return (
    <div className={PILDORA_VIAJE}>
      <span className="flex items-center gap-1">
        <span className="font-semibold">
          {tr("geographic_view.distance_to_origin", dict)}:
        </span>
        <span>
          {km.toFixed(1)} {tr("geographic_view.km", dict)}
        </span>
      </span>
      <span className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
      <span className="flex items-center gap-1">
        <span className="font-semibold">
          {tr("geographic_view.eta_to_origin", dict)}:
        </span>
        <span>{etaHoras == null ? "—" : formatEtaHours(etaHoras)}</span>
      </span>
    </div>
  );
}

/** El mismo margen que el marco de controles (p-5): 20 px. */
const MARGEN_CONTROLES_PX = 20;

/** Papel de una geocerca del viaje según su location_type (1 origen, 2 destino). */
function papelGeocerca(locationType: unknown, dict: I18nRecord): string {
  if (locationType === 1)
    return tr("geographic_view.trip_geofences.origin", dict);
  if (locationType === 2)
    return tr("geographic_view.trip_geofences.destination", dict);
  return tr("geographic_view.trip_geofences.other", dict);
}

/** El anillo exterior de un polígono (o del primero de un multipolígono). */
function anilloExterior(geometry: {
  type?: string;
  coordinates?: unknown;
}): LngLat[] | null {
  const c = geometry.coordinates;
  if (!Array.isArray(c)) return null;
  if (geometry.type === "Polygon") return (c[0] as LngLat[]) ?? null;
  if (geometry.type === "MultiPolygon")
    return ((c[0] as LngLat[][] | undefined)?.[0] as LngLat[]) ?? null;
  return null;
}

/** [lat, lon] para ir a la geocerca: centro del anillo o el punto mismo. */
export function anclaDeGeometria(geometry: {
  type?: string;
  coordinates?: unknown;
}): [number, number] | null {
  const c = geometry.coordinates;
  if (geometry.type === "Point" && Array.isArray(c)) {
    const [lng, lat] = c as number[];
    return typeof lat === "number" && typeof lng === "number"
      ? [lat, lng]
      : null;
  }
  const anillo = anilloExterior(geometry);
  const centro = anillo ? ringCentroid(anillo) : null;
  return centro ? [centro[1], centro[0]] : null;
}

/** Las geocercas del viaje como filas de solo lectura para la lista. */
function geocercasDelViaje(
  features: GeometryFeature[],
  dict: I18nRecord
): GeocercaExterna[] {
  return features.flatMap((f, i) => {
    const ancla = anclaDeGeometria(
      f.geometry as unknown as { type?: string; coordinates?: unknown }
    );
    if (!ancla) return [];
    const props = f.properties as {
      id?: string;
      name?: string;
      location_type?: unknown;
    };
    const papel = papelGeocerca(props.location_type, dict);
    return [
      {
        id: String(props.id ?? `viaje-${i}`),
        nombre: props.name || papel,
        detalle: papel,
        ancla,
      },
    ];
  });
}

export default function MapVisualizationTrip({
  tripId,
  positions,
  isLoading,
  filteredLocationData,
  dict,
  selectedTreatmentIndex,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
  minimized = false,
  licensePlate,
  onLugaresChange,
  casePoint = null,
}: MapVisualizationProps) {
  const [rotation, _] = useState(0);
  const [mapStyle, setMapStyle] = useState("satellite");
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<PulseProps | PulseListType>>();
  const { geofence_data } = useGeofences(tripId);
  const [selectedPulse, setSelectedPulse] = useState<number[]>([]);
  const [camera_movement, setCameraMovement] = useState<boolean>(true);
  const [displayPosition, setDisplayPosition] = useState<number>(0);
  const [pictures_list, setPicturesList] = useState<string[]>([]);

  const mapRef = useRef<MapRef>(null);

  // Lugares (para probar): el mismo editor de la vista geográfica, con su
  // botón; sin el permiso "Editor de lugares" es de solo lectura
  const puedeEditarLugares = usePermisoEditorLugares();
  const [lugaresAbierto, setLugaresAbierto] = useState(false);
  const editandoLugares = lugaresAbierto;
  const cambiarLugares = (abierto: boolean) => {
    setLugaresAbierto(abierto);
    onLugaresChange?.(abierto);
  };
  const [zoom, setZoom] = useState(2);
  const alCambioZoom = (z: number) => {
    const next = Math.round((z || 2) * 10) / 10;
    setZoom((prev) => (prev === next ? prev : next));
  };
  const [showStops, setShowStops] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showPulse, setShowPulse] = useState(true);
  // las geocercas de Lugares siguen al botón "geocercas" de la barra de
  // herramientas del mapa (el mismo que las del viaje); cerrado, se ven solo
  // de lectura sobre el viaje
  const verGeocercas = showGeofences;
  const lugares = usePlacesEnMapa(mapRef, {
    editando: editandoLugares,
    verGeocercas,
    puedeEditar: puedeEditarLugares,
    // los trayectos se dibujan (y llevan badge) solo con Lugares abierto
    nombres: { geocercas: verGeocercas, trayectos: editandoLugares },
    mapStyle,
    zoom,
  });

  const { timelapse } = useTimelapse(
    licensePlate ?? null,
    selectedTreatmentIndex?.start ?? null
  );

  useEffect(() => {
    if (selectedTreatmentIndex && selectedTreatmentIndex.evidences) {
      setPicturesList(selectedTreatmentIndex.evidences as string[]);
    }
  }, [selectedTreatmentIndex]);

  // Set when a positions load moves displayPosition, so follow mode does not
  // interrupt the fit-to-bounds that runs for the new positions.
  const skipNextFollow = useRef(false);

  // Add effect to update displayPosition when positions change
  useEffect(() => {
    if (positions?.length) {
      skipNextFollow.current = displayPosition !== positions.length - 1;
      setDisplayPosition(positions.length - 1);
    }
  }, [positions?.length]);

  // Follow mode: while the camera toggle is on, keep the vehicle centered
  // whenever its displayed position changes, without changing the zoom.
  useEffect(() => {
    if (skipNextFollow.current) {
      skipNextFollow.current = false;
      return;
    }
    const position = positions?.[displayPosition];
    if (!camera_movement || !position || !mapRef.current) return;
    panTo(mapRef.current, [position.longitude, position.latitude]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera_movement, displayPosition]);

  const caseLng = casePoint?.longitude;
  const caseLat = casePoint?.latitude;
  const [mapReady, setMapReady] = useState(false);

  // Fits the track, or flies to its single position or to the case point.
  // Waits for the map, so data that arrives first is not lost.
  useEffect(() => {
    if (!mapRef.current || isLoading) return;
    const point =
      caseLng != null && caseLat != null
        ? { longitude: caseLng, latitude: caseLat }
        : null;
    const camera = tripCamera(positions, point);
    if (camera?.kind === "bounds") {
      mapRef.current.fitBounds(camera.bounds, {
        padding: BOUNDS_PADDING,
        duration: 1000,
        maxZoom: camera.maxZoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
      });
    } else if (camera?.kind === "point") {
      flyTo(mapRef.current, camera.target, camera.zoom);
    }
  }, [positions, isLoading, caseLng, caseLat, mapReady]);

  useEffect(() => {
    // A case without a trip is framed by its point and its track instead.
    if (caseLng != null) return;
    const first = filteredLocationData?.features[0];
    const coordinates = first
      ? toLngLat(first.longitude, first.latitude)
      : null;
    if (coordinates && mapRef.current) {
      flyTo(mapRef.current, coordinates, 6.5);
    }
  }, [filteredLocationData, caseLng]);

  // Transform API data to GeoJSON format
  const geoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features:
        positions?.map((item: MapPosition, index: number) => {
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [item?.longitude, item?.latitude],
            },
            properties: {
              id: index,
              icu_code: 0,
              asset_id: item.assetid,
              rotation: item.heading * (180 / Math.PI),
              latitude: item.latitude,
              longitude: item.longitude,
              speed: item.speed,
              timestamp: item.timestamp,
            },
          };
        }) || [],
    }),
    [positions]
  );

  useEffect(() => {
    if (!filteredLocationData || !positions) return;

    // Create a set of matching position indices
    const matchingIndices = new Set<number>();

    if (filteredLocationData && positions) {
      filteredLocationData.features.forEach((filteredItem) => {
        // Find matching position index
        const matchingIndex = positions.findIndex(
          (pos) =>
            pos.longitude === filteredItem.longitude &&
            pos.latitude === filteredItem.latitude
        );
        if (matchingIndex !== -1) {
          matchingIndices.add(matchingIndex);
        }
      });
    }

    setSelectedPulse(Array.from(matchingIndices));

    // A case without a trip has one opening point, not a span of signals to
    // summarise, so its popup waits for the user to pick a pulse.
    if (matchingIndices.size > 0 && caseLng == null) {
      setHoverInfo({
        x: 10,
        y: 10,
        object: {
          elements: Array.from(matchingIndices),
          description: filteredLocationData?.description,
        },
      } as PickingInfo<PulseListType>);
    }
  }, [filteredLocationData, positions, caseLng]);

  // Memoize the geofence processing
  const processedGeofence = React.useMemo(() => {
    if (
      !geofence_data?.data ||
      !geofence_data?.data.length ||
      geofence_data?.data.length === 0
    )
      return null;

    try {
      // Process all geofences into features, filtering out null locations
      const features = geofence_data?.data
        ?.filter((item: GeofenceData) => item.zone.location !== null)
        .map((item: GeofenceData) => {
          const geometry = geofenceGeometry(item.zone.location);

          return {
            type: "Feature",
            geometry,
            properties: {
              id: item.zone.id,
              name: item.zone.name,
              location_type: item.zone.location_type,
            },
          };
        }) as GeometryFeature[];

      // Return a FeatureCollection containing all valid geofences
      return {
        type: "FeatureCollection",
        features,
      };
    } catch (error) {
      logger.error(error, "Error processing geofence data:");
      return null;
    }
  }, [geofence_data]);

  // las geocercas del viaje, como sección de solo lectura en Lugares: la
  // misma lista en todo mapa de viaje (síntomas y bento)
  const geocercasViaje = React.useMemo(
    () => ({
      titulo: tr("geographic_view.trip_geofences.title", dict),
      items: geocercasDelViaje(processedGeofence?.features ?? [], dict),
    }),
    [processedGeofence, dict]
  );

  // Distance + rough ETA from the current vehicle position to the ORIGIN
  // geofence centroid (location_type === 1). The origin/end flags themselves
  // are drawn by GeofencePinLayer; this surfaces "how far is the vehicle from
  // the origin" and an ETA estimated from its last reported speed.
  const originCentroid = React.useMemo<LngLat | null>(() => {
    const origin = processedGeofence?.features.find(
      (f) => (f.properties as { location_type?: number }).location_type === 1
    );
    return origin ? geofencePinPosition(origin.geometry) : null;
  }, [processedGeofence]);

  const vehicle =
    positions && positions.length > 0 ? positions[displayPosition] : null;

  const distanceToOriginKm =
    vehicle && originCentroid
      ? haversineKm([vehicle.longitude, vehicle.latitude], originCentroid)
      : null;

  const etaToOriginHours =
    distanceToOriginKm == null
      ? null
      : estimateEtaHours(distanceToOriginKm, vehicle?.speed);

  // Memoize the layers array
  const layers = React.useMemo(() => {
    const baseLayers = [];

    // Add geofence layer if available
    if (
      processedGeofence &&
      processedGeofence.features.length > 0 &&
      showGeofences
    ) {
      baseLayers.push(
        new GeofenceLayer({
          data: processedGeofence,
          updateTriggers: {
            showGeofences,
          },
        })
      );
    }

    if (geoJson && showPulse) {
      baseLayers.push(
        new PulsePinLayer({
          data: geoJson,
          rotation,
          pickable: true,
          onClick: (info: PickingInfo<PulseProps>) => {
            if (info.viewport) {
              info.x = info.viewport.width / 2;
              info.y = info.viewport.height / 2;
            }

            setHoverInfo(info);
            setSelectedPulse(
              info.object?.properties.id ? [info.object?.properties.id] : []
            );
            const coordinates = info.object?.geometry?.coordinates;
            if (camera_movement && mapRef.current && coordinates) {
              const target = toLngLat(coordinates[0], coordinates[1]);
              if (target) panTo(mapRef.current, target);
            }
            if (setSelectedTreatment && setSelectedTreatmentIndex) {
              setSelectedTreatment(null);
              setSelectedTreatmentIndex(null);
            }
          },
          selectedPulse,
          displayPosition,
          showStops,
          updateTriggers: {
            data: positions,
            selectedPulse,
            showStops,
            displayPosition,
          },
        })
      );
    }

    // Geofences icons
    if (
      processedGeofence &&
      processedGeofence.features.length > 0 &&
      showGeofences
    ) {
      baseLayers.push(
        new GeofencePinLayer({
          data: processedGeofence,
          onClick: (info: any) => {
            const coordinates = info.object?.coordinates;
            if (camera_movement && mapRef.current && coordinates) {
              const target = toLngLat(coordinates[0], coordinates[1]);
              if (target) panTo(mapRef.current, target);
            }
            return true;
          },
          showGeofences,
          updateTriggers: {
            showGeofences,
          },
        })
      );
    }

    if (positions?.length != 0) {
      baseLayers.push(
        new PinLayer({
          data: positions ? [positions[displayPosition]] : [],
          onClick: (info: PickingInfo<any>) => {
            if (info.viewport) {
              info.x = info.viewport.width / 2;
              info.y = info.viewport.height / 2;
            }

            // Create a properly typed formatted info object
            const formattedInfo: PickingInfo<PulseType> = {
              ...info,
              object: {
                properties: {
                  icu_code: info.object?.properties?.icu_code ?? 0,
                  asset_id: info.object?.assetid,
                  rotation: info.object?.heading * (180 / Math.PI),
                  latitude: info.object?.latitude,
                  longitude: info.object?.longitude,
                  speed: info.object?.speed,
                  timestamp: info.object?.timestamp,
                },
              },
            };

            setHoverInfo(formattedInfo as any);
            // The trip map only ever shows this one vehicle
            const target = toLngLat(
              info.object?.longitude,
              info.object?.latitude
            );
            if (mapRef.current && target) {
              zoomToVehicle(mapRef.current, target);
            }
          },
          updateTriggers: {
            data: positions,
          },
        })
      );
    }

    if (caseLng != null && caseLat != null) {
      baseLayers.push(
        new ScatterplotLayer<CasePoint>({
          id: "case-point",
          data: [{ longitude: caseLng, latitude: caseLat }],
          getPosition: (d) => [d.longitude, d.latitude],
          getRadius: 9,
          radiusUnits: "pixels",
          getFillColor: [220, 38, 38, 230],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 3,
          lineWidthUnits: "pixels",
          stroked: true,
          parameters: { depthCompare: "always" },
        })
      );
    }

    return baseLayers;
  }, [
    caseLng,
    caseLat,
    geoJson,
    positions,
    processedGeofence,
    rotation,
    filteredLocationData,
    selectedPulse,
    displayPosition,
    camera_movement,
    showStops,
    showGeofences,
    showPulse,
  ]);

  /** Al cerrar la tarjeta de pulsos: soltar lo seleccionado. */
  const cerrarPulsos = () => {
    setSelectedPulse([]);
    if (setSelectedTreatment && setSelectedTreatmentIndex) {
      setSelectedTreatment(null);
      setSelectedTreatmentIndex(null);
    }
  };

  return (
    // el mapa y, a su lado, la barra de Lugares (no encima): al abrirla el
    // mapa se angosta y sus controles se mueven con su borde
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        {(pictures_list.length > 0 || timelapse) && !minimized ? (
          <div className="z-[700] absolute top-0 left-0 h-full pointer-events-none">
            <ImageSelector
              images={pictures_list}
              dictionary={dict}
              timelapse={timelapse}
            />
          </div>
        ) : null}
        <div className="z-[700] absolute bottom-0 left-0 right-0 w-full pointer-events-none">
          <ToolBar
            dictionary={dict}
            positions={positions ?? []}
            display_position={{
              displayPosition,
              setDisplayPosition,
            }}
            selected_style={{
              selectedStyle: mapStyle,
              setSelectedStyle: setMapStyle,
            }}
            camera_movement={{
              camera_movement,
              setCameraMovement,
            }}
            show_stops={{
              showStops,
              setShowStops,
            }}
            show_geofences={{
              showGeofences,
              setShowGeofences,
            }}
            show_pulse={{
              showPulse,
              setShowPulse,
            }}
            timelineComponent={
              <PulseRange
                positions={positions ?? []}
                displayPosition={displayPosition}
                setDisplayPosition={setDisplayPosition}
              />
            }
          />
        </div>
        <MapVisualization
          mapStyle={
            mapStyle as
              | "satellite"
              | "streets"
              | "dark"
              | "light"
              | "outdoors"
              | "hybrid"
          }
          layers={
            verGeocercas || editandoLugares
              ? [...lugares.capasNombres, ...layers]
              : layers
          }
          isLoading={false}
          mapRef={mapRef}
          // con la barra de Lugares al lado, el borde que la toca va recto
          rounded={editandoLugares ? "left" : true}
          onZoomChange={alCambioZoom}
          minZoom={TRIP_MAP_MIN_ZOOM}
          onMapLoad={() => setMapReady(true)}
          {...lugares.propsMapa}
        >
          {(editandoLugares || verGeocercas) && (
            <PlacesMapLayers
              ws={lugares.ws}
              vistaGeneral={!editandoLugares}
              ocultar={{ geocercas: !verGeocercas }}
            />
          )}
        </MapVisualization>

        {/* resumen de los pulsos elegidos: arrastrable, abre a la izquierda
            (20 px, como los demás controles) y centrada en el alto */}
        {hoverInfo && (
          <MapTooltip
            left={MARGEN_CONTROLES_PX}
            top={MARGEN_CONTROLES_PX}
            centrarVertical
            setHoverInfo={setHoverInfo}
            onExitAction={cerrarPulsos}
          >
            <PulseTooltip
              object={hoverInfo.object as PulseListType | PulseType}
              dict={dict}
            />
          </MapTooltip>
        )}
        {/* mismos 20 px de margen que la barra de herramientas de abajo (p-5) */}
        <MapControlsFrame
          className="z-[760]"
          topCenter={
            // un solo lugar arriba al centro: mientras carga o no hay datos,
            // el aviso; con datos, la distancia y el ETA al origen
            isLoading || showsNoData(isLoading, positions, casePoint) ? (
              <EstadoDelViaje dict={dict} cargando={isLoading} />
            ) : (
              !minimized &&
              distanceToOriginKm != null && (
                <DistanciaAlOrigen
                  dict={dict}
                  km={distanceToOriginKm}
                  etaHoras={etaToOriginHours}
                />
              )
            )
          }
          topRight={
            <PlacesToggle
              dict={dict}
              abierto={lugaresAbierto}
              onCambiar={cambiarLugares}
            />
          }
        />
        {/* geocercas solo de lectura: nombre y categorías bajo el mouse */}
        {!editandoLugares && lugares.ws.tooltipBadge && (
          <PlaceBadgeTooltip
            badge={lugares.ws.tooltipBadge.badge}
            x={lugares.ws.tooltipBadge.x}
            y={lugares.ws.tooltipBadge.y}
          />
        )}
        {/* menús y barras de dibujo de Lugares: sobre el mapa */}
        {editandoLugares && (
          <div className="contents [&>*]:z-[750]">
            <PlacesEditorOverlays ws={lugares.ws} dict={dict} />
          </div>
        )}
      </div>
      <PlacesFloatingOverlay
        dict={dict}
        ws={lugares.ws}
        show={editandoLugares}
        externas={geocercasViaje}
      />
    </div>
  );
}
