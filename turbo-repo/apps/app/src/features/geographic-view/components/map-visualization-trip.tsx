"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import {
  FlyToInterpolator,
  type Layer,
  LineLayer,
  LinearInterpolator,
  ScatterplotLayer,
} from "deck.gl";
import type { LayersList, PickingInfo } from "@deck.gl/core";
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
import {
  GEOFENCES_MODES,
  GEOFENCES_MODES_DEL_VIAJE,
  type GeofencesMode,
} from "./tool-bar/geofences-mode-selector";
// import MapStyleSelector from "./map-style-selector";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
// import MapButton from "./map-button";
// import { BsSignStop } from "react-icons/bs";
import { ConditionsAgg } from "@/features/symptoms/types/timeline";
import ImageSelector from "./image-viewer/image-selector";
import { useTimelapse } from "../hooks/use-timelapse";
import { useAssetSignal } from "../hooks/use-asset-signal";
import { isNewestFrame, isOffline, offlineLabel } from "../utils/signal-state";
import { engineOffLabel, newestEngineOff } from "../utils/engine-state";
import { pulseWithSignal } from "../utils/signal-tooltip";
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
  hayBorrador,
  usePlacesEnMapa,
} from "@/features/places";
import PlacesFloatingOverlay from "./places-overlay/places-floating-overlay";
import PlacesToggle from "./places-overlay/places-toggle";
import { PlacesI18nProvider } from "@/features/places/i18n/places-i18n";
import MapControlsFrame from "./map-controls-frame";
import {
  usePermisoEditorLugares,
  usePermisoVerLugares,
} from "../profiles/places-permission";
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
import {
  countPulseSources,
  filterVisiblePulses,
  isDarkMapStyle,
} from "../utils/pulse-source";
import { PulseSourceLegend } from "./pulse-source-indicator";
import { BOUNDS_PADDING, showsNoData, tripCamera } from "../utils/trip-camera";
import {
  type CaseSpan,
  pointLevel,
  stepLimitAt,
} from "@/features/symptoms/model/level-reason";
import {
  type CaseWindow,
  pulsesInWindow,
} from "@/features/symptoms/model/case-window";
import {
  dashSegments,
  frameDelay,
  hasFramePosition,
  isLate,
  silenceGap,
} from "../utils/frame-delays";

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

const SELECTION_CARD_INSET = 8;

function applySelectionCardPosition(
  info: {
    x?: number;
    y?: number;
    viewport?: { width: number; height: number } | null;
  },
  pinToBottomRight: boolean
) {
  if (pinToBottomRight) {
    info.x = SELECTION_CARD_INSET;
    info.y = SELECTION_CARD_INSET;
    return;
  }
  if (info.viewport) {
    info.x = info.viewport.width / 2;
    info.y = info.viewport.height / 2;
  }
}

const NO_SPANS: CaseSpan[] = [];

/** The silence connection and late-frame rings, independent of the other map layers. */
function frameDelayLayers(
  positions: MapPosition[],
  lostSince: string | null,
  showAppSignalDetail: boolean
): Layer[] {
  const layers: Layer[] = [];
  const gap = silenceGap(positions, lostSince);
  if (gap) {
    layers.push(
      new LineLayer({
        id: "silence-gap",
        data: dashSegments(gap.from, gap.to),
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getColor: [255, 255, 255, 230],
        getWidth: 3,
        widthUnits: "pixels",
        parameters: { depthCompare: "always" },
      })
    );
  }
  // A hidden app pulse must not leave its late-frame dot behind.
  const late = filterVisiblePulses(positions, showAppSignalDetail)
    .filter(hasFramePosition)
    .filter(isLate);
  if (late.length) {
    layers.push(
      new ScatterplotLayer<MapPosition>({
        id: "late-frames",
        data: late,
        getPosition: (d) => [d.longitude, d.latitude],
        // A late frame is drawn as a gray dot with a white border over its blue
        // dot (Tailwind gray-400): lateness is context, not an alarm.
        getRadius: 6,
        radiusUnits: "pixels",
        filled: true,
        getFillColor: [156, 163, 175, 255],
        stroked: true,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        parameters: { depthCompare: "always" },
      })
    );
  }
  return layers;
}

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
  /** The case's engine report, independent of the selected timeline entry. */
  reportedEngineStatus?: boolean | null;
  dict: I18nRecord;
  selectedTreatmentIndex: ConditionsAgg | null;
  setSelectedTreatment?: (
    treatment: TreatmentsGeneralResponseItem | null
  ) => void;
  setSelectedTreatmentIndex?: (treatmentIndex: ConditionsAgg | null) => void;
  minimized?: boolean;
  licensePlate?: string | null;
  showAppSignalDetailDefault?: boolean;
  /**
   * Avisa al abrir o cerrar Lugares: la página puede ocultar lo que tiene al
   * lado (la línea de tiempo, el visor multimedia) para darle todo el ancho.
   */
  onLugaresChange?: (abierto: boolean) => void;
  /** Where a case without a trip opened, marked on the map. */
  casePoint?: CasePoint | null;
  /** The page's symptom intervals: its frames take the symptom's level color. */
  caseSpans?: CaseSpan[];
  /** A lost signal's last frame before the silence: the silence is drawn dashed. */
  lostSince?: string | null;
  /**
   * An engine case's own time inside a longer track: its pulses are selected
   * (white border) and the map opens framed on them.
   */
  caseWindow?: CaseWindow | null;
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

