"use client";

import Map, {
  Marker,
  NavigationControl,
  type MapMouseEvent,
  type MarkerDragEvent,
} from "react-map-gl";
import { Spinner } from "flowbite-react";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import "mapbox-gl/dist/mapbox-gl.css";

interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

/** A Mapbox map where a click or a drag of the marker sets the point. */
export default function PointPicker({
  center,
  point,
  onPoint,
  label,
}: Readonly<{
  center: Point;
  point: Point | null;
  onPoint: (point: Point) => void;
  label: string;
}>) {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig?.MAPBOX_API_KEY?.trim() ?? "";
  if (!token) {
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
