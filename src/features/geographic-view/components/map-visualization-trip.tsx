"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator, LinearInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./pin_layer_clustered";
import { PulsePinLayer } from "./pulse";
import Map from "react-map-gl";
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
import ImageSelector from "./image-selector";

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
  averagePosition: {
    latitude: number;
    longitude: number;
  };
  filteredLocationData: TreatmentsLocationResponseItem | null;
  dict: I18nRecord;
  setSelectedTreatment?: (
    treatment: TreatmentsGeneralResponseItem | null,
  ) => void;
  setSelectedTreatmentIndex?: (treatmentIndex: ConditionsAgg | null) => void;
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

function zoom_on_pin(
  longitude: number,
  latitude: number,
  clustered: boolean,
  setViewState: (viewState: ViewStateType) => void,
  viewState: ViewStateType,
  camera_movement: boolean,
  zoom?: number,
) {
  if (latitude && longitude) {
    const newViewState = {
      ...viewState,
      longitude,
      latitude,
      transitionDuration: 500,
      transitionInterpolator: camera_movement
        ? new FlyToInterpolator({
            curve: 1,
            speed: 1,
          })
        : new LinearInterpolator(),
      transitionEasing: (t: number) => t,
    };

    // Only update zoom if camera_movement is true and a zoom value is provided
    if (camera_movement && zoom !== undefined) {
      newViewState.zoom = zoom;
    }

    setViewState(newViewState);
  }
}

function move_to_pin(
  averagePosition: {
    latitude: number;
    longitude: number;
  },
  setViewState: (viewState: ViewStateType) => void,
  viewState: ViewStateType,
  camera_movement: boolean,
) {
  if (camera_movement) {
    setViewState({
      ...viewState,
      longitude: averagePosition.longitude,
      latitude: averagePosition.latitude,
      zoom: 6.5,
      transitionDuration: 500,
      transitionInterpolator: new FlyToInterpolator(),
    });
  }
}