/** Bottom-right corner on the full map; left and vertically centered when minimized. */
function selectionCardPlacement(pinToBottomRight: boolean) {
  if (pinToBottomRight) {
    return {
      start_right: true,
      start_bottom: true,
      left: SELECTION_CARD_INSET,
      top: SELECTION_CARD_INSET,
    };
  }
  return {
    left: MARGEN_CONTROLES_PX,
    top: MARGEN_CONTROLES_PX,
    centrarVertical: true,
  };
}

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

/**
 * Las capas de deck.gl en orden de dibujo (la última queda encima). Los
 * nombres de las geocercas van bajo lo del viaje (pulsos, vehículo, banderas)
 * salvo con el editor de Lugares abierto: ahí se pregunta por las geocercas,
 * así que sus nombres pasan encima de todo.
 */
export function capasDelMapa(
  delViaje: LayersList,
  nombres: LayersList,
  editando: boolean
): LayersList {
  return editando ? [...delViaje, ...nombres] : [...nombres, ...delViaje];
}

/**
 * Lugares sobre el mapa de viaje: el mismo editor de la vista geográfica, con
 * su botón. Sin el permiso "Editor de lugares" es de solo lectura; sin el de
 * ver Lugares no hay botón ni geocercas de Lugares (las del viaje, origen y
 * destino, siguen: son del viaje).
 */
