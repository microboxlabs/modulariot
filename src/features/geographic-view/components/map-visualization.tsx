"use client";

import React, { useEffect, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./pin_layer_clustered";
import SideBar from "./side-bar/side-bar";
import { PulsePinLayer } from "./pulse";
import Map from "react-map-gl";
import {
  MapPosition,
  MapPositionProperties,
  MapPositionResume,
} from "../types/map";
import Filters from "./filters";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

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
  longitude: 0,
  latitude: 0,
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

type MapVisualizationProps = {
  mapPositions: MapPosition[] | null;
  dict: I18nRecord;
  specific_view?: boolean;
  mapPositionsResume: MapPositionResume;
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

export default function MapVisualization({
  mapPositions,
  mapPositionsResume,
  dict,
  specific_view = false,
}: MapVisualizationProps) {
  const [rotation, _] = useState(0);
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [originalPositions, setOriginalPositions] = useState<MapPosition[]>([]);

  useEffect(() => {
    if (mapPositions) {
      setPositions(mapPositions);
      setOriginalPositions(mapPositions); // Store original unfiltered positions
    }
  }, [mapPositions]);

  // GET THE AVERAGE OF THE LONGITUDE AND LATITUDE OF THE MAP POSITIONS
  const NEW_INITIAL_VIEW_STATE = {
    ...INITIAL_VIEW_STATE,
    longitude:
      mapPositions && mapPositions.length > 0
        ? mapPositions.reduce((acc, pos) => acc + pos.longitude, 0) /
          mapPositions.length
        : 0,
    latitude:
      mapPositions && mapPositions.length > 0
        ? mapPositions.reduce((acc, pos) => acc + pos.latitude, 0) /
          mapPositions.length
        : 0,
  };

  const [viewState, setViewState] = useState(NEW_INITIAL_VIEW_STATE);

  // Set initial view state when data is first received
  /* React.useEffect(() => {
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
  }, [mapPositions]); */

  // Transform API data to GeoJSON format
  const geoJson = React.useMemo(
    () => ({
      type: "FeatureCollection",
      features:
        positions?.map((item: MapPosition) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [item.longitude, item.latitude],
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

  /*
  // here we make a check for duplicated elements in map mapPositions
  const asset_id_counter = mapPositions?.reduce((acc: any, item) => {
    acc[item.asset_id] = (acc[item.asset_id] || 0) + 1;
    return acc;
  }, {});

  console.log(asset_id_counter);
  */

  const layers = !specific_view
    ? [
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
      ]
    : [
        new PulsePinLayer({
          data: geoJson,
          rotation,
          zoom: viewState.zoom,
        }),
        new PinLayer({
          data: positions ? [positions[0]] : [],
          zoom: viewState.zoom,
          onClick: ({ object }: { object: any }) => {
            zoom_on_pin(object, setViewState, viewState);
          },
          getElevation: 1,
        }),
      ];

  return (
    <div className="h-full w-full relative overflow-hidden">
      <DeckGL
        initialViewState={viewState}
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
          mapStyle={mapboxStyles["satellite-streets-v11"]}
        />
        <Filters
          dict={dict}
          originalPositions={originalPositions}
          setPositions={setPositions}
        />
        <div className="absolute right-0 top-0 bottom-0">
          <SideBar dict={dict} mapPositionsResume={mapPositionsResume} />
        </div>
      </DeckGL>
    </div>
  );
}
