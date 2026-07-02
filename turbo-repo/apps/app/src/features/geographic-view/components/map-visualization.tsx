"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css"; // for the base style of mapbox maps
import type { PickingInfo } from "@deck.gl/core";
import { PinLayer } from "./layers/pin_layer_clustered";
import SideBar from "./side-bar/side-bar";
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
import { MapRef } from "react-map-gl";
import MapVisualizationGeneric from "@/features/map-visualization/map-visualization";

type MapVisualizationProps = {
  mapPositions: MapPosition[] | null;
  dict: I18nRecord;
  mapPositionsResume: MapPositionResume;
  isLoading: boolean;
};

import {
  center_in_bounds,
  flyTo,
} from "@/features/map-visualization/map-view-utils";

export default function MapVisualization({
  mapPositions,
  mapPositionsResume,
  dict,
  isLoading,
}: MapVisualizationProps) {
  const [hoverInfo, setHoverInfo] =
    useState<PickingInfo<MapPositionProperties>>();
  const [positions, setPositions] = useState<MapPosition[]>([]);
  const [originalPositions, setOriginalPositions] = useState<MapPosition[]>([]);
  const [mapStyle, setMapStyle] = useState("satellite");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("licensePlate") || "");

  const [zoom, setZoom] = useState(2);

  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (mapPositions) {
      setPositions(mapPositions);
      setOriginalPositions(mapPositions); // Store original unfiltered positions
    }
  }, [mapPositions]);

  useEffect(() => {
    setSearch(searchParams.get("licensePlate") || "");
  }, [searchParams.get("licensePlate")]);

  useEffect(() => {
    if (
      !isLoading &&
      mapRef.current &&
      mapPositions &&
      mapPositions.length > 0
    ) {
      center_in_bounds(positions || [], mapRef.current, isLoading);
    }
  }, [isLoading, mapRef.current]);

  useEffect(() => {
    if (search && search != "") {
      const filteredPositions = originalPositions.filter((position: any) =>
        position.asset_id.toLowerCase().includes(search.toLowerCase())
      );
      setPositions(filteredPositions || []);
      if (filteredPositions && filteredPositions.length > 0 && mapRef.current) {
        center_in_bounds(filteredPositions, mapRef.current, false);
      }
    } else if (originalPositions.length != positions.length) {
      setPositions(originalPositions);
    }
  }, [search, originalPositions]);

  const onPinClick = useCallback(
    ({ object, viewport }: { object: any; viewport: any }) => {
      // Only show tooltip for non-clustered pins
      if (!object.properties.cluster && mapRef.current) {
        flyTo(mapRef.current, [
          object.geometry.coordinates[0],
          object.geometry.coordinates[1],
        ]);
        setHoverInfo({
          object,
          x: viewport.width / 2, // Center horizontally
          y: viewport.height / 2, // Center vertically + offset down by 100px
        } as PickingInfo<MapPositionProperties>);
      } else {
        if (mapRef.current) {
          flyTo(
            mapRef.current,
            [object.geometry.coordinates[0], object.geometry.coordinates[1]],
            zoom + 2
          );
        }
        setHoverInfo(undefined);
      }
    },
    [setHoverInfo, zoom]
  );

  const layers = [
    new PinLayer({
      data: positions || [],
      zoom: zoom,
      onClick: ({ object, viewport }: { object: any; viewport: any }) => {
        onPinClick({ object, viewport });
      },
      updateTriggers: {
        data: positions,
      },
      pickable: true,
    }),
  ];

  return (
    <div className="h-full w-full relative overflow-hidden">
      <MapVisualizationGeneric
        rounded={false}
        mapStyle={
          mapStyle as
            | "satellite"
            | "streets"
            | "dark"
            | "light"
            | "outdoors"
            | "hybrid"
        }
        layers={layers}
        isLoading={false}
        mapRef={mapRef}
        onZoomChange={(zoom) => {
          setZoom(zoom || 2);
        }}
      />
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
      <div className="absolute right-0 top-0 bottom-0 pointer-events-none">
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
