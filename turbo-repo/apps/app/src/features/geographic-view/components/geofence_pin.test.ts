import type { Layer } from "deck.gl";
import { expect, it } from "vitest";
import { GeofencePinLayer, nameBadges } from "./geofence_pin";

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
          properties: { location_type: 1, name: " Planta Lo Aguirre " },
        },
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: { location_type: 2, name: "CD Quilicura" },
        },
      ],
    },
  });

  const [pins] = layer.renderLayers() as Layer[];
  expect(pins.props.data).toEqual([
    {
      id: "",
      coordinates: [1, 0.5],
      location_type: 1,
      name: "Planta Lo Aguirre",
    },
    { id: "", coordinates: [1, 0.5], location_type: 2, name: "CD Quilicura" },
  ]);
});

it("badges the origin and destination by geofence name, once per geofence", () => {
  const pin = (id: string, location_type: number, name: string) => ({
    id,
    coordinates: [-70.6, -33.4] as [number, number],
    location_type,
    name,
  });

  const badges = nameBadges([
    pin("10", 1, "Planta Lo Aguirre"),
    pin("20", 2, "CD Quilicura"),
    pin("30", 3, "Parada"),
    pin("40", 2, ""),
    // origin and destination on the same geofence: one badge
    pin("10", 2, "Planta Lo Aguirre"),
  ]);

  expect(badges).toEqual([
    {
      id: "trip-geofence-10",
      name: "Planta Lo Aguirre",
      color: "",
      icon: "",
      sinIcono: true,
      ancla: [-33.4, -70.6],
      abajo: true,
    },
    {
      id: "trip-geofence-20",
      name: "CD Quilicura",
      color: "",
      icon: "",
      sinIcono: true,
      ancla: [-33.4, -70.6],
      abajo: true,
    },
  ]);
});
