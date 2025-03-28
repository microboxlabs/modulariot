"use client";

import React, { useEffect, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./pin_layer_clustered";
import SideBar from "./side-bar/side-bar";
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

type MapVisualizationProps = {
  mapPositions: MapPosition[] | null;
  dict: I18nRecord;
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
}: MapVisualizationProps) {
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

  const layers = [
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
              html: `
                <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    ${(dict.symptoms as I18nRecord).license_plate}: ${object.properties.asset_id}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-300">
                    ${(dict.geographic_view as I18nRecord).trip}: ${object.properties.trip_id}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-300">
                    ${(dict.geographic_view as I18nRecord).date_and_time}: ${new Date(object.properties.timestamp).toLocaleString()}
                  </div>
                  <hr class="my-2 border-gray-200 dark:border-gray-700">
                  <div class="text-sm text-gray-600 dark:text-gray-300">
                    ${(dict.geographic_view as I18nRecord).speed}: <span class="font-bold ${object.properties.speed_limit && object.properties.speed > object.properties.speed_limit ? "text-red-500" : "text-green-500"}">${object.properties.speed}<span class="font-light"> km/h</span></span> ${object.properties.speed_limit && object.properties.speed > object.properties.speed_limit ? "<span class='text-red-500'> - " + (object.properties.speed - object.properties.speed_limit) + "km/h" + (dict.geographic_view as I18nRecord).over_limit + "</span>" : ""}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-300 ${object.properties.speed_limit ? "block" : "hidden"}">
                    ${(dict.geographic_view as I18nRecord).speed_limit}: <span class='text-green-500'>${object.properties.speed_limit}Km/h</span>
                  </div>
                </div>
              `,
              style: {
                backgroundColor: "transparent",
                border: "none",
                boxShadow: "none",
                padding: "0",
                margin: "0",
              },
            };
          }
          return null;
        }}
      >
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          mapStyle={mapboxStyles["satellite-streets-v11"]}
          preserveDrawingBuffer={true}
        />
        <Filters
          dict={dict}
          originalPositions={originalPositions}
          setPositions={setPositions}
        />
        <div className="absolute right-0 top-0 bottom-0">
          {mapPositionsResume && mapPositionsResume?.sections?.length > 0 && (
            <SideBar
              dict={dict}
              mapPositionsResume={mapPositionsResume}
              mapPositions={mapPositions || []}
            />
          )}
        </div>
      </DeckGL>
    </div>
  );
}
