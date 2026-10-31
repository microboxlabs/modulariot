"use client";

import Map, {
  Marker,
  NavigationControl,
  type MapMouseEvent,
  type MarkerDragEvent,
} from "react-map-gl";
import { useEffect, useState } from "react";
import { Spinner } from "flowbite-react";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import "mapbox-gl/dist/mapbox-gl.css";

interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

function hasWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

/**
 * A Mapbox map where a click or a drag of the marker sets the point. Without WebGL the map cannot draw, so it
 * shows `unavailable` instead.
 */
export default function PointPicker({
  center,
  point,
  onPoint,
  label,
  unavailable,
}: Readonly<{
  center: Point;
  point: Point | null;
  onPoint: (point: Point) => void;
  label: string;
  unavailable: string;
}>) {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig?.MAPBOX_API_KEY?.trim() ?? "";
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(hasWebGL()), []);
  if (webgl === false) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 p-6 text-center text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
        {unavailable}
      </div>
    );
  }
  if (!token || webgl === null) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }
  const pick = (event: MapMouseEvent) =>
    onPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
  const drag = (event: MarkerDragEvent) =>
    onPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });

  return (
    <div
      className="h-full w-full overflow-hidden rounded-lg"
      role="application"
      aria-label={label}
    >
      <Map
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        initialViewState={{ ...center, zoom: point ? 16 : 12 }}
        cursor="crosshair"
        onClick={pick}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {point && (
          <Marker
            latitude={point.latitude}
            longitude={point.longitude}
            draggable
            onDragEnd={drag}
            color="#1C64F2"
          />
        )}
      </Map>
    </div>
  );
}
