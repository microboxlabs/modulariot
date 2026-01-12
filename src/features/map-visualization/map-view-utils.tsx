import { MapRef } from "react-map-gl";

export function fly_to(
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
      fly_to(mapRef, [coordinates[0][0], coordinates[0][1]], 15, 45, 45);
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
          maxZoom: 18,
          pitch: 45,
          bearing: 45,
        }
      );
    }
  }
}
