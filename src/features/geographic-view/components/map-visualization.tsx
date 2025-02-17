"use client";

/* eslint-disable */

import React, { useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import { PinLayer } from "./pin_layer_clustered";
import { HiChevronLeft } from "react-icons/hi";
import MapButton from "./map-button";
import SideBar from "./side-bar/side-bar";
import { BsStars } from "react-icons/bs";
import { PulsePinLayer } from "./pulse";
import Map from "react-map-gl";
import { useMapPositions } from "../hooks/use-map-positions";
import { MapPosition } from "../types/map";
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
  pitch: 0,
  bearing: 0,
  transitionDuration: 1000,
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

/* const GenerateRandomPositions = (numberOfPositions: number) => {
  return Array.from({ length: numberOfPositions }, () => ({
    longitude: Math.random() * 360 - 180,
    latitude: Math.random() * 180 - 90,
    rotation: Math.random() * 360,
  }));
};

const positions = GenerateRandomPositions(1000); */

/* INDIVIDUAL POSITION TEST */
const individual_position_test = [
  {
    longitude: -70.668505,
    latitude: -33.439764,
    rotation: 0,
  },
];

const states = ["stable", "critical", "code black", "none"];

/* const generateRandomPulsarPositions = (count: number) => {
  return Array.from({ length: count }, () => ({
    state: states[Math.floor(Math.random() * states.length)],
    geometry: {
      coordinates: [
        Math.random() * 360 - 180, // Random longitude
        Math.random() * 180 - 90, // Random latitude
      ],
    },
  }));
};

// Example usage
const pulsar_position_test = generateRandomPulsarPositions(100000); */

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
  specific_view?: boolean;
};

export default function MapVisualization({
  specific_view = false,
}: MapVisualizationProps) {
  const [rotation, setRotation] = useState(0);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const { positions: mapPositions, loading, error } = useMapPositions();

  // Set initial view state when data is first received
  React.useEffect(() => {
    if (mapPositions && mapPositions.length > 0) {
      const firstPosition = mapPositions[0];
      const newViewState = {
        ...INITIAL_VIEW_STATE,
        longitude: firstPosition.longitude,
        latitude: firstPosition.latitude,
        zoom: 6.5, // Slightly closer zoom to see the vehicle better
        transitionDuration: 2000,
      };
      console.log("View state updated:", newViewState);
      setViewState(newViewState);
    }
  }, [mapPositions]);

  // Transform API data to GeoJSON format
  const geoJson = React.useMemo(() => ({
    type: "FeatureCollection",
    features: mapPositions?.map((item: MapPosition) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
      properties: {
        color: stateToColor[item.status as keyof typeof stateToColor] || [0, 0, 0],
        rotation: (item.heading * (180 / Math.PI)),//item.rotation,
        licensePlate: item.asset_id,//item.licensePlate,
        driver: item.driver_id,//item.driver,
        trip: item.trip_id,//item.trip,
      },
    })) || [],
  }), [mapPositions]);



  const layers = !specific_view
    ? [
      new PinLayer({
        data: mapPositions || [],
        zoom: viewState.zoom,
        rotation,
      }),
    ]
    : [
      new PulsePinLayer({
        data: geoJson,
        rotation,
      }),
      new PinLayer({
        data: mapPositions || [],
        zoom: viewState.zoom,
        rotation,
      }),
    ];

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
    </div>;
  }

  if (error) {
    console.error('Map error:', error);
    // Continue rendering with empty data instead of showing error
  }

  return (
    <div className="h-full w-full relative overflow-hidden">
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={({ viewState }) =>
          setViewState(viewState as ViewStateType)
        }
      >
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          viewState={viewState}
          mapStyle={mapboxStyles["satellite-v9"]}
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
            <SideBar />
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
