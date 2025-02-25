"use client";

import React, { useEffect, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./pin_layer_clustered";
import MapButton from "./map-button";
import SideBar from "./side-bar/side-bar";
import { BsStars } from "react-icons/bs";
import { PulsePinLayer } from "./pulse";
import Map from "react-map-gl";
import { MapPosition, MapPositionProperties } from "../types/map";
import { useTripPositions } from "../hooks/use-trip-positions";

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
  zoom: 6.5,
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
  dict: any;
  specific_view?: boolean;
  tripId: string;
};

function zoom_on_pin(
  object: any,
  setViewState: (viewState: ViewStateType) => void,
  viewState: ViewStateType,
) {
  if (object) {
    const longitude = object.geometry.coordinates[0];
    const latitude = object.geometry.coordinates[1];

    setViewState({
      ...viewState,
      longitude,
      latitude,
      zoom: object.properties.cluster ? viewState.zoom + 2.0 : 15.0,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    });
  }
}

export default function MapVisualizationTrip({
  dict,
  specific_view = false,
  tripId,
}: MapVisualizationProps) {
  const [rotation, setRotation] = useState(0);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const { positions, loading, error } = useTripPositions(tripId);

  // Use positions to update your map
  useEffect(() => {
    if (positions.length > 0) {
      // Update map with new positions
      //console.log("New positions received:", positions.length);
      console.log(positions);
    }
  }, [positions]);

  // Set initial view state when data is first received
  /* React.useEffect(() => {
    if (positions && positions.length > 0) {
      const firstPosition = positions[0];
      const newViewState = {
        ...INITIAL_VIEW_STATE,
        longitude: firstPosition.longitude,
        latitude: firstPosition.latitude,
        zoom: 6.5, // Slightly closer zoom to see the vehicle better
        transitionDuration: 2000,
      };
      setViewState(newViewState);

      layers = [
        new PinLayer({
          data: positions || [],
          zoom: viewState.zoom,
          onClick: ({ object }: { object: any }) => {
            zoom_on_pin(object, setViewState, viewState);
          },
          updateTriggers: {
            data: positions,
          },
        }),
      ];
    }
  }, [positions]); */

  // Transform API data to GeoJSON format
  const geoJson = React.useMemo(
    () => ({
      type: "FeatureCollection",
      features:
        positions?.map((item: MapPosition) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [item?.longitude, item?.latitude],
          },
          properties: {
            color: stateToColor[item.status as keyof typeof stateToColor] || [
              0, 0, 0,
            ],
            rotation: item.heading * (180 / Math.PI),
            licensePlate: item.asset_id,
            driver: item.driver_id,
            trip: item.trip_id,
          },
        })) || [],
    }),
    [positions],
  );

  const layers = [
    new PulsePinLayer({
      data: geoJson,
      rotation,
      zoom: viewState.zoom,
      updateTriggers: {
        data: positions,
      },
    }),
    new PinLayer({
      data: positions ? [positions[0]] : [],
      zoom: viewState.zoom,
      onClick: ({ object }: { object: any }) => {
        zoom_on_pin(object, setViewState, viewState);
      },
      updateTriggers: {
        data: positions,
      },
    }),
  ];

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    console.error("Map error:", error);
    // Continue rendering with empty data instead of showing error
  }

  return (
    <div className="h-full w-full relative overflow-hidden">
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        getTooltip={({ object }: PickingInfo<MapPositionProperties>) => {
          if (object) {
            if (object.properties.cluster) {
              return null;
            }
            return {
              text: `Patente: ${object.properties.asset_id}\n Servicio: ${object.properties.trip_id}\n Fecha y Hora: ${new Date(object.properties.timestamp).toLocaleString()}`,
            };
          }
          return null;
        }}
      >
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          viewState={viewState}
          mapStyle={mapboxStyles["satellite-streets-v11"]}
        />
        {!specific_view ? (
          <div className="w-full h-full flex justify-between absolute">
            <div className="m-5 gap-[14px] flex flex-col">
              {/* <MapButton
                main_color="bg-white dark:bg-gray-800"
                button_color="bg-white dark:bg-gray-800"
                icon={HiChevronLeft}
                text="Este es un texto de ejemplo"
              />
              <MapButton
                main_color="bg-white dark:bg-gray-800"
                button_color="bg-white dark:bg-gray-800"
                icon={HiChevronLeft}
                text="Este es otro texto de ejemplo"
              />
              <MapButton
                main_color="bg-white dark:bg-gray-800"
                button_color="bg-white dark:bg-gray-800"
                icon={HiChevronLeft}
                text="Este es el ultimo texto de ejemplo aaaaa"
              />
              <MapButton
                main_color="bg-white dark:bg-gray-800"
                button_color="bg-white dark:bg-gray-800"
                icon={HiChevronLeft}
                text="Este es el ultimo texto de ejemplo aaaaa"
              />
              <MapButton
                main_color="bg-white dark:bg-gray-800"
                button_color="bg-white dark:bg-gray-800"
                icon={HiChevronLeft}
                text="Este es el ultimo texto de ejemplo aaaaa"
              />
              <MapButton
                main_color="bg-white dark:bg-gray-800"
                button_color="bg-white dark:bg-gray-800"
                icon={HiChevronLeft}
                text="Este es el ultimo texto de ejemplo aaaaa"
              /> */}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-end absolute p-5 flex-col">
            <MapButton
              main_color="bg-white dark:bg-gray-800"
              button_color="bg-white dark:bg-gray-800"
              icon={BsStars}
              text="Copilot"
              open_to_left={true}
            />
          </div>
        )}
      </DeckGL>
      <div className="absolute right-0 top-0 bottom-0">
        <SideBar dict={dict} />
      </div>
      {/* Rotation test elements */}
      <div className="invisible absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rotation: {rotation}°
        </label>
        <input
          type="range"
          min="0"
          max="360"
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="w-64 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}
