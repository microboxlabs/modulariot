import { describe, expect, it } from "vitest";
import { anclaDeFeature, anclaLugar, itemsDesdeFC } from "./place-labels";

describe("place labels", () => {
  it("builds parent and child chips from the painted geofence polygons", () => {
    const fc = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            name: "geofence 1 de prueba",
            place_id: "park",
            inner: false,
            radius_m: 250,
            color: "#1C64F2",
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-70.1, -33.1],
                [-69.9, -33.1],
                [-69.9, -32.9],
                [-70.1, -32.9],
                [-70.1, -33.1],
              ],
            ],
          },
        },
        {
          type: "Feature" as const,
          properties: {
            name: "Lote VIP",
            place_id: "lot",
            inner: true,
            parent_id: "park",
            radius_m: 40,
            color: "#E02424",
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-70.01, -33.01],
                [-69.99, -33.01],
                [-69.99, -32.99],
                [-70.01, -32.99],
                [-70.01, -33.01],
              ],
            ],
          },
        },
      ],
    };
    const items = itemsDesdeFC(fc);
    expect(items.map((i) => i.name)).toEqual([
      "geofence 1 de prueba",
      "Lote VIP",
    ]);
    expect(items[0]).toMatchObject({
      inner: false,
      id: "park",
      radio_m: 250,
    });
    expect(items[1]).toMatchObject({
      inner: true,
      id: "lot",
      parentId: "park",
      radio_m: 40,
    });
  });

  it("anchors circles at the centre and polygons at the centroid", () => {
    expect(anclaLugar({ center: [1, 2], polygon: null })).toEqual([1, 2]);
    expect(
      anclaLugar({
        center: [9, 9],
        polygon: [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
        ],
      })
    ).toEqual([1, 1]);
  });

  it("anchors a route's badge at the middle vertex of its line", () => {
    expect(
      anclaDeFeature({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [-70, -33],
            [-71, -34],
            [-72, -35],
          ],
        },
      })
    ).toEqual([-34, -71]);
  });
});
