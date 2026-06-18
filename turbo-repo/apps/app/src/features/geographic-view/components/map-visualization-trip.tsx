"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import { FlyToInterpolator, LinearInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./layers/pin_layer";
import { PulsePinLayer } from "./layers/pulse";
import { MapPosition, PulseProps } from "../types/map";
import { useGeofences } from "@/features/common/providers/client-api.provider";
import wkx, { Geometry } from "wkx";
import { GeofenceLayer } from "./geofence";
import { Spinner } from "flowbite-react";
import { GeofencePinLayer } from "./geofence_pin";
import { TreatmentsLocationResponseItem } from "@/app/api/treatments/location/route.type";
import MapTooltip from "./map-tooltip";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
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
  center_in_bounds,
  flyTo,
} from "@/features/map-visualization/map-view-utils";
import { haversineKm, type LngLat } from "@/features/calendar/utils/distance";
import {
  ringCentroid,
  estimateEtaHours,
  formatEtaHours,
} from "../utils/vehicle-origin";

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
  location: string;
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
};

type GeometryFeature = {
  type: string;
  geometry: Geometry;
  properties: GeometryFeatureProperties;
};

type GeometryFeatureProperties = {
  id: string;
  name: string;
};

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

  const { timelapse } = useTimelapse(
    licensePlate ?? null,
    selectedTreatmentIndex?.start ?? null
  );

  useEffect(() => {
    if (selectedTreatmentIndex && selectedTreatmentIndex.evidences) {
      setPicturesList(selectedTreatmentIndex.evidences as string[]);
    }
  }, [selectedTreatmentIndex]);

  // Add effect to update displayPosition when positions change
  useEffect(() => {
    if (positions?.length) {
      setDisplayPosition(positions.length - 1);
    }
  }, [positions?.length]);

  const [showStops, setShowStops] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showPulse, setShowPulse] = useState(true);

  useEffect(() => {
    if (mapRef.current) {
      center_in_bounds(positions || [], mapRef.current, isLoading);
    }
  }, [positions]);

  useEffect(() => {
    if (
      filteredLocationData &&
      filteredLocationData.features.length > 0 &&
      mapRef.current
    ) {
      flyTo(
        mapRef.current,
        [
          filteredLocationData.features[0].longitude ?? 0,
          filteredLocationData.features[0].latitude ?? 0,
        ],
        6.5
      );
    }
  }, [filteredLocationData]);

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

    if (matchingIndices.size > 0) {
      setHoverInfo({
        x: 10,
        y: 10,
        object: {
          elements: Array.from(matchingIndices),
          description: filteredLocationData?.description,
        },
      } as PickingInfo<PulseListType>);
    }
  }, [filteredLocationData, positions]);

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
          const wkbHexString = item.zone.location;
          const wkbBuffer = Buffer.from(wkbHexString, "hex");
          const geometry = wkx.Geometry.parse(wkbBuffer);

          return {
            type: "Feature",
            geometry: geometry.toGeoJSON(),
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

  // Distance + rough ETA from the current vehicle position to the ORIGIN
  // geofence centroid (location_type === 1). The origin/end flags themselves
  // are drawn by GeofencePinLayer; this surfaces "how far is the vehicle from
  // the origin" and an ETA estimated from its last reported speed.
  const originCentroid = React.useMemo<LngLat | null>(() => {
    const origin = processedGeofence?.features.find(
      (f) => (f.properties as { location_type?: number }).location_type === 1
    );
    const ring = (origin?.geometry as { coordinates?: LngLat[][] } | undefined)
      ?.coordinates?.[0];
    return ring ? ringCentroid(ring) : null;
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
            if (camera_movement && mapRef.current) {
              flyTo(
                mapRef.current,
                info.object?.geometry.coordinates ?? [0, 0],
                15
              );
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
            if (camera_movement && mapRef.current) {
              flyTo(mapRef.current, info.object?.coordinates ?? [0, 0], 15);
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
            if (camera_movement && mapRef.current) {
              flyTo(
                mapRef.current,
                [info.object?.longitude ?? 0, info.object?.latitude ?? 0],
                15
              );
            }
          },
          updateTriggers: {
            data: positions,
          },
        })
      );
    }

    return baseLayers;
  }, [
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

  return (
    <div className="h-full w-full relative overflow-hidden">
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
              onZoom={(e) => {
                if (positions && mapRef.current) {
                  flyTo(
                    mapRef.current,
                    [
                      positions[Number(e.target.value)]?.longitude ?? 0,
                      positions[Number(e.target.value)]?.latitude ?? 0,
                    ],
                    15
                  );
                }
              }}
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
        layers={layers}
        isLoading={false}
        mapRef={mapRef}
        onZoomChange={() => {}}
      />
      {hoverInfo && (
        <MapTooltip
          start_right={true}
          left={hoverInfo.x}
          top={hoverInfo.y}
          setHoverInfo={setHoverInfo}
          onExitAction={() => {
            setSelectedPulse([]);
            if (setSelectedTreatment && setSelectedTreatmentIndex) {
              setSelectedTreatment(null);
              setSelectedTreatmentIndex(null);
            }
          }}
        >
          <PulseTooltip
            object={hoverInfo.object as PulseListType | PulseType}
            dict={dict}
          />
        </MapTooltip>
      )}

      <div className="absolute right-0 top-5 bg-white dark:bg-gray-800 rounded-l-full border-r border-y border-gray-400 dark:border-gray-700">
        {isLoading ? (
          <div className="flex items-center justify-center h-full p-2">
            <Spinner />
          </div>
        ) : !isLoading && positions?.length === 0 ? (
          <div className="flex items-center justify-center h-full p-2">
            <p className="text-gray-500 dark:text-gray-400 font-light">
              {tr("geographic_view.no_data_found", dict)}
            </p>
          </div>
        ) : null}
      </div>

      {!minimized && distanceToOriginKm != null && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-[600] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs shadow dark:border-gray-700 dark:bg-gray-800/90">
          <span className="flex items-center gap-1">
            <span className="font-semibold">
              {tr("geographic_view.distance_to_origin", dict)}:
            </span>
            <span>{distanceToOriginKm.toFixed(1)} km</span>
          </span>
          <span className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="font-semibold">
              {tr("geographic_view.eta_to_origin", dict)}:
            </span>
            <span>
              {etaToOriginHours == null ? "—" : formatEtaHours(etaToOriginHours)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
