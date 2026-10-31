import { expect, it } from "vitest";
import { GeofencePinLayer } from "./geofence_pin";

it("places origin and destination flags for MultiPolygon and Polygon geofences", () => {
  const ring = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 0],
  ];
  const layer = new GeofencePinLayer({
    id: "test-geofences",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "MultiPolygon", coordinates: [[ring]] },
          properties: { location_type: 1 },
        },
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: { location_type: 2 },
        },
      ],
    },
  });

  const [pins] = layer.renderLayers();
  expect(pins.props.data).toEqual([
    { coordinates: [1, 0.5], location_type: 1 },
    { coordinates: [1, 0.5], location_type: 2 },
  ]);
});
