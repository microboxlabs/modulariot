"use client";

import React, { useEffect, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./pin_layer_clustered";
import SideBar from "./side-bar/side-bar";
import Map from "react-map-gl";
import { useSearchParams } from "next/navigation";
import {
  MapPosition,
  MapPositionProperties,
  MapPositionResume,
} from "../types/map";
import Filters from "./filters";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import MapTooltip from "./map-tooltip";
import PinTooltip from "./tooltips/pin-tooltip";
import MapStyleSelector from "./map-style-selector";

const mapboxStyles = {
  streets: "mapbox://styles/mapbox/streets-v9",
  satellite: "mapbox://styles/mapbox/satellite-streets-v11",
  dark: "mapbox://styles/mapbox/dark-v10",
  light: "mapbox://styles/mapbox/light-v10",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
  hybrid: "mapbox://styles/mapbox/hybrid-v10",
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
      zoom: object.properties.cluster ? viewState.zoom + 5.0 : 15.0,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    });
  }
}

function zoom_on_position(
  positions: MapPosition[],
  setViewState: (viewState: ViewStateType) => void,
  viewState: ViewStateType,
) {
  if (positions && positions.length > 0) {
    const validPositions = positions.filter(
      (pos: MapPosition) =>
        typeof pos.longitude === "number" &&
        typeof pos.latitude === "number" &&
        !isNaN(pos.longitude) &&
        !isNaN(pos.latitude),
    );

    if (validPositions.length > 0) {
      const avgLongitude =
        validPositions.reduce((acc, pos) => acc + pos.longitude, 0) /
        validPositions.length;
      const avgLatitude =
        validPositions.reduce((acc, pos) => acc + pos.latitude, 0) /
        validPositions.length;

      const newViewState = {
        ...viewState,
        longitude: avgLongitude,
        latitude: avgLatitude,
        zoom: validPositions.length === 1 ? 12.0 : 4.0,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
        transitionEasing: (t: number) =>
          t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      };

      setViewState(newViewState);
    }
  }
}

export default function MapVisualization({
  mapPositions,
  mapPositionsResume,
  dict,
}: MapVisualizationProps) {
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<MapPositionProperties>>();
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [originalPositions, setOriginalPositions] = useState<MapPosition[]>([]);
  const [mapStyle, setMapStyle] = useState("satellite");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  useEffect(() => {
    if (mapPositions) {
      console.log(mapPositions[0]);
      setPositions(mapPositions);
      setOriginalPositions(mapPositions); // Store original unfiltered positions
    }
  }, [mapPositions]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
  }, [searchParams.get("search")]);

  useEffect(() => {
    if (search && search != "") {
      const filteredPositions = originalPositions?.filter((position: any) =>
        position.asset_id.toLowerCase().includes(search.toLowerCase()),
      );
      setPositions(filteredPositions || []);
      if (filteredPositions && filteredPositions.length > 0) {
        zoom_on_position(filteredPositions, setViewState, viewState);
      }
    } else {
      setPositions(originalPositions);
      if (originalPositions && originalPositions.length > 0) {
        zoom_on_position(originalPositions, setViewState, viewState);
      }
    }
  }, [search, originalPositions]);

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
      onClick: ({ object, viewport }: { object: any; viewport: any }) => {
        // Only show tooltip for non-clustered pins
        if (!object.properties.cluster) {
          setHoverInfo({
            object,
            x: viewport.width / 2, // Center horizontally
            y: viewport.height / 2, // Center vertically + offset down by 100px
          } as PickingInfo<MapPositionProperties>);
        }
        zoom_on_pin(object, setViewState, viewState);
      },
      updateTriggers: {
        data: positions,
      },
      pickable: true,
    }),
  ];

  return (
    <div className="h-full w-full relative overflow-hidden">
      <DeckGL
        initialViewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        getCursor={({ isDragging, isHovering }) => {
          if (isDragging) return "grabbing";
          if (isHovering) return "pointer";
          return "grab";
        }}
      >
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_KEY}
          mapStyle={mapboxStyles[mapStyle as keyof typeof mapboxStyles]}
          preserveDrawingBuffer={true}
        />
      </DeckGL>
      <div className="absolute bottom-10 left-5 z-40 flex flex-col gap-2">
        <MapStyleSelector
          dict={dict}
          selectedStyle={mapStyle}
          setSelectedStyle={setMapStyle}
        />
      </div>
      <div className="absolute left-0 top-0 bottom-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <Filters
            dict={dict}
            originalPositions={originalPositions}
            setPositions={setPositions}
          />
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 ">
        {mapPositionsResume && mapPositionsResume?.sections?.length > 0 && (
          <SideBar
            dict={dict}
            mapPositionsResume={mapPositionsResume}
            mapPositions={mapPositions || []}
          />
        )}
      </div>
      {hoverInfo && (
        <MapTooltip
          left={hoverInfo.x}
          top={hoverInfo.y}
          setHoverInfo={setHoverInfo}
        >
          <PinTooltip object={hoverInfo.object} dict={dict} />
        </MapTooltip>
      )}
    </div>
  );
}