export default function MapVisualizationTrip({
  tripId,
  positions,
  isLoading,
  averagePosition,
  filteredLocationData,
  dict,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
}: MapVisualizationProps) {
  const [rotation, _] = useState(0);
  const [mapStyle, setMapStyle] = useState("satellite");
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<PulseProps | PulseListType>>();
  const { geofence_data, geofence_error, geofence_isLoading } =
    useGeofences(tripId);
  const [selectedPulse, setSelectedPulse] = useState<number[]>([]);
  const [camera_movement, setCameraMovement] = useState<boolean>(true);
  const [displayPosition, setDisplayPosition] = useState<number>(0);
  const [pictures_list, setPicturesList] = useState<any[]>([0,1,2,3]);

  // Add effect to update displayPosition when positions change
  useEffect(() => {
    if (positions?.length) {
      setDisplayPosition(positions.length - 1);
    }
  }, [positions?.length]);

  const handleViewStateChange = useCallback((e: any) => {
    if (e.viewState) {
      setViewState(e.viewState);
    }
  }, []);
  const [showStops, _setShowStops] = useState(true);

  // Handle initial zoom when positions are loaded
  useEffect(() => {
    if (positions && positions.length > 0) {
      move_to_pin(averagePosition, setViewState, viewState, true);
    }
    if (filteredLocationData && filteredLocationData.features.length > 0) {
      move_to_pin(
        {
          latitude: filteredLocationData.features[0].latitude ?? 0,
          longitude: filteredLocationData.features[0].longitude ?? 0,
        },
        setViewState,
        viewState,
        true,
      );
    }
  }, [positions, filteredLocationData]);

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
    [positions],
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
            pos.latitude === filteredItem.latitude,
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
      console.error("Error processing geofence data:", error);
      return null;
    }
  }, [geofence_data]);

  // Memoize the layers array
  const layers = React.useMemo(() => {
    const baseLayers = [];

    // Add geofence layer if available
    if (processedGeofence && processedGeofence.features.length > 0) {
      baseLayers.push(
        new GeofenceLayer({
          data: processedGeofence,
          zoom: viewState.zoom,
        }),
      );
    }

    if (geoJson) {
      baseLayers.push(
        new PulsePinLayer({
          data: geoJson,
          rotation,
          zoom: viewState.zoom,
          pickable: true,
          onClick: (info: PickingInfo<PulseProps>) => {
            if (info.viewport) {
              info.x = info.viewport.width / 2;
              info.y = info.viewport.height / 2;
            }

            setHoverInfo(info);
            setSelectedPulse(
              info.object?.properties.id ? [info.object?.properties.id] : [],
            );
            zoom_on_pin(
              info.object?.geometry.coordinates[0] ?? 0,
              info.object?.geometry.coordinates[1] ?? 0,
              false,
              setViewState,
              viewState,
              camera_movement,
            );
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
        }),
      );
    }

    // Geofences icons
    if (processedGeofence && processedGeofence.features.length > 0) {
      baseLayers.push(
        new GeofencePinLayer({
          data: processedGeofence,
          zoom: viewState.zoom,
          onClick: (info: any) => {
            zoom_on_pin(
              info.object.coordinates[0],
              info.object.coordinates[1],
              false,
              setViewState,
              viewState,
              camera_movement,
            );
            return true;
          },
        }),
      );
    }

    if (positions?.length != 0) {
      baseLayers.push(
        new PinLayer({
          data: positions ? [positions[displayPosition]] : [],
          zoom: viewState.zoom,
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
                  icu_code: info.object?.properties.icu_code ?? 0,
                  asset_id: info.object?.properties.assetid,
                  rotation: info.object?.properties.heading * (180 / Math.PI),
                  latitude: info.object?.properties.latitude,
                  longitude: info.object?.properties.longitude,
                  speed: info.object?.properties.speed,
                  timestamp: info.object?.properties.timestamp,
                },
              },
            };

            setHoverInfo(formattedInfo as any);
            zoom_on_pin(
              info.object?.properties.longitude,
              info.object?.properties.latitude,
              false,
              setViewState,
              viewState,
              camera_movement,
            );
          },
          updateTriggers: {
            data: positions,
          },
        }),
      );
    }

    return baseLayers;
  }, [
    geoJson,
    positions,
    processedGeofence,
    rotation,
    viewState.zoom,
    filteredLocationData,
    selectedPulse,
    displayPosition,
    camera_movement,
    showStops,
  ]);

  // Handle errors and loading states
  React.useEffect(() => {
    if (geofence_error) {
      console.error("Error loading geofences:", geofence_error);
    }

    if (geofence_isLoading) {
      console.log("Loading geofences...");
    }
  }, [geofence_error, geofence_isLoading]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      <DeckGL
        initialViewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={handleViewStateChange}
        getCursor={({ isHovering }) => {
          if (isHovering) return "pointer";
          return "grab";
        }}
      >
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          mapStyle={mapboxStyles[mapStyle as keyof typeof mapboxStyles]}
          attributionControl={true}
          style={{ position: "relative" }}
        >
          <style jsx global>{`
            .mapboxgl-ctrl-logo {
              display: none !important;
            }
          `}</style>
        </Map>
      </DeckGL>
      {/*
      <div className="absolute bottom-10 left-5 z-40 flex flex-col gap-2">
        <MapButton
          main_color="bg-white dark:bg-gray-800"
          button_color="bg-white dark:bg-gray-800"
          border={
            showStops ? "border-2 border-gray-700 dark:border-gray-300" : ""
          }
          icon={BsSignStop}
          text={
            showStops
              ? (((dict as I18nRecord).geographic_view as I18nRecord)
                  .hide_stops as string)
              : (((dict as I18nRecord).geographic_view as I18nRecord)
                  .show_stops as string)
          }
          open_to_left={false}
          onClick={() => {
            setShowStops(!showStops);
          }}
          disable_label_after_click={true}
        />
        <MapStyleSelector
          dict={dict}
          selectedStyle={mapStyle}
          setSelectedStyle={setMapStyle}
        />
      </div>
      */}
      {hoverInfo && (
        <MapTooltip
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
      <div className="absolute w-full h-full flex flex-row justify-end items-start gap-2 pointer-events-none">
        <ImageSelector images={pictures_list} />
        <ToolBar
          positions={positions ?? []}
          displayPosition={displayPosition}
          setDisplayPosition={setDisplayPosition}
          zoom_on_pin={zoom_on_pin}
          setViewState={setViewState}
          viewState={viewState}
          selectedStyle={mapStyle}
          setSelectedStyle={setMapStyle}
          camera_movement={camera_movement}
          setCameraMovement={setCameraMovement}
        />
      </div>
      <div className="absolute left-0 top-5 bg-white dark:bg-gray-800 rounded-r-full border-r border-y border-gray-400 dark:border-gray-700">
        {isLoading ? (
          <div className="flex items-center justify-center h-full p-2">
            <Spinner />
          </div>
        ) : !isLoading && positions?.length === 0 ? (
          <div className="flex items-center justify-center h-full p-2">
            <p className="text-gray-500 dark:text-gray-400 font-light">
              {
                ((dict as I18nRecord).geographic_view as I18nRecord)
                  .no_data_found as string
              }
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
