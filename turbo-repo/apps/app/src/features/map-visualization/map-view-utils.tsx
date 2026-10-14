import { MapRef } from "react-map-gl";

export function flyTo(
  mapRef: MapRef,
  coordinates: [number, number],
  zoom?: number,
  bearing: number = 0,
  pitch: number = 0
) {
  const flyToOptions: any = {
    center: [coordinates[0], coordinates[1]] as [number, number],
    duration: 1000,
  };

  if (zoom) {
    flyToOptions.zoom = zoom;
  }

  if (bearing) {
    flyToOptions.bearing = bearing;
  }

  if (pitch) {
    flyToOptions.pitch = pitch;
  }

  mapRef.flyTo(flyToOptions);
}

/**
 * Returns [lng, lat] when both are finite numbers, otherwise null, so callers
 * skip the camera move instead of sending the map to [0, 0].
 */
export function toLngLat(
  longitude: number | null | undefined,
  latitude: number | null | undefined
): [number, number] | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude as number, latitude as number];
}

/** Zoom used when the user clicks a vehicle that is shown on its own. */
export const VEHICLE_FOCUS_ZOOM = 12;

/**
 * Flies to a clicked vehicle and zooms in on it. Only for a vehicle shown on
 * its own; on fleet maps the click just recenters. Never zooms out if the
 * user is already closer than VEHICLE_FOCUS_ZOOM.
 */
export function zoomToVehicle(
  mapRef: Pick<MapRef, "getZoom" | "flyTo">,
  coordinates: [number, number]
) {
  mapRef.flyTo({
    center: [coordinates[0], coordinates[1]],
    zoom: Math.max(mapRef.getZoom(), VEHICLE_FOCUS_ZOOM),
    duration: 1000,
  });
}

// Recenters the map on a point while keeping the user's current zoom, pitch
// and bearing — used to follow a moving element without zooming into it.
export function panTo(
  mapRef: MapRef,
  coordinates: [number, number],
  duration: number = 300
) {
  mapRef.easeTo({
    center: [coordinates[0], coordinates[1]] as [number, number],
    duration,
  });
}

export function center_in_bounds(
  data: { longitude: number; latitude: number }[],
  mapRef: MapRef,
  isLoading: boolean
) {
  // Here each time data gets updated, we will get the 2 farthest coordinates, and generate a zoom in screen
  // To have visualization between both of them
  if (!data || data.length === 0) return;

  const coordinates = data.map((signal) => [signal.longitude, signal.latitude]);

  if (!isLoading) {
    if (coordinates.length === 1 && coordinates[0].length === 2) {
      // If only one point, center on it with a reasonable zoom level
      flyTo(mapRef, [coordinates[0][0], coordinates[0][1]], 5, 45, 45);
    } else if (coordinates.length > 1) {
      // Calculate bounding box
      const lngs = coordinates.map((coord) => coord[0]);
      const lats = coordinates.map((coord) => coord[1]);

      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      // Fit map to bounds with padding
      mapRef.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: 50,
          duration: 1000,
          maxZoom: 8,
          pitch: 45,
          bearing: 45,
        }
      );
    }
  }
}
