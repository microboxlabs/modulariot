"use client";

import React, { useEffect, useState, useCallback } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import DeckGL, { FlyToInterpolator, type MapViewState } from "deck.gl";
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./layers/pin_layer_clustered";
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

type MapVisualizationProps = {
  mapPositions: MapPosition[] | null;
  dict: I18nRecord;
  mapPositionsResume: MapPositionResume;
};

function zoom_on_position(
  positions: MapPosition[],
  setViewState: (viewState: MapViewState) => void,
  viewState: MapViewState
) {
  if (positions && positions.length > 0) {
    const validPositions = positions.filter(
      (pos: MapPosition) =>
        typeof pos.longitude === "number" &&
        typeof pos.latitude === "number" &&
        !isNaN(pos.longitude) &&
        !isNaN(pos.latitude)
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

      // Defer the setState call to avoid updating during render
      setTimeout(() => {
        setViewState(newViewState);
      }, 0);
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
      setPositions(mapPositions);
      setOriginalPositions(mapPositions); // Store original unfiltered positions
    }
  }, [mapPositions]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
  }, [searchParams.get("search")]);

  useEffect(() => {
    if (search && search != "") {
      const filteredPositions = originalPositions.filter((position: any) =>
        position.asset_id.toLowerCase().includes(search.toLowerCase())
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

  const [viewState, setViewState] = useState<MapViewState>({
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
    zoom: 2,
    pitch: 45,
    bearing: 45,
  });

  const onPinClick = useCallback(
    ({ object, viewport }: { object: any; viewport: any }) => {
      setViewState((prevViewState) => ({
        ...prevViewState,
        zoom: object.properties.cluster
          ? prevViewState.zoom + 2
          : prevViewState.zoom,
        longitude: object.geometry.coordinates[0],
        latitude: object.geometry.coordinates[1],
        transitionInterpolator: new FlyToInterpolator({ speed: 2 }),
        transitionDuration: 500,
        transitionEasing: (t: number) =>
          t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      }));
      // Only show tooltip for non-clustered pins
      if (!object.properties.cluster) {
        setHoverInfo({
          object,
          x: viewport.width / 2, // Center horizontally
          y: viewport.height / 2, // Center vertically + offset down by 100px
        } as PickingInfo<MapPositionProperties>);
      } else {
        setHoverInfo(undefined);
      }
    },
    [setHoverInfo]
  );

  const layers = [
    new PinLayer({
      data: positions || [],
      zoom: viewState.zoom,
      onClick: ({ object, viewport }: { object: any; viewport: any }) => {
        onPinClick({ object, viewport });
      },
      updateTriggers: {
        data: positions,
      },
      pickable: true,
    }),
  ];

  const onViewStateChange = useCallback((e: any) => {
    setViewState(e.viewState);
  }, []);

  return (
    <div className="h-full w-full relative overflow-hidden">
      <DeckGL
        layers={layers}
        controller
        onViewStateChange={onViewStateChange}
        viewState={viewState}
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
        >
          <style jsx global>{`
            .mapboxgl-ctrl-logo {
              display: none !important;
            }
          `}</style>
        </Map>
      </DeckGL>
      <div className="absolute bottom-5 left-5 z-40 flex flex-col gap-2">
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
