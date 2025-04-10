"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./pin_layer_clustered";
import { PulsePinLayer } from "./pulse";
import Map from "react-map-gl";
import { MapPosition, MapPositionProperties } from "../types/map";
import { useGeofences } from "@/features/common/providers/client-api.provider";
import wkx, { Geometry } from "wkx";
import { GeofenceLayer } from "./geofence";
import { Spinner } from "flowbite-react";
import { GeofencePinLayer } from "./geofence_pin";
import { TreatmentsLocationResponseItemFeature } from "@/app/api/treatments/location/route.type";
import MapTooltip from "./map-tooltip";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import PulseTooltip, { PulseType } from "./tooltips/pulse-tooltip";

// This is defined so i can then try to add a "visualization selector" if the user wants the satelital view or not
const mapboxStyles = {
  "streets-v9": "mapbox://styles/mapbox/streets-v9",
  "satellite-v9": "mapbox://styles/mapbox/satellite-v9",
  "satellite-streets-v11": "mapbox://styles/mapbox/satellite-streets-v11",
  "dark-v10": "mapbox://styles/mapbox/dark-v10",
  "light-v10": "mapbox://styles/mapbox/light-v10",
  "outdoors-v11": "mapbox://styles/mapbox/outdoors-v11",
  "hybrid-v10": "mapbox://styles/mapbox/hybrid-v10",
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

type ViewStateType = {
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
  transitionInterpolator?: FlyToInterpolator;
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

const stateToColor = {
  "code black": [0, 0, 0], // Black
  critical: [244, 63, 94], // Red
  treatment: [245, 158, 11], // Yellow
  stable: [37, 99, 235], // Blue
  compromised: [190, 18, 60], // Rose 100
  observation: [190, 18, 60], // Rose 100
  remission: [13, 148, 136], // Green
  none: [180, 180, 180], // Gray for null state
};

// Convert the data to GeoJSON
/* const geoJson = {
  type: "FeatureCollection",
  features: pulsar_position_test.map((item) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: item.geometry.coordinates,
    },
    properties: {
      color: stateToColor[item.state as keyof typeof stateToColor] || [0, 0, 0], // Default to black if state is unknown
    },
  })),
}; */

/* INDIVIDUAL POSITION TEST */
type MapVisualizationProps = {
  tripId: string;
  positions: MapPosition[] | null;
  error: Error | null;
  averagePosition: {
    latitude: number;
    longitude: number;
  };
  filteredLocationData: TreatmentsLocationResponseItemFeature[] | null;
  dict: I18nRecord;
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
) {
  if (latitude && longitude) {
    setViewState({
      ...viewState,
      longitude,
      latitude,
      zoom: 15.0,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    });
  }
}

function move_to_pin(
  averagePosition: {
    latitude: number;
    longitude: number;
  },
  setViewState: (viewState: ViewStateType) => void,
  viewState: ViewStateType,
) {
  setViewState({
    ...viewState,
    longitude: averagePosition.longitude,
    latitude: averagePosition.latitude,
    zoom: 6.5,
    transitionDuration: 500,
    transitionInterpolator: new FlyToInterpolator(),
  });
}

export default function MapVisualizationTrip({
  tripId,
  positions,
  error,
  averagePosition,
  filteredLocationData,
  dict,
}: MapVisualizationProps) {
  const [rotation, _] = useState(0);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<MapPositionProperties>>();
  const { geofence_data, geofence_error, geofence_isLoading } =
    useGeofences(tripId);
  const [selectedPulse, setSelectedPulse] = useState<string | null>(null);

  const handleViewStateChange = useCallback((e: any) => {
    if (e.viewState) {
      setViewState(e.viewState);
    }
  }, []);

  // Handle initial zoom when positions are loaded
  useEffect(() => {
    if (positions && positions.length > 0) {
      move_to_pin(averagePosition, setViewState, viewState);
    }
    if (filteredLocationData && filteredLocationData.length > 0) {
      move_to_pin(
        {
          latitude: filteredLocationData[0].latitude ?? 0,
          longitude: filteredLocationData[0].longitude ?? 0,
        },
        setViewState,
        viewState,
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

  const geoFilteredJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features:
        filteredLocationData?.map(
          (item: TreatmentsLocationResponseItemFeature) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [item?.longitude, item?.latitude],
            },
            properties: {
              color: stateToColor[item.status as keyof typeof stateToColor] || [
                244, 63, 94,
              ],
              //rotation: item.heading * (180 / Math.PI),
              //licensePlate: item.asset_id,
              //driver: item.driver_id,
              //trip: item.trip_id,
            },
          }),
        ) || [],
    }),
    [filteredLocationData],
  );

  // Memoize the geofence processing
  const processedGeofence = React.useMemo(() => {
    if (!geofence_data?.data || geofence_data?.data.length === 0) return null;

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
          updateTriggers: {
            data: positions,
            selectedPulse,
          },
          pickable: true,
          onClick: (info: PickingInfo<MapPositionProperties>) => {
            setHoverInfo(info);
            setSelectedPulse(info.object?.properties.id ?? null);
          },
          selectedPulse,
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
            );
            return true;
          },
        }),
      );
    }

    if (positions?.length != 0) {
      baseLayers.push(
        new PinLayer({
          data: positions ? [positions[positions.length - 1]] : [],
          zoom: viewState.zoom,
          onClick: ({ object }: { object: any }) => {
            zoom_on_pin(
              object.geometry.coordinates[0],
              object.geometry.coordinates[1],
              false,
              setViewState,
              viewState,
            );
          },
          updateTriggers: {
            data: positions,
          },
        }),
      );
    }

    if (filteredLocationData && filteredLocationData.length > 0) {
      baseLayers.push(
        new PulsePinLayer({
          data: geoFilteredJson,
          //color: [244, 63, 94], // RED
          zoom: viewState.zoom,
          updateTriggers: {
            data: filteredLocationData,
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

  if (error) {
    console.error("Map error:", error);
  }

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
          mapStyle={mapboxStyles["satellite-streets-v11"]}
        />
      </DeckGL>
      {hoverInfo && (
        <MapTooltip
          left={hoverInfo.x}
          top={hoverInfo.y}
          setHoverInfo={setHoverInfo}
          onExitAction={() => setSelectedPulse(null)}
        >
          <PulseTooltip
            object={hoverInfo.object?.properties as unknown as PulseType}
            dict={dict}
          />
        </MapTooltip>
      )}
      <div className="absolute right-5 top-5 bottom-0">
        {/*
        <MapButton
          main_color="bg-white dark:bg-gray-800"
          button_color="bg-white dark:bg-gray-800"
          icon={BsStars}
          text="Copilot"
          open_to_left={true}
        />
        */}
      </div>
      <div className="absolute left-5 bottom-5">
        {positions?.length === 0 ? <Spinner /> : null}
      </div>
    </div>
  );
}