function useLugaresDelViaje(
  mapRef: RefObject<MapRef | null>,
  {
    dict,
    mapStyle,
    zoom,
    geofencesMode,
    onLugaresChange,
  }: {
    dict: I18nRecord;
    mapStyle: string;
    zoom: number;
    geofencesMode: GeofencesMode;
    onLugaresChange?: (abierto: boolean) => void;
  }
) {
  const puedeEditarLugares = usePermisoEditorLugares();
  const verLugares = usePermisoVerLugares();
  const [lugaresAbierto, setLugaresAbierto] = useState(false);
  const editandoLugares = verLugares && lugaresAbierto;
  const cambiarLugares = (abierto: boolean) => {
    setLugaresAbierto(abierto);
    onLugaresChange?.(abierto);
  };
  // las de Lugares, solo de lectura sobre el viaje, van con "todas"; con el
  // editor abierto se ven siempre (son lo que se edita)
  const verGeocercas =
    verLugares && (geofencesMode === "all" || editandoLugares);
  const lugares = usePlacesEnMapa(mapRef, {
    dict,
    editando: editandoLugares,
    verGeocercas,
    puedeEditar: puedeEditarLugares,
    // los trayectos se dibujan (y llevan badge) solo con Lugares abierto
    nombres: { geocercas: verGeocercas, trayectos: editandoLugares },
    mapStyle,
    zoom,
    ambito: "viaje",
  });
  // tras recargar con un lugar o trayecto a medio editar: reabrir Lugares
  // (el editor retoma el borrador al abrirse)
  const borradorRevisado = useRef<string | null>(null);
  useEffect(() => {
    if (
      !lugares.ws.storageScope ||
      !verLugares ||
      !puedeEditarLugares ||
      borradorRevisado.current === lugares.ws.storageScope
    )
      return;
    borradorRevisado.current = lugares.ws.storageScope;
    if (!lugaresAbierto && hayBorrador("viaje", lugares.ws.storageScope))
      cambiarLugares(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verLugares, puedeEditarLugares, lugares.ws.storageScope]);

  // cerrar Lugares con cambios sin guardar: igual que el ✕ del formulario
  const alternarLugares = () => {
    if (!lugaresAbierto) cambiarLugares(true);
    else lugares.ws.pedirSalir(() => cambiarLugares(false));
  };
  return {
    verLugares,
    lugaresAbierto,
    editandoLugares,
    verGeocercas,
    // sin ver Lugares, el selector ofrece solo las del viaje o ninguna
    modosGeocercas: verLugares ? GEOFENCES_MODES : GEOFENCES_MODES_DEL_VIAJE,
    lugares,
    alternarLugares,
  };
}

export default function MapVisualizationTrip({
  tripId,
  positions,
  isLoading,
  filteredLocationData,
  reportedEngineStatus,
  dict,
  selectedTreatmentIndex,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
  minimized = false,
  licensePlate,
  showAppSignalDetailDefault = false,
  onLugaresChange,
  casePoint = null,
  caseSpans = NO_SPANS,
  lostSince = null,
  caseWindow = null,
}: MapVisualizationProps) {
  const pinSelectionCardToCorner = !minimized;
  const [rotation, _] = useState(0);
  const [mapStyle, setMapStyle] = useState("satellite");
  const isDarkMap = isDarkMapStyle(mapStyle);
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<PulseProps | PulseListType>>();
  const { geofence_data } = useGeofences(tripId);
  const [selectedPulse, setSelectedPulse] = useState<number[]>([]);
  const [camera_movement, setCameraMovement] = useState<boolean>(true);
  const [displayPosition, setDisplayPosition] = useState<number>(0);
  const [pictures_list, setPicturesList] = useState<string[]>([]);

  const mapRef = useRef<MapRef>(null);

  const [zoom, setZoom] = useState(2);
  const alCambioZoom = (z: number) => {
    const next = Math.round((z || 2) * 10) / 10;
    setZoom((prev) => (prev === next ? prev : next));
  };
  const [showStops, setShowStops] = useState(true);
  // qué geocercas se ven (botón "geocercas" de la barra de herramientas):
  // todas, solo las del viaje (por defecto) o ninguna
  const [geofencesMode, setGeofencesMode] = useState<GeofencesMode>("trip");
  const [showPulse, setShowPulse] = useState(true);
  const [showAppSignalDetail, setShowAppSignalDetail] = useState(
    showAppSignalDetailDefault
  );
  const showGeofences = geofencesMode !== "none";
  const {
    verLugares,
    lugaresAbierto,
    editandoLugares,
    verGeocercas,
    modosGeocercas,
    lugares,
    alternarLugares,
  } = useLugaresDelViaje(mapRef, {
    dict,
    mapStyle,
    zoom,
    geofencesMode,
    onLugaresChange,
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
  const casePulses = useMemo(
    () => pulsesInWindow(positions, caseWindow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, caseWindow?.from, caseWindow?.to]
  );
  const casePulsesKey = casePulses.join(",");
  const hasCaseWindow = caseWindow != null;

  // Fits the track, or flies to its single position or to the case point.
  // Waits for the map, so data that arrives first is not lost.
  useEffect(() => {
    if (!mapRef.current || isLoading) return;
    const point =
      caseLng != null && caseLat != null
        ? { longitude: caseLng, latitude: caseLat }
        : null;
    // A case on a longer track opens on its own pulses; zooming out shows the rest.
    const focus = casePulses.length > 0;
    const framed = focus
      ? casePulses
          .map((i) => positions?.[i])
          .filter((p): p is MapPosition => !!p)
      : positions;
    const camera = tripCamera(framed, point, focus);
    if (camera?.kind === "bounds") {
      mapRef.current.fitBounds(camera.bounds, {
        padding: BOUNDS_PADDING,
        duration: 1000,
        maxZoom: camera.maxZoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
      });
    } else if (camera?.kind === "point") {
      mapRef.current.flyTo({
        center: camera.target,
        zoom: camera.zoom,
        duration: 1000,
        ...(focus ? { pitch: 0, bearing: 0 } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    positions,
    isLoading,
    caseLng,
    caseLat,
    mapReady,
    casePulsesKey,
    hasCaseWindow,
  ]);

  useEffect(() => {
    // A case without a trip is framed by its point and its track instead, and
    // a case window by its pulses.
    if (caseLng != null || hasCaseWindow) return;
    const first = filteredLocationData?.features[0];
    const coordinates = first
      ? toLngLat(first.longitude, first.latitude)
      : null;
    if (coordinates && mapRef.current) {
      flyTo(mapRef.current, coordinates, 6.5);
    }
  }, [filteredLocationData, caseLng, hasCaseWindow]);

  // The detector's state of the vehicle: its newest position turns gray and
  // carries "Sin señal · hace N min" while the signal does not arrive.
  const newestIndex = (positions?.length ?? 0) - 1;
  const newest = positions?.at(-1);
  const signal = useAssetSignal(newest?.assetid, newest?.timestamp);
  const offline =
    !!newest && isOffline(signal) && isNewestFrame(newest.timestamp, signal);
  const offlineText = offline ? offlineLabel(signal, dict) : null;
  const pinOffline = offline && displayPosition === newestIndex;
  // Engine off on the newest frame turns the pin gray with its normal face and
  // labels it "Motor apagado". Lost signal wins.
  const engineOff = newestEngineOff(newest, reportedEngineStatus);
  const engineText = engineOffLabel(engineOff, offline, dict);
  const pinEngineOff = !!engineText && displayPosition === newestIndex;
  const engineLabel = useMemo(
    () =>
      newest && engineText
        ? { timestamp: newest.timestamp, label: engineText }
        : null,
    [newest, engineText]
  );

  // Transform API data to GeoJSON format
  const geoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features:
        positions?.map((item: MapPosition, index: number) => {
          const symptom = pointLevel(item.timestamp, caseSpans);
          const limit = stepLimitAt(item.timestamp, caseSpans);
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [item?.longitude, item?.latitude],
            },
            properties: {
              id: index,
              // Frames stay blue; selecting a symptom rings its frames. The level only shows in the popup.
              icu_code: 0,
              symptom_level: symptom?.level ?? null,
              symptom_name: symptom?.name ?? null,
              asset_id: item.assetid,
              rotation: item.heading * (180 / Math.PI),
              latitude: item.latitude,
              longitude: item.longitude,
              speed: limit?.speed ?? item.speed,
              timestamp: item.timestamp,
              signal_description: item.signal_description,
              signal_detail: item.signal_detail,
              delay_s: frameDelay(item),
              speed_limit: limit?.limit ?? null,
              speed_limit_zone: limit?.zone ?? null,
              offline: offline && index === newestIndex,
              signal_label:
                offline && index === newestIndex ? offlineText : null,
            },
          };
        }) || [],
    }),
    [positions, caseSpans, offline, newestIndex, offlineText]
  );

  // A refreshed description must not reopen a dismissed popup or reset a selected frame.
  const matchingPulseKey = useMemo(() => {
    // An engine case's signals are its pulses in its window, as the legacy
    // symptoms' signals were.
    if (hasCaseWindow) return casePulsesKey;
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

    return Array.from(matchingIndices).join(",");
  }, [filteredLocationData, positions, casePulsesKey, hasCaseWindow]);

  const previousTimelineId = useRef(selectedTreatmentIndex?.symptom_id);
  useEffect(() => {
    const indices = matchingPulseKey
      ? matchingPulseKey.split(",").map(Number)
      : [];
    // Clearing the timeline after a pulse click must keep that pulse and popup.
    // Selecting a timeline condition again restores the case's selection.
    const timelineId = selectedTreatmentIndex?.symptom_id;
    const clearedTimeline =
      previousTimelineId.current != null && timelineId == null;
    previousTimelineId.current = timelineId;
    if (hasCaseWindow && clearedTimeline) return;
    setSelectedPulse(indices);
    if (hasCaseWindow && indices.length === 0) setHoverInfo(undefined);

    // A case without a trip has one opening point, not a span of signals to
    // summarise, so its popup waits for the user to pick a pulse.
    if (indices.length > 0 && caseLng == null) {
      const selected = new Set(indices);
      const sourceCounts = countPulseSources(
        (positions ?? []).filter((_position, index) => selected.has(index))
      );
      setHoverInfo({
        x: pinSelectionCardToCorner ? SELECTION_CARD_INSET : 10,
        y: pinSelectionCardToCorner ? SELECTION_CARD_INSET : 10,
        object: {
          elements: indices,
          description: {},
          appCount: sourceCounts.app,
          gpsCount: sourceCounts.gps,
        },
      } as PickingInfo<PulseListType>);
    }
    // `positions` stays out: a refresh with the same matches must not reopen the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    matchingPulseKey,
    caseLng,
    hasCaseWindow,
    selectedTreatmentIndex?.symptom_id,
    pinSelectionCardToCorner,
  ]);

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
            applySelectionCardPosition(info, pinSelectionCardToCorner);

            setHoverInfo(info);
            const pulseId = info.object?.properties.id;
            setSelectedPulse(pulseId == null ? [] : [pulseId]);
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
          showAppSignalDetail,
          isDarkMap,
          updateTriggers: {
            data: positions,
            selectedPulse,
            showStops,
            showAppSignalDetail,
            displayPosition,
            isDarkMap,
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
            applySelectionCardPosition(info, pinSelectionCardToCorner);

            const pinLimit = stepLimitAt(info.object?.timestamp, caseSpans);
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
                  speed: pinLimit?.speed ?? info.object?.speed,
                  timestamp: info.object?.timestamp,
                  signal_description: info.object?.signal_description,
                  signal_detail: info.object?.signal_detail,
                  delay_s: frameDelay(info.object),
                  speed_limit: pinLimit?.limit ?? null,
                  speed_limit_zone: pinLimit?.zone ?? null,
                  signal_label: pinOffline ? offlineText : null,
                  engine_label: pinEngineOff ? engineText : null,
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
          offline: pinOffline,
          engineOff: pinEngineOff,
          label: offlineText ?? engineText,
          updateTriggers: {
            data: positions,
          },
        })
      );
    }

    if (showPulse && positions?.length) {
      baseLayers.push(
        ...frameDelayLayers(positions, lostSince, showAppSignalDetail)
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
    lostSince,
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
    showAppSignalDetail,
    isDarkMap,
    pinSelectionCardToCorner,
    pinOffline,
    offlineText,
    pinEngineOff,
    engineText,
    caseSpans,
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
    // isolate: el mapa es su propia capa, así ningún z de adentro (controles,
    // filtros, la barra de Lugares) queda sobre la barra superior y sus menús
    <PlacesI18nProvider dict={dict}>
      <div className="isolate flex h-full w-full overflow-hidden">
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
              geofences_mode={{
                geofencesMode,
                setGeofencesMode,
                modes: modosGeocercas,
              }}
              show_pulse={{
                showPulse,
                setShowPulse,
              }}
              show_app_signal_detail={{
                showAppSignalDetail,
                setShowAppSignalDetail,
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
            layers={capasDelMapa(
              layers,
              verGeocercas ? lugares.capasNombres : [],
              editandoLugares
            )}
            isLoading={false}
            mapRef={mapRef}
            // con la barra de Lugares al lado, el borde que la toca va recto
            rounded={editandoLugares ? "left" : true}
            onZoomChange={alCambioZoom}
            minZoom={TRIP_MAP_MIN_ZOOM}
            onMapLoad={() => setMapReady(true)}
            {...lugares.propsMapa}
          >
            {verGeocercas && (
              <PlacesMapLayers
                ws={lugares.ws}
                vistaGeneral={!editandoLugares}
              />
            )}
          </MapVisualization>

          {/* resumen de los pulsos elegidos: arrastrable, abre a la izquierda
            (20 px, como los demás controles) y centrada en el alto */}
          {hoverInfo && (
            <MapTooltip
              {...selectionCardPlacement(pinSelectionCardToCorner)}
              setHoverInfo={setHoverInfo}
              onExitAction={cerrarPulsos}
            >
              <PulseTooltip
                object={pulseWithSignal(
                  hoverInfo.object as PulseListType | PulseType,
                  newest?.assetid,
                  signal,
                  dict,
                  filteredLocationData?.description,
                  engineLabel
                )}
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
              <>
                {verLugares && (
                  <PlacesToggle
                    dict={dict}
                    abierto={lugaresAbierto}
                    onCambiar={alternarLugares}
                  />
                )}
                {positions && positions.length > 0 && (
                  <PulseSourceLegend
                    dict={dict}
                    showStops={showStops}
                    isDarkMap={isDarkMap}
                  />
                )}
              </>
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
    </PlacesI18nProvider>
  );
}
