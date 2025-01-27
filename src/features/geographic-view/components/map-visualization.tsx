"use client";

import React, { useState } from "react";
import Map from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import { PinLayer } from "./pin_layer_clustered";
import { HiChevronLeft } from "react-icons/hi";
import { Button } from "flowbite-react";
import MapButton from "./map-button";
import SideBar from "./side-bar/side-bar";

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
const INITIAL_VIEW_STATE = {
  longitude: -70.668505,
  latitude: -33.439764,
  zoom: 10,
  pitch: 0,
  transitionDuration: 1000,
  transitionInterpolator: new FlyToInterpolator(),
  transitionEasing: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

const GenerateRandomPositions = (numberOfPositions: number) => {
  return Array.from({ length: numberOfPositions }, () => ({
    longitude: Math.random() * 360 - 180,
    latitude: Math.random() * 180 - 90,
    rotation: Math.random() * 360,
  }));
};

const positions = GenerateRandomPositions(1000);

export default function MapVisualization() {
  const [rotation, setRotation] = useState(0); // Add rotation state
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const layers = [
    new PinLayer({
      data: positions,
      zoom: viewState.zoom,
      rotation,
    }),
  ];

  return (
    <div className="h-full w-full absolute">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
      >
        <Map
          viewState={viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          initialViewState={{
            longitude: 0.45,
            latitude: 51.47,
            zoom: 10,
          }}
          mapStyle={mapboxStyles["satellite-v9"]}
        />
        <div className="w-full h-full flex justify-between">
          <div className="m-5 gap-[14px] flex flex-col">
            <MapButton
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
            />
          </div>
          <SideBar />
        </div>
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
