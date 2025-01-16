"use client";

import React from "react";
import Map from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";

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

export default function MapVisualization() {
  /* 
const layers = [
  // Here we will add the layers of information that will be displayed in front of the map
];
*/

  return (
    <div className="h-full w-full absolute">
      <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={true}>
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          initialViewState={{
            longitude: 0.45,
            latitude: 51.47,
            zoom: 11,
          }}
          mapStyle={mapboxStyles["satellite-streets-v11"]}
        />
      </DeckGL>
    </div>
  );
}
